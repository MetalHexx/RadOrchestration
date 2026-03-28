'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { processEvent } = require('../lib/pipeline-engine');
const {
  createMockIO,
  createBaseState,
  createExecutionState,
  createReviewState,
  createDefaultConfig,
  deepClone,
} = require('./helpers/test-helpers');

const PROJECT_DIR = '/test/project';

// ─── Local Helpers ──────────────────────────────────────────────────────────

/**
 * Remove project.updated so V13 monotonicity check does not fire.
 * The engine does not bump project.updated between mutation and validation,
 * so identical timestamps trigger V13. Deleting the field means both current
 * and proposed have undefined, and `undefined <= undefined` → NaN ≤ NaN → false.
 */
function backdateTimestamp(state) {
  delete state.project.updated;
  return state;
}

/** Create a minimal parsed-document object for the MockIO documents map. */
function makeDoc(frontmatter) {
  return { frontmatter, body: '' };
}

/**
 * Build an execution-tier state (post plan_approved) with the given number of
 * empty phases. All planning steps are complete and human_approved is true.
 * project.updated is removed for V13 safety.
 */
function makeExecutionStartState(totalPhases) {
  const phases = [];
  for (let i = 0; i < totalPhases; i++) {
    phases.push({
      name: `Phase ${i + 1}`,
      status: 'not_started',
      stage: 'planning',
      current_task: 0,
      tasks: [],
      docs: { phase_plan: null, phase_report: null, phase_review: null },
      review: { verdict: null, action: null },
    });
  }
  const state = createBaseState({
    pipeline: { current_tier: 'execution', gate_mode: 'autonomous' },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'r.md' },
        { name: 'prd', status: 'complete', doc_path: 'p.md' },
        { name: 'design', status: 'complete', doc_path: 'd.md' },
        { name: 'architecture', status: 'complete', doc_path: 'a.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'mp.md' },
      ],
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases,
    },
  });
  delete state.project.updated;
  return state;
}

// ─── Category 1: Full happy path ────────────────────────────────────────────
// Drives a single-phase, single-task project from init through display_complete.
// 15 sequential events, one per it block, shared io.

describe('Category 1: Full happy path', () => {
  const documents = {
    'mp.md': makeDoc({ total_phases: 1 }),
    'pp.md': makeDoc({ tasks: ['T01'] }),
    'tr.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
  };
  const io = createMockIO({ state: null, documents });
  let writeCount = 0;

  it('Step 1: start (no state) → spawn_research', () => {
    const result = processEvent('start', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_research');
    assert.equal(io.getWrites().length, writeCount);
    // Remove timestamp so subsequent standard-path events pass V13
    backdateTimestamp(io.getState());
  });

  it('Step 1b: research_started → spawn_research', () => {
    backdateTimestamp(io.getState());
    const result = processEvent('research_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_research');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(
      io.getState().planning.steps.find(s => s.name === 'research').status,
      'in_progress'
    );
  });

  it('Step 2: research_completed → spawn_prd', () => {
    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: 'research.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 2b: prd_started → spawn_prd', () => {
    backdateTimestamp(io.getState());
    const result = processEvent('prd_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(
      io.getState().planning.steps.find(s => s.name === 'prd').status,
      'in_progress'
    );
  });

  it('Step 3: prd_completed → spawn_design', () => {
    const result = processEvent('prd_completed', PROJECT_DIR, { doc_path: 'prd.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_design');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 3b: design_started → spawn_design', () => {
    backdateTimestamp(io.getState());
    const result = processEvent('design_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_design');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(
      io.getState().planning.steps.find(s => s.name === 'design').status,
      'in_progress'
    );
  });

  it('Step 4: design_completed → spawn_architecture', () => {
    const result = processEvent('design_completed', PROJECT_DIR, { doc_path: 'design.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_architecture');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 4b: architecture_started → spawn_architecture', () => {
    backdateTimestamp(io.getState());
    const result = processEvent('architecture_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_architecture');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(
      io.getState().planning.steps.find(s => s.name === 'architecture').status,
      'in_progress'
    );
  });

  it('Step 5: architecture_completed → spawn_master_plan', () => {
    const result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: 'arch.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_master_plan');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 5b: master_plan_started → spawn_master_plan', () => {
    backdateTimestamp(io.getState());
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_master_plan');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(
      io.getState().planning.steps.find(s => s.name === 'master_plan').status,
      'in_progress'
    );
  });

  it('Step 6: master_plan_completed → request_plan_approval', () => {
    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: 'mp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_plan_approval');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 7: plan_approved → create_phase_plan', () => {
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: 'mp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'planning');
  });

  it('Step 7b: phase_planning_started → create_phase_plan', () => {
    const result = processEvent('phase_planning_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    // Phase status transitions to in_progress; stage stays planning
    const state = io.getState();
    assert.equal(state.execution.phases[0].status, 'in_progress');
    assert.equal(state.execution.phases[0].stage, 'planning');
  });

  it('Step 8: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'pp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'executing');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'planning');
  });

  it('Step 8b: task_handoff_started → create_task_handoff', () => {
    const result = processEvent('task_handoff_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].status, 'in_progress');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'planning');
  });

  it('Step 9: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'th.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'coding');
  });

  it('Step 10: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'tr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
    // v4 semantic change: status stays 'in_progress'
    assert.equal(io.getState().execution.phases[0].tasks[0].status, 'in_progress');
  });

  it('Step 11: code_review_completed → generate_phase_report', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'cr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'complete');
  });

  it('Step 12: phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 'pr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'reviewing');
  });

  it('Step 13: phase_review_completed → spawn_final_reviewer', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'prv.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_final_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'complete');
  });

  it('Step 14: final_review_completed → request_final_approval', () => {
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: 'fr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_final_approval');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 15: final_approved → display_complete', () => {
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'display_complete');
    assert.equal(io.getWrites().length, writeCount);
  });
});

// ─── Category 2: Multi-phase, multi-task ────────────────────────────────────
// Starts post plan_approved with 2 phases. Phase 1 has 2 tasks, Phase 2 has
// 1 task. Verifies pointer advances, phase status transitions, and tier transitions.

describe('Category 2: Multi-phase multi-task', () => {
  const documents = {
    'c2-pp1.md': makeDoc({ tasks: ['T01', 'T02'] }),
    'c2-tr1.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'c2-cr1.md': makeDoc({ verdict: 'approved' }),
    'c2-tr2.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'c2-cr2.md': makeDoc({ verdict: 'approved' }),
    'c2-prv1.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
    'c2-pp2.md': makeDoc({ tasks: ['T01'] }),
    'c2-tr-p2.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'c2-cr-p2.md': makeDoc({ verdict: 'approved' }),
    'c2-prv2.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
  };
  const io = createMockIO({ state: makeExecutionStartState(2), documents });
  let writeCount = 0;

  // ── Phase 1: 2 tasks ──

  it('P1 Step 0: phase_planning_started → create_phase_plan', () => {
    const result = processEvent('phase_planning_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    // Phase 1 status transitions to in_progress; stage stays planning
    const state = io.getState();
    assert.equal(state.execution.phases[0].status, 'in_progress');
    assert.equal(state.execution.phases[0].stage, 'planning');
  });

  it('P1 Step 1: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'c2-pp1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'executing');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'planning');
  });

  it('P1 Step 1b: task_handoff_started (T01) → create_task_handoff', () => {
    const result = processEvent('task_handoff_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].status, 'in_progress');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'planning');
  });

  it('P1 Step 2: task_handoff_created (T01) → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c2-th1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'coding');
  });

  it('P1 Step 3: task_completed (T01) → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c2-tr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
    assert.equal(io.getState().execution.phases[0].tasks[0].status, 'in_progress');
  });

  it('P1 Step 4: code_review_completed (T01 approved) → create_task_handoff (T02)', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c2-cr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    // Verify pointer advanced to T02
    const state = io.getState();
    assert.equal(state.execution.phases[0].current_task, 2);
    assert.equal(state.execution.phases[0].tasks[0].stage, 'complete');
  });

  it('P1 Step 4b: task_handoff_started (T02) → create_task_handoff', () => {
    const result = processEvent('task_handoff_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[1].status, 'in_progress');
    assert.equal(io.getState().execution.phases[0].tasks[1].stage, 'planning');
  });

  it('P1 Step 5: task_handoff_created (T02) → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c2-th2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[1].stage, 'coding');
  });

  it('P1 Step 6: task_completed (T02) → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c2-tr2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[1].stage, 'reviewing');
    assert.equal(io.getState().execution.phases[0].tasks[1].status, 'in_progress');
  });

  it('P1 Step 7: code_review_completed (T02 approved) → generate_phase_report', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c2-cr2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[1].stage, 'complete');
  });

  it('P1 Step 8: phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 'c2-pr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'reviewing');
  });

  it('P1 Step 9: phase_review_completed → create_phase_plan', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'c2-prv1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    // Verify pointer advanced and phase status transitions
    const state = io.getState();
    assert.equal(state.execution.current_phase, 2);
    assert.equal(state.execution.phases[0].status, 'complete');
    assert.equal(state.execution.phases[1].status, 'not_started');
    assert.equal(state.execution.phases[0].stage, 'complete');
  });

  it('P2 Step 9b: phase_planning_started → create_phase_plan', () => {
    const result = processEvent('phase_planning_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    // Phase 2 status transitions to in_progress; stage stays planning
    const state = io.getState();
    assert.equal(state.execution.phases[1].status, 'in_progress');
    assert.equal(state.execution.phases[1].stage, 'planning');
  });

  // ── Phase 2: Full lifecycle ──

  it('P2 Step 10: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'c2-pp2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[1].status, 'in_progress');
    assert.equal(io.getState().execution.phases[1].stage, 'executing');
    assert.equal(io.getState().execution.phases[1].tasks[0].stage, 'planning');
  });

  it('P2 Step 10b: task_handoff_started → create_task_handoff', () => {
    const result = processEvent('task_handoff_started', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[1].tasks[0].status, 'in_progress');
    assert.equal(io.getState().execution.phases[1].tasks[0].stage, 'planning');
  });

  it('P2 Step 11: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c2-th-p2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[1].tasks[0].stage, 'coding');
  });

  it('P2 Step 12: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c2-tr-p2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[1].tasks[0].stage, 'reviewing');
    assert.equal(io.getState().execution.phases[1].tasks[0].status, 'in_progress');
  });

  it('P2 Step 13: code_review_completed → generate_phase_report', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c2-cr-p2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[1].tasks[0].stage, 'complete');
  });

  it('P2 Step 14: phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 'c2-pr2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[1].stage, 'reviewing');
  });

  it('P2 Step 15: phase_review_completed → spawn_final_reviewer', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'c2-prv2.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_final_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    // Verify tier transition: execution → review
    const state = io.getState();
    assert.equal(state.pipeline.current_tier, 'review');
    assert.equal(state.execution.status, 'complete');
    assert.equal(state.execution.phases[1].stage, 'complete');
  });

  it('P2 Step 16: final_review_completed → request_final_approval', () => {
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: 'c2-fr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_final_approval');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('P2 Step 17: final_approved → display_complete', () => {
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'display_complete');
    assert.equal(io.getWrites().length, writeCount);
    // Verify tier transition: review → complete
    assert.equal(io.getState().pipeline.current_tier, 'complete');
  });
});

// ─── Category 3: Cold-start resume ──────────────────────────────────────────
// Each test creates a state at a specific pipeline point, fires 'start', and
// verifies 0 writes, 0 mutations_applied, and the correct resolved action.

describe('Category 3: Cold-start resume', () => {
  it('(a) planning tier, research not started → spawn_research', () => {
    const state = createBaseState();
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_research');
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });

  it('(b) planning complete, not approved → request_plan_approval', () => {
    const state = createBaseState({
      planning: {
        status: 'complete',
        human_approved: false,
        steps: [
          { name: 'research', status: 'complete', doc_path: 'r.md' },
          { name: 'prd', status: 'complete', doc_path: 'p.md' },
          { name: 'design', status: 'complete', doc_path: 'd.md' },
          { name: 'architecture', status: 'complete', doc_path: 'a.md' },
          { name: 'master_plan', status: 'complete', doc_path: 'mp.md' },
        ],
      },
    });
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_plan_approval');
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });

  it('(c) execution tier, phase not started → create_phase_plan', () => {
    const state = makeExecutionStartState(1);
    // Restore project.updated (cold-start has no V13 concern — no write occurs)
    state.project.updated = state.project.created;
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });

  it('(d) execution tier, task not started → create_task_handoff', () => {
    const state = createExecutionState();
    state.execution.phases[0].current_task = 1;
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });

  it('(e) review tier, no final review → spawn_final_reviewer', () => {
    const state = createReviewState();
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_final_reviewer');
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });
});

// ─── Category 4: Pre-read validation failures ──────────────────────────────
// Each test provides a malformed document for a pre-read event. Asserts
// success=false, action=null, 0 writes, structured error with event and field.

describe('Category 4: Pre-read validation failures', () => {
  it('plan_approved — missing total_phases', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({
      state,
      documents: { 'bad-mp.md': makeDoc({}) },
    });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: 'bad-mp.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.context.event, 'plan_approved');
    assert.equal(result.context.field, 'total_phases');
  });

  it('task_completed — missing status', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({
      state,
      documents: { 'bad-tr.md': makeDoc({ has_deviations: false, deviation_type: null }) },
    });
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'bad-tr.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.context.event, 'task_completed');
    assert.equal(result.context.field, 'status');
  });

  it('code_review_completed — missing verdict', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({
      state,
      documents: { 'bad-cr.md': makeDoc({}) },
    });
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'bad-cr.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.context.event, 'code_review_completed');
    assert.equal(result.context.field, 'verdict');
  });

  it('phase_plan_created — empty tasks array', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({
      state,
      documents: { 'bad-pp.md': makeDoc({ tasks: [] }) },
    });
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'bad-pp.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.context.event, 'phase_plan_created');
    assert.equal(result.context.field, 'tasks');
  });

  it('phase_review_completed — missing exit_criteria_met', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({
      state,
      documents: { 'bad-prv.md': makeDoc({ verdict: 'approved' }) },
    });
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'bad-prv.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.context.event, 'phase_review_completed');
    assert.equal(result.context.field, 'exit_criteria_met');
  });
});

// ─── Category 5: Phase lifecycle ────────────────────────────────────────────
// Drives a full phase lifecycle from phase_plan_created through
// phase_review_completed. Starts from execution tier with 2 phases.
// Verifies phase status transitions, pointer advance, and review action.

describe('Category 5: Phase lifecycle', () => {
  const documents = {
    'c5-pp.md': makeDoc({ tasks: ['T01'] }),
    'c5-tr.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'c5-cr.md': makeDoc({ verdict: 'approved' }),
    'c5-prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
  };
  const io = createMockIO({ state: makeExecutionStartState(2), documents });
  let writeCount = 0;

  it('phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'c5-pp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    // Phase 1 transitioned to in_progress
    assert.equal(io.getState().execution.phases[0].status, 'in_progress');
    assert.equal(io.getState().execution.phases[0].stage, 'executing');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'planning');
  });

  it('task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c5-th.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'coding');
  });

  it('task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c5-tr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
    assert.equal(io.getState().execution.phases[0].tasks[0].status, 'in_progress');
  });

  it('code_review_completed (approved) → generate_phase_report', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c5-cr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'complete');
  });

  it('phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 'c5-pr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'reviewing');
  });

  it('phase_review_completed → create_phase_plan; phase 1 complete, pointer advances', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'c5-prv.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    // Verify phase lifecycle outcomes
    const state = io.getState();
    assert.equal(state.execution.phases[0].status, 'complete');
    assert.equal(state.execution.phases[0].review.action, 'advanced');
    assert.equal(state.execution.current_phase, 2);
    assert.equal(state.execution.phases[1].status, 'not_started');
    assert.equal(state.execution.phases[0].stage, 'complete');
  });
});

// ─── Category 6: Halt paths ────────────────────────────────────────────────

describe('Category 6: Halt paths', () => {
  describe('(a) Task halt — rejected verdict', () => {
    const state = createExecutionState({
      execution: {
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01', status: 'in_progress', stage: 'coding',
            docs: { handoff: 'h.md', report: null, review: null },
            review: { verdict: null, action: null },
            report_status: null,
            has_deviations: false, deviation_type: null,
            retries: 0,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
    delete state.project.updated;
    const documents = {
      'c6a-tr.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
      'c6a-cr.md': makeDoc({ verdict: 'rejected' }),
    };
    const io = createMockIO({ state, documents });
    let writeCount = 0;

    it('task_completed → spawn_code_reviewer', () => {
      const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c6a-tr.md' }, io);
      writeCount++;
      assert.equal(result.success, true);
      assert.equal(result.action, 'spawn_code_reviewer');
      assert.equal(io.getWrites().length, writeCount);
      assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
    });

    it('code_review_completed (rejected) → display_halted', () => {
      const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c6a-cr.md' }, io);
      writeCount++;
      assert.equal(result.success, true);
      assert.equal(result.action, 'display_halted');
      assert.equal(io.getWrites().length, writeCount);
      const task = io.getState().execution.phases[0].tasks[0];
      assert.equal(task.status, 'halted');
      assert.equal(task.review.action, 'halted');
      assert.equal(task.review.verdict, 'rejected');
      assert.equal(task.stage, 'failed');
    });
  });

  describe('(b) Task halt — retry budget exhausted', () => {
    const state = createExecutionState({
      execution: {
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01', status: 'in_progress', stage: 'coding',
            docs: { handoff: 'h.md', report: null, review: null },
            review: { verdict: null, action: null },
            report_status: null,
            has_deviations: false, deviation_type: null,
            retries: 2,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
    delete state.project.updated;
    const documents = {
      'c6b-tr.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
      'c6b-cr.md': makeDoc({ verdict: 'changes_requested' }),
    };
    const io = createMockIO({ state, documents });
    let writeCount = 0;

    it('task_completed → spawn_code_reviewer', () => {
      const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c6b-tr.md' }, io);
      writeCount++;
      assert.equal(result.success, true);
      assert.equal(result.action, 'spawn_code_reviewer');
      assert.equal(io.getWrites().length, writeCount);
      assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
    });

    it('code_review_completed (changes_requested, retries exhausted) → display_halted', () => {
      const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c6b-cr.md' }, io);
      writeCount++;
      assert.equal(result.success, true);
      assert.equal(result.action, 'display_halted');
      assert.equal(io.getWrites().length, writeCount);
      const task = io.getState().execution.phases[0].tasks[0];
      assert.equal(task.status, 'halted');
      assert.equal(task.review.action, 'halted');
      assert.equal(task.stage, 'failed');
    });
  });

  describe('(c) Phase halt — rejected', () => {
    const state = createExecutionState({
      execution: {
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'reviewing',
          current_task: 1,
          tasks: [{
            name: 'T01', status: 'complete', stage: 'complete',
            docs: { handoff: 'h.md', report: 'r.md', review: 'rv.md' },
            review: { verdict: 'approved', action: 'advanced' },
            has_deviations: false, deviation_type: null,
            retries: 0, report_status: 'complete',
          }],
          docs: { phase_plan: 'pp.md', phase_report: 'pr.md', phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
    delete state.project.updated;
    const documents = {
      'c6c-prv.md': makeDoc({ verdict: 'rejected', exit_criteria_met: false }),
    };
    const io = createMockIO({ state, documents });

    it('phase_review_completed (rejected) → display_halted', () => {
      const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'c6c-prv.md' }, io);
      assert.equal(result.success, true);
      assert.equal(result.action, 'display_halted');
      assert.equal(io.getWrites().length, 1);
      const phase = io.getState().execution.phases[0];
      assert.equal(phase.status, 'halted');
      assert.equal(phase.review.action, 'halted');
      assert.equal(phase.stage, 'failed');
    });
  });
});

// ─── Category 7: Pre-read failure flows ─────────────────────────────────────

describe('Category 7: Pre-read failure flows', () => {
  it('(a) Missing document (readDocument returns null)', () => {
    const state = createExecutionState();
    delete state.project.updated;
    // Set task to in_progress with handoff so we can fire task_completed
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].stage = 'coding';
    state.execution.phases[0].tasks[0].docs.handoff = 'h.md';
    state.execution.phases[0].current_task = 1;
    const io = createMockIO({ state, documents: {} });
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'nonexistent.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
  });

  it('(b) Null frontmatter', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({
      state,
      documents: { 'null-fm.md': { frontmatter: null, body: '' } },
    });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: 'null-fm.md' }, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
  });
});

// ─── Category 8: Review tier ────────────────────────────────────────────────

describe('Category 8: Review tier', () => {
  it('(a) final_review_completed → request_final_approval', () => {
    const state = createReviewState();
    delete state.project.updated;
    const documents = { 'fr.md': { frontmatter: {}, body: '' } };
    const io = createMockIO({ state, documents });
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: 'fr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_final_approval');
    assert.equal(io.getWrites().length, 1);
    assert.equal(io.getState().final_review.doc_path, 'fr.md');
  });

  it('(b) final_approved → display_complete', () => {
    const state = createReviewState({
      final_review: {
        doc_path: 'fr.md',
        status: 'complete',
        human_approved: false,
      },
    });
    delete state.project.updated;
    const io = createMockIO({ state });
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'display_complete');
    assert.equal(io.getWrites().length, 1);
    assert.equal(io.getState().final_review.human_approved, true);
    assert.equal(io.getState().pipeline.current_tier, 'complete');
  });
});

// ─── Category 9: CF-1 review tier end-to-end ────────────────────────────────

describe('Category 9: CF-1 review tier end-to-end', () => {
  const state = createReviewState();
  delete state.project.updated;
  const documents = { 'c9-fr.md': { frontmatter: {}, body: '' } };
  const io = createMockIO({ state, documents });
  let writeCount = 0;

  it('final_review_completed → request_final_approval', () => {
    const result = processEvent('final_review_completed', PROJECT_DIR, { doc_path: 'c9-fr.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_final_approval');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().final_review.doc_path, 'c9-fr.md');
  });

  it('final_approved → display_complete', () => {
    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'display_complete');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().final_review.human_approved, true);
    assert.equal(io.getState().pipeline.current_tier, 'complete');
  });
});

// ─── Category 10: Edge cases ────────────────────────────────────────────────

describe('Category 10: Edge cases', () => {
  it('(a) Unknown event', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({ state });
    const result = processEvent('nonexistent_event', PROJECT_DIR, {}, io);
    assert.equal(result.success, false);
    assert.equal(result.action, null);
    assert.equal(io.getWrites().length, 0);
    assert.ok(result.context.error.includes('Unknown event'));
  });

  it('(b) Non-start event with no state', () => {
    const io = createMockIO({ state: null });
    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: 'r.md' }, io);
    assert.equal(result.success, false);
    assert.equal(io.getWrites().length, 0);
    assert.ok(result.context.error.includes('No state.json found'));
  });

  it('(c) Cold-start on halted pipeline', () => {
    const state = createBaseState({
      pipeline: { current_tier: 'halted' },
    });
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'display_halted');
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });
});

// ─── Category 11: Corrective Task Flow ───────────────────────────────────

describe('Category 11 — Corrective Task Flow', () => {
  const state = createExecutionState({
    execution: {
      phases: [{
        name: 'Phase 1',
        status: 'in_progress',
        stage: 'executing',
        current_task: 1,
        tasks: [{
          name: 'T01',
          status: 'failed',
          stage: 'failed',
          docs: {
            handoff: 'c11-original-handoff.md',
            report: 'c11-report.md',
            review: 'c11-review.md',
          },
          review: {
            verdict: 'changes_requested',
            action: 'corrective_task_issued',
          },
          report_status: 'complete',
          has_deviations: false,
          deviation_type: null,
          retries: 1,
        }],
        docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
        review: { verdict: null, action: null },
      }],
    },
  });
  delete state.project.updated;

  const documents = {
    'c11-corrective-report.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
  };

  const io = createMockIO({ state, documents });
  let writeCount = 0;

  it('Step 1: task_handoff_created (corrective) → execute_task; stale fields cleared', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c11-corrective-handoff.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getWrites().length, writeCount);

    const task = io.getState().execution.phases[0].tasks[0];
    // Status and handoff set correctly
    assert.equal(task.status, 'in_progress');
    assert.equal(task.docs.handoff, 'c11-corrective-handoff.md');
    assert.equal(task.stage, 'coding');

    // All five stale fields cleared to null
    assert.equal(task.docs.report, null);
    assert.equal(task.report_status, null);
    assert.equal(task.docs.review, null);
    assert.equal(task.review.verdict, null);
    assert.equal(task.review.action, null);
  });

  it('Step 2: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c11-corrective-report.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
  });
});

// ─── Category 12: Commit-enabled happy path (auto_commit=always) ────────────

describe('Category 12: Commit-enabled happy path (auto_commit=always)', () => {
  const documents = {
    'c12-pp.md': makeDoc({ tasks: ['T01', 'T02'] }),
    'c12-th1.md': makeDoc({}),
    'c12-tr1.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'c12-cr1.md': makeDoc({ verdict: 'approved' }),
  };

  const state = makeExecutionStartState(1);
  const io = createMockIO({ state, documents });
  let writeCount = 0;

  it('Step 1: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'c12-pp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].tasks.length, 2);
    backdateTimestamp(io.getState());
  });

  it('Step 2: source_control_init → create_task_handoff', () => {
    const result = processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feat/x',
      base_branch: 'main',
      worktree_path: '/wt',
      auto_commit: 'always',
      auto_pr: 'never',
    }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getState().pipeline.source_control.auto_commit, 'always');
    backdateTimestamp(io.getState());
  });

  it('Step 3: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c12-th1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'coding');
    backdateTimestamp(io.getState());
  });

  it('Step 4: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c12-tr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
    backdateTimestamp(io.getState());
  });

  it('Step 5: code_review_completed → invoke_source_control_commit (pointer NOT bumped)', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c12-cr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'invoke_source_control_commit');
    assert.equal(io.getState().execution.phases[0].current_task, 1); // NOT bumped
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'complete');
    assert.ok(result.mutations_applied.some(m => m.includes('Deferred')));
    assert.ok(result.mutations_applied.some(m => m.includes('auto_commit')));
    backdateTimestamp(io.getState());
  });

  it('Step 6: task_commit_requested → invoke_source_control_commit (validation pass)', () => {
    const result = processEvent('task_commit_requested', PROJECT_DIR, { task_id: 'P01-T01' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'invoke_source_control_commit');
    assert.equal(io.getState().execution.phases[0].current_task, 1); // still 1
    backdateTimestamp(io.getState());
  });

  it('Step 7: task_committed → create_task_handoff (pointer bumped to T02)', () => {
    const result = processEvent('task_committed', PROJECT_DIR, { task_id: 'P01-T01', committed: true, pushed: true }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getState().execution.phases[0].current_task, 2); // bumped
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'complete');
    assert.equal(io.getState().execution.phases[0].tasks[1].stage, 'planning');
  });
});

// ─── Category 13: Commit-disabled (auto_commit=never) ───────────────────────

describe('Category 13: Commit-disabled (auto_commit=never)', () => {
  const documents = {
    'c13-pp.md': makeDoc({ tasks: ['T01'] }),
    'c13-th1.md': makeDoc({}),
    'c13-tr1.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    'c13-cr1.md': makeDoc({ verdict: 'approved' }),
  };

  const state = makeExecutionStartState(1);
  const io = createMockIO({ state, documents });
  let writeCount = 0;

  it('Step 1: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'c13-pp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    backdateTimestamp(io.getState());
  });

  it('Step 2: source_control_init (auto_commit=never) → create_task_handoff', () => {
    const result = processEvent('source_control_init', PROJECT_DIR, {
      branch: 'feat/y',
      base_branch: 'main',
      worktree_path: '/wt2',
      auto_commit: 'never',
      auto_pr: 'never',
    }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(io.getState().pipeline.source_control.auto_commit, 'never');
    backdateTimestamp(io.getState());
  });

  it('Step 3: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c13-th1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    backdateTimestamp(io.getState());
  });

  it('Step 4: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c13-tr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    backdateTimestamp(io.getState());
  });

  it('Step 5: code_review_completed → generate_phase_report (pointer bumped immediately, no commit step)', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'c13-cr1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    // Pointer should be bumped immediately and phase report generated (single task phase)
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(io.getState().execution.phases[0].current_task, 2); // bumped past last task
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'complete');
  });
});
