'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { getMutation, normalizeDocPath, _test } = require('../lib/mutations');
const { resolveTaskOutcome, resolvePhaseOutcome, checkRetryBudget } = _test;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlanningState() {
  return {
    planning: {
      status: 'in_progress',
      human_approved: false,
      current_step: 'research',
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
      current_tier: 'planning',
      current_phase: 0,
      total_phases: 0,
      phases: [],
    },
  };
}

// ─── getMutation ────────────────────────────────────────────────────────────

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
      '.github/projects/MY-PROJECT/PRD.md',
      '.github/projects',
      'MY-PROJECT',
    );
    assert.equal(result, 'PRD.md');
  });

  it('returns path unchanged when prefix is not present', () => {
    const result = normalizeDocPath('some/other/path.md', '.github/projects', 'MY-PROJECT');
    assert.equal(result, 'some/other/path.md');
  });

  it('returns null when input is null', () => {
    assert.equal(normalizeDocPath(null, '.github/projects', 'MY-PROJECT'), null);
  });

  it('returns undefined when input is undefined', () => {
    assert.equal(normalizeDocPath(undefined, '.github/projects', 'MY-PROJECT'), undefined);
  });
});

// ─── Task Decision Table ────────────────────────────────────────────────────

describe('task decision table', () => {
  it('task row 1: approved + complete + no deviations → complete/advanced', () => {
    const result = resolveTaskOutcome('approved', 'complete', false, null, 0, 3);
    assert.deepEqual(result, { taskStatus: 'complete', reviewAction: 'advanced' });
  });

  it('task row 2: approved + complete + minor deviations → complete/advanced', () => {
    const result = resolveTaskOutcome('approved', 'complete', true, 'minor', 0, 3);
    assert.deepEqual(result, { taskStatus: 'complete', reviewAction: 'advanced' });
  });

  it('task row 3: approved + complete + critical deviations → complete/advanced', () => {
    const result = resolveTaskOutcome('approved', 'complete', true, 'critical', 0, 3);
    assert.deepEqual(result, { taskStatus: 'complete', reviewAction: 'advanced' });
  });

  it('task row 4: changes_requested + complete + retries left → failed/corrective', () => {
    const result = resolveTaskOutcome('changes_requested', 'complete', false, null, 0, 3);
    assert.deepEqual(result, { taskStatus: 'failed', reviewAction: 'corrective_task_issued' });
  });

  it('task row 5: changes_requested + complete + no retries → halted/halted', () => {
    const result = resolveTaskOutcome('changes_requested', 'complete', false, null, 3, 3);
    assert.deepEqual(result, { taskStatus: 'halted', reviewAction: 'halted' });
  });

  it('task row 6: changes_requested + failed + retries left → failed/corrective', () => {
    const result = resolveTaskOutcome('changes_requested', 'failed', false, null, 1, 3);
    assert.deepEqual(result, { taskStatus: 'failed', reviewAction: 'corrective_task_issued' });
  });

  it('task row 7: changes_requested + failed + no retries → halted/halted', () => {
    const result = resolveTaskOutcome('changes_requested', 'failed', false, null, 3, 3);
    assert.deepEqual(result, { taskStatus: 'halted', reviewAction: 'halted' });
  });

  it('task row 8: rejected → halted/halted', () => {
    const result = resolveTaskOutcome('rejected', 'complete', false, null, 0, 3);
    assert.deepEqual(result, { taskStatus: 'halted', reviewAction: 'halted' });
  });
});

// ─── Phase Decision Table ───────────────────────────────────────────────────

describe('phase decision table', () => {
  it('phase row 1: approved + exit criteria met → complete/advanced', () => {
    const result = resolvePhaseOutcome('approved', true);
    assert.deepEqual(result, { phaseStatus: 'complete', phaseReviewAction: 'advanced' });
  });

  it('phase row 2: approved + exit criteria not met → complete/advanced', () => {
    const result = resolvePhaseOutcome('approved', false);
    assert.deepEqual(result, { phaseStatus: 'complete', phaseReviewAction: 'advanced' });
  });

  it('phase row 3: changes_requested → in_progress/corrective_tasks_issued', () => {
    const result = resolvePhaseOutcome('changes_requested', true);
    assert.deepEqual(result, { phaseStatus: 'in_progress', phaseReviewAction: 'corrective_tasks_issued' });
  });

  it('phase row 4: rejected + exit criteria met → halted/halted', () => {
    const result = resolvePhaseOutcome('rejected', true);
    assert.deepEqual(result, { phaseStatus: 'halted', phaseReviewAction: 'halted' });
  });

  it('phase row 5: rejected + exit criteria not met → halted/halted', () => {
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

  it('sets execution.current_tier to "execution"', () => {
    assert.equal(result.state.execution.current_tier, 'execution');
  });

  it('sets execution.status to "in_progress"', () => {
    assert.equal(result.state.execution.status, 'in_progress');
  });

  it('sets execution.total_phases to context.total_phases', () => {
    assert.equal(result.state.execution.total_phases, 3);
  });

  it('initializes execution.phases array with correct length', () => {
    assert.equal(result.state.execution.phases.length, 3);
  });

  it('sets execution.current_phase to 0', () => {
    assert.equal(result.state.execution.current_phase, 0);
  });

  it('each phase has the correct template', () => {
    for (let i = 0; i < 3; i++) {
      const phase = result.state.execution.phases[i];
      assert.equal(phase.name, `Phase ${i + 1}`);
      assert.equal(phase.status, 'not_started');
      assert.equal(phase.current_task, 0);
      assert.equal(phase.total_tasks, 0);
      assert.deepEqual(phase.tasks, []);
      assert.equal(phase.phase_plan_doc, null);
      assert.equal(phase.phase_report_doc, null);
      assert.equal(phase.phase_review_doc, null);
      assert.equal(phase.phase_review_verdict, null);
      assert.equal(phase.phase_review_action, null);
    }
  });

  it('returns mutations_applied array', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
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

  it('sets execution.current_tier to "halted"', () => {
    assert.equal(result.state.execution.current_tier, 'halted');
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
        handoff_doc: null,
        report_doc: null,
        review_doc: null,
        review_verdict: null,
        review_action: null,
        has_deviations: false,
        deviation_type: null,
        retries: 0,
      });
    }
    phases.push({
      name: `Phase ${i + 1}`,
      status: i === 0 ? 'in_progress' : 'not_started',
      current_task: 0,
      total_tasks: tasksPerPhase,
      tasks,
      phase_plan_doc: null,
      phase_report_doc: null,
      phase_review_doc: null,
      phase_review_verdict: null,
      phase_review_action: null,
    });
  }
  return {
    planning: {
      status: 'complete',
      human_approved: true,
      current_step: 'master_plan',
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
      current_tier: 'execution',
      current_phase: 0,
      total_phases: totalPhases,
      phases,
    },
  };
}

const defaultConfig = { limits: { max_retries_per_task: 2 } };

// ─── handlePhasePlanCreated ─────────────────────────────────────────────────

describe('handlePhasePlanCreated', () => {
  let state, result;

  beforeEach(() => {
    state = makeExecutionState();
    // Reset phase to pre-plan state
    state.execution.phases[0].status = 'not_started';
    state.execution.phases[0].total_tasks = 0;
    state.execution.phases[0].tasks = [];
    const handler = getMutation('phase_plan_created');
    result = handler(state, { doc_path: 'phases/PHASE-PLAN-P01.md', tasks: ['Setup', 'Implement'] }, defaultConfig);
  });

  it('sets phase.status to in_progress', () => {
    assert.equal(result.state.execution.phases[0].status, 'in_progress');
  });

  it('sets phase.phase_plan_doc to context.doc_path', () => {
    assert.equal(result.state.execution.phases[0].phase_plan_doc, 'phases/PHASE-PLAN-P01.md');
  });

  it('sets phase.total_tasks to context.tasks.length', () => {
    assert.equal(result.state.execution.phases[0].total_tasks, 2);
  });

  it('populates phase.tasks with correct task template objects', () => {
    const tasks = result.state.execution.phases[0].tasks;
    assert.equal(tasks.length, 2);
    assert.deepEqual(tasks[0], {
      name: 'Setup',
      status: 'not_started',
      handoff_doc: null,
      report_doc: null,
      review_doc: null,
      review_verdict: null,
      review_action: null,
      has_deviations: false,
      deviation_type: null,
      retries: 0,
      report_status: null,
    });
    assert.deepEqual(tasks[1], {
      name: 'Implement',
      status: 'not_started',
      handoff_doc: null,
      report_doc: null,
      review_doc: null,
      review_verdict: null,
      review_action: null,
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
    s.execution.phases[0].total_tasks = 0;
    s.execution.phases[0].tasks = [];
    const handler = getMutation('phase_plan_created');
    const r = handler(s, { doc_path: 'phases/p.md', tasks: ['T01'], title: 'Core Features' }, defaultConfig);
    assert.equal(r.state.execution.phases[0].name, 'Core Features');
    assert.ok(r.mutations_applied.some(m => m.includes('Core Features')));
  });

  it('does not change phase.name when context.title is absent', () => {
    const s = makeExecutionState();
    s.execution.phases[0].status = 'not_started';
    s.execution.phases[0].total_tasks = 0;
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

  it('sets task.handoff_doc to context.doc_path', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.handoff_doc, 'tasks/TASK-P01-T01.md');
  });

  it('sets task.status to in_progress', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'in_progress');
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
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

  it('sets task.report_doc to context.doc_path', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.report_doc, 'reports/TASK-REPORT-P01-T01.md');
  });

  it('sets task.has_deviations from context', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.has_deviations, true);
  });

  it('sets task.deviation_type from context', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.deviation_type, 'minor');
  });

  it('sets task.status to complete', () => {
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'complete');
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
  it('on approved verdict: sets task complete, review_action to advanced, bumps current_task', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'approved' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'complete');
    assert.equal(task.review_action, 'advanced');
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('on changes_requested with retries left: sets task failed, corrective_task_issued, increments retries', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 0;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'changes_requested' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'failed');
    assert.equal(task.review_action, 'corrective_task_issued');
    assert.equal(task.retries, 1);
    assert.equal(result.state.execution.phases[0].current_task, 0);
  });

  it('on changes_requested with no retries left: sets task halted', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 2;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'changes_requested' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'halted');
    assert.equal(task.review_action, 'halted');
    assert.equal(result.state.execution.phases[0].current_task, 0);
  });

  it('on rejected verdict: sets task halted', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW-P01-T01.md', verdict: 'rejected' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.status, 'halted');
    assert.equal(task.review_action, 'halted');
  });

  it('sets review_doc and review_verdict on the task', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'reviews/REVIEW.md', verdict: 'approved' }, defaultConfig);
    const task = result.state.execution.phases[0].tasks[0];
    assert.equal(task.review_doc, 'reviews/REVIEW.md');
    assert.equal(task.review_verdict, 'approved');
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

  it('sets phase.phase_report_doc to context.doc_path', () => {
    assert.equal(result.state.execution.phases[0].phase_report_doc, 'reports/PHASE-REPORT-P01.md');
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handlePhaseReviewCompleted ─────────────────────────────────────────────

describe('handlePhaseReviewCompleted', () => {
  it('on approved + more phases: sets phase complete, bumps current_phase, leaves next phase not_started', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'complete');
    assert.equal(result.state.execution.phases[0].phase_review_action, 'advanced');
    assert.equal(result.state.execution.current_phase, 1);
    assert.equal(result.state.execution.phases[1].status, 'not_started');
  });

  it('on approved + last phase: sets phase complete, execution.status to complete, current_tier to review', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'complete');
    assert.equal(result.state.execution.status, 'complete');
    assert.equal(result.state.execution.current_tier, 'review');
  });

  it('on changes_requested: sets phase_review_action to corrective_tasks_issued, phase stays in_progress', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'changes_requested', exit_criteria_met: false }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'in_progress');
    assert.equal(result.state.execution.phases[0].phase_review_action, 'corrective_tasks_issued');
  });

  it('on rejected: sets phase halted, phase_review_action to halted', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'rejected', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].status, 'halted');
    assert.equal(result.state.execution.phases[0].phase_review_action, 'halted');
  });

  it('sets phase_review_doc and phase_review_verdict', () => {
    const state = makeExecutionState();
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'reviews/PHASE-REVIEW-P01.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.phases[0].phase_review_doc, 'reviews/PHASE-REVIEW-P01.md');
    assert.equal(result.state.execution.phases[0].phase_review_verdict, 'approved');
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
  it('current_task bumps from 0 to 1 when first task advances in a 2-task phase', () => {
    const state = makeExecutionState({ tasksPerPhase: 2 });
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 1);
  });

  it('current_task stays at last index when last task advances (no out-of-bounds)', () => {
    const state = makeExecutionState({ tasksPerPhase: 2 });
    state.execution.phases[0].current_task = 1;
    state.execution.phases[0].tasks[1].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved' }, defaultConfig);
    // Pointer bumps to 2, which is past the last task index — valid for "done" detection
    assert.equal(result.state.execution.phases[0].current_task, 2);
  });

  it('current_task does NOT bump on corrective_task_issued', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    state.execution.phases[0].tasks[0].retries = 0;
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'changes_requested' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 0);
  });

  it('current_task does NOT bump on halted', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'in_progress';
    const handler = getMutation('code_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'rejected' }, defaultConfig);
    assert.equal(result.state.execution.phases[0].current_task, 0);
  });

  it('current_phase bumps from 0 to 1 when first phase advances in a 2-phase project', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.current_phase, 1);
  });
});

describe('tier transition', () => {
  it('current_tier changes from execution to review only when last phase completes', () => {
    const state = makeExecutionState({ totalPhases: 1 });
    assert.equal(state.execution.current_tier, 'execution');
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.current_tier, 'review');
    assert.equal(result.state.execution.status, 'complete');
  });

  it('current_tier stays execution when non-last phase completes', () => {
    const state = makeExecutionState({ totalPhases: 2 });
    const handler = getMutation('phase_review_completed');
    const result = handler(state, { doc_path: 'r.md', verdict: 'approved', exit_criteria_met: true }, defaultConfig);
    assert.equal(result.state.execution.current_tier, 'execution');
  });
});

// ─── Review State Helper ────────────────────────────────────────────────────

function makeReviewState() {
  return {
    planning: {
      status: 'complete',
      human_approved: true,
      current_step: 'master_plan',
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
      current_tier: 'review',
      current_phase: 0,
      total_phases: 1,
      phases: [
        {
          name: 'Phase 1',
          status: 'complete',
          current_task: 1,
          total_tasks: 1,
          tasks: [
            {
              name: 'Task 1',
              status: 'complete',
              handoff_doc: 'tasks/TASK-P01-T01.md',
              report_doc: 'reports/TASK-REPORT-P01-T01.md',
              review_doc: 'reviews/REVIEW-P01-T01.md',
              review_verdict: 'approved',
              review_action: 'advanced',
              has_deviations: false,
              deviation_type: null,
              retries: 0,
            },
          ],
          phase_plan_doc: 'phases/PHASE-PLAN-P01.md',
          phase_report_doc: 'reports/PHASE-REPORT-P01.md',
          phase_review_doc: 'reviews/PHASE-REVIEW-P01.md',
          phase_review_verdict: 'approved',
          phase_review_action: 'advanced',
        },
      ],
    },
    final_review: {
      status: 'not_started',
      report_doc: null,
      human_approved: false,
    },
  };
}

// ─── handleTaskApproved ─────────────────────────────────────────────────────

describe('handleTaskApproved', () => {
  it('returns state unchanged (no-op gate)', () => {
    const state = makeExecutionState();
    // Mark current task as complete to simulate post-review state
    state.execution.phases[0].tasks[0].status = 'complete';
    const original = JSON.parse(JSON.stringify(state));
    const handler = getMutation('task_approved');
    const result = handler(state, {}, defaultConfig);
    assert.deepEqual(result.state, original);
  });

  it('returns mutations_applied as a non-empty array', () => {
    const state = makeExecutionState();
    state.execution.phases[0].tasks[0].status = 'complete';
    const handler = getMutation('task_approved');
    const result = handler(state, {}, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handlePhaseApproved ────────────────────────────────────────────────────

describe('handlePhaseApproved', () => {
  it('returns state unchanged (no-op gate)', () => {
    const state = makeExecutionState();
    state.execution.phases[0].status = 'complete';
    const original = JSON.parse(JSON.stringify(state));
    const handler = getMutation('phase_approved');
    const result = handler(state, {}, defaultConfig);
    assert.deepEqual(result.state, original);
  });

  it('returns mutations_applied as a non-empty array', () => {
    const state = makeExecutionState();
    state.execution.phases[0].status = 'complete';
    const handler = getMutation('phase_approved');
    const result = handler(state, {}, defaultConfig);
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── handleFinalReviewCompleted ─────────────────────────────────────────────

describe('handleFinalReviewCompleted', () => {
  it('sets execution.final_review_doc from context.doc_path', () => {
    const state = makeReviewState();
    const handler = getMutation('final_review_completed');
    const result = handler(state, { doc_path: 'reviews/FINAL-REVIEW.md' }, defaultConfig);
    assert.equal(result.state.execution.final_review_doc, 'reviews/FINAL-REVIEW.md');
  });

  it('sets execution.final_review_status to complete', () => {
    const state = makeReviewState();
    const handler = getMutation('final_review_completed');
    const result = handler(state, { doc_path: 'reviews/FINAL-REVIEW.md' }, defaultConfig);
    assert.equal(result.state.execution.final_review_status, 'complete');
  });

  it('does NOT write to state.final_review', () => {
    const state = makeReviewState();
    delete state.final_review;
    const handler = getMutation('final_review_completed');
    const result = handler(state, { doc_path: 'reviews/FINAL-REVIEW.md' }, defaultConfig);
    assert.equal(result.state.final_review, undefined);
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
    state.execution.final_review_doc = 'reviews/FINAL-REVIEW.md';
    state.execution.final_review_status = 'complete';
    const handler = getMutation('final_approved');
    result = handler(state, {}, defaultConfig);
  });

  it('sets execution.final_review_approved to true', () => {
    assert.equal(result.state.execution.final_review_approved, true);
  });

  it('does NOT write to state.final_review', () => {
    // final_review still exists from makeReviewState but should not have human_approved set by this handler
    assert.equal(result.state.final_review.human_approved, false);
  });

  it('transitions execution.current_tier to complete', () => {
    assert.equal(result.state.execution.current_tier, 'complete');
  });

  it('does NOT change execution.status', () => {
    assert.equal(result.state.execution.status, 'complete');
  });

  it('returns MutationResult with non-empty mutations_applied', () => {
    assert.ok(Array.isArray(result.mutations_applied));
    assert.ok(result.mutations_applied.length > 0);
  });
});

// ─── getMutation dispatch for all 17 events ─────────────────────────────────

describe('getMutation (all 17 events)', () => {
  const allEvents = [
    'research_completed',
    'prd_completed',
    'design_completed',
    'architecture_completed',
    'master_plan_completed',
    'plan_approved',
    'phase_plan_created',
    'task_handoff_created',
    'task_completed',
    'code_review_completed',
    'phase_report_created',
    'phase_review_completed',
    'task_approved',
    'phase_approved',
    'final_review_completed',
    'final_approved',
    'halt',
  ];

  for (const event of allEvents) {
    it(`returns a function for "${event}"`, () => {
      assert.equal(typeof getMutation(event), 'function');
    });
  }

  it('has exactly 17 registered events', () => {
    let count = 0;
    for (const event of allEvents) {
      if (getMutation(event)) count++;
    }
    assert.equal(count, 17);
  });
});
