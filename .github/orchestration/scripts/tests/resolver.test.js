'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveNextAction } = require('../lib/resolver.js');

// ─── Factories ──────────────────────────────────────────────────────────────

function makeTask(overrides = {}) {
  return {
    name: 'task',
    status: 'not_started',
    retries: 0,
    handoff_doc: null,
    report_doc: null,
    review_doc: null,
    review_verdict: null,
    review_action: null,
    has_deviations: false,
    deviation_type: null,
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
    current_task: 0,
    total_tasks: tasks.length,
    tasks,
    phase_plan_doc: null,
    phase_report_doc: null,
    phase_review_doc: null,
    phase_review_verdict: null,
    phase_review_action: null,
    ...overrides,
    ...(overrides.tasks ? {} : { tasks }),
  };
}

function makePlanningStep(name, status = 'not_started') {
  return { name, status, doc_path: status === 'complete' ? `docs/${name}.md` : null };
}

function makeState(overrides = {}) {
  const base = {
    $schema: 'orchestration-state-v3',
    project: {
      name: 'TEST',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:01.000Z',
    },
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
      current_step: 'master_plan',
    },
    execution: {
      status: 'in_progress',
      current_tier: 'execution',
      current_phase: 0,
      total_phases: 1,
      phases: [makePhase()],
    },
  };

  // Deep merge overrides
  const result = { ...base };
  if (overrides.project) result.project = { ...base.project, ...overrides.project };
  if (overrides.planning) result.planning = { ...base.planning, ...overrides.planning };
  if (overrides.execution) result.execution = { ...base.execution, ...overrides.execution };
  return result;
}

function makeConfig(overrides = {}) {
  const base = {
    human_gates: {
      execution_mode: 'autonomous',
      after_final_review: true,
    },
    limits: {
      max_retries_per_task: 2,
      max_phases: 10,
      max_tasks_per_phase: 15,
    },
  };
  if (overrides.human_gates) base.human_gates = { ...base.human_gates, ...overrides.human_gates };
  if (overrides.limits) base.limits = { ...base.limits, ...overrides.limits };
  return base;
}

// ─── Structural Tests ───────────────────────────────────────────────────────

describe('resolver — structural', () => {
  it('resolveNextAction is a function', () => {
    assert.equal(typeof resolveNextAction, 'function');
  });

  it('module exports only resolveNextAction', () => {
    const mod = require('../lib/resolver.js');
    const keys = Object.keys(mod);
    assert.deepEqual(keys, ['resolveNextAction']);
  });

  it('return value always has action (string) and context (object)', () => {
    const state = makeState({ execution: { ...makeState().execution, current_tier: 'complete' } });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(typeof result.action, 'string');
    assert.equal(typeof result.context, 'object');
    assert.notEqual(result.context, null);
  });
});

// ─── Planning Tier Tests ────────────────────────────────────────────────────

describe('resolver — planning tier', () => {
  function planningState(completedSteps = []) {
    const steps = ['research', 'prd', 'design', 'architecture', 'master_plan'].map(name =>
      makePlanningStep(name, completedSteps.includes(name) ? 'complete' : 'not_started')
    );
    return makeState({
      planning: {
        status: 'in_progress',
        human_approved: false,
        steps,
        current_step: completedSteps.length > 0 ? completedSteps[completedSteps.length - 1] : 'research',
      },
      execution: {
        status: 'not_started',
        current_tier: 'planning',
        current_phase: 0,
        total_phases: 0,
        phases: [],
      },
    });
  }

  it('returns spawn_research when research step is not complete', () => {
    const result = resolveNextAction(planningState([]), makeConfig());
    assert.equal(result.action, 'spawn_research');
    assert.equal(result.context.step, 'research');
  });

  it('returns spawn_prd when research is complete but prd is not', () => {
    const result = resolveNextAction(planningState(['research']), makeConfig());
    assert.equal(result.action, 'spawn_prd');
    assert.equal(result.context.step, 'prd');
  });

  it('returns spawn_design when research+prd complete but design is not', () => {
    const result = resolveNextAction(planningState(['research', 'prd']), makeConfig());
    assert.equal(result.action, 'spawn_design');
    assert.equal(result.context.step, 'design');
  });

  it('returns spawn_architecture when research+prd+design complete but architecture is not', () => {
    const result = resolveNextAction(planningState(['research', 'prd', 'design']), makeConfig());
    assert.equal(result.action, 'spawn_architecture');
    assert.equal(result.context.step, 'architecture');
  });

  it('returns spawn_master_plan when all steps complete except master_plan', () => {
    const result = resolveNextAction(planningState(['research', 'prd', 'design', 'architecture']), makeConfig());
    assert.equal(result.action, 'spawn_master_plan');
    assert.equal(result.context.step, 'master_plan');
  });

  it('returns request_plan_approval when all steps complete and human_approved is false', () => {
    const state = planningState(['research', 'prd', 'design', 'architecture', 'master_plan']);
    // All steps complete but human_approved is false
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'request_plan_approval');
  });

  it('returns display_halted (not request_plan_approval) when all steps complete and human_approved is true but tier is still planning', () => {
    const state = planningState(['research', 'prd', 'design', 'architecture', 'master_plan']);
    state.planning.human_approved = true;
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.includes('Unreachable'));
  });
});

// ─── Execution Tier — Task-Level Tests ──────────────────────────────────────

describe('resolver — execution tier — task level', () => {
  it('returns create_phase_plan when phase status is not_started', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'not_started' })],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(result.context.phase_index, 0);
    assert.equal(result.context.phase_id, 'P01');
  });

  it('returns create_task_handoff when task has no handoff_doc and status is not_started', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{ status: 'not_started' }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(result.context.is_correction, false);
    assert.equal(result.context.phase_index, 0);
    assert.equal(result.context.task_index, 0);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });

  it('returns create_task_handoff with is_correction: true when task failed with corrective_task_issued', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{
          status: 'failed',
          review_doc: 'reviews/review.md',
          review_verdict: 'changes_requested',
          review_action: 'corrective_task_issued',
          report_doc: 'reports/report.md',
          handoff_doc: 'tasks/handoff.md',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(result.context.is_correction, true);
  });

  it('corrective context includes previous_review and reason', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{
          status: 'failed',
          review_doc: 'reviews/r1.md',
          review_verdict: 'changes_requested',
          review_action: 'corrective_task_issued',
          report_doc: 'reports/rpt.md',
          handoff_doc: 'tasks/h.md',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.context.previous_review, 'reviews/r1.md');
    assert.equal(result.context.reason, 'changes_requested');
    assert.equal(result.context.phase_index, 0);
    assert.equal(result.context.task_index, 0);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });

  it('returns execute_task when task has handoff_doc but no report_doc and status is in_progress', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{
          status: 'in_progress',
          handoff_doc: 'tasks/handoff.md',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'execute_task');
    assert.equal(result.context.handoff_doc, 'tasks/handoff.md');
    assert.equal(result.context.phase_index, 0);
    assert.equal(result.context.task_index, 0);
  });

  it('returns spawn_code_reviewer when task status is complete and no review_doc', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{
          status: 'complete',
          handoff_doc: 'tasks/handoff.md',
          report_doc: 'reports/report.md',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(result.context.report_doc, 'reports/report.md');
  });
});

// ─── Execution Tier — Phase-Level Tests ─────────────────────────────────────

describe('resolver — execution tier — phase level', () => {
  it('returns generate_phase_report when all tasks processed and no phase_report_doc', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 1,
          total_tasks: 1,
        }, [{
          status: 'complete',
          handoff_doc: 'h.md',
          report_doc: 'r.md',
          review_doc: 'rv.md',
          review_action: 'advanced',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(result.context.phase_index, 0);
    assert.equal(result.context.phase_id, 'P01');
  });

  it('returns spawn_phase_reviewer when phase_report_doc exists and no phase_review_doc', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 1,
          total_tasks: 1,
          phase_report_doc: 'reports/phase-report.md',
        }, [{
          status: 'complete',
          handoff_doc: 'h.md',
          report_doc: 'r.md',
          review_doc: 'rv.md',
          review_action: 'advanced',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(result.context.phase_report_doc, 'reports/phase-report.md');
    assert.equal(result.context.phase_index, 0);
  });
});

// ─── Gate Tests ─────────────────────────────────────────────────────────────

describe('resolver — gates', () => {
  function completedTaskState() {
    return makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{
          status: 'complete',
          handoff_doc: 'h.md',
          report_doc: 'r.md',
          review_doc: 'rv.md',
          review_verdict: 'approved',
          review_action: 'advanced',
        }])],
      },
    });
  }

  function completedPhaseState() {
    return makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 1,
          total_tasks: 1,
          phase_report_doc: 'reports/pr.md',
          phase_review_doc: 'reviews/pvr.md',
          phase_review_verdict: 'approved',
          phase_review_action: 'advanced',
        }, [{
          status: 'complete',
          handoff_doc: 'h.md',
          report_doc: 'r.md',
          review_doc: 'rv.md',
          review_action: 'advanced',
        }])],
      },
    });
  }

  it('returns gate_task when task review_action is advanced and gate mode is task', () => {
    const state = completedTaskState();
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_task');
    assert.equal(result.context.phase_index, 0);
    assert.equal(result.context.task_index, 0);
  });

  it('returns gate_phase when phase_review_action is advanced and gate mode is phase', () => {
    const state = completedPhaseState();
    const config = makeConfig({ human_gates: { execution_mode: 'phase' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_phase');
    assert.equal(result.context.phase_index, 0);
  });

  it('returns gate_phase when phase_review_action is advanced and gate mode is task (task mode also gates phases)', () => {
    const state = completedPhaseState();
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_phase');
    assert.equal(result.context.phase_index, 0);
  });

  it('skips gate when mode is autonomous', () => {
    const state = completedTaskState();
    const config = makeConfig({ human_gates: { execution_mode: 'autonomous' } });
    const result = resolveNextAction(state, config);
    // Autonomous mode should not return gate_task — returns halted as a safety net
    assert.notEqual(result.action, 'gate_task');
    assert.notEqual(result.action, 'gate_phase');
  });

  it('skips gate when mode is ask', () => {
    const state = completedTaskState();
    const config = makeConfig({ human_gates: { execution_mode: 'ask' } });
    const result = resolveNextAction(state, config);
    assert.notEqual(result.action, 'gate_task');
    assert.notEqual(result.action, 'gate_phase');
  });
});

// ─── Review Tier Tests ──────────────────────────────────────────────────────

describe('resolver — review tier', () => {
  it('returns spawn_final_reviewer when tier is review and no final review doc', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'review',
        current_phase: 0,
        total_phases: 1,
        phases: [],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'spawn_final_reviewer');
  });

  it('returns request_final_approval when final review exists but not human-approved', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'review',
        current_phase: 0,
        total_phases: 1,
        phases: [],
        final_review_doc: 'reviews/final.md',
        final_review_approved: false,
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'request_final_approval');
  });
});

// ─── Terminal Tests ─────────────────────────────────────────────────────────

describe('resolver — terminal', () => {
  it('returns display_halted when tier is halted', () => {
    const state = makeState({
      execution: {
        status: 'halted',
        current_tier: 'halted',
        current_phase: 0,
        total_phases: 1,
        phases: [],
        halt_reason: 'Critical error occurred',
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.length > 0);
  });

  it('returns display_halted when task status is halted — includes descriptive context.details', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress' }, [{
          status: 'halted',
          name: 'broken-task',
        }])],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.length > 0);
    assert.ok(result.context.details.includes('halted'));
  });

  it('returns display_halted when phase status is halted — includes descriptive context.details', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'halted', name: 'broken-phase' })],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.length > 0);
    assert.ok(result.context.details.includes('halted'));
  });

  it('returns display_complete when tier is complete', () => {
    const state = makeState({
      execution: {
        status: 'complete',
        current_tier: 'complete',
        current_phase: 0,
        total_phases: 1,
        phases: [],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_complete');
  });
});

// ─── Halt Consolidation Tests ───────────────────────────────────────────────

describe('resolver — halt consolidation', () => {
  it('all halted states produce action display_halted (no separate halt action types)', () => {
    const haltedScenarios = [
      // tier halted
      makeState({
        execution: { status: 'halted', current_tier: 'halted', current_phase: 0, total_phases: 0, phases: [] },
      }),
      // phase halted
      makeState({
        execution: {
          status: 'in_progress', current_tier: 'execution', current_phase: 0, total_phases: 1,
          phases: [makePhase({ status: 'halted' })],
        },
      }),
      // task halted
      makeState({
        execution: {
          status: 'in_progress', current_tier: 'execution', current_phase: 0, total_phases: 1,
          phases: [makePhase({ status: 'in_progress' }, [{ status: 'halted' }])],
        },
      }),
    ];

    for (const state of haltedScenarios) {
      const result = resolveNextAction(state, makeConfig());
      assert.equal(result.action, 'display_halted', `Expected display_halted for tier=${state.execution.current_tier}`);
    }
  });

  it('context.details is a non-empty string describing the halt reason', () => {
    const state = makeState({
      execution: {
        status: 'halted',
        current_tier: 'halted',
        current_phase: 0,
        total_phases: 0,
        phases: [],
        halt_reason: 'Maximum retries exceeded',
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.length > 0);
  });
});
