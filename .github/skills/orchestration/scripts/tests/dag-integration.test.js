'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { processEvent } = require('../lib/pipeline-engine');
const { resolveNextAction } = require('../lib/resolver');
const { computeNestedView } = require('../lib/dag-adapter');
const {
  createMockIO,
  createBaseState,
  createDefaultConfig,
  makeExpandedDag,
  makeDagNode,
  deepClone,
} = require('./helpers/test-helpers');

const PROJECT_DIR = '/test/v5-project';

// ─── Local Helpers ──────────────────────────────────────────────────────────

function makeDoc(frontmatter) {
  return { frontmatter, body: '' };
}

/**
 * Build a v5 base state from the real 'full' template.
 * project.updated is omitted to avoid V13 monotonicity edge cases.
 */
function createV5BaseState() {
  const { nodes, execution_order } = makeExpandedDag('full');
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST-V5', created: '2025-01-01T00:00:00.000Z' },
    pipeline: { current_tier: 'planning', gate_mode: null, template: 'full' },
    dag: { template_name: 'full', nodes, execution_order },
    planning: {
      status: 'not_started',
      human_approved: false,
      steps: [
        { name: 'research', status: 'not_started', doc_path: null },
        { name: 'prd', status: 'not_started', doc_path: null },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
    },
    execution: { status: 'not_started', current_phase: 0, phases: [] },
    final_review: { status: 'not_started', doc_path: null, human_approved: false },
    config: {
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      },
      human_gates: {
        after_planning: true,
        execution_mode: 'autonomous',
        after_final_review: true,
      },
    },
  };
}

/**
 * Drive a v5 state through planning and into phase execution (tasks expanded).
 * Returns the MockIO with current state at the point where task T01 is ready
 * for task_handoff_started.
 */
function driveToTaskReady(totalPhases, taskNames) {
  const documents = {
    'mp.md': makeDoc({ total_phases: totalPhases }),
    'pp.md': makeDoc({ tasks: taskNames, title: 'Phase 1' }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'cr-reject.md': makeDoc({ verdict: 'changes_requested' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
    'pr.md': makeDoc({}),
    'th.md': makeDoc({}),
  };
  const state = createV5BaseState();
  const io = createMockIO({ state, documents });

  // Drive through planning
  const planningEvents = [
    ['research_started', {}],
    ['research_completed', { doc_path: 'research.md' }],
    ['prd_started', {}],
    ['prd_completed', { doc_path: 'prd.md' }],
    ['design_started', {}],
    ['design_completed', { doc_path: 'design.md' }],
    ['architecture_started', {}],
    ['architecture_completed', { doc_path: 'arch.md' }],
    ['master_plan_started', {}],
    ['master_plan_completed', { doc_path: 'mp.md' }],
    ['plan_approved', { doc_path: 'mp.md' }],
  ];
  for (const [event, ctx] of planningEvents) {
    const r = processEvent(event, PROJECT_DIR, ctx, io);
    if (!r.success) throw new Error(`Setup failed at ${event}: ${JSON.stringify(r.context)}`);
  }

  // Drive through phase plan
  const phaseEvents = [
    ['phase_planning_started', {}],
    ['phase_plan_created', { doc_path: 'pp.md' }],
  ];
  for (const [event, ctx] of phaseEvents) {
    const r = processEvent(event, PROJECT_DIR, ctx, io);
    if (!r.success) throw new Error(`Setup failed at ${event}: ${JSON.stringify(r.context)}`);
  }

  return io;
}

// ─── Category 1: Full Planning Happy Path (v5) ─────────────────────────────

describe('Category 1: v5 full planning happy path', () => {
  const documents = {
    'mp.md': makeDoc({ total_phases: 1 }),
    'pp.md': makeDoc({ tasks: ['T01'], title: 'Phase 1' }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
  };
  const state = createV5BaseState();
  const io = createMockIO({ state, documents });

  it('research_started → spawn_research, DAG node in_progress', () => {
    const result = processEvent('research_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_research');
    const s = io.getState();
    assert.equal(s.planning.steps.find(st => st.name === 'research').status, 'in_progress');
    assert.equal(s.dag.nodes.research.status, 'in_progress');
  });

  it('research_completed → spawn_prd, DAG node complete', () => {
    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: 'research.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(io.getState().dag.nodes.research.status, 'complete');
  });

  it('prd_started → spawn_prd', () => {
    const result = processEvent('prd_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(io.getState().dag.nodes.create_prd.status, 'in_progress');
  });

  it('prd_completed → spawn_design', () => {
    const result = processEvent('prd_completed', PROJECT_DIR, { doc_path: 'prd.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_design');
    assert.equal(io.getState().dag.nodes.create_prd.status, 'complete');
  });

  it('design_started → spawn_design', () => {
    const result = processEvent('design_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_design');
    assert.equal(io.getState().dag.nodes.create_design.status, 'in_progress');
  });

  it('design_completed → spawn_architecture', () => {
    const result = processEvent('design_completed', PROJECT_DIR, { doc_path: 'design.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_architecture');
    assert.equal(io.getState().dag.nodes.create_design.status, 'complete');
  });

  it('architecture_started → spawn_architecture', () => {
    const result = processEvent('architecture_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_architecture');
    assert.equal(io.getState().dag.nodes.create_architecture.status, 'in_progress');
  });

  it('architecture_completed → spawn_master_plan', () => {
    const result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: 'arch.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_master_plan');
    assert.equal(io.getState().dag.nodes.create_architecture.status, 'complete');
  });

  it('master_plan_started → spawn_master_plan', () => {
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_master_plan');
    assert.equal(io.getState().dag.nodes.create_master_plan.status, 'in_progress');
  });

  it('master_plan_completed → request_plan_approval', () => {
    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: 'mp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'request_plan_approval');
    assert.equal(io.getState().dag.nodes.create_master_plan.status, 'complete');
  });

  it('plan_approved → create_phase_plan, for_each_phase expanded', () => {
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: 'mp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    const s = io.getState();
    // Planning gate marked complete
    assert.equal(s.dag.nodes.request_plan_approval.status, 'complete');
    // for_each_phase container deleted
    assert.equal(s.dag.nodes.for_each_phase, undefined);
    // Per-phase nodes created
    assert.ok(s.dag.nodes['P01.create_phase_plan']);
    assert.ok(s.dag.nodes['P01.for_each_task']);
    assert.ok(s.dag.nodes['P01.generate_phase_report']);
    assert.ok(s.dag.nodes['P01.phase_review']);
    // Nested execution view
    assert.equal(s.execution.phases.length, 1);
    assert.equal(s.execution.current_phase, 1);
    assert.equal(s.pipeline.current_tier, 'execution');
  });
});

// ─── Category 2: Phase Execution Sequence ───────────────────────────────────

describe('Category 2: v5 phase execution sequence', () => {
  const documents = {
    'mp.md': makeDoc({ total_phases: 1 }),
    'pp.md': makeDoc({ tasks: ['T01'], title: 'Phase 1' }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
    'pr.md': makeDoc({}),
    'th.md': makeDoc({}),
  };

  let io;
  it('setup: drive v5 state through planning', () => {
    io = driveToTaskReady(1, ['T01']);
    const s = io.getState();
    // Verify tasks expanded
    assert.ok(s.dag.nodes['P01.T01.create_task_handoff']);
    assert.ok(s.dag.nodes['P01.T01.execute_coding_task']);
    assert.ok(s.dag.nodes['P01.T01.code_review']);
    assert.ok(s.dag.nodes['P01.T01.source_control_commit']);
    // for_each_task container deleted
    assert.equal(s.dag.nodes['P01.for_each_task'], undefined);
  });

  it('task_handoff_started → create_task_handoff, DAG node in_progress', () => {
    const result = processEvent('task_handoff_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.T01.create_task_handoff'].status, 'in_progress');
    assert.equal(s.execution.phases[0].tasks[0].status, 'in_progress');
  });

  it('task_handoff_created → execute_task, DAG handoff complete + execute in_progress', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'th.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.T01.create_task_handoff'].status, 'complete');
    assert.equal(s.dag.nodes['P01.T01.execute_coding_task'].status, 'in_progress');
    assert.equal(s.execution.phases[0].tasks[0].stage, 'coding');
  });

  it('task_completed → spawn_code_reviewer, DAG execute complete + review in_progress', () => {
    const result = processEvent('task_completed', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.T01.execute_coding_task'].status, 'complete');
    assert.equal(s.dag.nodes['P01.T01.code_review'].status, 'in_progress');
    assert.equal(s.execution.phases[0].tasks[0].stage, 'reviewing');
  });

  it('code_review_completed (approved) → invoke_source_control_commit, DAG review complete', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'cr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'invoke_source_control_commit');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.T01.code_review'].status, 'complete');
    // SC commit node is ready (not_started with deps met)
    assert.equal(s.dag.nodes['P01.T01.source_control_commit'].status, 'not_started');
    assert.equal(s.execution.phases[0].tasks[0].status, 'complete');
    assert.equal(s.execution.phases[0].tasks[0].review.action, 'advanced');
  });

  it('task_commit_requested (no-branch) → skips commit, SC node skipped', () => {
    const r = processEvent('task_commit_requested', PROJECT_DIR, {}, io);
    assert.equal(r.success, true);
    processEvent('task_committed', PROJECT_DIR, {}, io); // no-branch: V2 prevents double-bump; SC stays skipped
    assert.equal(io.getState().dag.nodes['P01.T01.source_control_commit'].status, 'skipped');
  });

  it('phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 'pr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.generate_phase_report'].status, 'complete');
    assert.equal(s.execution.phases[0].stage, 'reviewing');
  });

  it('phase_review_completed (approved) → spawn_final_reviewer, tier transitions to review', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'prv.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_final_reviewer');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.phase_review'].status, 'complete');
    assert.equal(s.execution.phases[0].status, 'complete');
    assert.equal(s.execution.phases[0].stage, 'complete');
    assert.equal(s.pipeline.current_tier, 'review');
    assert.equal(s.execution.status, 'complete');
  });
});

// ─── Category 3: Corrective Task Flow ───────────────────────────────────────

describe('Category 3: v5 corrective task flow', () => {
  const documents = {
    'mp.md': makeDoc({ total_phases: 1 }),
    'pp.md': makeDoc({ tasks: ['T01'], title: 'Phase 1' }),
    'cr-reject.md': makeDoc({ verdict: 'changes_requested' }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
    'pr.md': makeDoc({}),
    'th.md': makeDoc({}),
    'th2.md': makeDoc({}),
  };

  let io;
  it('setup: drive to reviewing stage', () => {
    io = driveToTaskReady(1, ['T01']);
    // Drive task through to reviewing
    const events = [
      ['task_handoff_started', {}],
      ['task_handoff_created', { doc_path: 'th.md' }],
      ['task_completed', {}],
    ];
    for (const [event, ctx] of events) {
      const r = processEvent(event, PROJECT_DIR, ctx, io);
      if (!r.success) throw new Error(`Setup failed at ${event}: ${JSON.stringify(r.context)}`);
    }
    assert.equal(io.getState().dag.nodes['P01.T01.code_review'].status, 'in_progress');
  });

  it('code_review_completed (changes_requested) → create_task_handoff, corrective nodes injected', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'cr-reject.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    const s = io.getState();
    // Original review node marked failed
    assert.equal(s.dag.nodes['P01.T01.code_review'].status, 'failed');
    // Corrective nodes injected
    assert.ok(s.dag.nodes['P01.T01.create_task_handoff_r1']);
    assert.ok(s.dag.nodes['P01.T01.execute_coding_task_r1']);
    assert.ok(s.dag.nodes['P01.T01.code_review_r1']);
    // Execution order recomputed to include corrective nodes
    assert.ok(s.dag.execution_order.includes('P01.T01.create_task_handoff_r1'));
    assert.ok(s.dag.execution_order.includes('P01.T01.execute_coding_task_r1'));
    assert.ok(s.dag.execution_order.includes('P01.T01.code_review_r1'));
    // Task retries incremented
    assert.equal(s.execution.phases[0].tasks[0].retries, 1);
    assert.equal(s.execution.phases[0].tasks[0].status, 'failed');
  });

  it('corrective task_handoff_started → create_task_handoff, DAG r1 node in_progress', () => {
    const result = processEvent('task_handoff_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(io.getState().dag.nodes['P01.T01.create_task_handoff_r1'].status, 'in_progress');
  });

  it('corrective task_handoff_created → execute_task', () => {
    const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'th2.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'execute_task');
    assert.equal(io.getState().dag.nodes['P01.T01.create_task_handoff_r1'].status, 'complete');
    assert.equal(io.getState().dag.nodes['P01.T01.execute_coding_task_r1'].status, 'in_progress');
  });

  it('corrective task_completed → spawn_code_reviewer', () => {
    const result = processEvent('task_completed', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(io.getState().dag.nodes['P01.T01.execute_coding_task_r1'].status, 'complete');
    assert.equal(io.getState().dag.nodes['P01.T01.code_review_r1'].status, 'in_progress');
  });

  it('corrective code_review_completed (approved) → invoke_source_control_commit, task complete', () => {
    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'cr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'invoke_source_control_commit');
    const s = io.getState();
    assert.equal(s.dag.nodes['P01.T01.code_review_r1'].status, 'complete');
    assert.equal(s.execution.phases[0].tasks[0].status, 'complete');
    assert.equal(s.execution.phases[0].tasks[0].review.action, 'advanced');
    // Original source_control_commit was rewired to depend on code_review_r1
    assert.ok(s.dag.nodes['P01.T01.source_control_commit'].depends_on.includes('P01.T01.code_review_r1'));
  });

  it('halt on retry exhaustion: changes_requested with max_retries=0 → display_halted', () => {
    const haltIo = driveToTaskReady(1, ['T01']);
    // Override retry budget to 0 so the first rejection triggers halt
    haltIo.getState().config.limits.max_retries_per_task = 0;

    // Drive task to reviewing stage
    for (const [event, ctx] of [
      ['task_handoff_started', {}],
      ['task_handoff_created', { doc_path: 'th.md' }],
      ['task_completed', {}],
    ]) {
      const r = processEvent(event, PROJECT_DIR, ctx, haltIo);
      if (!r.success) throw new Error(`Halt setup failed at ${event}: ${JSON.stringify(r.context)}`);
    }

    const result = processEvent('code_review_completed', PROJECT_DIR, { doc_path: 'cr-reject.md' }, haltIo);
    const s = haltIo.getState();

    assert.equal(result.success, true);
    assert.equal(result.action, 'display_halted');
    assert.equal(s.dag.nodes['P01.T01.code_review'].status, 'halted');
    assert.equal(s.execution.phases[0].tasks[0].status, 'halted');
    assert.equal(s.execution.phases[0].tasks[0].review.action, 'halted');
    // No corrective nodes injected when retry budget is exhausted
    assert.equal(s.dag.nodes['P01.T01.create_task_handoff_r1'], undefined);
  });
});

// ─── Category 4: Phase Completion and Multi-Phase Advancement ───────────────

describe('Category 4: v5 phase completion and multi-phase advancement', () => {
  const documents = {
    'mp.md': makeDoc({ total_phases: 2 }),
    'pp.md': makeDoc({ tasks: ['T01'], title: 'Phase 1' }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
    'pr.md': makeDoc({}),
    'th.md': makeDoc({}),
  };

  let io;
  it('setup: drive 2-phase project through phase 1 task', () => {
    io = driveToTaskReady(2, ['T01']);
    // Drive task through to code review approved
    const events = [
      ['task_handoff_started', {}],
      ['task_handoff_created', { doc_path: 'th.md' }],
      ['task_completed', {}],
      ['code_review_completed', { doc_path: 'cr.md' }],
    ];
    for (const [event, ctx] of events) {
      const r = processEvent(event, PROJECT_DIR, ctx, io);
      if (!r.success) throw new Error(`Setup failed at ${event}: ${JSON.stringify(r.context)}`);
    }
    // Replace manual state patch with real SC event flow
    const scR = processEvent('task_commit_requested', PROJECT_DIR, {}, io);
    if (!scR.success) throw new Error(`Setup failed at task_commit_requested: ${JSON.stringify(scR.context)}`);
    processEvent('task_committed', PROJECT_DIR, {}, io); // no-branch: may fail V2; SC node stays skipped
  });

  it('phase_report_created → spawn_phase_reviewer', () => {
    const result = processEvent('phase_report_created', PROJECT_DIR, { doc_path: 'pr.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_phase_reviewer');
  });

  it('phase_review_completed (approved) → create_phase_plan for P02, current_phase advances', () => {
    const result = processEvent('phase_review_completed', PROJECT_DIR, { doc_path: 'prv.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    const s = io.getState();
    // Phase 1 is complete
    assert.equal(s.execution.phases[0].status, 'complete');
    assert.equal(s.execution.phases[0].stage, 'complete');
    // Phase advances to 2 in autonomous mode
    assert.equal(s.execution.current_phase, 2);
    // Tier stays execution (not review — still have phase 2)
    assert.equal(s.pipeline.current_tier, 'execution');
    // DAG: P01 phase_review complete
    assert.equal(s.dag.nodes['P01.phase_review'].status, 'complete');
    // P02 create_phase_plan exists and is ready
    assert.ok(s.dag.nodes['P02.create_phase_plan']);
    assert.equal(s.dag.nodes['P02.create_phase_plan'].status, 'not_started');
  });
});

// ─── Category 5: Autonomous Gate Auto-Advance ───────────────────────────────

describe('Category 5: autonomous gate auto-advance', () => {
  it('resolver auto-advances past execution gates in autonomous mode', () => {
    const state = {
      $schema: 'orchestration-state-v5',
      project: { name: 'GATE-TEST', created: '2025-01-01T00:00:00.000Z' },
      pipeline: { current_tier: 'execution', gate_mode: 'autonomous', template: 'test' },
      dag: {
        template_name: 'test',
        nodes: {
          step_a: makeDagNode({
            id: 'step_a', status: 'complete', action: 'spawn_research',
          }),
          exec_gate: makeDagNode({
            id: 'exec_gate', type: 'gate', gate_type: 'execution',
            action: 'gate_phase', status: 'not_started', depends_on: ['step_a'],
          }),
          step_b: makeDagNode({
            id: 'step_b', status: 'not_started', depends_on: ['exec_gate'],
            action: 'create_phase_plan', phase_number: 2,
          }),
        },
        execution_order: ['step_a', 'exec_gate', 'step_b'],
      },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: { status: 'in_progress', current_phase: 1, phases: [] },
      final_review: { status: 'not_started', doc_path: null, human_approved: false },
      config: {
        limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
      },
    };
    const config = createDefaultConfig();
    const result = resolveNextAction(state, config);
    // Execution gate is transparently skipped (auto-advanced)
    assert.equal(result.action, 'create_phase_plan');
    // Original nodes are NOT mutated — resolveV5 operates on a copy
    assert.equal(state.dag.nodes.exec_gate.status, 'not_started');
  });

  it('multiple consecutive execution gates are all auto-advanced', () => {
    const state = {
      $schema: 'orchestration-state-v5',
      project: { name: 'GATE-TEST-2', created: '2025-01-01T00:00:00.000Z' },
      pipeline: { current_tier: 'execution', gate_mode: 'autonomous', template: 'test' },
      dag: {
        template_name: 'test',
        nodes: {
          step_a: makeDagNode({ id: 'step_a', status: 'complete', action: 'spawn_research' }),
          gate_1: makeDagNode({
            id: 'gate_1', type: 'gate', gate_type: 'execution',
            action: 'gate_task', status: 'not_started', depends_on: ['step_a'],
          }),
          gate_2: makeDagNode({
            id: 'gate_2', type: 'gate', gate_type: 'execution',
            action: 'gate_phase', status: 'not_started', depends_on: ['gate_1'],
          }),
          step_b: makeDagNode({
            id: 'step_b', status: 'not_started', depends_on: ['gate_2'],
            action: 'execute_task',
          }),
        },
        execution_order: ['step_a', 'gate_1', 'gate_2', 'step_b'],
      },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: { status: 'in_progress', current_phase: 1, phases: [] },
      final_review: { status: 'not_started', doc_path: null, human_approved: false },
      config: {
        limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
      },
    };
    const config = createDefaultConfig();
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'execute_task');
    // Original nodes are NOT mutated — resolveV5 operates on a copy
    assert.equal(state.dag.nodes.gate_1.status, 'not_started');
    assert.equal(state.dag.nodes.gate_2.status, 'not_started');
  });
});

// ─── Category 6: State Integrity ────────────────────────────────────────────

describe('Category 6: v5 state integrity after event processing', () => {
  it('state contains both dag and nested views with correct values', () => {
    const io = driveToTaskReady(1, ['T01']);
    const s = io.getState();

    // DAG section present with correct structure
    assert.ok(s.dag);
    assert.ok(s.dag.nodes);
    assert.ok(Array.isArray(s.dag.execution_order));
    assert.equal(s.dag.template_name, 'full');

    // Nested planning view is correct
    assert.equal(s.planning.status, 'complete');
    assert.equal(s.planning.human_approved, true);
    for (const step of s.planning.steps) {
      assert.equal(step.status, 'complete');
    }

    // Nested execution view is correct
    assert.equal(s.pipeline.current_tier, 'execution');
    assert.equal(s.execution.current_phase, 1);
    assert.equal(s.execution.phases.length, 1);
    assert.equal(s.execution.phases[0].stage, 'executing');

    // DAG nodes reflect planning completion
    assert.equal(s.dag.nodes.research.status, 'complete');
    assert.equal(s.dag.nodes.create_prd.status, 'complete');
    assert.equal(s.dag.nodes.create_design.status, 'complete');
    assert.equal(s.dag.nodes.create_architecture.status, 'complete');
    assert.equal(s.dag.nodes.create_master_plan.status, 'complete');
    assert.equal(s.dag.nodes.request_plan_approval.status, 'complete');

    // Phase nodes exist
    assert.ok(s.dag.nodes['P01.create_phase_plan']);
    assert.equal(s.dag.nodes['P01.create_phase_plan'].status, 'complete');

    // Task nodes exist and are at correct starting state
    assert.ok(s.dag.nodes['P01.T01.create_task_handoff']);
    assert.equal(s.dag.nodes['P01.T01.create_task_handoff'].status, 'not_started');
  });

  it('execution_order is a valid topological sort', () => {
    const io = driveToTaskReady(1, ['T01']);
    const s = io.getState();
    const order = s.dag.execution_order;
    const orderIdx = new Map(order.map((id, i) => [id, i]));

    // Every node with deps must appear after all its dependencies
    for (const nodeId of order) {
      const node = s.dag.nodes[nodeId];
      if (!node) continue;
      for (const depId of node.depends_on) {
        if (orderIdx.has(depId)) {
          assert.ok(
            orderIdx.get(depId) < orderIdx.get(nodeId),
            `${depId} (idx ${orderIdx.get(depId)}) must come before ${nodeId} (idx ${orderIdx.get(nodeId)})`
          );
        }
      }
    }
  });

  it('pipeline.current_tier matches DAG progression', () => {
    const state = createV5BaseState();
    const io = createMockIO({ state, documents: { 'mp.md': makeDoc({ total_phases: 1 }) } });

    // Planning tier: before any events
    const r1 = processEvent('research_started', PROJECT_DIR, {}, io);
    assert.equal(r1.success, true);
    assert.equal(io.getState().pipeline.current_tier, 'planning');
  });
});

// ─── Category 7: V4 Regression Smoke Test ───────────────────────────────────

describe('Category 7: v4 regression smoke test', () => {
  it('v4 state uses legacy resolver — no DAG fields in state', () => {
    const state = createBaseState();
    delete state.project.updated;
    const io = createMockIO({ state });
    const result = processEvent('research_started', PROJECT_DIR, {}, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_research');
    const s = io.getState();
    assert.equal(s.dag, undefined);
    assert.equal(s.planning.steps[0].status, 'in_progress');
  });

  it('v4 research_completed → spawn_prd', () => {
    const state = createBaseState({
      planning: {
        status: 'in_progress',
        steps: [
          { name: 'research', status: 'in_progress', doc_path: null },
          { name: 'prd', status: 'not_started', doc_path: null },
          { name: 'design', status: 'not_started', doc_path: null },
          { name: 'architecture', status: 'not_started', doc_path: null },
          { name: 'master_plan', status: 'not_started', doc_path: null },
        ],
      },
    });
    delete state.project.updated;
    const io = createMockIO({ state });
    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: 'r.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'spawn_prd');
    assert.equal(io.getState().planning.steps[0].status, 'complete');
    assert.equal(io.getState().dag, undefined);
  });

  it('v4 plan_approved → create_phase_plan (legacy path)', () => {
    const documents = { 'mp.md': makeDoc({ total_phases: 1 }) };
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
    delete state.project.updated;
    const io = createMockIO({ state, documents });
    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: 'mp.md' }, io);
    assert.equal(result.success, true);
    assert.equal(result.action, 'create_phase_plan');
    const s = io.getState();
    assert.equal(s.dag, undefined);
    assert.equal(s.execution.phases.length, 1);
  });
});

// ─── Category 8: Adapter Parity ─────────────────────────────────────────────

describe('Category 8: adapter parity — mutation-applied state matches computeNestedView', () => {
  it('nested state matches computeNestedView output after task execution', () => {
    const documents = {
      'mp.md': makeDoc({ total_phases: 1 }),
      'pp.md': makeDoc({ tasks: ['T01'], title: 'Phase 1' }),
      'cr.md': makeDoc({ verdict: 'approved' }),
      'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
      'pr.md': makeDoc({}),
      'th.md': makeDoc({}),
    };
    const io = driveToTaskReady(1, ['T01']);
    // Drive task through handoff and coding
    for (const [event, ctx] of [
      ['task_handoff_started', {}],
      ['task_handoff_created', { doc_path: 'th.md' }],
      ['task_completed', {}],
    ]) {
      const r = processEvent(event, PROJECT_DIR, ctx, io);
      if (!r.success) throw new Error(`Setup failed at ${event}: ${JSON.stringify(r.context)}`);
    }
    const s = io.getState();
    const nested = computeNestedView(s.dag);
    assert.deepEqual(s.planning.status, nested.planning.status, 'adapter parity: planning.status');
    assert.deepEqual(s.execution.status, nested.execution.status, 'adapter parity: execution.status');
    assert.deepEqual(s.execution.current_phase, nested.execution.current_phase, 'adapter parity: current_phase');
  });
});
