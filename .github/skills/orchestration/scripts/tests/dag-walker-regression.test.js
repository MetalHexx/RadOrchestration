'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { resolveNextAction: resolverResolve } = require('../lib/resolver.js');
const { resolveNextAction: walkerResolve } = require('../lib/dag-walker.js');
const { makeDagNode, makeDagState, makeExpandedDag } = require('./helpers/test-helpers.js');

// ─── Resolver Factories (replicated from resolver.test.js) ──────────────────

function makeTask(overrides = {}) {
  return {
    name: 'task',
    status: 'not_started',
    stage: 'planning',
    docs: { handoff: null, review: null },
    review: { verdict: null, action: null },
    retries: 0,
    ...overrides,
  };
}

function makePhase(overrides = {}, taskOverrides = []) {
  const tasks = taskOverrides.length > 0
    ? taskOverrides.map(t => makeTask(t))
    : [makeTask()];
  return {
    name: 'phase',
    status: 'not_started',
    stage: 'planning',
    current_task: 0,
    tasks,
    docs: { phase_plan: null, phase_report: null, phase_review: null },
    review: { verdict: null, action: null },
    ...overrides,
    ...(overrides.tasks ? {} : { tasks }),
  };
}

function makePlanningStep(name, status = 'not_started') {
  return { name, status, doc_path: status === 'complete' ? `docs/${name}.md` : null };
}

function makeResolverState(overrides = {}) {
  const base = {
    $schema: 'orchestration-state-v4',
    project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:01.000Z' },
    pipeline: { current_tier: 'execution' },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        makePlanningStep('research', 'complete'),
        makePlanningStep('prd', 'complete'),
        makePlanningStep('design', 'complete'),
        makePlanningStep('architecture', 'complete'),
        makePlanningStep('master_plan', 'complete'),
      ],
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [makePhase()],
    },
    final_review: { status: 'not_started', doc_path: null, human_approved: false },
  };
  const result = { ...base };
  if (overrides.project) result.project = { ...base.project, ...overrides.project };
  if (overrides.pipeline) result.pipeline = { ...base.pipeline, ...overrides.pipeline };
  if (overrides.planning) result.planning = { ...base.planning, ...overrides.planning };
  if (overrides.execution) result.execution = { ...base.execution, ...overrides.execution };
  if (overrides.final_review) result.final_review = { ...base.final_review, ...overrides.final_review };
  return result;
}

function makeConfig(overrides = {}) {
  const base = {
    human_gates: { execution_mode: 'autonomous', after_final_review: true },
    limits: { max_retries_per_task: 2, max_phases: 10, max_tasks_per_phase: 15 },
  };
  if (overrides.human_gates) base.human_gates = { ...base.human_gates, ...overrides.human_gates };
  if (overrides.limits) base.limits = { ...base.limits, ...overrides.limits };
  return base;
}

// ─── Walker State Helpers ───────────────────────────────────────────────────

/**
 * Build a minimal v5 state for the DAG walker.
 */
function makeWalkerState(nodes, executionOrder, pipelineOverrides = {}) {
  return {
    pipeline: Object.assign(
      { current_tier: 'execution', gate_mode: 'autonomous', source_control: null },
      pipelineOverrides,
    ),
    dag: makeDagState({ nodes, execution_order: executionOrder }),
    config: { human_gates: { execution_mode: 'autonomous' } },
  };
}

/**
 * Load the full.yml expanded template and return { nodes, execution_order }.
 * Planning step nodes need context.step added manually.
 */
const FULL_DAG = makeExpandedDag('full');

const PLANNING_STEP_MAP = {
  research: 'research',
  create_prd: 'prd',
  create_design: 'design',
  create_architecture: 'architecture',
  create_master_plan: 'master_plan',
};

/**
 * Build a planning-tier walker state from the full template.
 * Sets nodes as complete up through completedNodeIds, adds context.step to planning steps.
 */
function makePlanningWalkerState(completedNodeIds = []) {
  const nodes = {};
  for (const [id, node] of Object.entries(FULL_DAG.nodes)) {
    nodes[id] = { ...node };
    // Add context.step for planning step nodes
    if (PLANNING_STEP_MAP[id]) {
      nodes[id].context = { step: PLANNING_STEP_MAP[id] };
    }
    if (completedNodeIds.includes(id)) {
      nodes[id].status = 'complete';
    }
  }
  return makeWalkerState(nodes, FULL_DAG.execution_order, {
    current_tier: 'planning',
    gate_mode: null,
    source_control: null,
  });
}

/**
 * Build a resolver planning state with specific completed steps.
 */
function planningResolverState(completedSteps = []) {
  const steps = ['research', 'prd', 'design', 'architecture', 'master_plan'].map(name =>
    makePlanningStep(name, completedSteps.includes(name) ? 'complete' : 'not_started')
  );
  return makeResolverState({
    pipeline: { current_tier: 'planning' },
    planning: { status: 'in_progress', human_approved: false, steps },
    execution: { status: 'not_started', current_phase: 0, phases: [] },
  });
}

// ─── Assertion Helpers ──────────────────────────────────────────────────────

/**
 * Assert walker result action matches resolver result action,
 * and all resolver context fields are present in walker context with same values.
 *
 * Options:
 *   haltedDetailsLoose - only check details is non-empty string (halted messages differ)
 *   gateActionOnly     - only check action matches (walker gates return context: {},
 *                        resolver gates include phase/task IDs — known divergence:
 *                        mapGateNode intentionally returns empty context because the
 *                        orchestrator derives scope from the node ID)
 */
function assertMatch(resolverResult, walkerResult, { haltedDetailsLoose = false, gateActionOnly = false } = {}) {
  assert.equal(walkerResult.action, resolverResult.action,
    `action mismatch: walker=${walkerResult.action}, resolver=${resolverResult.action}`);

  if (gateActionOnly) {
    // Gate actions match but context fields intentionally differ.
    // Walker gates return {} — the orchestrator derives phase/task scope from the node ID.
    return;
  }

  if (haltedDetailsLoose) {
    // For halted scenarios, just check details is a non-empty string
    assert.equal(typeof walkerResult.context.details, 'string');
    assert.ok(walkerResult.context.details.length > 0, 'halted context.details should be non-empty');
  } else {
    // Check every resolver context field exists in walker context with same value
    for (const [key, value] of Object.entries(resolverResult.context)) {
      assert.deepStrictEqual(walkerResult.context[key], value,
        `context.${key} mismatch: walker=${JSON.stringify(walkerResult.context[key])}, resolver=${JSON.stringify(value)}`);
    }
  }
}

// ─── Planning Tier Regression ───────────────────────────────────────────────

describe('regression — planning tier', () => {
  const config = makeConfig();

  it('fresh project → spawn_research with context.step=research', () => {
    const resolverResult = resolverResolve(planningResolverState([]), config);
    const walkerResult = walkerResolve(makePlanningWalkerState([]), config);
    assertMatch(resolverResult, walkerResult);
  });

  it('research complete → spawn_prd with context.step=prd', () => {
    const resolverResult = resolverResolve(planningResolverState(['research']), config);
    const walkerResult = walkerResolve(makePlanningWalkerState(['research']), config);
    assertMatch(resolverResult, walkerResult);
  });

  it('research+prd complete → spawn_design with context.step=design', () => {
    const resolverResult = resolverResolve(planningResolverState(['research', 'prd']), config);
    const walkerResult = walkerResolve(makePlanningWalkerState(['research', 'create_prd']), config);
    assertMatch(resolverResult, walkerResult);
  });

  it('research+prd+design complete → spawn_architecture with context.step=architecture', () => {
    const resolverResult = resolverResolve(planningResolverState(['research', 'prd', 'design']), config);
    const walkerResult = walkerResolve(makePlanningWalkerState(['research', 'create_prd', 'create_design']), config);
    assertMatch(resolverResult, walkerResult);
  });

  it('all except master_plan complete → spawn_master_plan with context.step=master_plan', () => {
    const resolverResult = resolverResolve(planningResolverState(['research', 'prd', 'design', 'architecture']), config);
    const walkerResult = walkerResolve(makePlanningWalkerState(['research', 'create_prd', 'create_design', 'create_architecture']), config);
    assertMatch(resolverResult, walkerResult);
  });

  it('all planning steps complete, human_approved=false → request_plan_approval', () => {
    const resolverState = planningResolverState(['research', 'prd', 'design', 'architecture', 'master_plan']);
    const resolverResult = resolverResolve(resolverState, config);

    const allPlanningNodes = ['research', 'create_prd', 'create_design', 'create_architecture', 'create_master_plan'];
    const walkerResult = walkerResolve(makePlanningWalkerState(allPlanningNodes), config);
    assertMatch(resolverResult, walkerResult);
  });

  it('all planning steps complete, human_approved=true, tier still planning → display_halted', () => {
    const resolverState = planningResolverState(['research', 'prd', 'design', 'architecture', 'master_plan']);
    resolverState.planning.human_approved = true;
    const resolverResult = resolverResolve(resolverState, config);

    // For walker: all planning nodes + gate complete, but for_each_phase is not ready
    // because its deps are met, it would become the next ready node (a container).
    // Actually, if gate is complete the for_each_phase becomes ready, returning container action.
    // But the resolver returns display_halted because planning is approved but tier is still planning.
    //
    // This scenario is "unreachable" in both systems — the mutation should have transitioned the tier.
    // The walker doesn't have this exact path — once gate is complete, the next node (for_each_phase)
    // would be ready. So we test the halted state differently: set all planning nodes + gate complete
    // AND mark for_each_phase as not_started so it would be the next node. The walker returns
    // a container-awaiting action, not display_halted. However, the resolver's "unreachable" path
    // is a dead-code safeguard — in practice the tier would have been advanced.
    //
    // For this regression, we test the halted tier directly — set current_tier=halted so both
    // systems agree on the same action.
    // NOTE: This is a known divergence. The resolver's "Unreachable" halt path doesn't have a
    // 1:1 DAG equivalent because the walker never sees this state. We document it and test
    // that both produce display_halted for the halted tier instead.
    assert.equal(resolverResult.action, 'display_halted');

    // Walker halted-tier equivalent:
    const allNodeIds = ['research', 'create_prd', 'create_design', 'create_architecture', 'create_master_plan', 'request_plan_approval'];
    const walkerState = makePlanningWalkerState(allNodeIds);
    walkerState.pipeline.current_tier = 'halted';
    const walkerResult = walkerResolve(walkerState, config);
    assertMatch(resolverResult, walkerResult, { haltedDetailsLoose: true });
  });
});

// ─── Execution Tier — Phase Stage Routing Regression ────────────────────────

describe('regression — execution tier — phase stage routing', () => {
  it('phase.stage=planning → create_phase_plan with phase_number, phase_id', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({ status: 'not_started', stage: 'planning' })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: single phase-scoped node for create_phase_plan
    const nodes = {
      'P01.create_phase_plan': makeDagNode({
        id: 'P01.create_phase_plan',
        type: 'step',
        action: 'create_phase_plan',
        status: 'not_started',
        depends_on: [],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.create_phase_plan']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('phase.stage=executing with active task → task-level action', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'planning' }]
        )],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: phase plan complete, task handoff is next ready node
    const nodes = {
      'P01.create_phase_plan': makeDagNode({
        id: 'P01.create_phase_plan',
        type: 'step',
        action: 'create_phase_plan',
        status: 'complete',
        depends_on: [],
        phase_number: 1,
      }),
      'P01.T01.create_task_handoff': makeDagNode({
        id: 'P01.T01.create_task_handoff',
        type: 'step',
        action: 'create_task_handoff',
        status: 'not_started',
        depends_on: ['P01.create_phase_plan'],
        phase_number: 1,
        task_number: 1,
        context: { is_correction: false },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.create_phase_plan', 'P01.T01.create_task_handoff']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('phase.stage=reviewing → spawn_phase_reviewer with phase_report_doc, phase_number, phase_id', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          stage: 'reviewing',
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: null },
        })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    const nodes = {
      'P01.generate_phase_report': makeDagNode({
        id: 'P01.generate_phase_report',
        type: 'step',
        action: 'generate_phase_report',
        status: 'complete',
        depends_on: [],
        phase_number: 1,
      }),
      'P01.phase_review': makeDagNode({
        id: 'P01.phase_review',
        type: 'step',
        action: 'spawn_phase_reviewer',
        status: 'not_started',
        depends_on: ['P01.generate_phase_report'],
        phase_number: 1,
        docs: { phase_report: 'reports/pr.md' },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.generate_phase_report', 'P01.phase_review']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('phase.stage=complete, review.action=advanced, gate_mode=phase → gate_phase', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          stage: 'complete',
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: 'reviews/pvr.md' },
          review: { verdict: 'approved', action: 'advanced' },
        })],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'phase' } });
    const resolverResult = resolverResolve(resolverState, config);

    const nodes = {
      'P01.phase_review': makeDagNode({
        id: 'P01.phase_review',
        type: 'step',
        action: 'spawn_phase_reviewer',
        status: 'complete',
        depends_on: [],
        phase_number: 1,
      }),
      'P01.gate_phase': makeDagNode({
        id: 'P01.gate_phase',
        type: 'gate',
        gate_type: 'phase',
        action: 'gate_phase',
        status: 'not_started',
        depends_on: ['P01.phase_review'],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.phase_review', 'P01.gate_phase'], {
      current_tier: 'execution',
      gate_mode: 'phase',
      source_control: null,
    });
    const walkerResult = walkerResolve(walkerState, config);
    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });
});

// ─── Execution Tier — Phase FAILED Routing Regression ───────────────────────

describe('regression — execution tier — phase FAILED routing', () => {
  it('phase.stage=failed, review.action=corrective_tasks_issued → create_phase_plan with is_correction, previous_review', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'failed',
          stage: 'failed',
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: 'reviews/pvr.md' },
          review: { verdict: 'changes_requested', action: 'corrective_tasks_issued' },
        })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: corrective phase plan node
    const nodes = {
      'P01.create_phase_plan_corrective': makeDagNode({
        id: 'P01.create_phase_plan_corrective',
        type: 'step',
        action: 'create_phase_plan',
        status: 'not_started',
        depends_on: [],
        phase_number: 1,
        context: { is_correction: true, previous_review: 'reviews/pvr.md' },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.create_phase_plan_corrective']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('phase.stage=failed, review.action=null → display_halted', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'failed',
          stage: 'failed',
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: null },
          review: { verdict: null, action: null },
        })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: halted tier produces same action
    const nodes = {
      'P01.stuck': makeDagNode({
        id: 'P01.stuck',
        type: 'step',
        action: 'create_phase_plan',
        status: 'failed',
        depends_on: [],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.stuck'], { current_tier: 'halted', gate_mode: null, source_control: null });
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult, { haltedDetailsLoose: true });
  });

  it('phase.stage=failed, review.action=halted → display_halted', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'failed',
          stage: 'failed',
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: 'reviews/pvr.md' },
          review: { verdict: null, action: 'halted' },
        })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: halted tier
    const nodes = {
      'P01.halted': makeDagNode({
        id: 'P01.halted',
        type: 'step',
        action: 'create_phase_plan',
        status: 'halted',
        depends_on: [],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.halted'], { current_tier: 'halted', gate_mode: null, source_control: null });
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult, { haltedDetailsLoose: true });
  });
});

// ─── Execution Tier — Task Stage Routing Regression ─────────────────────────

describe('regression — execution tier — task stage routing', () => {
  it('task.stage=planning → create_task_handoff with is_correction=false, phase/task IDs', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'planning' }]
        )],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    const nodes = {
      'P01.T01.create_task_handoff': makeDagNode({
        id: 'P01.T01.create_task_handoff',
        type: 'step',
        action: 'create_task_handoff',
        status: 'not_started',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
        context: { is_correction: false },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.create_task_handoff']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('task.stage=coding → execute_task with handoff_doc, phase/task IDs', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'coding', status: 'in_progress', docs: { handoff: 'tasks/handoff.md', review: null } }]
        )],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    const nodes = {
      'P01.T01.execute_coding_task': makeDagNode({
        id: 'P01.T01.execute_coding_task',
        type: 'step',
        action: 'execute_task',
        status: 'not_started',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
        docs: { handoff: 'tasks/handoff.md' },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.execute_coding_task']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('task.stage=reviewing → spawn_code_reviewer with phase/task IDs', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'reviewing', status: 'complete', docs: { handoff: 'tasks/handoff.md', review: null } }]
        )],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    const nodes = {
      'P01.T01.code_review': makeDagNode({
        id: 'P01.T01.code_review',
        type: 'step',
        action: 'spawn_code_reviewer',
        status: 'not_started',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('task.stage=complete, review.action=advanced, gate_mode=task → gate_task', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }]
        )],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const resolverResult = resolverResolve(resolverState, config);

    const nodes = {
      'P01.T01.code_review': makeDagNode({
        id: 'P01.T01.code_review',
        type: 'step',
        action: 'spawn_code_reviewer',
        status: 'complete',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
      }),
      'P01.T01.gate_task': makeDagNode({
        id: 'P01.T01.gate_task',
        type: 'gate',
        gate_type: 'task',
        action: 'gate_task',
        status: 'not_started',
        depends_on: ['P01.T01.code_review'],
        phase_number: 1,
        task_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review', 'P01.T01.gate_task'], {
      current_tier: 'execution',
      gate_mode: 'task',
      source_control: null,
    });
    const walkerResult = walkerResolve(walkerState, config);
    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });

  it('task.stage=failed, review.action=corrective_task_issued → create_task_handoff with is_correction, previous_review, reason', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'failed', status: 'failed', docs: { handoff: 'tasks/handoff.md', review: 'reviews/rv.md' }, review: { verdict: 'changes_requested', action: 'corrective_task_issued' } }]
        )],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    const nodes = {
      'P01.T01.create_task_handoff_corrective': makeDagNode({
        id: 'P01.T01.create_task_handoff_corrective',
        type: 'step',
        action: 'create_task_handoff',
        status: 'not_started',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
        context: {
          is_correction: true,
          previous_review: 'reviews/rv.md',
          reason: 'changes_requested',
        },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.create_task_handoff_corrective']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });
});

// ─── Phase Completion Regression ────────────────────────────────────────────

describe('regression — execution tier — phase completion', () => {
  it('all tasks done (current_task > tasks.length equivalent) → generate_phase_report', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          stage: 'executing',
          current_task: 2,
        }, [{
          stage: 'complete',
          status: 'complete',
          docs: { handoff: 'h.md', review: 'rv.md' },
          review: { verdict: 'approved', action: 'advanced' },
        }])],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: all task nodes complete, generate_phase_report is next ready
    const nodes = {
      'P01.T01.create_task_handoff': makeDagNode({
        id: 'P01.T01.create_task_handoff',
        type: 'step',
        action: 'create_task_handoff',
        status: 'complete',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
      }),
      'P01.T01.code_review': makeDagNode({
        id: 'P01.T01.code_review',
        type: 'step',
        action: 'spawn_code_reviewer',
        status: 'complete',
        depends_on: ['P01.T01.create_task_handoff'],
        phase_number: 1,
        task_number: 1,
      }),
      'P01.generate_phase_report': makeDagNode({
        id: 'P01.generate_phase_report',
        type: 'step',
        action: 'generate_phase_report',
        status: 'not_started',
        depends_on: ['P01.T01.code_review'],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, [
      'P01.T01.create_task_handoff', 'P01.T01.code_review', 'P01.generate_phase_report',
    ]);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });
});

// ─── Gates Regression ───────────────────────────────────────────────────────

describe('regression — gates', () => {
  it('task advanced, gate_mode=task → gate_task', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }]
        )],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const resolverResult = resolverResolve(resolverState, config);

    const nodes = {
      'P01.T01.code_review': makeDagNode({ id: 'P01.T01.code_review', type: 'step', action: 'spawn_code_reviewer', status: 'complete', depends_on: [], phase_number: 1, task_number: 1 }),
      'P01.T01.gate_task': makeDagNode({ id: 'P01.T01.gate_task', type: 'gate', gate_type: 'task', action: 'gate_task', status: 'not_started', depends_on: ['P01.T01.code_review'], phase_number: 1, task_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review', 'P01.T01.gate_task'], { current_tier: 'execution', gate_mode: 'task', source_control: null });
    const walkerResult = walkerResolve(walkerState, config);
    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });

  it('phase advanced, gate_mode=phase → gate_phase', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          stage: 'complete',
          current_task: 2,
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: 'reviews/pvr.md' },
          review: { verdict: 'approved', action: 'advanced' },
        }, [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }])],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'phase' } });
    const resolverResult = resolverResolve(resolverState, config);

    const nodes = {
      'P01.phase_review': makeDagNode({ id: 'P01.phase_review', type: 'step', action: 'spawn_phase_reviewer', status: 'complete', depends_on: [], phase_number: 1 }),
      'P01.gate_phase': makeDagNode({ id: 'P01.gate_phase', type: 'gate', gate_type: 'phase', action: 'gate_phase', status: 'not_started', depends_on: ['P01.phase_review'], phase_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.phase_review', 'P01.gate_phase'], { current_tier: 'execution', gate_mode: 'phase', source_control: null });
    const walkerResult = walkerResolve(walkerState, config);
    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });

  it('phase advanced, gate_mode=task → gate_phase (task mode also gates phases)', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          stage: 'complete',
          current_task: 2,
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: 'reviews/pvr.md' },
          review: { verdict: 'approved', action: 'advanced' },
        }, [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }])],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const resolverResult = resolverResolve(resolverState, config);

    const nodes = {
      'P01.phase_review': makeDagNode({ id: 'P01.phase_review', type: 'step', action: 'spawn_phase_reviewer', status: 'complete', depends_on: [], phase_number: 1 }),
      'P01.gate_phase': makeDagNode({ id: 'P01.gate_phase', type: 'gate', gate_type: 'phase', action: 'gate_phase', status: 'not_started', depends_on: ['P01.phase_review'], phase_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.phase_review', 'P01.gate_phase'], { current_tier: 'execution', gate_mode: 'task', source_control: null });
    const walkerResult = walkerResolve(walkerState, config);
    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });

  it('autonomous mode → walker returns null (auto-advance signal); resolver skips gate', () => {
    // Resolver: autonomous mode skips gate entirely (falls through to halted in this case
    // because the mutation should have advanced the pointer)
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }]
        )],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'autonomous' } });
    const resolverResult = resolverResolve(resolverState, config);

    // Walker: gate node is ready, autonomous mode → mapGateNode returns null
    // resolveNextAction returns null
    const nodes = {
      'P01.T01.code_review': makeDagNode({ id: 'P01.T01.code_review', type: 'step', action: 'spawn_code_reviewer', status: 'complete', depends_on: [], phase_number: 1, task_number: 1 }),
      'P01.T01.gate_task': makeDagNode({ id: 'P01.T01.gate_task', type: 'gate', gate_type: 'task', action: 'gate_task', status: 'not_started', depends_on: ['P01.T01.code_review'], phase_number: 1, task_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review', 'P01.T01.gate_task'], {
      current_tier: 'execution',
      gate_mode: 'autonomous',
      source_control: null,
    });
    const walkerResult = walkerResolve(walkerState, config);

    // Both systems agree: don't produce a gate action.
    // Resolver returns a halted fallthrough; walker returns null (auto-advance signal).
    // The mechanism differs but the intent is the same: no gate prompt.
    // Document: walker null === "auto-advance, re-invoke after marking gate complete"
    assert.notEqual(resolverResult.action, 'gate_task');
    assert.notEqual(resolverResult.action, 'gate_phase');
    assert.equal(walkerResult, null, 'walker should return null for autonomous gate (auto-advance signal)');
  });

  it('skips gate when mode is ask', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }]
        )],
      },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'ask' } });
    const resolverResult = resolverResolve(resolverState, config);

    const nodes = {
      'P01.T01.code_review': makeDagNode({ id: 'P01.T01.code_review', type: 'step', action: 'spawn_code_reviewer', status: 'complete', depends_on: [], phase_number: 1, task_number: 1 }),
      'P01.T01.gate_task': makeDagNode({ id: 'P01.T01.gate_task', type: 'gate', gate_type: 'task', action: 'gate_task', status: 'not_started', depends_on: ['P01.T01.code_review'], phase_number: 1, task_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review', 'P01.T01.gate_task'], {
      current_tier: 'execution',
      gate_mode: null,
      source_control: null,
    });
    walkerState.config = { human_gates: { execution_mode: 'ask' } };
    const walkerResult = walkerResolve(walkerState, config);

    assert.equal(walkerResult.action, resolverResult.action);
  });

  it('uses state.config snapshot execution_mode over global config', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }]
        )],
      },
    });
    resolverState.config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const globalConfig = makeConfig({ human_gates: { execution_mode: 'autonomous' } });
    const resolverResult = resolverResolve(resolverState, globalConfig);

    const nodes = {
      'P01.T01.code_review': makeDagNode({ id: 'P01.T01.code_review', type: 'step', action: 'spawn_code_reviewer', status: 'complete', depends_on: [], phase_number: 1, task_number: 1 }),
      'P01.T01.gate_task': makeDagNode({ id: 'P01.T01.gate_task', type: 'gate', gate_type: 'task', action: 'gate_task', status: 'not_started', depends_on: ['P01.T01.code_review'], phase_number: 1, task_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review', 'P01.T01.gate_task'], {
      current_tier: 'execution',
      gate_mode: null,
      source_control: null,
    });
    walkerState.config = { human_gates: { execution_mode: 'task' } };
    const walkerResult = walkerResolve(walkerState, globalConfig);

    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });

  it('falls through to global config when state.config is absent (legacy project)', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }]
        )],
      },
    });
    delete resolverState.config;
    const globalConfig = makeConfig({ human_gates: { execution_mode: 'task' } });
    const resolverResult = resolverResolve(resolverState, globalConfig);

    const nodes = {
      'P01.T01.code_review': makeDagNode({ id: 'P01.T01.code_review', type: 'step', action: 'spawn_code_reviewer', status: 'complete', depends_on: [], phase_number: 1, task_number: 1 }),
      'P01.T01.gate_task': makeDagNode({ id: 'P01.T01.gate_task', type: 'gate', gate_type: 'task', action: 'gate_task', status: 'not_started', depends_on: ['P01.T01.code_review'], phase_number: 1, task_number: 1 }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.T01.code_review', 'P01.T01.gate_task'], {
      current_tier: 'execution',
      gate_mode: null,
      source_control: null,
    });
    delete walkerState.config;
    const walkerResult = walkerResolve(walkerState, globalConfig);

    assertMatch(resolverResult, walkerResult, { gateActionOnly: true });
  });
});

// ─── Review Tier Regression ─────────────────────────────────────────────────

describe('regression — review tier', () => {
  it('tier=review, final review doc not done → spawn_final_reviewer', () => {
    const resolverState = makeResolverState({
      pipeline: { current_tier: 'review' },
      execution: { status: 'complete', current_phase: 0, phases: [] },
      final_review: { status: 'not_started', doc_path: null, human_approved: false },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: for_each_phase complete, create_final_review is next ready
    const nodes = {
      'create_final_review': makeDagNode({
        id: 'create_final_review',
        type: 'step',
        action: 'spawn_final_reviewer',
        status: 'not_started',
        depends_on: [],
      }),
      'invoke_source_control_pr': makeDagNode({
        id: 'invoke_source_control_pr',
        type: 'step',
        action: 'invoke_source_control_pr',
        status: 'not_started',
        depends_on: ['create_final_review'],
      }),
      'request_final_approval': makeDagNode({
        id: 'request_final_approval',
        type: 'gate',
        gate_type: 'final',
        action: 'request_final_approval',
        status: 'not_started',
        depends_on: ['invoke_source_control_pr'],
      }),
    };
    const walkerState = makeWalkerState(nodes, ['create_final_review', 'invoke_source_control_pr', 'request_final_approval'], {
      current_tier: 'review',
      gate_mode: null,
      source_control: null,
    });
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('tier=review, final review done, human_approved=false → request_final_approval', () => {
    const resolverState = makeResolverState({
      pipeline: { current_tier: 'review' },
      execution: { status: 'complete', current_phase: 0, phases: [] },
      final_review: { status: 'in_progress', doc_path: 'reviews/final.md', human_approved: false },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: final review complete, PR complete, gate is next ready
    const nodes = {
      'create_final_review': makeDagNode({
        id: 'create_final_review',
        type: 'step',
        action: 'spawn_final_reviewer',
        status: 'complete',
        depends_on: [],
      }),
      'invoke_source_control_pr': makeDagNode({
        id: 'invoke_source_control_pr',
        type: 'step',
        action: 'invoke_source_control_pr',
        status: 'complete',
        depends_on: ['create_final_review'],
      }),
      'request_final_approval': makeDagNode({
        id: 'request_final_approval',
        type: 'gate',
        gate_type: 'final',
        action: 'request_final_approval',
        status: 'not_started',
        depends_on: ['invoke_source_control_pr'],
      }),
    };
    const walkerState = makeWalkerState(nodes, ['create_final_review', 'invoke_source_control_pr', 'request_final_approval'], {
      current_tier: 'review',
      gate_mode: null,
      source_control: null,
    });
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });
});

// ─── Terminal States Regression ─────────────────────────────────────────────

describe('regression — terminal states', () => {
  it('tier=halted → display_halted with non-empty details', () => {
    const resolverState = makeResolverState({
      pipeline: { current_tier: 'halted' },
      execution: { status: 'halted', current_phase: 0, phases: [] },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    const nodes = {
      'a': makeDagNode({ id: 'a', status: 'not_started', depends_on: [] }),
    };
    const walkerState = makeWalkerState(nodes, ['a'], { current_tier: 'halted', gate_mode: null, source_control: null });
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult, { haltedDetailsLoose: true });
  });

  it('task halted → display_halted with non-empty details', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ status: 'halted', name: 'broken-task' }]
        )],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: stuck pipeline (halted node blocks progress, no ready nodes)
    const nodes = {
      'P01.T01.execute': makeDagNode({
        id: 'P01.T01.execute',
        type: 'step',
        action: 'execute_task',
        status: 'halted',
        depends_on: [],
        phase_number: 1,
        task_number: 1,
      }),
      'P01.T01.code_review': makeDagNode({
        id: 'P01.T01.code_review',
        type: 'step',
        action: 'spawn_code_reviewer',
        status: 'not_started',
        depends_on: ['P01.T01.execute'],
        phase_number: 1,
        task_number: 1,
      }),
    };
    // Halted node is not complete/skipped, so code_review deps not met → stuck → display_halted
    const walkerState = makeWalkerState(nodes, ['P01.T01.execute', 'P01.T01.code_review']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult, { haltedDetailsLoose: true });
  });

  it('phase halted → display_halted with non-empty details', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({ status: 'halted', stage: 'planning', name: 'broken-phase' })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: halted first node → stuck
    const nodes = {
      'P01.create_phase_plan': makeDagNode({
        id: 'P01.create_phase_plan',
        type: 'step',
        action: 'create_phase_plan',
        status: 'halted',
        depends_on: [],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.create_phase_plan']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult, { haltedDetailsLoose: true });
  });

  it('tier=complete (all nodes complete/skipped) → display_complete', () => {
    const resolverState = makeResolverState({
      pipeline: { current_tier: 'complete' },
      execution: { status: 'complete', current_phase: 0, phases: [] },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: all nodes complete → display_complete
    const nodes = {
      'a': makeDagNode({ id: 'a', status: 'complete', depends_on: [] }),
      'b': makeDagNode({ id: 'b', status: 'skipped', depends_on: ['a'] }),
    };
    const walkerState = makeWalkerState(nodes, ['a', 'b']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });
});

// ─── Edge Cases Regression ──────────────────────────────────────────────────

describe('regression — edge cases', () => {
  it('empty phase (no task nodes) → generate_phase_report', () => {
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({ status: 'in_progress', stage: 'executing', current_task: 0, tasks: [] })],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: phase plan complete, no task nodes, generate_phase_report is ready
    const nodes = {
      'P01.create_phase_plan': makeDagNode({
        id: 'P01.create_phase_plan',
        type: 'step',
        action: 'create_phase_plan',
        status: 'complete',
        depends_on: [],
        phase_number: 1,
      }),
      'P01.generate_phase_report': makeDagNode({
        id: 'P01.generate_phase_report',
        type: 'step',
        action: 'generate_phase_report',
        status: 'not_started',
        depends_on: ['P01.create_phase_plan'],
        phase_number: 1,
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P01.create_phase_plan', 'P01.generate_phase_report']);
    const walkerResult = walkerResolve(walkerState, makeConfig());
    assertMatch(resolverResult, walkerResult);
  });

  it('phase/task IDs are 1-based and match resolver format (P01, P02-T03)', () => {
    // Resolver with phase 2, task 3
    const tasks = [
      makeTask({ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }),
      makeTask({ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }),
      makeTask({ stage: 'planning' }),
    ];
    const resolverState = makeResolverState({
      execution: {
        status: 'in_progress',
        current_phase: 2,
        phases: [
          makePhase({ stage: 'complete' }),
          makePhase({ stage: 'executing', status: 'in_progress', current_task: 3, tasks }),
        ],
      },
    });
    const resolverResult = resolverResolve(resolverState, makeConfig());

    // Walker: P02-T03 task handoff
    const nodes = {
      'P02.T03.create_task_handoff': makeDagNode({
        id: 'P02.T03.create_task_handoff',
        type: 'step',
        action: 'create_task_handoff',
        status: 'not_started',
        depends_on: [],
        phase_number: 2,
        task_number: 3,
        context: { is_correction: false },
      }),
    };
    const walkerState = makeWalkerState(nodes, ['P02.T03.create_task_handoff']);
    const walkerResult = walkerResolve(walkerState, makeConfig());

    assert.equal(resolverResult.context.phase_id, 'P02');
    assert.equal(resolverResult.context.task_id, 'P02-T03');
    assertMatch(resolverResult, walkerResult);
  });

  /*
   * EXCLUDED: resolver 'returns display_halted when no phase found at current_phase (out-of-bounds)'
   *
   * This test is resolver-specific because it relies on phases[current_phase - 1] being undefined.
   * The DAG walker has no current_phase pointer — it walks nodes by dependency. The equivalent
   * stuck-DAG scenario (all nodes blocked, no ready node) already produces display_halted and is
   * covered by the terminal halt tests in describe('regression — terminal states').
   */
});
