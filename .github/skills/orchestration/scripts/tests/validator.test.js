'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateTransition } = require('../lib/validator.js');

// ─── Factories ──────────────────────────────────────────────────────────────

function makeTask(overrides = {}) {
  return {
    name: 'task',
    status: 'not_started',
    stage: 'planning',
    docs: { handoff: null, report: null, review: null },
    review: { verdict: null, action: null },
    report_status: null,
    has_deviations: false,
    deviation_type: null,
    retries: 0,
    ...overrides,
  };
}

function makePhase(overrides = {}) {
  const tasks = overrides.tasks !== undefined ? overrides.tasks : [];
  return {
    name: 'phase',
    status: 'not_started',
    stage: 'planning',
    current_task: 0,
    tasks,
    docs: { phase_plan: null, phase_report: null, phase_review: null },
    review: { verdict: null, action: null },
    ...overrides,
    tasks,
  };
}

function makeState(overrides = {}) {
  const base = {
    $schema: 'orchestration-state-v4',
    project: {
      name: 'TEST',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:01.000Z',
    },
    pipeline: {
      current_tier: 'planning',
    },
    planning: {
      status: 'not_started',
      human_approved: false,
      steps: [],
    },
    execution: {
      status: 'not_started',
      current_phase: 0,
      phases: [],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
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
  return {
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 10,
      ...(overrides.limits || {}),
    },
    human_gates: {
      after_final_review: true,
      ...(overrides.human_gates || {}),
    },
  };
}

const defaultConfig = makeConfig();

// ─── V1 — current_phase bounds ──────────────────────────────────────────────

describe('V1 — current_phase bounds', () => {
  it('errors when current_phase is -1', () => {
    const proposed = makeState({ execution: { current_phase: -1, phases: [makePhase()], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V1'));
  });

  it('errors when current_phase >= phases.length', () => {
    const proposed = makeState({ execution: { current_phase: 2, phases: [makePhase()], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V1'));
  });

  it('allows current_phase = 0 with empty phases', () => {
    const proposed = makeState({ execution: { current_phase: 0, phases: [], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V1'));
  });
});

// ─── V2 — current_task bounds ───────────────────────────────────────────────

describe('V2 — current_task bounds', () => {
  it('errors when current_task is -1', () => {
    const phase = makePhase({ current_task: -1 });
    const proposed = makeState({ execution: { current_phase: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V2'));
  });

  it('errors when current_task > tasks.length', () => {
    const phase = makePhase({ current_task: 5 });
    const proposed = makeState({ execution: { current_phase: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V2'));
  });

  it('allows current_task === tasks.length when all tasks complete', () => {
    const phase = makePhase({ current_task: 2, tasks: [makeTask({ status: 'complete' }), makeTask({ status: 'complete' })] });
    const proposed = makeState({ execution: { current_phase: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V2'));
  });
});

// ─── V5 — config limits exceeded ────────────────────────────────────────────

describe('V5 — config limits exceeded', () => {
  it('errors when phases.length > max_phases', () => {
    const phases = Array.from({ length: 11 }, () => makePhase());
    const proposed = makeState({ execution: { current_phase: 0, phases, status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V5'));
  });

  it('errors when tasks.length > max_tasks_per_phase', () => {
    const tasks = Array.from({ length: 11 }, () => makeTask());
    const phase = makePhase({ current_task: 0, tasks });
    const proposed = makeState({ execution: { current_phase: 0, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V5'));
  });
});

// ─── V6 — human approval gate (execution) ──────────────────────────────────

describe('V6 — human approval gate (execution)', () => {
  it('errors when execution tier with human_approved = false', () => {
    const phase = makePhase({ status: 'in_progress' });
    const proposed = makeState({
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: false, steps: [] },
      execution: { current_phase: 1, phases: [phase], status: 'in_progress' },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V6'));
  });
});

// ─── V7 — human approval gate (completion) ──────────────────────────────────

describe('V7 — human approval gate (completion)', () => {
  it('errors when complete tier with after_final_review and human_approved = false', () => {
    const phase = makePhase({ status: 'complete', current_task: 1, tasks: [makeTask({ status: 'complete' })] });
    const proposed = makeState({
      pipeline: { current_tier: 'complete' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: { current_phase: 1, phases: [phase], status: 'complete' },
    });
    const config = makeConfig({ human_gates: { after_final_review: true } });
    const errors = validateTransition(null, proposed, config);
    assert.ok(errors.some(e => e.invariant === 'V7'));
  });

  it('passes when after_final_review = false', () => {
    const phase = makePhase({ status: 'complete', current_task: 1, tasks: [makeTask({ status: 'complete' })] });
    const proposed = makeState({
      pipeline: { current_tier: 'complete' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: { current_phase: 1, phases: [phase], status: 'complete' },
    });
    const config = makeConfig({ human_gates: { after_final_review: false } });
    const errors = validateTransition(null, proposed, config);
    assert.ok(!errors.some(e => e.invariant === 'V7'));
  });
});

// ─── V10 — phase status vs tier ─────────────────────────────────────────────

describe('V10 — phase status vs tier', () => {
  it('errors when active phase is complete during execution tier', () => {
    const phase = makePhase({ status: 'complete', current_task: 1, tasks: [makeTask({ status: 'complete' })] });
    const proposed = makeState({
      pipeline: { current_tier: 'execution' },
      execution: { current_phase: 1, phases: [phase], status: 'in_progress' },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V10'));
  });

  it('errors when a phase is in_progress during planning tier', () => {
    const phase = makePhase({ status: 'in_progress' });
    const proposed = makeState({
      execution: { current_phase: 0, phases: [phase], status: 'not_started' },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V10'));
  });
});

// ─── V11 — retry monotonicity ───────────────────────────────────────────────

describe('V11 — retry monotonicity', () => {
  it('errors when retries decrease', () => {
    const current = makeState({
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 3 })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 2 })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v11 = errors.filter(e => e.invariant === 'V11');
    assert.ok(v11.length > 0);
    assert.equal(v11[0].current, 3);
    assert.equal(v11[0].proposed, 2);
  });

  it('passes when retries increase or stay same', () => {
    const current = makeState({
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 1 })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 2 })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V11'));
  });
});

// ─── V12 — status transitions ───────────────────────────────────────────────

describe('V12 — status transitions', () => {
  it('errors on illegal task transition not_started → complete', () => {
    const current = makeState({
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'not_started' })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'complete' })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v12 = errors.filter(e => e.invariant === 'V12');
    assert.ok(v12.some(e => e.current === 'not_started' && e.proposed === 'complete'));
  });

  it('passes on legal task transition not_started → in_progress', () => {
    const current = makeState({
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'not_started' })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress' })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V12'));
  });

  it('errors on illegal phase transition in_progress → not_started', () => {
    const current = makeState({
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress' })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_phase: 0, phases: [makePhase({ status: 'not_started' })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v12 = errors.filter(e => e.invariant === 'V12');
    assert.ok(v12.some(e => e.current === 'in_progress' && e.proposed === 'not_started'));
  });

  it('passes on legal phase transition in_progress → complete', () => {
    const current = makeState({
      execution: { current_phase: 0, phases: [makePhase({ status: 'in_progress', current_task: 1, tasks: [makeTask({ status: 'complete' })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_phase: 0, phases: [makePhase({ status: 'complete', current_task: 1, tasks: [makeTask({ status: 'complete' })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V12'));
  });
});

// ─── V13 — timestamp monotonicity ──────────────────────────────────────────

describe('V13 — timestamp monotonicity', () => {
  it('errors when proposed timestamp <= current', () => {
    const current = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:05.000Z' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:03.000Z' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v13 = errors.filter(e => e.invariant === 'V13');
    assert.ok(v13.length > 0);
    assert.equal(v13[0].current, '2026-01-01T00:00:05.000Z');
    assert.equal(v13[0].proposed, '2026-01-01T00:00:03.000Z');
  });

  it('passes when proposed timestamp is strictly newer', () => {
    const current = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:01.000Z' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V13'));
  });
});

// ─── V14 — task stage transitions ──────────────────────────────────────────

describe('V14 — task stage transitions', () => {
  // Helper to build a current/proposed pair differing only in task stage
  function makeTransitionPair(fromStage, toStage) {
    const current = makeState({
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: {
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 1,
          tasks: [makeTask({ status: 'in_progress', stage: fromStage })],
        })],
        status: 'in_progress',
      },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: {
        current_phase: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 1,
          tasks: [makeTask({ status: 'in_progress', stage: toStage })],
        })],
        status: 'in_progress',
      },
    });
    return { current, proposed };
  }

  it('errors on illegal planning → reviewing', () => {
    const { current, proposed } = makeTransitionPair('planning', 'reviewing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V14'));
  });

  it('errors on illegal coding → complete', () => {
    const { current, proposed } = makeTransitionPair('coding', 'complete');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V14'));
  });

  it('errors on illegal complete → coding (terminal)', () => {
    const { current, proposed } = makeTransitionPair('complete', 'coding');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V14'));
  });

  it('passes on legal planning → coding', () => {
    const { current, proposed } = makeTransitionPair('planning', 'coding');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });

  it('passes on legal coding → reviewing', () => {
    const { current, proposed } = makeTransitionPair('coding', 'reviewing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });

  it('passes on legal reviewing → complete', () => {
    const { current, proposed } = makeTransitionPair('reviewing', 'complete');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });

  it('passes on legal reviewing → failed', () => {
    const { current, proposed } = makeTransitionPair('reviewing', 'failed');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });

  it('passes on legal failed → coding (corrective re-entry)', () => {
    const { current, proposed } = makeTransitionPair('failed', 'coding');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });

  it('no V14 error when current is null (init path)', () => {
    const proposed = makeState({
      execution: {
        current_phase: 1,
        phases: [makePhase({
          current_task: 1,
          tasks: [makeTask({ stage: 'coding' })],
        })],
        status: 'not_started',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });
});

// ─── V15 — phase stage transitions ──────────────────────────────────────────

describe('V15 — phase stage transitions', () => {
  function makePhaseTransitionPair(fromStage, toStage) {
    const current = makeState({
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: {
        current_phase: 1,
        phases: [makePhase({ status: 'in_progress', stage: fromStage })],
        status: 'in_progress',
      },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: {
        current_phase: 1,
        phases: [makePhase({ status: 'in_progress', stage: toStage })],
        status: 'in_progress',
      },
    });
    return { current, proposed };
  }

  it('errors on illegal planning → reviewing', () => {
    const { current, proposed } = makePhaseTransitionPair('planning', 'reviewing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V15'));
  });

  it('errors on illegal complete → executing (terminal)', () => {
    const { current, proposed } = makePhaseTransitionPair('complete', 'executing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V15'));
  });

  it('passes on legal planning → executing', () => {
    const { current, proposed } = makePhaseTransitionPair('planning', 'executing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });

  it('passes on legal executing → reviewing', () => {
    const { current, proposed } = makePhaseTransitionPair('executing', 'reviewing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });

  it('passes on legal reviewing → complete', () => {
    const { current, proposed } = makePhaseTransitionPair('reviewing', 'complete');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });

  it('passes on legal reviewing → failed', () => {
    const { current, proposed } = makePhaseTransitionPair('reviewing', 'failed');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });

  it('passes on legal failed → executing (corrective re-entry)', () => {
    const { current, proposed } = makePhaseTransitionPair('failed', 'executing');
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });

  it('no V15 error when current is null (init path)', () => {
    const proposed = makeState({
      execution: {
        current_phase: 1,
        phases: [makePhase({ stage: 'executing' })],
        status: 'not_started',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });
});

// ─── Removed invariants (V8, V9 absent) ─────────────────────────────────────

describe('Removed invariants (V8, V9 absent)', () => {
  it('V8 absent — review_doc set but review_verdict null produces no V8 error', () => {
    const proposed = makeState({
      execution: {
        current_phase: 0,
        phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', review_doc: 'some/path.md', review_verdict: null })] })],
        status: 'in_progress',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V8'));
  });

  it('V9 absent — phase_review_doc set but phase_review_verdict null produces no V9 error', () => {
    const proposed = makeState({
      execution: {
        current_phase: 0,
        phases: [makePhase({ status: 'in_progress', phase_review_doc: 'some/path.md', phase_review_verdict: null })],
        status: 'in_progress',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V9'));
  });
});

// ─── Valid state & init path ────────────────────────────────────────────────

describe('Valid state passes', () => {
  it('returns empty array for a fully valid state pair', () => {
    const current = makeState({
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: {
        current_phase: 1,
        phases: [makePhase({ status: 'in_progress', current_task: 1, tasks: [makeTask({ status: 'not_started' })] })],
        status: 'in_progress',
      },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      pipeline: { current_tier: 'execution' },
      planning: { status: 'complete', human_approved: true, steps: [] },
      execution: {
        current_phase: 1,
        phases: [makePhase({ status: 'in_progress', current_task: 1, tasks: [makeTask({ status: 'in_progress' })] })],
        status: 'in_progress',
      },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.deepEqual(errors, []);
  });
});

describe('Init path (current = null)', () => {
  it('skips V11–V13 and checks only structural invariants', () => {
    const proposed = makeState({
      execution: {
        current_phase: 1,
        phases: [makePhase()],
        status: 'not_started',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.deepEqual(errors, []);
  });

  it('still catches structural errors on init', () => {
    const proposed = makeState({
      execution: {
        current_phase: 5,
        phases: [makePhase()],
        status: 'not_started',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V1'));
    // Should NOT have any V11–V13 errors
    assert.ok(!errors.some(e => ['V11', 'V12', 'V13'].includes(e.invariant)));
  });
});
