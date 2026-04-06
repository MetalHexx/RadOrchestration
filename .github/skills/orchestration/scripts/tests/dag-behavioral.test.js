'use strict';

const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { processEvent, scaffoldInitialState } = require('../lib/pipeline-engine');
const { resolveNextAction } = require('../lib/resolver');
const { computeNestedView } = require('../lib/dag-adapter');
const {
  createMockIO,
  createDefaultConfig,
  deepClone,
} = require('./helpers/test-helpers');

const PROJECT_DIR = '/test/behavioral-v5';
const ORCH_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ─── Local Helpers ──────────────────────────────────────────────────────────

function makeDoc(frontmatter) {
  return { frontmatter, body: '' };
}

/**
 * Action-to-events mapping. Each entry is an array of [event, context]
 * pairs to fire in order to advance past that action. Source control
 * actions only fire the "requested" event — the no-branch skip handles
 * pointer advancement and DAG node status internally.
 */
const ACTION_EVENTS = {
  spawn_research:               [['research_started', {}], ['research_completed', { doc_path: 'research.md' }]],
  spawn_prd:                    [['prd_started', {}], ['prd_completed', { doc_path: 'prd.md' }]],
  spawn_design:                 [['design_started', {}], ['design_completed', { doc_path: 'design.md' }]],
  spawn_architecture:           [['architecture_started', {}], ['architecture_completed', { doc_path: 'arch.md' }]],
  spawn_master_plan:            [['master_plan_started', {}], ['master_plan_completed', { doc_path: 'mp.md' }]],
  request_plan_approval:        [['plan_approved', { doc_path: 'mp.md' }]],
  create_phase_plan:            [['phase_planning_started', {}], ['phase_plan_created', { doc_path: 'pp.md' }]],
  create_task_handoff:          [['task_handoff_started', {}], ['task_handoff_created', { doc_path: 'th.md' }]],
  execute_task:                 [['task_completed', {}]],
  spawn_code_reviewer:          [['code_review_completed', { doc_path: 'cr.md' }]],
  invoke_source_control_commit: [['task_commit_requested', {}]],
  generate_phase_report:        [['phase_report_created', { doc_path: 'pr.md' }]],
  spawn_phase_reviewer:         [['phase_review_completed', { doc_path: 'prv.md' }]],
  spawn_final_reviewer:         [['final_review_completed', { doc_path: 'fr.md' }]],
  invoke_source_control_pr:     [['pr_requested', {}]],
  request_final_approval:       [['final_approved', {}]],
};

/**
 * Scaffold a v5 pipeline and return io + config ready for driving.
 */
function scaffoldPipeline(templateName, totalPhases, taskNames, options = {}) {
  const documents = {
    'mp.md': makeDoc({ total_phases: totalPhases }),
    'pp.md': makeDoc({ tasks: taskNames, title: 'Phase Plan' }),
    'cr.md': makeDoc({ verdict: 'approved' }),
    'cr-reject.md': makeDoc({ verdict: 'changes_requested' }),
    'prv.md': makeDoc({ verdict: 'approved', exit_criteria_met: true }),
    'pr.md': makeDoc({}),
    'th.md': makeDoc({}),
    'fr.md': makeDoc({}),
    ...(options.documents || {}),
  };

  const config = {
    ...createDefaultConfig(),
    pipeline: { template: templateName },
  };

  const { state, error } = scaffoldInitialState(config, PROJECT_DIR, ORCH_ROOT);
  if (error) throw new Error('Scaffold failed: ' + error);

  if (options.limits) {
    Object.assign(state.config.limits, options.limits);
  }

  const io = createMockIO({ state, documents });
  return { io, config };
}

/**
 * Fire events to advance past a single action.
 */
function advanceAction(action, io) {
  const eventList = ACTION_EVENTS[action];
  if (!eventList) throw new Error('No event mapping for action: ' + action);

  for (const [event, ctx] of eventList) {
    const r = processEvent(event, PROJECT_DIR, ctx, io);
    if (!r.success) {
      throw new Error(
        'Event ' + event + ' failed at action ' + action + ': ' + JSON.stringify(r.context)
      );
    }
  }
}

/**
 * Drive a v5 pipeline from scaffold to terminal action (display_complete
 * or display_halted). Uses resolveNextAction → advanceAction loop with
 * a safety counter.
 *
 * @param {string} templateName - 'full' or 'quick'
 * @param {number} totalPhases
 * @param {string[]} taskNames - task names per phase
 * @param {Object} [options]
 * @returns {{ actions: string[], finalState: Object, io: Object }}
 */
function driveFullPipeline(templateName, totalPhases, taskNames, options = {}) {
  const { io, config } = scaffoldPipeline(templateName, totalPhases, taskNames, options);
  const actions = [];
  const MAX_ITERATIONS = 200;

  while (actions.length < MAX_ITERATIONS) {
    const next = resolveNextAction(io.getState(), config);
    if (!next) throw new Error('resolveNextAction returned null at iteration ' + actions.length);

    actions.push(next.action);

    if (next.action === 'display_complete' || next.action === 'display_halted') break;

    advanceAction(next.action, io);
  }

  if (actions.length >= MAX_ITERATIONS) {
    throw new Error('Safety counter exceeded. Actions: ' + actions.join(', '));
  }

  return { actions, finalState: io.getState(), io };
}

/**
 * Drive pipeline from current state to a specific target action WITHOUT
 * advancing past it. Returns the collected action sequence.
 */
function driveTo(io, config, targetAction) {
  const actions = [];
  const MAX = 200;

  while (actions.length < MAX) {
    const next = resolveNextAction(io.getState(), config);
    if (!next) throw new Error('resolveNextAction returned null');

    actions.push(next.action);

    if (next.action === targetAction) return actions;

    if (next.action === 'display_complete' || next.action === 'display_halted') {
      throw new Error('Reached terminal ' + next.action + ' before ' + targetAction);
    }

    advanceAction(next.action, io);
  }

  throw new Error('Max iterations reached waiting for ' + targetAction);
}

// ─── Category 1: Full Template Happy Path ───────────────────────────────────

describe('Category 1: Full template happy path', () => {
  it('walks complete lifecycle from scaffold to display_complete', () => {
    const { actions, finalState } = driveFullPipeline('full', 1, ['T01']);

    const expected = [
      'spawn_research', 'spawn_prd', 'spawn_design',
      'spawn_architecture', 'spawn_master_plan', 'request_plan_approval',
      'create_phase_plan', 'create_task_handoff', 'execute_task',
      'spawn_code_reviewer', 'invoke_source_control_commit',
      'generate_phase_report', 'spawn_phase_reviewer',
      'spawn_final_reviewer', 'invoke_source_control_pr',
      'request_final_approval', 'display_complete',
    ];

    assert.deepStrictEqual(actions, expected);
    assert.equal(finalState.pipeline.current_tier, 'complete');
  });
});

// ─── Category 2: Quick Template Happy Path ──────────────────────────────────

describe('Category 2: Quick template happy path', () => {
  it('walks complete lifecycle with reduced action sequence', () => {
    const { actions } = driveFullPipeline('quick', 1, ['T01']);

    const expected = [
      'spawn_research', 'spawn_prd', 'spawn_architecture',
      'request_plan_approval',
      'create_phase_plan', 'create_task_handoff', 'execute_task',
      'spawn_final_reviewer', 'request_final_approval', 'display_complete',
    ];

    assert.deepStrictEqual(actions, expected);
  });

  it('omits design, master_plan, code_review, SC commit, phase_report, phase_review, PR', () => {
    const { actions } = driveFullPipeline('quick', 1, ['T01']);

    const omitted = [
      'spawn_design', 'spawn_master_plan',
      'spawn_code_reviewer', 'invoke_source_control_commit',
      'generate_phase_report', 'spawn_phase_reviewer',
      'invoke_source_control_pr',
    ];

    for (const action of omitted) {
      assert.ok(!actions.includes(action), 'Expected ' + action + ' to be omitted');
    }
  });

  it('quick action count is less than full action count', () => {
    const { actions: quickActions } = driveFullPipeline('quick', 1, ['T01']);
    const { actions: fullActions } = driveFullPipeline('full', 1, ['T01']);
    assert.ok(quickActions.length < fullActions.length);
  });

  it('adapter-derived planning.steps omits design and master_plan', () => {
    const { finalState } = driveFullPipeline('quick', 1, ['T01']);
    const adapterView = computeNestedView(finalState.dag);
    const stepNames = adapterView.planning.steps.map(s => s.name);

    assert.ok(!stepNames.includes('design'), 'design should not appear');
    assert.ok(!stepNames.includes('master_plan'), 'master_plan should not appear');
    assert.deepStrictEqual(stepNames, ['research', 'prd', 'architecture']);
  });
});

// ─── Category 3: Corrective Task Path ───────────────────────────────────────

describe('Category 3: Corrective task path', () => {
  it('changes_requested injects corrective nodes and pipeline recovers', () => {
    const { io, config } = scaffoldPipeline('full', 1, ['T01']);

    // Drive to spawn_code_reviewer (stops before firing its events)
    driveTo(io, config, 'spawn_code_reviewer');

    // Fire code_review_completed with changes_requested
    const r = processEvent(
      'code_review_completed', PROJECT_DIR, { doc_path: 'cr-reject.md' }, io
    );
    assert.equal(r.success, true);
    assert.equal(r.action, 'create_task_handoff');

    const s = io.getState();

    // Corrective nodes injected
    assert.ok(s.dag.nodes['P01.T01.create_task_handoff_r1'], 'corrective handoff node exists');
    assert.ok(s.dag.nodes['P01.T01.execute_coding_task_r1'], 'corrective execute node exists');
    assert.ok(s.dag.nodes['P01.T01.code_review_r1'], 'corrective review node exists');

    // Execution order includes corrective nodes
    assert.ok(s.dag.execution_order.includes('P01.T01.create_task_handoff_r1'));
    assert.ok(s.dag.execution_order.includes('P01.T01.execute_coding_task_r1'));
    assert.ok(s.dag.execution_order.includes('P01.T01.code_review_r1'));

    // Task retries incremented
    assert.equal(s.execution.phases[0].tasks[0].retries, 1);

    // Drive corrective cycle to approval
    const correctiveEvents = [
      ['task_handoff_started', {}],
      ['task_handoff_created', { doc_path: 'th.md' }],
      ['task_completed', {}],
      ['code_review_completed', { doc_path: 'cr.md' }],
    ];
    for (const [event, ctx] of correctiveEvents) {
      const e = processEvent(event, PROJECT_DIR, ctx, io);
      if (!e.success) {
        throw new Error('Corrective ' + event + ' failed: ' + JSON.stringify(e.context));
      }
    }

    // Task is now complete after corrective cycle
    assert.equal(io.getState().execution.phases[0].tasks[0].status, 'complete');

    // Drive remaining pipeline — verify it continues to generate_phase_report
    const remaining = driveTo(io, config, 'generate_phase_report');
    assert.ok(
      remaining.includes('invoke_source_control_commit'),
      'pipeline should reach SC commit after corrective cycle'
    );
    assert.equal(
      remaining[remaining.length - 1], 'generate_phase_report',
      'pipeline should reach generate_phase_report'
    );
  });
});

// ─── Category 4: Halt on Retry Exhaustion ───────────────────────────────────

describe('Category 4: Halt on retry exhaustion', () => {
  it('max_retries_per_task: 0 + changes_requested → display_halted', () => {
    const { io, config } = scaffoldPipeline('full', 1, ['T01'], {
      limits: { max_retries_per_task: 0 },
    });

    // Drive to spawn_code_reviewer
    driveTo(io, config, 'spawn_code_reviewer');

    // Fire code_review_completed with changes_requested
    const r = processEvent(
      'code_review_completed', PROJECT_DIR, { doc_path: 'cr-reject.md' }, io
    );
    assert.equal(r.success, true);
    assert.equal(r.action, 'display_halted');

    const s = io.getState();
    assert.equal(s.dag.nodes['P01.T01.code_review'].status, 'halted');
    assert.equal(s.execution.phases[0].tasks[0].status, 'halted');
    assert.equal(s.execution.phases[0].tasks[0].review.action, 'halted');

    // No corrective nodes injected
    assert.equal(s.dag.nodes['P01.T01.create_task_handoff_r1'], undefined);
  });
});

// ─── Category 5: Adapter Fidelity ───────────────────────────────────────────

describe('Category 5: Adapter fidelity', () => {
  it('state sections match computeNestedView after full walk-through', () => {
    const { finalState } = driveFullPipeline('full', 1, ['T01']);
    const adapterView = computeNestedView(finalState.dag);

    // Planning: 5 steps, all complete
    assert.equal(finalState.planning.steps.length, 5);
    for (const step of finalState.planning.steps) {
      assert.equal(step.status, 'complete', 'state step ' + step.name + ' should be complete');
    }

    // Adapter planning matches state planning
    assert.equal(adapterView.planning.status, finalState.planning.status);
    assert.equal(adapterView.planning.human_approved, finalState.planning.human_approved);
    assert.equal(adapterView.planning.steps.length, 5);
    for (let i = 0; i < 5; i++) {
      assert.equal(adapterView.planning.steps[i].name, finalState.planning.steps[i].name);
      assert.equal(adapterView.planning.steps[i].status, finalState.planning.steps[i].status);
      assert.equal(adapterView.planning.steps[i].doc_path, finalState.planning.steps[i].doc_path);
    }

    // Execution: phase complete
    assert.equal(finalState.execution.phases[0].tasks[0].status, 'complete');
    assert.equal(finalState.execution.phases[0].stage, 'complete');
    assert.equal(adapterView.execution.phases.length, finalState.execution.phases.length);
    assert.equal(adapterView.execution.phases[0].status, finalState.execution.phases[0].status);
    assert.equal(adapterView.execution.phases[0].stage, finalState.execution.phases[0].stage);

    // Final review
    assert.ok(finalState.final_review.status);
    assert.equal(adapterView.final_review.status, finalState.final_review.status);
    assert.equal(adapterView.final_review.doc_path, finalState.final_review.doc_path);
    assert.equal(adapterView.final_review.human_approved, finalState.final_review.human_approved);
  });
});

// ─── Category 6: Multi-Phase Walk-Through ───────────────────────────────────

describe('Category 6: Multi-phase walk-through', () => {
  it('2 phases, 1 task each — both complete with correct DAG nodes', () => {
    const { actions, finalState } = driveFullPipeline('full', 2, ['T01']);

    // Both phases exist and complete
    assert.equal(finalState.execution.phases.length, 2);
    assert.equal(finalState.execution.phases[0].status, 'complete');
    assert.equal(finalState.execution.phases[1].status, 'complete');

    // P02 nodes exist in DAG
    assert.ok(finalState.dag.nodes['P02.create_phase_plan'], 'P02 phase plan node exists');

    // Action sequence includes two create_phase_plan actions (one per phase)
    const phasePlanCount = actions.filter(a => a === 'create_phase_plan').length;
    assert.equal(phasePlanCount, 2, 'should have 2 create_phase_plan actions');

    // Terminal action
    assert.equal(actions[actions.length - 1], 'display_complete');
    assert.equal(finalState.pipeline.current_tier, 'complete');
  });
});

// ─── Category 7: Final State Shape Verification ─────────────────────────────

describe('Category 7: Final state shape verification', () => {
  it('terminal state has correct v5 structure', () => {
    const { finalState } = driveFullPipeline('full', 1, ['T01']);

    // v5 schema
    assert.equal(finalState.$schema, 'orchestration-state-v5');

    // DAG structure
    assert.ok(finalState.dag);
    assert.equal(typeof finalState.dag.template_name, 'string');
    assert.equal(typeof finalState.dag.nodes, 'object');
    assert.ok(Array.isArray(finalState.dag.execution_order));

    // All DAG nodes complete or skipped
    for (const [id, node] of Object.entries(finalState.dag.nodes)) {
      assert.ok(
        node.status === 'complete' || node.status === 'skipped',
        'Node ' + id + ' should be complete or skipped, got ' + node.status
      );
    }

    // Pipeline tier
    assert.equal(finalState.pipeline.current_tier, 'complete');

    // Execution status
    assert.equal(finalState.execution.status, 'complete');
  });
});
