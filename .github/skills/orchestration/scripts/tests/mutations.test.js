'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { getMutation, normalizeDocPath, _test } = require('../lib/mutations');
const { resolveTaskOutcome, resolvePhaseOutcome, checkRetryBudget } = _test;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlanningState() {
  return {
    pipeline: {
      current_tier: 'planning',
    },
    planning: {
      status: 'in_progress',
      human_approved: false,
      steps: [
        { name: 'research', status: 'not_started', doc_path: null },
        { name: 'prd', status: 'not_started', doc_path: null },
        { name: 'design', status: 'not_started', doc_path: null },
        { name: 'architecture', status: 'not_started', doc_path: null },
        { name: 'master_plan', status: 'not_started', doc_path: null },
      ],
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
}

// ─── getMutation (basic dispatch) ───────────────────────────────────────────

describe('getMutation', () => {
  const events = [
    'research_completed',
    'prd_completed',
    'design_completed',
    'architecture_completed',
    'master_plan_completed',
    'plan_approved',
    'halt',
  ];

  for (const event of events) {
    it(`returns a function for "${event}"`, () => {
      assert.equal(typeof getMutation(event), 'function');
    });
  }

  it('returns undefined for an unknown event name', () => {
    assert.equal(getMutation('nonexistent_event'), undefined);
  });
});

// ─── normalizeDocPath ───────────────────────────────────────────────────────

describe('normalizeDocPath', () => {
  it('strips basePath/projectName/ prefix when present', () => {
    const result = normalizeDocPath(
      'custom/project-store/MY-PROJECT/PRD.md',
      'custom/project-store',
      'MY-PROJECT',
    );
    assert.equal(result, 'PRD.md');
  });

  it('returns path unchanged when prefix is not present', () => {
    const result = normalizeDocPath('some/other/path.md', 'custom/project-store', 'MY-PROJECT');
    assert.equal(result, 'some/other/path.md');
  });

  it('returns null when input is null', () => {
    assert.equal(normalizeDocPath(null, 'custom/project-store', 'MY-PROJECT'), null);
  });

  it('returns undefined when input is undefined', () => {
    assert.equal(normalizeDocPath(undefined, 'custom/project-store', 'MY-PROJECT'), undefined);
  });

  it('normalizes backslashes and strips prefix', () => {
    const result = normalizeDocPath(
      'custom\\project-store\\MY-PROJECT\\PRD.md',
      'custom/project-store',
      'MY-PROJECT',
    );
    assert.equal(result, 'PRD.md');
  });

  it('returns already project-relative path unchanged (idempotent)', () => {
    const result = normalizeDocPath('PRD.md', 'custom/project-store', 'MY-PROJECT');
    assert.equal(result, 'PRD.md');
  });
});

// ─── Task Decision Table ────────────────────────────────────────────────────

describe('task decision table', () => {
  it('task row 1: approved + complete + no deviations -> complete/advanced', () => {
    const result = resolveTaskOutcome('approved', 'complete', false, null, 0, 3);
    assert.deepEqual(result, { taskStatus: 'complete', reviewAction: 'advanced' });
  });

  it('task row 2: approved + complete + minor deviations -> complete/advanced', () => {
    const result = resolveTaskOutcome('approved', 'complete', true, 'minor', 0, 3);
    assert.deepEqual(result, { taskStatus: 'complete', reviewAction: 'advanced' });
  });

  it('task row 3: approved + complete + critical deviations -> complete/advanced', () => {
    const result = resolveTaskOutcome('approved', 'complete', true, 'critical', 0, 3);
    assert.deepEqual(result, { taskStatus: 'complete', reviewAction: 'advanced' });
  });

  it('task row 4: changes_requested + complete + retries left -> failed/corrective', () => {
    const result = resolveTaskOutcome('changes_requested', 'complete', false, null, 0, 3);
    assert.deepEqual(result, { taskStatus: 'failed', reviewAction: 'corrective_task_issued' });
  });

  it('task row 5: changes_requested + complete + no retries -> halted/halted', () => {
    const result = resolveTaskOutcome('changes_requested', 'complete', false, null, 3, 3);
    assert.deepEqual(result, { taskStatus: 'halted', reviewAction: 'halted' });
  });

  it('task row 6: changes_requested + failed + retries left -> failed/corrective', () => {
    const result = resolveTaskOutcome('changes_requested', 'failed', false, null, 1, 3);
    assert.deepEqual(result, { taskStatus: 'failed', reviewAction: 'corrective_task_issued' });
  });

  it('task row 7: changes_requested + failed + no retries -> halted/halted', () => {
    const result = resolveTaskOutcome('changes_requested', 'failed', false, null, 3, 3);
    assert.deepEqual(result, { taskStatus: 'halted', reviewAction: 'halted' });
  });

  it('task row 8: rejected -> halted/halted', () => {
    const result = resolveTaskOutcome('rejected', 'complete', false, null, 0, 3);
    assert.deepEqual(result, { taskStatus: 'halted', reviewAction: 'halted' });
  });
});

// ─── Phase Decision Table ───────────────────────────────────────────────────

describe('phase decision table', () => {
  it('phase row 1: approved + exit criteria met -> complete/advanced', () => {
    const result = resolvePhaseOutcome('approved', true);
    assert.deepEqual(result, { phaseStatus: 'complete', phaseReviewAction: 'advanced' });
  });

  it('phase row 2: approved + exit criteria not met -> complete/advanced', () => {
    const result = resolvePhaseOutcome('approved', false);
    assert.deepEqual(result, { phaseStatus: 'complete', phaseReviewAction: 'advanced' });
  });

  it('phase row 3: changes_requested -> in_progress/corrective_tasks_issued', () => {
    const result = resolvePhaseOutcome('changes_requested', true);
    assert.deepEqual(result, { phaseStatus: 'in_progress', phaseReviewAction: 'corrective_tasks_issued' });
  });

  it('phase row 4: rejected + exit criteria met -> halted/halted', () => {
    const result = resolvePhaseOutcome('rejected', true);
    assert.deepEqual(result, { phaseStatus: 'halted', phaseReviewAction: 'halted' });
  });

  it('phase row 5: rejected + exit criteria not met -> halted/halted', () => {
    const result = resolvePhaseOutcome('rejected', false);
    assert.deepEqual(result, { phaseStatus: 'halted', phaseReviewAction: 'halted' });
  });
});

// ─── checkRetryBudget ───────────────────────────────────────────────────────

describe('checkRetryBudget', () => {
  it('returns true when retries < maxRetries', () => {
    assert.equal(checkRetryBudget(1, 3), true);
  });

  it('returns false when retries === maxRetries', () => {
    assert.equal(checkRetryBudget(3, 3), false);
  });

  it('returns false when retries > maxRetries', () => {
    assert.equal(checkRetryBudget(5, 3), false);
  });
});

// ─── Planning Handlers ─────────────────────────────────────────────────────

describe('planning handlers', () => {
  const stepHandlers = [
    { event: 'research_completed', stepName: 'research' },
    { event: 'prd_completed', stepName: 'prd' },
    { event: 'design_completed', stepName: 'design' },
    { event: 'architecture_completed', stepName: 'architecture' },
    { event: 'master_plan_completed', stepName: 'master_plan' },
  ];

  for (const { event, stepName } of stepHandlers) {
    describe(`handle ${event}`, () => {
      let state, result;

      beforeEach(() => {
        state = makePlanningState();
        const handler = getMutation(event);
        result = handler(state, { doc_path: `${stepName}-doc.md` }, {});
      });

      it(`sets the "${stepName}" step status to complete`, () => {
        const step = result.state.planning.steps.find(s => s.name === stepName);
        assert.equal(step.status, 'complete');
      });

      it(`sets the "${stepName}" step doc_path`, () => {
        const step = result.state.planning.steps.find(s => s.name === stepName);
        assert.equal(step.doc_path, `${stepName}-doc.md`);
      });

      it('returns mutations_applied array with descriptions', () => {
        assert.ok(Array.isArray(result.mutations_applied));
        assert.ok(result.mutations_applied.length >= 2);
      });
    });
  }

  it('handleMasterPlanCompleted additionally sets planning.status to complete', () => {
    const state = makePlanningState();
    const handler = getMutation('master_plan_completed');
    const result = handler(state, { doc_path: 'MASTER-PLAN.md' }, {});
    assert.equal(result.state.planning.status, 'complete');
  });
});

// ─── handlePlanApproved ─────────────────────────────────────────────────────

describe('handlePlanApproved', () => {
  let state, result;

  beforeEach(() => {
    state = makePlanningState();
    const handler = getMutation('plan_approved');
    result = handler(state, { total_phases: 3 }, {});
  });

  it('sets planning.human_approved to true', () => {
    assert.equal(result.state.planning.human_approved, true);
  });

  it('sets pipeline.current_tier to "execution" (NOT execution.current_tier)', () => {
    assert.equal(result.state.pipeline.current_tier, 'execution');
  });

  it('does NOT set execution.current_tier', () => {
    assert.equal(result.state.execution.current_tier, undefined);
  });

  it('sets execution.status to "in_progress"', () => {
    assert.equal(result.state.execution.status, 'in_progress');
  });

  it('does NOT set execution.total_phases (field removed in v4)', () => {
    assert.equal(result.state.execution.total_phases, undefined);
  });

  it('initializes execution.phases array with correct length', () => {
    assert.equal(result.state.execution.phases.length, 3);
  });

  it('sets execution.current_phase to 1 (1-based)', () => {
    assert.equal(result.state.execution.current_phase, 1);
  });

  it('each phase has the correct v4 template (stage, nested docs/review, no total_tasks)', () => {
    for (let i = 0; i < 3; i++) {
      const phase = result.state.execution.phases[i];
      assert.equal(phase.name, `Phase ${i + 1}`);
      assert.equal(phase.status, 'not_started');
      assert.equal(phase.stage, 'planning');
      assert.equal(phase.current_task, 0);
      assert.deepEqual(phase.tasks, []);
      assert.deepEqual(phase.docs, { phase_plan: null, phase_report: null, phase_review: null });
      assert.deepEqual(phase.review, { verdict: null, action: null });
      assert.equal(phase.total_tasks, undefined);
      assert.equal(phase.phase_plan_doc, undefined);
      assert.equal(phase.phase_review_verdict, undefined);
    }
  });

  it('returns mutations_applied array', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handlePlanRejected ─────────────────────────────────────────────────────

describe('handlePlanRejected', () => {
  let state, result;

  beforeEach(() => {
    state = makePlanningState();
    state.planning.human_approved = true;
    state.planning.steps.find(s => s.name === 'master_plan').status = 'complete';
    const handler = getMutation('plan_rejected');
    result = handler(state, {}, {});
  });

  it('sets planning.human_approved to false', () => {
    assert.equal(result.state.planning.human_approved, false);
  });

  it('sets the master_plan step status to "in_progress"', () => {
    const step = result.state.planning.steps.find(s => s.name === 'master_plan');
    assert.equal(step.status, 'in_progress');
  });

  it('returns mutations_applied with exactly 2 descriptive string entries', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.equal(result.mutations_applied.length, 2);
    assert.ok(result.mutations_applied[0].includes('planning.human_approved'));
    assert.ok(result.mutations_applied[1].includes('master_plan'));
  });
});

// ─── handleHalt ─────────────────────────────────────────────────────────────

describe('handleHalt', () => {
  let state, result;

  beforeEach(() => {
    state = makePlanningState();
    const handler = getMutation('halt');
    result = handler(state, {}, {});
  });

  it('sets pipeline.current_tier to "halted" (NOT execution.current_tier)', () => {
    assert.equal(result.state.pipeline.current_tier, 'halted');
  });

  it('does NOT set execution.current_tier', () => {
    assert.equal(result.state.execution.current_tier, undefined);
  });

  it('returns mutations_applied array', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── Execution State Helper ─────────────────────────────────────────────────

function makeExecutionState(opts = {}) {
  const totalPhases = opts.totalPhases || 1;
  const tasksPerPhase = opts.tasksPerPhase || 2;
  const phases = [];
  for (let i = 0; i < totalPhases; i++) {
    const tasks = [];
    for (let j = 0; j < tasksPerPhase; j++) {
      tasks.push({
        name: `Task ${j + 1}`,
        status: 'not_started',
        stage: 'planning',
        docs: {
          handoff: null,
          report: null,
          review: null,
        },
        review: {
          verdict: null,
          action: null,
        },
        has_deviations: false,
        deviation_type: null,
        retries: 0,
        report_status: null,
      });
    }
    phases.push({
      name: `Phase ${i + 1}`,
      status: i === 0 ? 'in_progress' : 'not_started',
      stage: i === 0 ? 'executing' : 'planning',
      current_task: 1,
      tasks,
      docs: {
        phase_plan: null,
        phase_report: null,
        phase_review: null,
      },
      review: {
        verdict: null,
        action: null,
      },
    });
  }
  return {
    pipeline: {
      current_tier: 'execution',
      gate_mode: null,
    },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'RESEARCH.md' },
        { name: 'prd', status: 'complete', doc_path: 'PRD.md' },
        { name: 'design', status: 'complete', doc_path: 'DESIGN.md' },
        { name: 'architecture', status: 'complete', doc_path: 'ARCHITECTURE.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'MASTER-PLAN.md' },
      ],
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases,
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
  };
}

const defaultConfig = { limits: { max_retries_per_task: 2 }, human_gates: { execution_mode: 'autonomous' } };

// ─── handlePhasePlanCreated ─────────────────────────────────────────────────

describe('handlePhasePlanCreated', () => {
  let state, result;

  beforeEach(() => {
    state = makeExecutionState();
    state.execution.phases[0].status = 'not_started';
    state.execution.phases[0].stage = 'planning';
    state.execution.phases[0].tasks = [];
    state.execution.phases[0].current_task = 0;
    const handler = getMutation('phase_plan_created');
    result = handler(state, { doc_path: 'phases/PHASE-PLAN-P01.md', tasks: ['Setup', 'Implement'] }, defaultConfig);
  });

  it('sets phase.status to in_progress', () => {
    assert.equal(result.state.execution.phases[0].status, 'in_progress');
  });

  it('sets phase.stage to "executing"', () => {
    assert.equal(result.state.execution.phases[0].stage, 'executing');
  });

  it('sets phase.docs.phase_plan to context.doc_path', () => {
    assert.equal(result.state.execution.phases[0].docs.phase_plan, 'phases/PHASE-PLAN-P01.md');
  });

  it('does NOT set phase.phase_plan_doc (v3 flat field absent)', () => {
    assert.equal(result.state.execution.phases[0].phase_plan_doc, undefined);
  });

  it('sets phase.current_task to 1 (1-based)', () => {
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('does NOT set phase.total_tasks (field removed in v4)', () => {
    assert.equal(result.state.execution.phases[0].total_tasks, undefined);
  });

  it('populates phase.tasks with correct v4 task template objects', () => {
    const tasks = result.state.execution.phases[0].tasks;
    assert.equal(tasks.length, 2);
    assert.deepEqual(tasks[0], {
      name: 'Setup',
      status: 'not_started',
      stage: 'planning',
      docs: { handoff: null, report: null, review: null },
      review: { verdict: null, action: null },
      has_deviations: false,
      deviation_type: null,
      retries: 0,
      report_status: null,
    });
    assert.deepEqual(tasks[1], {
      name: 'Implement',
      status: 'not_started',
      stage: 'planning',
      docs: { handoff: null, report: null, review: null },
      review: { verdict: null, action: null },
      has_deviations: false,
      deviation_type: null,
      retries: 0,
      report_status: null,
    });
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });

  it('updates phase.name when context.title is provided', () => {
    const s = makeExecutionState();
    s.execution.phases[0].status = 'not_started';
    s.execution.phases[0].tasks = [];
    const handler = getMutation('phase_plan_created');
    const r = handler(s, { doc_path: 'phases/p.md', tasks: ['T01'], title: 'Core Features' }, defaultConfig);
    assert.equal(r.state.execution.phases[0].name, 'Core Features');
    assert.ok(r.mutations_applied.some(m => m.includes('Core Features')));
  });

  it('does not change phase.name when context.title is absent', () => {
    const s = makeExecutionState();
    s.execution.phases[0].status = 'not_started';
    s.execution.phases[0].tasks = [];
    const originalName = s.execution.phases[0].name;
    const handler = getMutation('phase_plan_created');
    const r = handler(s, { doc_path: 'phases/p.md', tasks: ['T01'] }, defaultConfig);
    assert.equal(r.state.execution.phases[0].name, originalName);
  });
});

// ─── handleTaskHandoffCreated ───────────────────────────────────────────────

describe('handleTaskHandoffCreated', () => {
  let state, result;

  beforeEach(() => {
    state = makeExecutionState();
    const handler = getMutation('task_handoff_created');
    result = handler(state, { doc_path: 'tasks/TASK-P01-T01.md' }, defaultConfig);
  });

  it('sets task.docs.handoff to context.doc_path', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.docs.handoff, 'tasks/TASK-P01-T01.md');
  });

  it('sets task.status to in_progress', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'in_progress');
  });

  it('sets task.stage to "coding"', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.stage, 'coding');
  });

  it('does NOT set task.handoff_doc (v3 flat field absent)', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.handoff_doc, undefined);
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });

  it('clears stale report and review fields on corrective re-execution', () => {
    const state = makeExecutionState();
    const task = state.execution.phases[0].tasks[0];
    task.docs.report = 'reports/TASK-REPORT-P01-T01.md';
    task.report_status = 'complete';
    task.docs.review = 'reviews/CODE-REVIEW-P01-T01.md';
    task.review.verdict = 'changes_requested';
    task.review.action = 'corrective_task_issued';

    const handler = getMutation('task_handoff_created');
    const result = handler(state, { doc_path: 'tasks/CORRECTIVE-HANDOFF.md' }, defaultConfig);

    assert.strictEqual(task.docs.report, null);
    assert.strictEqual(task.report_status, null);
    assert.strictEqual(task.docs.review, null);
    assert.strictEqual(task.review.verdict, null);
    assert.strictEqual(task.review.action, null);

    assert.strictEqual(task.docs.handoff, 'tasks/CORRECTIVE-HANDOFF.md');
    assert.strictEqual(task.status, 'in_progress');
    assert.strictEqual(task.stage, 'coding');

    assert.ok(
      result.mutations_applied.some(m => m.includes('Cleared task.docs.report')),
      'Expected clearing entry for docs.report',
    );
    assert.ok(
      result.mutations_applied.some(m => m.includes('Cleared task.docs.review')),
      'Expected clearing entry for docs.review',
    );
  });

  it('emits no clearing entries when stale fields are already null (first-time handoff)', () => {
    const state = makeExecutionState();
    const handler = getMutation('task_handoff_created');
    const result = handler(state, { doc_path: 'tasks/HANDOFF-P01-T01.md' }, defaultConfig);

    assert.ok(
      !result.mutations_applied.some(m => m.includes('Cleared task.docs.report')),
      'Unexpected clearing entry for docs.report on first-time handoff',
    );
    assert.ok(
      !result.mutations_applied.some(m => m.includes('Cleared task.docs.review')),
      'Unexpected clearing entry for docs.review on first-time handoff',
    );

    assert.strictEqual(result.mutations_applied.length, 3);

    const task = state.execution.phases[0].tasks[0];
    assert.strictEqual(task.docs.handoff, 'tasks/HANDOFF-P01-T01.md');
    assert.strictEqual(task.status, 'in_progress');
    assert.strictEqual(task.docs.report, null);
    assert.strictEqual(task.docs.review, null);
  });
});

// ─── handleTaskCompleted ────────────────────────────────────────────────────

describe('handleTaskCompleted', () => {
  let state, result;

  beforeEach(() => {
    state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('task_completed');
    result = handler(state, { doc_path: 'reports/TASK-REPORT-P01-T01.md', has_deviations: true, deviation_type: 'minor' }, defaultConfig);
  });

  it('sets task.docs.report to context.doc_path', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.docs.report, 'reports/TASK-REPORT-P01-T01.md');
  });

  it('does NOT set task.report_doc (v3 flat field absent)', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.report_doc, undefined);
  });

  it('sets task.has_deviations from context', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.has_deviations, true);
  });

  it('sets task.deviation_type from context', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.deviation_type, 'minor');
  });

  it('sets task.stage to "reviewing"', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.stage, 'reviewing');
  });

  it('task.status stays "in_progress" NOT "complete" (key v4 semantic change)', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'in_progress');
    assert.notEqual(task.status, 'complete');
  });

  it('sets task.report_status from context.report_status when provided', () => {
    const state2 = makeExecutionState();
    state2.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('task_completed');
    const result2 = handler(state2, { doc_path: 'reports/R.md', has_deviations: false, deviation_type: null, report_status: 'failed' }, defaultConfig);
    const task = result2.state.execution.phases[0].tasks[0];
    assert.equal(task.report_status, 'failed');
  });

  it('defaults task.report_status to complete when context.report_status is undefined', () => {
    const state2 = makeExecutionState();
    state2.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('task_completed');
    const result2 = handler(state2, { doc_path: 'reports/R.md', has_deviations: false, deviation_type: null }, defaultConfig);
    const task = result2.state.execution.phases[0].tasks[0];
    assert.equal(task.report_status, 'complete');
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handleCodeReviewCompleted ──────────────────────────────────────────────

describe('handleCodeReviewCompleted', () => {
  it('on approved verdict: sets task complete, review.action advanced, bumps current_task, stage = complete', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'approved' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'complete');
    assert.equal(task.stage, 'complete');
    assert.equal(task.review.action, 'advanced');
    assert.equal(result.state.execution.phases[0].current_task, 2);
  });

  it('on changes_requested with retries left: sets task failed, corrective_task_issued, increments retries, stage = failed', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 0;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'changes_requested' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'failed');
    assert.equal(task.stage, 'failed');
    assert.equal(task.review.action, 'corrective_task_issued');
    assert.equal(task.retries, 1);
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('on changes_requested with no retries left: sets task halted, stage = failed', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 2;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'changes_requested' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'halted');
    assert.equal(task.stage, 'failed');
    assert.equal(task.review.action, 'halted');
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('on rejected verdict: sets task halted, stage = failed', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'rejected' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'halted');
    assert.equal(task.stage, 'failed');
    assert.equal(task.review.action, 'halted');
  });

  it('sets task.docs.review and task.review.verdict on the task', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW.md', verdict: 'approved' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.docs.review, 'reviews/REVIEW.md');
    assert.equal(task.review.verdict, 'approved');
    assert.equal(task.review_doc, undefined);
    assert.equal(task.review_verdict, undefined);
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW.md', verdict: 'approved' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handlePhaseReportCreated ───────────────────────────────────────────────

describe('handlePhaseReportCreated', () => {
  let state, result;

  beforeEach(() => {
    state = makeExecutionState();
    const handler = getMutation('phase_report_created');
    result = handler(state, { doc_path: 'reports/PHASE-REPORT-P01.md' }, defaultConfig);
  });

  it('sets phase.docs.phase_report to context.doc_path', () => {
    assert.equal(result.state.execution.phases[0].docs.phase_report, 'reports/PHASE-REPORT-P01.md');
  });

  it('sets phase.stage to "reviewing"', () => {
    assert.equal(result.state.execution.phases[0].stage, 'reviewing');
  });

  it('does NOT set phase.phase_report_doc (v3 flat field absent)', () => {
    assert.equal(result.state.execution.phases[0].phase_report_doc, undefined);
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handlePhaseReviewCompleted ─────────────────────────────────────────────

describe('handlePhaseReviewCompleted', () => {
  it('on approved + more phases: sets phase complete, bumps current_phase, phase.stage = complete', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'complete');
    assert.equal(result.state.execution.phases[0].stage, 'complete');
    assert.equal(result.state.execution.phases[0].review.action, 'advanced');
    assert.equal(result.state.execution.current_phase, 2);
    assert.equal(result.state.execution.phases[1].status, 'not_started');
  });

  it('on approved + last phase: sets phase complete, execution.status complete, pipeline.current_tier review', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'complete');
    assert.equal(result.state.execution.phases[0].stage, 'complete');
    assert.equal(result.state.execution.status, 'complete');
    assert.equal(result.state.pipeline.current_tier, 'review');
    assert.equal(result.state.execution.current_tier, undefined);
  });

  it('on changes_requested: sets review.action corrective_tasks_issued, phase.stage = executing', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'changes_requested', exit_criteria_met: false }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'in_progress');
    assert.equal(result.state.execution.phases[0].stage, 'executing');
    assert.equal(result.state.execution.phases[0].review.action, 'corrective_tasks_issued');
  });

  it('on rejected: sets phase halted, phase.stage = failed, pipeline.current_tier = halted', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'rejected', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'halted');
    assert.equal(result.state.execution.phases[0].stage, 'failed');
    assert.equal(result.state.execution.phases[0].review.action, 'halted');
    assert.equal(result.state.pipeline.current_tier, 'halted');
  });

  it('sets phase.docs.phase_review and phase.review.verdict', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].docs.phase_review, 'reviews/PHASE-REVIEW-P01.md');
    assert.equal(result.state.execution.phases[0].review.verdict, 'approved');
    assert.equal(result.state.execution.phases[0].phase_review_doc, undefined);
    assert.equal(result.state.execution.phases[0].phase_review_verdict, undefined);
  });

  it('advance check uses phases.length NOT total_phases', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    assert.equal(state.execution.total_phases, undefined);
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.current_phase, 2);
    assert.equal(result.state.pipeline.current_tier, 'execution');
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── Pointer Advance & Tier Transition Boundary Tests ───────────────────────

describe('pointer advance boundaries', () => {
  it('current_task bumps from 1 to 2 when first task advances in a 2-task phase (1-based)', () => {
    const state = makeExecutionState({ tasksPerPhase: 2 });
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 2);
  });

  it('current_task bumps past last task index when last task advances (1-based pointer beyond end)', () => {
    const state = makeExecutionState({ tasksPerPhase: 2 });
    state.execution.phases[0].current_task = 2;
    state.execution.phases[0].tasks[1].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 3);
  });

  it('current_task does NOT bump on corrective_task_issued', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 0;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'changes_requested' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('current_task does NOT bump on halted', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'rejected' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('current_phase bumps from 1 to 2 when first phase advances in a 2-phase project (1-based)', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.current_phase, 2);
  });
});

describe('tier transition', () => {
  it('pipeline.current_tier changes from execution to review only when last phase completes', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    assert.equal(state.pipeline.current_tier, 'execution');
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.pipeline.current_tier, 'review');
    assert.equal(result.state.execution.status, 'complete');
  });

  it('pipeline.current_tier stays execution when non-last phase completes', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.pipeline.current_tier, 'execution');
  });
});

// ─── Gate Mode — handleCodeReviewCompleted ────────────────────────────────────────────

describe('handleCodeReviewCompleted gate mode', () => {
  it('gate_mode null + config autonomous: approved still bumps phase.current_task', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = null;
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const cfg = { limits: { max_retries_per_task: 2 }, human_gates: { execution_mode: 'autonomous' } };
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, cfg);
    assert.equal(result.state.execution.phases[0].current_task, 2);
    assert.equal(result.state.execution.phases[0].tasks[0].stage, 'complete');
  });

  it('gate_mode task: approved sets task.stage complete but does NOT bump phase.current_task', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'task';
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].tasks[0].stage, 'complete');
    assert.equal(result.state.execution.phases[0].current_task, 1); // NOT bumped
  });

  it('gate_mode task: mutations_applied includes deferred message', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'task';
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    assert.ok(result.mutations_applied.some(m => m.includes('Deferred') && m.includes('task')));
  });

  it('gate_mode phase: approved DOES bump phase.current_task (phase mode only gates phases)', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'phase';
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 2); // bumped
    assert.equal(result.state.execution.phases[0].tasks[0].stage, 'complete');
  });

  it('gate_mode task: corrective_task_issued branch is unaffected', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'task';
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 0;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'changes_requested' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].tasks[0].stage, 'failed');
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('gate_mode task: halted branch is unaffected', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'task';
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'rejected' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].tasks[0].stage, 'failed');
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });
});

// ─── Gate Mode — handlePhaseReviewCompleted ─────────────────────────────────────

describe('handlePhaseReviewCompleted gate mode', () => {
  it('gate_mode null + config autonomous: approved still bumps execution.current_phase', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.pipeline.gate_mode = null;
    const handler = getMutation('phase_review_completed');
    const cfg = { limits: { max_retries_per_task: 2 }, human_gates: { execution_mode: 'autonomous' } };
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, cfg);
    assert.equal(result.state.execution.current_phase, 2);
    assert.equal(result.state.execution.phases[0].stage, 'complete');
  });

  it('gate_mode phase: approved sets phase.stage complete but does NOT bump execution.current_phase', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.pipeline.gate_mode = 'phase';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].stage, 'complete');
    assert.equal(result.state.execution.current_phase, 1); // NOT bumped
  });

  it('gate_mode phase: mutations_applied includes deferred message', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.pipeline.gate_mode = 'phase';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.ok(result.mutations_applied.some(m => m.includes('Deferred') && m.includes('phase')));
  });

  it('gate_mode task: approved sets phase.stage complete but does NOT bump execution.current_phase', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.pipeline.gate_mode = 'task';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].stage, 'complete');
    assert.equal(result.state.execution.current_phase, 1); // NOT bumped (task mode defers both)
  });

  it('gate_mode autonomous: approved DOES bump execution.current_phase', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.pipeline.gate_mode = 'autonomous';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.current_phase, 2);
    assert.equal(result.state.execution.phases[0].stage, 'complete');
  });

  it('gate_mode phase: last phase does NOT transition tier to review (pointer deferred)', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    state.pipeline.gate_mode = 'phase';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.pipeline.current_tier, 'execution'); // NOT transitioned to review
    assert.equal(result.state.execution.status, 'in_progress'); // NOT set to complete
  });

  it('gate_mode phase: corrective_tasks_issued branch is unaffected', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'phase';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'changes_requested', exit_criteria_met: false }, defaultConfig);
    assert.equal(result.state.execution.phases[0].stage, 'executing');
    assert.equal(result.state.execution.current_phase, 1);
  });

  it('gate_mode phase: halted branch is unaffected', () => {
    const state = makeExecutionState();
    state.pipeline.gate_mode = 'phase';
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'rejected', exit_criteria_met: false }, defaultConfig);
    assert.equal(result.state.execution.phases[0].stage, 'failed');
    assert.equal(result.state.pipeline.current_tier, 'halted');
  });
});

// ─── Review State Helper ────────────────────────────────────────────────────

function makeReviewState() {
  return {
    pipeline: {
      current_tier: 'review',
    },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research', status: 'complete', doc_path: 'RESEARCH.md' },
        { name: 'prd', status: 'complete', doc_path: 'PRD.md' },
        { name: 'design', status: 'complete', doc_path: 'DESIGN.md' },
        { name: 'architecture', status: 'complete', doc_path: 'ARCHITECTURE.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'MASTER-PLAN.md' },
      ],
    },
    execution: {
      status: 'complete',
      current_phase: 1,
      phases: [
        {
          name: 'Phase 1',
          status: 'complete',
          stage: 'complete',
          current_task: 2,
          tasks: [
            {
              name: 'Task 1',
              status: 'complete',
              stage: 'complete',
              docs: {
                handoff: 'tasks/TASK-P01-T01.md',
                report: 'reports/TASK-REPORT-P01-T01.md',
                review: 'reviews/REVIEW-P01-T01.md',
              },
              review: {
                verdict: 'approved',
                action: 'advanced',
              },
              has_deviations: false,
              deviation_type: null,
              retries: 0,
              report_status: 'complete',
            },
          ],
          docs: {
            phase_plan: 'phases/PHASE-PLAN-P01.md',
            phase_report: 'reports/PHASE-REPORT-P01.md',
            phase_review: 'reviews/PHASE-REVIEW-P01.md',
          },
          review: {
            verdict: 'approved',
            action: 'advanced',
          },
        },
      ],
    },
    final_review: {
      status: 'not_started',
      doc_path: null,
      human_approved: false,
    },
  };
}

// ─── handleGateApproved ─────────────────────────────────────────────────────

describe('handleGateApproved', () => {
  it('gate_type task: bumps phase.current_task by 1', () => {
    const state = makeExecutionState();
    state.execution.phases[0].current_task = 1;
    const handler = getMutation('gate_approved');
    const result = handler(state, { gate_type: 'task' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 2);
  });

  it('gate_type task: returns descriptive mutations_applied', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_approved');
    const result = handler(state, { gate_type: 'task' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
    assert.ok(result.mutations_applied[0].includes('current_task'));
  });

  it('gate_type phase (not last): bumps execution.current_phase by 1', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.execution.current_phase = 1;
    const handler = getMutation('gate_approved');
    const result = handler(state, { gate_type: 'phase' }, defaultConfig);
    assert.equal(result.state.execution.current_phase, 2);
  });

  it('gate_type phase (not last): returns descriptive mutations_applied', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    state.execution.current_phase = 1;
    const handler = getMutation('gate_approved');
    const result = handler(state, { gate_type: 'phase' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
    assert.ok(result.mutations_applied[0].includes('current_phase'));
  });

  it('gate_type phase (last phase): sets execution.status to complete', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    state.execution.current_phase = 1;
    const handler = getMutation('gate_approved');
    const result = handler(state, { gate_type: 'phase' }, defaultConfig);
    assert.equal(result.state.execution.status, 'complete');
  });

  it('gate_type phase (last phase): sets pipeline.current_tier to review', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    state.execution.current_phase = 1;
    const handler = getMutation('gate_approved');
    const result = handler(state, { gate_type: 'phase' }, defaultConfig);
    assert.equal(result.state.pipeline.current_tier, 'review');
  });
});

// ─── handleGateRejected ────────────────────────────────────────────────────

describe('handleGateRejected', () => {
  it('gate_type task: sets pipeline.current_tier to halted', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_rejected');
    const result = handler(state, { gate_type: 'task', reason: 'Not ready' }, defaultConfig);
    assert.equal(result.state.pipeline.current_tier, 'halted');
  });

  it('gate_type task: mutations_applied includes gate type, location, and reason', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_rejected');
    const result = handler(state, { gate_type: 'task', reason: 'Not ready' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.some(m => m.includes('task')));
    assert.ok(result.mutations_applied.some(m => m.includes('phase')));
    assert.ok(result.mutations_applied.some(m => m.includes('Not ready')));
  });

  it('gate_type phase: sets pipeline.current_tier to halted', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_rejected');
    const result = handler(state, { gate_type: 'phase', reason: 'Phase incomplete' }, defaultConfig);
    assert.equal(result.state.pipeline.current_tier, 'halted');
  });

  it('gate_type phase: mutations_applied includes gate type, location, and reason', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_rejected');
    const result = handler(state, { gate_type: 'phase', reason: 'Phase incomplete' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.some(m => m.includes('phase')));
    assert.ok(result.mutations_applied.some(m => m.includes('Phase incomplete')));
  });

  it('does NOT modify task or phase status fields', () => {
    const state = makeExecutionState();
    const originalPhaseStatus = state.execution.phases[0].status;
    const handler = getMutation('gate_rejected');
    handler(state, { gate_type: 'task', reason: 'rejected' }, defaultConfig);
    assert.equal(state.execution.phases[0].status, originalPhaseStatus);
  });
});

// ─── handleGateModeSet ─────────────────────────────────────────────────────

describe('handleGateModeSet', () => {
  it('sets pipeline.gate_mode to task', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_mode_set');
    const result = handler(state, { gate_mode: 'task' }, defaultConfig);
    assert.equal(result.state.pipeline.gate_mode, 'task');
  });

  it('sets pipeline.gate_mode to phase', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_mode_set');
    const result = handler(state, { gate_mode: 'phase' }, defaultConfig);
    assert.equal(result.state.pipeline.gate_mode, 'phase');
  });

  it('sets pipeline.gate_mode to autonomous', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_mode_set');
    const result = handler(state, { gate_mode: 'autonomous' }, defaultConfig);
    assert.equal(result.state.pipeline.gate_mode, 'autonomous');
  });

  it('returns a single descriptive mutations_applied entry', () => {
    const state = makeExecutionState();
    const handler = getMutation('gate_mode_set');
    const result = handler(state, { gate_mode: 'task' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.equal(result.mutations_applied.length, 1);
    assert.ok(result.mutations_applied[0].includes('gate_mode'));
  });
});

// ─── handleFinalReviewCompleted ─────────────────────────────────────────────

describe('handleFinalReviewCompleted', () => {
  it('sets final_review.doc_path from context.doc_path (NOT execution.final_review_doc)', () => {
    const state = makeReviewState();
    const handler = getMutation('final_review_completed');
    const result = handler(state, { doc_path: 'reviews/FINAL-REVIEW.md' }, defaultConfig);
    assert.equal(result.state.final_review.doc_path, 'reviews/FINAL-REVIEW.md');
    assert.equal(result.state.execution.final_review_doc, undefined);
  });

  it('sets final_review.status to complete (NOT execution.final_review_status)', () => {
    const state = makeReviewState();
    const handler = getMutation('final_review_completed');
    const result = handler(state, { doc_path: 'reviews/FINAL-REVIEW.md' }, defaultConfig);
    assert.equal(result.state.final_review.status, 'complete');
    assert.equal(result.state.execution.final_review_status, undefined);
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    const state = makeReviewState();
    const handler = getMutation('final_review_completed');
    const result = handler(state, { doc_path: 'reviews/FINAL-REVIEW.md' }, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handleFinalApproved ────────────────────────────────────────────────────

describe('handleFinalApproved', () => {
  let state, result;

  beforeEach(() => {
    state = makeReviewState();
    state.final_review.doc_path = 'reviews/FINAL-REVIEW.md';
    state.final_review.status = 'complete';
    const handler = getMutation('final_approved');
    result = handler(state, {}, defaultConfig);
  });

  it('sets final_review.human_approved to true (NOT execution.final_review_approved)', () => {
    assert.equal(result.state.final_review.human_approved, true);
    assert.equal(result.state.execution.final_review_approved, undefined);
  });

  it('transitions pipeline.current_tier to complete (NOT execution.current_tier)', () => {
    assert.equal(result.state.pipeline.current_tier, 'complete');
    assert.equal(result.state.execution.current_tier, undefined);
  });

  it('does NOT change execution.status', () => {
    assert.equal(result.state.execution.status, 'complete');
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handleFinalRejected ────────────────────────────────────────────────────

describe('handleFinalRejected', () => {
  let state, result;

  beforeEach(() => {
    state = makeReviewState();
    state.final_review.doc_path = 'reviews/FINAL-REVIEW.md';
    state.final_review.status = 'complete';
    const handler = getMutation('final_rejected');
    result = handler(state, {}, defaultConfig);
  });

  it('sets final_review.doc_path to null', () => {
    assert.equal(result.state.final_review.doc_path, null);
  });

  it('sets final_review.status to "not_started"', () => {
    assert.equal(result.state.final_review.status, 'not_started');
  });

  it('returns mutations_applied with exactly 2 descriptive string entries', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.equal(result.mutations_applied.length, 2);
    assert.ok(result.mutations_applied[0].includes('final_review.doc_path'));
    assert.ok(result.mutations_applied[1].includes('final_review.status'));
  });
});

// ─── getMutation dispatch for all 20 events ─────────────────────────────────

describe('getMutation (all 20 events)', () => {
  const allEvents = [
    'research_completed',
    'prd_completed',
    'design_completed',
    'architecture_completed',
    'master_plan_completed',
    'plan_approved',
    'plan_rejected',
    'phase_plan_created',
    'task_handoff_created',
    'task_completed',
    'code_review_completed',
    'phase_report_created',
    'phase_review_completed',
    'gate_mode_set',
    'gate_approved',
    'gate_rejected',
    'final_review_completed',
    'final_approved',
    'final_rejected',
    'halt',
  ];

  for (const event of allEvents) {
    it(`returns a function for "${event}"`, () => {
      assert.equal(typeof getMutation(event), 'function');
    });
  }

  it('has exactly 20 registered events', () => {
    let count = 0;
    for (const event of allEvents) {
      if (getMutation(event)) count++;
    }
    assert.equal(count, 20);
  });

  it('does NOT contain task_approved', () => {
    assert.equal(getMutation('task_approved'), undefined);
  });

  it('does NOT contain phase_approved', () => {
    assert.equal(getMutation('phase_approved'), undefined);
  });
});
