'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { processEvent } = require('../lib/pipeline-engine');
const { getMutation } = require('../lib/mutations');
const {
  createMockIO,
  createBaseState,
  createReviewState,
  createDefaultConfig,
  deepClone,
} = require('./helpers/test-helpers');

const PROJECT_DIR = '/test/project';

// ─── Local Helpers ──────────────────────────────────────────────────────────

/** Create a minimal parsed-document object for the MockIO documents map. */
function makeDoc(frontmatter) {
  return { frontmatter, body: '' };
}

/**
 * Remove project.updated so the V13 monotonicity check does not fire.
 * Deleting the field means current.project.updated is undefined, and
 * `proposed.updated <= undefined` evaluates to false in V13's string check.
 */
function backdateTimestamp(state) {
  delete state.project.updated;
  return state;
}

/**
 * Build an execution-tier state (post plan_approved) with the given number of
 * empty phases and a configurable gate mode. project.updated is removed
 * for V13 safety on the first processEvent call.
 */
function makeGateTestState(totalPhases, gateMode) {
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
    pipeline: { current_tier: 'execution', gate_mode: gateMode },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research',      status: 'complete', doc_path: 'r.md' },
        { name: 'prd',           status: 'complete', doc_path: 'p.md' },
        { name: 'design',        status: 'complete', doc_path: 'd.md' },
        { name: 'architecture',  status: 'complete', doc_path: 'a.md' },
        { name: 'master_plan',   status: 'complete', doc_path: 'mp.md' },
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

// ─── Scenarios 1-2: Task gate mode ──────────────────────────────────────────
// Shared IO: 1-phase project, gate_mode='task'.
// Drive task through the full task lifecycle to verify pointer deferral on
// code_review_completed and advancement on gate_approved.

describe('Scenarios 1-2: Task gate mode', () => {
  const documents = {
    's1-pp.md':  makeDoc({ tasks: ['T01'] }),
    's1-th.md':  makeDoc({}),
    's1-tr.md':  makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    's1-cr.md':  makeDoc({ verdict: 'approved' }),
  };
  const io = createMockIO({ state: makeGateTestState(1, 'task'), documents });

  it('S1 setup: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 's1-pp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getState().execution.phases[0].stage, 'executing');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'planning');
  });

  it('S1 setup: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 's1-th.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'coding');
  });

  it('S1 setup: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 's1-tr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getState().execution.phases[0].tasks[0].stage, 'reviewing');
  });

  it('Scenario 1: code_review_completed (approved) defers pointer in task gate mode', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 's1-cr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'gate_task');
    const phase = io.getState().execution.phases[0];
    // Pointer must NOT advance — deferred until gate_approved
    assert.equal(phase.current_task, 1);
    assert.equal(phase.tasks[0].stage, 'complete');
  });

  it('Scenario 2: gate_approved advances task pointer', () => {
    const result = processEvent('gate_approved', PROJECT_DIR, { gate_type: 'task' }, io);
    assert.equal(result.success, true);
    // Pointer must advance by 1
    assert.equal(io.getState().execution.phases[0].current_task, 2);
  });
});

// ─── Scenarios 3-4: Phase gate mode − 2 phases ──────────────────────────────
// Shared IO: 2-phase project, gate_mode='phase'.
// Drive phase 1's single task to completion. On phase_review_completed (approved)
// the phase pointer must be deferred (Scenario 3). gate_approved advances it (Scenario 4).

describe('Scenarios 3-4: Phase gate mode - pointer deferral and advance', () => {
  const documents = {
    's34-pp.md':  makeDoc({ tasks: ['T01'] }),
    's34-th.md':  makeDoc({}),
    's34-tr.md':  makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    's34-cr.md':  makeDoc({ verdict: 'approved' }),
    's34-pr.md':  makeDoc({}),
    's34-prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
  };
  const io = createMockIO({ state: makeGateTestState(2, 'phase'), documents });

  it('S3 setup: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 's34-pp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
  });

  it('S3 setup: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 's34-th.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
  });

  it('S3 setup: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 's34-tr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
  });

  it('S3 setup: code_review_completed (phase mode) advances task pointer immediately', () => {
    // In phase gate mode, the task pointer advances immediately — only the phase pointer defers
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 's34-cr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(io.getState().execution.phases[0].current_task, 2);
  });

  it('S3 setup: phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 's34-pr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(io.getState().execution.phases[0].stage, 'reviewing');
  });

  it('Scenario 3: phase_review_completed defers phase pointer in phase gate mode', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 's34-prv.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'gate_phase');
    const state = io.getState();
    // Phase pointer must NOT advance — deferred until gate_approved
    assert.equal(state.execution.current_phase, 1);
    assert.equal(state.execution.phases[0].stage, 'complete');
  });

  it('Scenario 4: gate_approved advances phase pointer', () => {
    const result = processEvent('gate_approved', PROJECT_DIR, { gate_type: 'phase' }, io);
    assert.equal(result.success, true);
    // Phase pointer must advance by 1
    assert.equal(io.getState().execution.current_phase, 2);
  });
});

// ─── Scenario 5: Phase gate mode − last phase approval transitions to review ─
// Shared IO: 1-phase project, gate_mode='phase'.
// Drive through the full single-phase lifecycle, then verify that gate_approved
// on the last phase transitions the pipeline to the review tier.

describe('Scenario 5: Phase gate mode - last phase approval transitions to review tier', () => {
  const documents = {
    's5-pp.md':  makeDoc({ tasks: ['T01'] }),
    's5-th.md':  makeDoc({}),
    's5-tr.md':  makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    's5-cr.md':  makeDoc({ verdict: 'approved' }),
    's5-pr.md':  makeDoc({}),
    's5-prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
  };
  const io = createMockIO({ state: makeGateTestState(1, 'phase'), documents });

  it('S5 setup: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 's5-pp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
  });

  it('S5 setup: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 's5-th.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
  });

  it('S5 setup: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 's5-tr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
  });

  it('S5 setup: code_review_completed → generate_phase_report', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 's5-cr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report');
  });

  it('S5 setup: phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 's5-pr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
  });

  it('S5 setup: phase_review_completed defers last phase → gate_phase', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 's5-prv.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'gate_phase');
    assert.equal(io.getState().execution.current_phase, 1); // still 1 — deferred
  });

  it('Scenario 5: gate_approved on last phase transitions pipeline to review tier', () => {
    const result = processEvent('gate_approved', PROJECT_DIR, { gate_type: 'phase' }, io);
    assert.equal(result.success, true);
    const state = io.getState();
    assert.equal(state.pipeline.current_tier, 'review');
    assert.equal(state.execution.status, 'complete');
  });
});

// ─── Scenario 6: Autonomous mode − no gate, immediate pointer advance ────────
// Shared IO: 1-phase project, gate_mode='autonomous'.
// In autonomous mode, code_review_completed must advance the task pointer
// immediately (no gate interlude) and the resolver must request the phase report.

describe('Scenario 6: Autonomous mode - no gate, immediate pointer advance', () => {
  const documents = {
    's6-pp.md': makeDoc({ tasks: ['T01'] }),
    's6-th.md': makeDoc({}),
    's6-tr.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    's6-cr.md': makeDoc({ verdict: 'approved' }),
  };
  const io = createMockIO({ state: makeGateTestState(1, 'autonomous'), documents });

  it('S6 setup: phase_plan_created → create_task_handoff', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 's6-pp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
  });

  it('S6 setup: task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 's6-th.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
  });

  it('S6 setup: task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 's6-tr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
  });

  it('Scenario 6: code_review_completed advances pointer immediately and requests phase report', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 's6-cr.md' }, io);
    assert.equal(result.success, true);
    // Autonomous mode: no gate — pointer must advance past the last task
    assert.equal(result.action, 'generate_phase_report');
    const phase = io.getState().execution.phases[0];
    assert.equal(phase.current_task, 2); // advanced immediately (past tasks.length 1)
  });
});

// ─── Scenario 7: Gate rejection halts pipeline ───────────────────────────────
// Shared IO: 1-phase project, gate_mode='task'.
// Drive task to the gate_task state, then signal gate_rejected.
// Assert pipeline transitions to 'halted' and rejection reason appears in mutations.

describe('Scenario 7: Gate rejection halts pipeline', () => {
  const documents = {
    's7-pp.md': makeDoc({ tasks: ['T01'] }),
    's7-th.md': makeDoc({}),
    's7-tr.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
    's7-cr.md': makeDoc({ verdict: 'approved' }),
  };
  const io = createMockIO({ state: makeGateTestState(1, 'task'), documents });

  it('S7 setup: phase_plan_created', () => {
    const result = processEvent('phase_plan_created', PROJECT_DIR, { doc_path: 's7-pp.md' }, io);
    assert.equal(result.success, true);
  });

  it('S7 setup: task_handoff_created', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 's7-th.md' }, io);
    assert.equal(result.success, true);
  });

  it('S7 setup: task_completed', () => {
    const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 's7-tr.md' }, io);
    assert.equal(result.success, true);
  });

  it('S7 setup: code_review_completed → gate_task (pointer deferred)', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 's7-cr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'gate_task');
  });

  it('Scenario 7: gate_rejected halts pipeline and records rejection reason', () => {
    const result = processEvent(
      'gate_rejected',
      PROJECT_DIR,
      { gate_type: 'task', reason: 'Insufficient test coverage' },
      io,
    );
    assert.equal(result.success, true);
    assert.equal(io.getState().pipeline.current_tier, 'halted');
    assert.ok(
      result.mutations_applied.some(m => m.includes('Insufficient test coverage')),
      'mutations_applied should contain the rejection reason',
    );
  });
});

// ─── Scenario 8: Gate mode set persists choice ───────────────────────────────

it('Scenario 8: gate_mode_set persists gate mode choice into state', () => {
  const io = createMockIO({ state: makeGateTestState(1, 'autonomous') });
  const result = processEvent('gate_mode_set', PROJECT_DIR, { gate_mode: 'phase' }, io);
  assert.equal(result.success, true);
  assert.equal(io.getState().pipeline.gate_mode, 'phase');
});

// ─── Scenario 9: Ask-mode detection ─────────────────────────────────────────
// When config.human_gates.execution_mode='ask' and state.pipeline.gate_mode is null,
// a cold-start must return ask_gate_mode. After gate_mode is set, cold-start
// must NOT repeat the ask (single-fire guard).

describe('Scenario 9: Ask-mode detection', () => {
  it('Scenario 9a: null gate_mode with ask config → ask_gate_mode on cold-start', () => {
    const config = createDefaultConfig();
    config.human_gates.execution_mode = 'ask';
    const state = makeGateTestState(1, null);
    // Ensure gate_mode is explicitly null (makeGateTestState passes null to createBaseState)
    assert.equal(state.pipeline.gate_mode, null);
    const io = createMockIO({ state, config });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'ask_gate_mode');
    // Cold-start must not write state
    assert.equal(io.getWrites().length, 0);
    assert.equal(result.mutations_applied.length, 0);
  });

  it('Scenario 9b: gate_mode already set → no ask prompt (single-fire guard)', () => {
    const config = createDefaultConfig();
    config.human_gates.execution_mode = 'ask';
    const state = makeGateTestState(1, null);
    const io = createMockIO({ state, config });
    // First cold-start → ask_gate_mode
    const first = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(first.action, 'ask_gate_mode');
    // Simulate operator answering: set gate_mode on the io state
    io.getState().pipeline.gate_mode = 'task';
    // Second cold-start → guard fires: gate_mode is not null, so no ask
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.notEqual(result.action, 'ask_gate_mode');
  });
});

// ─── Scenario 10: Plan rejected resets planning approval ─────────────────────

it('Scenario 10: plan_rejected resets planning.human_approved and master_plan step status', () => {
  const state = createBaseState({
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research',     status: 'complete', doc_path: 'r.md' },
        { name: 'prd',          status: 'complete', doc_path: 'p.md' },
        { name: 'design',       status: 'complete', doc_path: 'd.md' },
        { name: 'architecture', status: 'complete', doc_path: 'a.md' },
        { name: 'master_plan',  status: 'complete', doc_path: 'mp.md' },
      ],
    },
  });
  delete state.project.updated;
  const io = createMockIO({ state });
  const result = processEvent('plan_rejected', PROJECT_DIR, {}, io);
  assert.equal(result.success, true);
  const s = io.getState();
  // planning.human_approved must be cleared
  assert.equal(s.planning.human_approved, false);
  // master_plan step must revert to in_progress (requires re-run)
  const masterPlanStep = s.planning.steps.find(step => step.name === 'master_plan');
  assert.equal(masterPlanStep.status, 'in_progress');
  // Resolver: master_plan step is no longer complete → spawn_master_plan (re-run the plan)
  assert.equal(result.action, 'spawn_master_plan');
});

// ─── Scenario 11: Final rejected resets final review ─────────────────────────

it('Scenario 11: final_rejected resets final_review.doc_path and status', () => {
  const state = createReviewState();
  // Simulate a completed final review that is being rejected
  state.final_review.doc_path = 'review/final-review.md';
  state.final_review.status = 'complete';
  delete state.project.updated;
  const io = createMockIO({ state });
  const result = processEvent('final_rejected', PROJECT_DIR, {}, io);
  assert.equal(result.success, true);
  const s = io.getState();
  assert.equal(s.final_review.doc_path, null);
  assert.equal(s.final_review.status, 'not_started');
  // Resolver: doc_path cleared → spawn_final_reviewer (redo the review)
  assert.equal(result.action, 'spawn_final_reviewer');
});

// ─── Scenario 12: MUTATIONS table has exactly 23 handlers ────────────────────

it('Scenario 12: MUTATIONS table has exactly 23 handlers', () => {
  const expectedEvents = [
    // Planning (6)
    'research_completed',
    'prd_completed',
    'design_completed',
    'architecture_completed',
    'master_plan_completed',
    'plan_approved',
    // Plan rejection (1)
    'plan_rejected',
    // Execution (6)
    'phase_plan_created',
    'task_handoff_created',
    'task_completed',
    'code_review_completed',
    'phase_report_created',
    'phase_review_completed',
    // Source control (3)
    'source_control_init',
    'task_commit_requested',
    'task_committed',
    // Gate events (3)
    'gate_mode_set',
    'gate_approved',
    'gate_rejected',
    // Review (3)
    'final_review_completed',
    'final_approved',
    'final_rejected',
    // Utility (1)
    'halt',
  ];

  // Must be exactly 23 events
  assert.equal(expectedEvents.length, 23);

  // Every known event must map to a function
  for (const event of expectedEvents) {
    const mutation = getMutation(event);
    assert.equal(
      typeof mutation,
      'function',
      `expected getMutation('${event}') to return a function, got ${typeof mutation}`,
    );
  }

  // Unknown events must return undefined
  assert.equal(getMutation('nonexistent_event'), undefined);
});

// ─── Scenarios 13-16: auto_commit × gate mode interactions ──────────────────

describe('Scenarios 13-16: auto_commit × gate mode interactions', () => {
  /**
   * Build a state at the point just AFTER code_review_completed approved with
   * auto_commit=always — task is at stage=complete, review.action=advanced,
   * pointer NOT bumped. This is the commit-defer state.
   */
  function makeCommitDeferState(gateMode) {
    const state = createBaseState({
      pipeline: {
        current_tier: 'execution',
        gate_mode: gateMode,
        source_control: {
          branch: 'feat/x',
          base_branch: 'main',
          worktree_path: '/wt',
          auto_commit: 'always',
          auto_pr: 'never',
        },
      },
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
        phases: [{
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'executing',
          current_task: 1,
          tasks: [{
            name: 'T01', status: 'complete', stage: 'complete',
            docs: { handoff: 'h.md', report: 'r.md', review: 'rv.md' },
            review: { verdict: 'approved', action: 'advanced' },
            report_status: 'complete',
            has_deviations: false, deviation_type: null, retries: 0,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
    delete state.project.updated;
    return state;
  }

  it('Scenario 13: auto_commit=always + gate_mode=phase → invoke_source_control_commit', () => {
    const state = makeCommitDeferState('phase');
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'invoke_source_control_commit');
    assert.equal(result.context.branch, 'feat/x');
    assert.equal(io.getWrites().length, 0); // cold-start → no write
  });

  it('Scenario 14: auto_commit=always + gate_mode=task → gate_task (task-gate takes precedence)', () => {
    const state = makeCommitDeferState('task');
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'gate_task');
    // Verify gate_task context does NOT contain branch/worktree
    assert.equal(result.context.branch, undefined);
  });

  it('Scenario 15: auto_commit=always + gate_mode=autonomous → invoke_source_control_commit', () => {
    const state = makeCommitDeferState('autonomous');
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'invoke_source_control_commit');
  });

  it('Scenario 16: auto_commit=never → standard pointer-bumped flow (no commit involvement)', () => {
    // With auto_commit=never, handleCodeReviewCompleted bumps pointer immediately.
    // So this state has pointer=2 (already past the last task), stage=executing.
    const state = createBaseState({
      pipeline: {
        current_tier: 'execution',
        gate_mode: 'phase',
        source_control: {
          branch: 'feat/x', base_branch: 'main', worktree_path: '/wt',
          auto_commit: 'never', auto_pr: 'never',
        },
      },
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
        phases: [{
          name: 'Phase 1', status: 'in_progress', stage: 'executing',
          current_task: 2,  // pointer already bumped past 1 task
          tasks: [{
            name: 'T01', status: 'complete', stage: 'complete',
            docs: { handoff: 'h.md', report: 'r.md', review: 'rv.md' },
            review: { verdict: 'approved', action: 'advanced' },
            report_status: 'complete',
            has_deviations: false, deviation_type: null, retries: 0,
          }],
          docs: { phase_plan: 'pp.md', phase_report: null, phase_review: null },
          review: { verdict: null, action: null },
        }],
      },
    });
    delete state.project.updated;
    const io = createMockIO({ state });
    const result = processEvent('start', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'generate_phase_report'); // standard flow, no commit
  });
});
