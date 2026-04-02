'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveNextAction } = require('../lib/resolver.js');

// ─── Factories ──────────────────────────────────────────────────────────────

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

function makeState(overrides = {}) {
  const base = {
    $schema: 'orchestration-state-v4',
    project: {
      name: 'TEST',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:01.000Z',
    },
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
    const state = makeState({ pipeline: { current_tier: 'complete' } });
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
      pipeline: { current_tier: 'planning' },
      planning: {
        status: 'in_progress',
        human_approved: false,
        steps,
      },
      execution: {
        status: 'not_started',
        current_phase: 0,
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'request_plan_approval');
  });

  it('returns display_halted when all steps complete and human_approved is true but tier is still planning', () => {
    const state = planningState(['research', 'prd', 'design', 'architecture', 'master_plan']);
    state.planning.human_approved = true;
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.includes('Unreachable'));
  });
});

// ─── Execution Tier — Phase Stage Routing Tests ──────────────────────────────

describe('resolver — execution tier — phase stage routing', () => {
  it('returns create_phase_plan when phase.stage is planning', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({ status: 'not_started', stage: 'planning' })],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
  });

  it('returns task-level action when phase.stage is executing with active task', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ stage: 'planning' }]
        )],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_task_handoff');
  });

  it('returns spawn_phase_reviewer when phase.stage is reviewing', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'spawn_phase_reviewer');
    assert.equal(result.context.phase_report_doc, 'reports/pr.md');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
  });

  it('returns gate_phase when phase.stage is complete and review.action is advanced (phase mode)', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_phase');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
  });
});

// ─── Execution Tier — Phase FAILED Routing Tests ───────────────────────────────

describe('resolver — execution tier — phase FAILED routing', () => {
  it('returns create_phase_plan with corrective context when phase.stage is failed and review.action is corrective_tasks_issued', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(result.context.is_correction, true);
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.previous_review, 'reviews/pvr.md');
  });

  it('returns display_halted when phase.stage is failed and review.action is null', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
  });

  it('returns display_halted when phase.stage is failed and review.action is halted', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
  });
});

// ─── Execution Tier — Task Stage Routing Tests ───────────────────────────────

describe('resolver — execution tier — task stage routing', () => {
  function executingPhaseState(taskOverrides) {
    return makeState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [taskOverrides]
        )],
      },
    });
  }

  it('returns create_task_handoff with is_correction: false when task.stage is planning', () => {
    const state = executingPhaseState({ stage: 'planning' });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(result.context.is_correction, false);
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.task_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });

  it('returns execute_task when task.stage is coding', () => {
    const state = executingPhaseState({
      stage: 'coding',
      status: 'in_progress',
      docs: { handoff: 'tasks/handoff.md', review: null },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'execute_task');
    assert.equal(result.context.handoff_doc, 'tasks/handoff.md');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.task_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });

  it('returns spawn_code_reviewer when task.stage is reviewing', () => {
    const state = executingPhaseState({
      stage: 'reviewing',
      status: 'complete',
      docs: { handoff: 'tasks/handoff.md', review: null },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'spawn_code_reviewer');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.task_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });

  it('returns gate_task when task.stage is complete and review.action is advanced (task mode)', () => {
    const state = executingPhaseState({
      stage: 'complete',
      status: 'complete',
      docs: { handoff: 'tasks/handoff.md', review: 'reviews/rv.md' },
      review: { verdict: 'approved', action: 'advanced' },
    });
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_task');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.task_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });

  it('returns create_task_handoff (corrective) when task.stage is failed and review.action is corrective_task_issued', () => {
    const state = executingPhaseState({
      stage: 'failed',
      status: 'failed',
      docs: { handoff: 'tasks/handoff.md', review: 'reviews/rv.md' },
      review: { verdict: 'changes_requested', action: 'corrective_task_issued' },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(result.context.is_correction, true);
    assert.equal(result.context.previous_review, 'reviews/rv.md');
    assert.equal(result.context.reason, 'changes_requested');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.task_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.task_id, 'P01-T01');
  });
});

// ─── Phase Completion Tests ──────────────────────────────────────────────────

describe('resolver — execution tier — phase completion', () => {
  it('returns generate_phase_report when current_task > tasks.length (all tasks done)', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
  });
});

// ─── Gate Tests ─────────────────────────────────────────────────────────────

describe('resolver — gates', () => {
  function completedTaskState() {
    return makeState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{
            stage: 'complete',
            status: 'complete',
            docs: { handoff: 'h.md', review: 'rv.md' },
            review: { verdict: 'approved', action: 'advanced' },
          }]
        )],
      },
    });
  }

  function completedPhaseState() {
    return makeState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          stage: 'complete',
          current_task: 2,
          docs: { phase_plan: 'plans/pp.md', phase_report: 'reports/pr.md', phase_review: 'reviews/pvr.md' },
          review: { verdict: 'approved', action: 'advanced' },
        }, [{
          stage: 'complete',
          status: 'complete',
          docs: { handoff: 'h.md', review: 'rv.md' },
          review: { verdict: 'approved', action: 'advanced' },
        }])],
      },
    });
  }

  it('returns gate_task when task review.action is advanced and gate mode is task', () => {
    const state = completedTaskState();
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_task');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.task_number, 1);
  });

  it('returns gate_phase when phase review.action is advanced and gate mode is phase', () => {
    const state = completedPhaseState();
    const config = makeConfig({ human_gates: { execution_mode: 'phase' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_phase');
    assert.equal(result.context.phase_number, 1);
  });

  it('returns gate_phase when phase review.action is advanced and gate mode is task (task mode also gates phases)', () => {
    const state = completedPhaseState();
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_phase');
    assert.equal(result.context.phase_number, 1);
  });

  it('skips gate when mode is autonomous', () => {
    const state = completedTaskState();
    const config = makeConfig({ human_gates: { execution_mode: 'autonomous' } });
    const result = resolveNextAction(state, config);
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

  it('uses state.config snapshot execution_mode over global config (snapshot-present)', () => {
    const state = completedTaskState();
    state.config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const config = makeConfig({ human_gates: { execution_mode: 'autonomous' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_task', 'snapshot execution_mode=task should win over config=autonomous');
  });

  it('falls through to global config when state.config is absent (legacy project)', () => {
    const state = completedTaskState();
    delete state.config;
    const config = makeConfig({ human_gates: { execution_mode: 'task' } });
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'gate_task', 'legacy project without snapshot should fall through to config');
  });
});

// ─── Review Tier Tests ──────────────────────────────────────────────────────

describe('resolver — review tier', () => {
  it('returns spawn_final_reviewer when tier is review and final_review.doc_path is null', () => {
    const state = makeState({
      pipeline: { current_tier: 'review' },
      execution: { status: 'complete', current_phase: 0, phases: [] },
      final_review: { status: 'not_started', doc_path: null, human_approved: false },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'spawn_final_reviewer');
  });

  it('returns request_final_approval when final_review.doc_path exists but human_approved is false', () => {
    const state = makeState({
      pipeline: { current_tier: 'review' },
      execution: { status: 'complete', current_phase: 0, phases: [] },
      final_review: { status: 'in_progress', doc_path: 'reviews/final.md', human_approved: false },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'request_final_approval');
  });
});

// ─── Terminal Tests ─────────────────────────────────────────────────────────

describe('resolver — terminal', () => {
  it('returns display_halted when tier is halted', () => {
    const state = makeState({
      pipeline: { current_tier: 'halted' },
      execution: { status: 'halted', current_phase: 0, phases: [] },
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
        current_phase: 1,
        phases: [makePhase(
          { status: 'in_progress', stage: 'executing', current_task: 1 },
          [{ status: 'halted', name: 'broken-task' }]
        )],
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
        current_phase: 1,
        phases: [makePhase({ status: 'halted', stage: 'planning', name: 'broken-phase' })],
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
      pipeline: { current_tier: 'complete' },
      execution: { status: 'complete', current_phase: 0, phases: [] },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_complete');
  });
});

// ─── Halt Consolidation Tests ───────────────────────────────────────────────

describe('resolver — halt consolidation', () => {
  it('all halted states produce action display_halted (no separate halt action types)', () => {
    const haltedScenarios = [
      makeState({
        pipeline: { current_tier: 'halted' },
        execution: { status: 'halted', current_phase: 0, phases: [] },
      }),
      makeState({
        execution: {
          status: 'in_progress', current_phase: 1,
          phases: [makePhase({ status: 'halted' })],
        },
      }),
      makeState({
        execution: {
          status: 'in_progress', current_phase: 1,
          phases: [makePhase(
            { status: 'in_progress', stage: 'executing', current_task: 1 },
            [{ status: 'halted' }]
          )],
        },
      }),
    ];

    for (const state of haltedScenarios) {
      const result = resolveNextAction(state, makeConfig());
      assert.equal(result.action, 'display_halted', `Expected display_halted for tier=${state.pipeline.current_tier}`);
    }
  });

  it('context.details is a non-empty string describing the halt reason', () => {
    const state = makeState({
      pipeline: { current_tier: 'halted' },
      execution: { status: 'halted', current_phase: 0, phases: [] },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.length > 0);
  });
});

// ─── Edge Case Tests ─────────────────────────────────────────────────────────

describe('resolver — edge cases', () => {
  it('returns generate_phase_report for empty phase (current_task: 0, tasks: [])', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_phase: 1,
        phases: [makePhase({ status: 'in_progress', stage: 'executing', current_task: 0, tasks: [] })],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
  });

  it('returns generate_phase_report when current_task advances past last task boundary', () => {
    const state = makeState({
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
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'generate_phase_report');
    assert.equal(result.context.phase_number, 1);
  });

  it('returns display_halted when no phase found at current_phase (out-of-bounds)', () => {
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_phase: 3,
        phases: [makePhase()],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'display_halted');
    assert.equal(typeof result.context.details, 'string');
    assert.ok(result.context.details.length > 0);
  });

  it('formatPhaseId produces 1-based IDs: phase 1 => P01, phase 2 => P02', () => {
    for (const [phaseNum, expectedId] of [[1, 'P01'], [2, 'P02'], [10, 'P10']]) {
      const phases = Array.from({ length: phaseNum }, (_, i) =>
        makePhase({ stage: i === phaseNum - 1 ? 'planning' : 'complete' })
      );
      const state = makeState({
        execution: { status: 'in_progress', current_phase: phaseNum, phases },
      });
      const result = resolveNextAction(state, makeConfig());
      assert.equal(result.context.phase_id, expectedId, `Expected phase_id=${expectedId} for phase ${phaseNum}`);
    }
  });

  it('formatTaskId produces 1-based IDs: phase 2 task 3 => P02-T03', () => {
    const tasks = [
      makeTask({ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }),
      makeTask({ stage: 'complete', status: 'complete', docs: { handoff: 'h.md', review: 'rv.md' }, review: { verdict: 'approved', action: 'advanced' } }),
      makeTask({ stage: 'planning' }),
    ];
    const state = makeState({
      execution: {
        status: 'in_progress',
        current_phase: 2,
        phases: [
          makePhase({ stage: 'complete' }),
          makePhase({ stage: 'executing', status: 'in_progress', current_task: 3, tasks }),
        ],
      },
    });
    const result = resolveNextAction(state, makeConfig());
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(result.context.phase_id, 'P02');
    assert.equal(result.context.task_id, 'P02-T03');
    assert.equal(result.context.phase_number, 2);
    assert.equal(result.context.task_number, 3);
  });
});
