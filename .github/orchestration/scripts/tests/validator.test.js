'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateTransition } = require('../lib/validator.js');

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
    // ensure tasks matches if overrides.tasks was provided
    ...(overrides.tasks ? {} : { tasks }),
  };
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
      steps: [],
      current_step: 'research',
    },
    execution: {
      status: 'not_started',
      current_tier: 'planning',
      current_phase: 0,
      total_phases: 1,
      phases: [makePhase()],
    },
  };

  // Deep-merge top-level sections
  const result = { ...base };
  if (overrides.project) result.project = { ...base.project, ...overrides.project };
  if (overrides.planning) result.planning = { ...base.planning, ...overrides.planning };
  if (overrides.execution) result.execution = { ...base.execution, ...overrides.execution };
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
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: -1, total_phases: 1, phases: [makePhase()], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V1'));
  });

  it('errors when current_phase >= phases.length', () => {
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 2, total_phases: 1, phases: [makePhase()], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V1'));
  });

  it('allows current_phase = 0 with empty phases', () => {
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 0, phases: [], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V1'));
  });
});

// ─── V2 — current_task bounds ───────────────────────────────────────────────

describe('V2 — current_task bounds', () => {
  it('errors when current_task is -1', () => {
    const phase = makePhase({ current_task: -1 });
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V2'));
  });

  it('errors when current_task > tasks.length', () => {
    const phase = makePhase({ current_task: 5 });
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V2'));
  });

  it('allows current_task === tasks.length when all tasks complete', () => {
    const phase = makePhase({ current_task: 2, total_tasks: 2, tasks: [makeTask({ status: 'complete' }), makeTask({ status: 'complete' })] });
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V2'));
  });
});

// ─── V3 — total_phases mismatch ─────────────────────────────────────────────

describe('V3 — total_phases mismatch', () => {
  it('errors when total_phases !== phases.length', () => {
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 5, phases: [makePhase()], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V3'));
  });
});

// ─── V4 — total_tasks mismatch ──────────────────────────────────────────────

describe('V4 — total_tasks mismatch', () => {
  it('errors when total_tasks !== tasks.length', () => {
    const phase = makePhase({ total_tasks: 99 });
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V4'));
  });
});

// ─── V5 — config limits exceeded ────────────────────────────────────────────

describe('V5 — config limits exceeded', () => {
  it('errors when phases.length > max_phases', () => {
    const phases = Array.from({ length: 11 }, () => makePhase());
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 11, phases, status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V5'));
  });

  it('errors when tasks.length > max_tasks_per_phase', () => {
    const tasks = Array.from({ length: 11 }, () => makeTask());
    const phase = makePhase({ current_task: 0, total_tasks: 11, tasks });
    const proposed = makeState({ execution: { current_tier: 'planning', current_phase: 0, total_phases: 1, phases: [phase], status: 'not_started' } });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V5'));
  });
});

// ─── V6 — human approval gate (execution) ──────────────────────────────────

describe('V6 — human approval gate (execution)', () => {
  it('errors when execution tier with human_approved = false', () => {
    const phase = makePhase({ status: 'in_progress' });
    const proposed = makeState({
      planning: { status: 'complete', human_approved: false, steps: [], current_step: 'research' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [phase], status: 'in_progress' },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V6'));
  });
});

// ─── V7 — human approval gate (completion) ──────────────────────────────────

describe('V7 — human approval gate (completion)', () => {
  it('errors when complete tier with after_final_review and human_approved = false', () => {
    const phase = makePhase({ status: 'complete', current_task: 1, total_tasks: 1, tasks: [makeTask({ status: 'complete' })] });
    const proposed = makeState({
      planning: { status: 'complete', human_approved: false, steps: [], current_step: 'research' },
      execution: { current_tier: 'complete', current_phase: 0, total_phases: 1, phases: [phase], status: 'complete' },
    });
    const config = makeConfig({ human_gates: { after_final_review: true } });
    const errors = validateTransition(null, proposed, config);
    assert.ok(errors.some(e => e.invariant === 'V7'));
  });

  it('passes when after_final_review = false', () => {
    const phase = makePhase({ status: 'complete', current_task: 1, total_tasks: 1, tasks: [makeTask({ status: 'complete' })] });
    const proposed = makeState({
      planning: { status: 'complete', human_approved: false, steps: [], current_step: 'research' },
      execution: { current_tier: 'complete', current_phase: 0, total_phases: 1, phases: [phase], status: 'complete' },
    });
    const config = makeConfig({ human_gates: { after_final_review: false } });
    const errors = validateTransition(null, proposed, config);
    assert.ok(!errors.some(e => e.invariant === 'V7'));
  });
});

// ─── V10 — phase status vs tier ─────────────────────────────────────────────

describe('V10 — phase status vs tier', () => {
  it('errors when active phase is complete during execution tier', () => {
    const phase = makePhase({ status: 'complete', current_task: 1, total_tasks: 1, tasks: [makeTask({ status: 'complete' })] });
    const proposed = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [phase], status: 'in_progress' },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V10'));
  });

  it('errors when a phase is in_progress during planning tier', () => {
    const phase = makePhase({ status: 'in_progress' });
    const proposed = makeState({
      execution: { current_tier: 'planning', current_phase: 0, total_phases: 1, phases: [phase], status: 'not_started' },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(errors.some(e => e.invariant === 'V10'));
  });
});

// ─── V11 — retry monotonicity ───────────────────────────────────────────────

describe('V11 — retry monotonicity', () => {
  it('errors when retries decrease', () => {
    const current = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 3 })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 2 })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v11 = errors.filter(e => e.invariant === 'V11');
    assert.ok(v11.length > 0);
    assert.equal(v11[0].current, 3);
    assert.equal(v11[0].proposed, 2);
  });

  it('passes when retries increase or stay same', () => {
    const current = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 1 })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', retries: 2 })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V11'));
  });
});

// ─── V12 — status transitions ───────────────────────────────────────────────

describe('V12 — status transitions', () => {
  it('errors on illegal task transition not_started → complete', () => {
    const current = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'not_started' })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'complete' })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v12 = errors.filter(e => e.invariant === 'V12');
    assert.ok(v12.some(e => e.current === 'not_started' && e.proposed === 'complete'));
  });

  it('passes on legal task transition not_started → in_progress', () => {
    const current = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'not_started' })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress' })] })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V12'));
  });

  it('errors on illegal phase transition in_progress → not_started', () => {
    const current = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress' })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'not_started' })], status: 'in_progress' },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    const v12 = errors.filter(e => e.invariant === 'V12');
    assert.ok(v12.some(e => e.current === 'in_progress' && e.proposed === 'not_started'));
  });

  it('passes on legal phase transition in_progress → complete', () => {
    const current = makeState({
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'in_progress', current_task: 1, total_tasks: 1, tasks: [makeTask({ status: 'complete' })] })], status: 'in_progress' },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: { current_tier: 'execution', current_phase: 0, total_phases: 1, phases: [makePhase({ status: 'complete', current_task: 1, total_tasks: 1, tasks: [makeTask({ status: 'complete' })] })], status: 'in_progress' },
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

// ─── Removed Invariants (V8, V9, V14, V15 absent) ──────────────────────────

describe('Removed invariants are NOT checked', () => {
  it('V8 absent — review_doc set but review_verdict null produces no V8 error', () => {
    const proposed = makeState({
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
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
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress', phase_review_doc: 'some/path.md', phase_review_verdict: null })],
        status: 'in_progress',
      },
    });
    const errors = validateTransition(null, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V9'));
  });

  it('V14 absent — review_doc and review_verdict both change in same write produces no V14 error', () => {
    const current = makeState({
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', review_doc: null, review_verdict: null })] })],
        status: 'in_progress',
      },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress', review_doc: 'review.md', review_verdict: 'approved' })] })],
        status: 'in_progress',
      },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V14'));
  });

  it('V15 absent — two tasks change review_verdict in same write produces no V15 error', () => {
    const current = makeState({
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 0,
          total_tasks: 2,
          tasks: [
            makeTask({ status: 'in_progress', review_verdict: null }),
            makeTask({ status: 'in_progress', review_verdict: null }),
          ],
        })],
        status: 'in_progress',
      },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({
          status: 'in_progress',
          current_task: 0,
          total_tasks: 2,
          tasks: [
            makeTask({ status: 'in_progress', review_verdict: 'approved' }),
            makeTask({ status: 'in_progress', review_verdict: 'approved' }),
          ],
        })],
        status: 'in_progress',
      },
    });
    const errors = validateTransition(current, proposed, defaultConfig);
    assert.ok(!errors.some(e => e.invariant === 'V15'));
  });
});

// ─── Valid state & init path ────────────────────────────────────────────────

describe('Valid state passes', () => {
  it('returns empty array for a fully valid state pair', () => {
    const current = makeState({
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'not_started' })] })],
        status: 'in_progress',
      },
    });
    const proposed = makeState({
      project: { name: 'TEST', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:02.000Z' },
      execution: {
        current_tier: 'execution',
        current_phase: 0,
        total_phases: 1,
        phases: [makePhase({ status: 'in_progress', tasks: [makeTask({ status: 'in_progress' })] })],
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
        current_tier: 'planning',
        current_phase: 0,
        total_phases: 1,
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
        current_tier: 'planning',
        current_phase: 5,
        total_phases: 1,
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
