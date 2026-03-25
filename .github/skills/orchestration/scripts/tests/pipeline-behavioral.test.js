'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { processEvent } = require('../lib/pipeline-engine');
const {
  createMockIO,
  createBaseState,
  createBaseStateV5,
  createExecutionState,
  createReviewState,
  createDefaultConfig,
  deepClone,
} = require('./helpers/test-helpers');

const PROJECT_DIR = '/test/project';
const SC_PROJECT_DIR = __dirname;

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

  it('Step 2: research_completed → spawn_prd', () => {
    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: 'research.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 3: prd_completed → spawn_design', () => {
    const result = processEvent('prd_completed', PROJECT_DIR, { doc_path: 'prd.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_design');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 4: design_completed → spawn_architecture', () => {
    const result = processEvent('design_completed', PROJECT_DIR, { doc_path: 'design.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_architecture');
    assert.equal(io.getWrites().length, writeCount);
  });

  it('Step 5: architecture_completed → spawn_master_plan', () => {
    const result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: 'arch.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_master_plan');
    assert.equal(io.getWrites().length, writeCount);
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

  it('Step 8: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'pp.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'executing');
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

  it('P1 Step 1: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'c2-pp1.md' }, io);
    writeCount++;
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().execution.phases[0].stage, 'executing');
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

// ─── Category 12: SC — Ask activation creation paths ────────────────────────

describe('Category 12: SC — Ask activation creation paths', () => {
  it('12: ask activation + ask branch-from (full creation flow)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'ask',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const documents = { 'pp.md': makeDoc({ tasks: ['T01'] }) };
    const io = createMockIO({
      state,
      documents,
      config,
      getDefaultBranch: () => 'main',
      getCurrentBranch: () => 'develop',
    });
    let writeCount = 0;

    // Step 1: start → ask_source_control_activation (cold-start resume; 0 writes)
    const r1 = processEvent('start', SC_PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(r1.action, 'ask_source_control_activation');
    assert.equal(io.getWrites().length, 0);
    assert.equal(r1.mutations_applied.length, 0);

    // Step 2: activation_set worktree → ask_source_control_branch_from; 1 write
    const r2 = processEvent('source_control_activation_set', SC_PROJECT_DIR, { choice: 'worktree' }, io);
    writeCount++;
    assert.equal(r2.success, true);
    assert.equal(r2.action, 'ask_source_control_branch_from');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getState().pipeline.source_control.activation_choice, 'worktree');
    assert.equal(io.getCreateWorktreeCalls().length, 0);

    // Step 3: branch_from_set default → create_phase_plan; creation fires; startPoint=main
    const r3 = processEvent('source_control_branch_from_set', SC_PROJECT_DIR, { choice: 'default' }, io);
    writeCount++;
    assert.equal(r3.success, true);
    assert.equal(r3.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getCreateWorktreeCalls().length, 1);
    assert.equal(io.getCreateWorktreeCalls()[0].startPoint, 'main');
    assert.ok(io.getState().pipeline.source_control.worktree_path !== null);
    assert.ok(io.getState().pipeline.source_control.branch !== null);

    // Step 4: phase_plan_created → create_task_handoff; idempotent (still 1 creation)
    const r4 = processEvent('phase_plan_created', SC_PROJECT_DIR, { doc_path: 'pp.md' }, io);
    writeCount++;
    assert.equal(r4.success, true);
    assert.equal(r4.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getCreateWorktreeCalls().length, 1);
    assert.ok(io.getState().pipeline.source_control.worktree_path !== null);
  });

  it('12b: ask activation + config branch-from current (no branch ask)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'current',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const io = createMockIO({
      state,
      config,
      getDefaultBranch: () => 'main',
      getCurrentBranch: () => 'develop',
    });
    let writeCount = 0;

    // Step 1: start → ask_source_control_activation (cold-start resume; 0 writes)
    const r1 = processEvent('start', SC_PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(r1.action, 'ask_source_control_activation');
    assert.equal(io.getWrites().length, 0);

    // Step 2: activation_set worktree → create_phase_plan (no branch ask); creation fires; startPoint=develop
    const r2 = processEvent('source_control_activation_set', SC_PROJECT_DIR, { choice: 'worktree' }, io);
    writeCount++;
    assert.equal(r2.success, true);
    assert.equal(r2.action, 'create_phase_plan');
    assert.notEqual(r2.action, 'ask_source_control_branch_from');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getCreateWorktreeCalls().length, 1);
    assert.equal(io.getCreateWorktreeCalls()[0].startPoint, 'develop');
    assert.ok(io.getState().pipeline.source_control.worktree_path !== null);
  });
});

// ─── Category 13: SC — Ask activation skip ──────────────────────────────────

describe('Category 13: SC — Ask activation skip', () => {
  it('13: choose none → no worktree created', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'ask',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const io = createMockIO({ state, config });
    let writeCount = 0;

    // Step 1: start → ask_source_control_activation (0 writes)
    const r1 = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(r1.action, 'ask_source_control_activation');
    assert.equal(io.getWrites().length, 0);

    // Step 2: activation_set none → create_phase_plan; no creation; activation_choice=none
    const r2 = processEvent('source_control_activation_set', PROJECT_DIR, { choice: 'none' }, io);
    writeCount++;
    assert.equal(r2.success, true);
    assert.equal(r2.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getCreateWorktreeCalls().length, 0);
    assert.equal(io.getState().pipeline.source_control.worktree_path, null);
    assert.equal(io.getState().pipeline.source_control.branch, null);
    assert.equal(io.getState().pipeline.source_control.activation_choice, 'none');
  });
});

// ─── Category 14: SC — Always activation creation paths ─────────────────────

describe('Category 14: SC — Always activation creation paths', () => {
  it('14: always activation + default branch-from (auto-create)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'always',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const documents = { 'pp.md': makeDoc({ tasks: ['T01'] }) };
    const io = createMockIO({
      state,
      documents,
      config,
      getDefaultBranch: () => 'main',
      getCurrentBranch: () => 'develop',
    });
    let writeCount = 0;

    // Step 1: start → create_phase_plan (always; no ask actions; 0 writes)
    const r1 = processEvent('start', SC_PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(r1.action, 'create_phase_plan');
    assert.notEqual(r1.action, 'ask_source_control_activation');
    assert.notEqual(r1.action, 'ask_source_control_branch_from');
    assert.equal(io.getWrites().length, 0);

    // Step 2: phase_plan_created → create_task_handoff; creation fires; startPoint=main
    const r2 = processEvent('phase_plan_created', SC_PROJECT_DIR, { doc_path: 'pp.md' }, io);
    writeCount++;
    assert.equal(r2.success, true);
    assert.equal(r2.action, 'create_task_handoff');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getCreateWorktreeCalls().length, 1);
    assert.equal(io.getCreateWorktreeCalls()[0].startPoint, 'main');
    assert.ok(io.getState().pipeline.source_control.worktree_path !== null);
    assert.ok(io.getState().pipeline.source_control.branch !== null);
  });

  it('14b: always activation + ask branch-from (hybrid)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'always',
      branch_from: 'ask',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const io = createMockIO({
      state,
      config,
      getDefaultBranch: () => 'main',
      getCurrentBranch: () => 'develop',
    });
    let writeCount = 0;

    // Step 1: start → ask_source_control_branch_from (always; no activation ask; 0 writes)
    const r1 = processEvent('start', SC_PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(r1.action, 'ask_source_control_branch_from');
    assert.notEqual(r1.action, 'ask_source_control_activation');
    assert.equal(io.getWrites().length, 0);

    // Step 2: branch_from_set current → create_phase_plan; creation fires; startPoint=develop
    const r2 = processEvent('source_control_branch_from_set', SC_PROJECT_DIR, { choice: 'current' }, io);
    writeCount++;
    assert.equal(r2.success, true);
    assert.equal(r2.action, 'create_phase_plan');
    assert.equal(io.getWrites().length, writeCount);
    assert.equal(io.getCreateWorktreeCalls().length, 1);
    assert.equal(io.getCreateWorktreeCalls()[0].startPoint, 'develop');
    assert.ok(io.getState().pipeline.source_control.worktree_path !== null);
    assert.ok(io.getState().pipeline.source_control.branch !== null);
  });

  it('14c: always activation during planning tier (tier guard prevents creation)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'always',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = createBaseStateV5();
    delete state.project.updated;
    const io = createMockIO({ state, config });

    // Step 1: research_completed → spawn_prd; tier guard: planning tier, no creation
    const r1 = processEvent('research_completed', PROJECT_DIR, { doc_path: 'r.md' }, io);
    assert.equal(r1.success, true);
    assert.equal(r1.action, 'spawn_prd');
    assert.equal(io.getCreateWorktreeCalls().length, 0);
    assert.equal(io.getState().pipeline.source_control.worktree_path, null);
  });
});

// ─── Category 15: SC — Ask cleanup paths ────────────────────────────────────
const CLEANUP_WORKTREE_PATH = path.resolve(SC_PROJECT_DIR, '..', 'worktrees', 'test');

describe('Category 15: SC — Ask cleanup paths', () => {
  function makeAskCleanupConfig() {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    return config;
  }

  function makeWorktreeState() {
    const state = createReviewState({
      pipeline: {
        source_control: {
          activation_choice: 'worktree',
          branch_from_choice: 'default',
          worktree_path: CLEANUP_WORKTREE_PATH,
          branch: 'project/test',
          cleanup_choice: null,
        },
      },
    });
    delete state.project.updated;
    return state;
  }

  it('15: ask cleanup, choose remove', () => {
    const config = makeAskCleanupConfig();
    const state = makeWorktreeState();
    const io = createMockIO({ state, config });

    const result = processEvent('source_control_cleanup_set', SC_PROJECT_DIR, { choice: 'remove' }, io);
    assert.equal(result.success, true);
    assert.equal(io.getRemoveWorktreeCalls().length, 1);
    assert.equal(io.getState().pipeline.source_control.worktree_path, null);
    assert.equal(io.getState().pipeline.source_control.branch, null);
    assert.equal(io.getWrites().length, 1);
  });

  it('15b: ask cleanup, choose keep', () => {
    const config = makeAskCleanupConfig();
    const state = makeWorktreeState();
    const io = createMockIO({ state, config });

    const result = processEvent('source_control_cleanup_set', PROJECT_DIR, { choice: 'keep' }, io);
    assert.equal(result.success, true);
    assert.equal(io.getRemoveWorktreeCalls().length, 0);
    assert.equal(io.getState().pipeline.source_control.worktree_path, CLEANUP_WORKTREE_PATH);
    assert.equal(io.getState().pipeline.source_control.branch, 'project/test');
    assert.equal(io.getState().pipeline.source_control.cleanup_choice, 'keep');
  });

  it('15c: cleanup blocked by uncommitted changes', () => {
    const config = makeAskCleanupConfig();
    const state = makeWorktreeState();
    const io = createMockIO({ state, config, hasUncommittedChanges: () => true });

    const result = processEvent('source_control_cleanup_set', SC_PROJECT_DIR, { choice: 'remove' }, io);
    assert.equal(result.success, false);
    assert.ok(result.context.error.includes('uncommitted changes'));
    assert.equal(io.getRemoveWorktreeCalls().length, 0);
    assert.equal(io.getWrites().length, 0);
  });
});

// ─── Category 16: SC — Completion/manual cleanup paths ──────────────────────

describe('Category 16: SC — Completion/manual cleanup paths', () => {
  function makeWorktreeStateWithFinalReview() {
    const state = createReviewState({
      pipeline: {
        source_control: {
          activation_choice: 'worktree',
          branch_from_choice: 'default',
          worktree_path: CLEANUP_WORKTREE_PATH,
          branch: 'project/test',
          cleanup_choice: null,
        },
      },
      final_review: {
        status: 'complete',
        doc_path: 'fr.md',
        human_approved: false,
      },
    });
    delete state.project.updated;
    return state;
  }

  it('16: on_completion auto-remove', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'default',
      cleanup: 'on_completion',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeWorktreeStateWithFinalReview();
    const io = createMockIO({ state, config });

    const result = processEvent('final_approved', SC_PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(io.getRemoveWorktreeCalls().length, 1);
    assert.equal(io.getState().pipeline.source_control.worktree_path, null);
    assert.equal(io.getState().pipeline.source_control.branch, null);
    assert.equal(io.getWrites().length, 1);
  });

  it('16b: manual cleanup (no removal)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'default',
      cleanup: 'manual',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeWorktreeStateWithFinalReview();
    const io = createMockIO({ state, config });

    const result = processEvent('final_approved', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(io.getRemoveWorktreeCalls().length, 0);
    assert.ok(io.getState().pipeline.source_control.worktree_path !== null);
    assert.ok(io.getState().pipeline.source_control.branch !== null);
  });
});

// ─── Category 17: SC — Backwards-compatibility skip paths ───────────────────

describe('Category 17: SC — Backwards-compatibility skip paths', () => {
  it('17: activation never (skip all SC)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'never',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const documents = { 'pp.md': makeDoc({ tasks: ['T01'] }) };
    const io = createMockIO({ state, config, documents });

    // Step 1: start → NOT ask_source_control_* (activation: never suppresses all SC asks); 0 writes
    const r1 = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.ok(!r1.action.startsWith('ask_source_control_'));
    assert.equal(io.getCreateWorktreeCalls().length, 0);
    assert.equal(io.getRemoveWorktreeCalls().length, 0);
    assert.equal(io.getState().pipeline.source_control.worktree_path, null);

    // Step 2: phase_plan_created → no worktree created (resolveIsolationMode returns 'none')
    const r2 = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'pp.md' }, io);
    assert.equal(r2.success, true);
    assert.equal(io.getCreateWorktreeCalls().length, 0);
  });

  it('17b: isolation_mode none (skip all SC)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'none',
      activation: 'always',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const documents = { 'pp.md': makeDoc({ tasks: ['T01'] }) };
    const io = createMockIO({ state, config, documents });

    // Step 1: start → NOT ask_source_control_* (isolation_mode: none suppresses creation); 0 writes
    const r1 = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.ok(!r1.action.startsWith('ask_source_control_'));
    assert.equal(io.getCreateWorktreeCalls().length, 0);
    assert.equal(io.getRemoveWorktreeCalls().length, 0);

    // Step 2: phase_plan_created → no worktree (resolveIsolationMode returns 'none')
    const r2 = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'pp.md' }, io);
    assert.equal(r2.success, true);
    assert.equal(io.getCreateWorktreeCalls().length, 0);
  });

  it('17c: isolation_mode branch (reserved, no-op)', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'branch',
      activation: 'always',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    const documents = { 'pp.md': makeDoc({ tasks: ['T01'] }) };
    const io = createMockIO({ state, config, documents });

    // Step 1: start → NOT ask_source_control_activation (activation: always); 0 writes
    const r1 = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(io.getCreateWorktreeCalls().length, 0);
    assert.equal(io.getRemoveWorktreeCalls().length, 0);

    // Step 2: phase_plan_created → no worktree (resolveIsolationMode returns 'branch', fails === 'worktree' check)
    const r2 = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 'pp.md' }, io);
    assert.equal(r2.success, true);
    assert.equal(io.getCreateWorktreeCalls().length, 0);
  });
});

// ─── Category 18: SC — Error paths ──────────────────────────────────────────

describe('Category 18: SC — Error paths', () => {
  it('18: version mismatch rejected', () => {
    const config = createDefaultConfig(); // version: '5.0'
    const state = createBaseState({ $schema: 'orchestration-state-v4' });
    const io = createMockIO({ state, config });

    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, false);
    assert.ok(result.context.error.includes('Version mismatch'));
    assert.equal(io.getWrites().length, 0);
  });

  it('18b: creation git error', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'ask',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    state.pipeline.source_control.activation_choice = 'worktree';
    const io = createMockIO({
      state,
      config,
      createWorktree: () => ({ success: false, error: 'branch already exists' }),
    });

    // branch_from_set satisfies final gate; creation fires; mock returns error
    const result = processEvent('source_control_branch_from_set', SC_PROJECT_DIR, { choice: 'default' }, io);
    assert.equal(result.success, false);
    assert.ok(result.context.error.includes('Worktree creation failed'));
    assert.equal(io.getWrites().length, 0);
    assert.equal(io.getState().pipeline.source_control.worktree_path, null);
  });

  it('18c: no .git directory found', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'current',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = makeExecutionStartState(1);
    state.pipeline.source_control.activation_choice = 'worktree';
    const io = createMockIO({ state, config });

    // PROJECT_DIR has no .git ancestor; findRepoRoot returns null → error before createWorktree
    const result = processEvent('source_control_activation_set', PROJECT_DIR, { choice: 'worktree' }, io);
    assert.equal(result.success, false);
    assert.ok(result.context.error.includes('no git repository found'));
    assert.equal(io.getCreateWorktreeCalls().length, 0);
    assert.equal(io.getWrites().length, 0);
  });

  it('18d: removal git error', () => {
    const config = createDefaultConfig();
    config.source_control = {
      isolation_mode: 'worktree',
      activation: 'ask',
      branch_from: 'default',
      cleanup: 'ask',
      worktree_path: '../worktrees',
      branch_prefix: 'project/',
    };
    const state = createReviewState({
      pipeline: {
        source_control: {
          activation_choice: 'worktree',
          branch_from_choice: 'default',
          worktree_path: CLEANUP_WORKTREE_PATH,
          branch: 'project/test',
          cleanup_choice: null,
        },
      },
    });
    delete state.project.updated;
    const io = createMockIO({
      state,
      config,
      removeWorktree: () => ({ success: false, error: 'permission denied' }),
    });

    // cleanup_set remove triggers removal; mock returns error; state NOT written
    const result = processEvent('source_control_cleanup_set', SC_PROJECT_DIR, { choice: 'remove' }, io);
    assert.equal(result.success, false);
    assert.ok(result.context.error.includes('Worktree removal failed'));
    assert.equal(io.getWrites().length, 0);
    assert.equal(io.getState().pipeline.source_control.worktree_path, CLEANUP_WORKTREE_PATH);
  });
});
