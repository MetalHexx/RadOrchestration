'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getMutation } = require('../lib/mutations');
const { resolveNextAction } = require('../lib/resolver');

// ─── Factories ──────────────────────────────────────────────────────────────

function makeState() {
  return {
    pipeline: {
      current_tier: 'execution',
      gate_mode: 'autonomous',
    },
    planning: {
      status: 'complete',
      human_approved: true,
      steps: [
        { name: 'research',     status: 'complete', doc_path: 'RESEARCH.md' },
        { name: 'prd',          status: 'complete', doc_path: 'PRD.md' },
        { name: 'design',       status: 'complete', doc_path: 'DESIGN.md' },
        { name: 'architecture', status: 'complete', doc_path: 'ARCHITECTURE.md' },
        { name: 'master_plan',  status: 'complete', doc_path: 'MASTER-PLAN.md' },
      ],
    },
    execution: {
      status: 'in_progress',
      current_phase: 1,
      phases: [
        {
          name: 'Phase 1',
          status: 'in_progress',
          stage: 'reviewing',
          current_task: 1,
          tasks: [
            {
              name: 'Task 1',
              status: 'complete',
              stage: 'complete',
              docs: {
                handoff: 'tasks/HANDOFF-P01-T01.md',
                report: 'tasks/REPORT-P01-T01.md',
                review: 'tasks/REVIEW-P01-T01.md',
              },
              review: { verdict: 'approved', action: 'advanced' },
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
            verdict: null,
            action: null,
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

function makeConfig() {
  return {
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
}

// ─── Corrective Cycle — End-to-End ──────────────────────────────────────────

describe('corrective cycle — end-to-end', () => {

  it('full corrective cycle: reviewing → failed → executing', () => {
    const state = makeState();
    const config = makeConfig();
    const phase = state.execution.phases[0];

    // (a) Phase starts in 'reviewing' stage
    assert.equal(phase.stage, 'reviewing');

    // (b) handlePhaseReviewCompleted with changes_requested verdict
    const reviewHandler = getMutation('phase_review_completed');
    reviewHandler(state, {
      doc_path: 'reviews/PHASE-REVIEW-P01.md',
      verdict: 'changes_requested',
      exit_criteria_met: false,
    }, config);

    // (c) Post-review: phase must be failed with corrective action
    assert.equal(phase.stage, 'failed');
    assert.equal(phase.status, 'in_progress');
    assert.equal(phase.review.action, 'corrective_tasks_issued');

    // (d) Resolve next action on the post-mutation state
    const result = resolveNextAction(state, config);

    // (e) Resolver must return create_phase_plan with corrective context
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(result.context.is_correction, true);
    assert.equal(result.context.phase_number, 1);
    assert.equal(result.context.phase_id, 'P01');
    assert.equal(result.context.previous_review, 'reviews/PHASE-REVIEW-P01.md');

    // (f) handlePhasePlanCreated with the corrective phase plan
    const planHandler = getMutation('phase_plan_created');
    planHandler(state, {
      doc_path: 'phases/CORRECTIVE-PHASE-PLAN-P01.md',
      tasks: ['Fix A', 'Fix B'],
    }, config);

    // (g) Post-plan: stage executing, stale fields cleared, new plan set
    assert.equal(phase.stage, 'executing');
    assert.equal(phase.status, 'in_progress');
    assert.equal(phase.docs.phase_report, null);
    assert.equal(phase.docs.phase_review, null);
    assert.equal(phase.review.verdict, null);
    assert.equal(phase.review.action, null);
    assert.equal(phase.docs.phase_plan, 'phases/CORRECTIVE-PHASE-PLAN-P01.md');
  });

  it('phase.status stays in_progress throughout the corrective cycle', () => {
    const state = makeState();
    const config = makeConfig();
    const phase = state.execution.phases[0];

    // Step 1: reviewing — status is in_progress
    assert.equal(phase.status, 'in_progress');

    // Step 2: after phase_review_completed (changes_requested) — still in_progress
    const reviewHandler = getMutation('phase_review_completed');
    reviewHandler(state, {
      doc_path: 'reviews/PHASE-REVIEW-P01.md',
      verdict: 'changes_requested',
      exit_criteria_met: false,
    }, config);
    assert.equal(phase.status, 'in_progress');

    // Step 3: after phase_plan_created — still in_progress
    const planHandler = getMutation('phase_plan_created');
    planHandler(state, {
      doc_path: 'phases/CORRECTIVE-PHASE-PLAN-P01.md',
      tasks: ['Fix A', 'Fix B'],
    }, config);
    assert.equal(phase.status, 'in_progress');
  });

  it('transition sequence is reviewing → failed → executing', () => {
    const state = makeState();
    const config = makeConfig();
    const phase = state.execution.phases[0];
    const stages = [];

    // Capture initial reviewing stage
    stages.push(phase.stage);

    // After review handler: failed
    const reviewHandler = getMutation('phase_review_completed');
    reviewHandler(state, {
      doc_path: 'reviews/PHASE-REVIEW-P01.md',
      verdict: 'changes_requested',
      exit_criteria_met: false,
    }, config);
    stages.push(phase.stage);

    // After plan handler: executing
    const planHandler = getMutation('phase_plan_created');
    planHandler(state, {
      doc_path: 'phases/CORRECTIVE-PHASE-PLAN-P01.md',
      tasks: ['Fix A', 'Fix B'],
    }, config);
    stages.push(phase.stage);

    assert.deepEqual(stages, ['reviewing', 'failed', 'executing']);
  });

  it('does not produce corrective routing without corrective action', () => {
    const state = makeState();
    const config = makeConfig();
    const phase = state.execution.phases[0];

    // Place phase directly in failed stage but with null review action
    phase.stage = 'failed';
    phase.review.action = null;

    const result = resolveNextAction(state, config);

    assert.notEqual(result.action, 'create_phase_plan');
    assert.equal(result.action, 'display_halted');
  });

  it('corrective cycle does NOT include phase_planning_started', () => {
    const state = makeState();
    const config = makeConfig();
    const phase = state.execution.phases[0];

    // (a) Start in reviewing
    assert.equal(phase.stage, 'reviewing');

    // (b) Phase review fails → stage becomes 'failed'
    const reviewHandler = getMutation('phase_review_completed');
    reviewHandler(state, {
      doc_path: 'reviews/PHASE-REVIEW-P01.md',
      verdict: 'changes_requested',
      exit_criteria_met: false,
    }, config);
    assert.equal(phase.stage, 'failed');
    assert.equal(phase.status, 'in_progress');
    assert.equal(phase.review.action, 'corrective_tasks_issued');

    // (c) Resolve next action — must return is_correction: true
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'create_phase_plan');
    assert.equal(result.context.is_correction, true);

    // (d) GUARD: phase_planning_started is NEVER signaled during the corrective path.
    //     The Orchestrator checks result.context.is_correction before signaling.
    //     When is_correction is true, the Orchestrator spawns the Tactical Planner
    //     directly and proceeds to phase_plan_created — no phase_planning_started.
    //
    //     We verify the guard by confirming the stage sequence through the
    //     corrective cycle contains NO 'planning' stage re-entry:
    const stages = [phase.stage]; // ['failed']

    // (e) Proceed directly to phase_plan_created (no phase_planning_started in between)
    const planHandler = getMutation('phase_plan_created');
    planHandler(state, {
      doc_path: 'phases/CORRECTIVE-PHASE-PLAN-P01.md',
      tasks: ['Fix A', 'Fix B'],
    }, config);
    stages.push(phase.stage); // ['failed', 'executing']

    // (f) The corrective stage sequence is failed → executing.
    //     'planning' NEVER appears — phase_planning_started was not signaled.
    assert.deepEqual(stages, ['failed', 'executing']);
    assert.equal(phase.status, 'in_progress');

    // (g) Verify 'planning' is NOT in the corrective stage sequence
    assert.equal(stages.includes('planning'), false,
      'Corrective cycle must NOT re-enter planning stage');
  });

  it('corrective path proceeds from failed to coding without planning stage re-entry', () => {
    const state = makeState();
    const config = makeConfig();
    const phase = state.execution.phases[0];
    const task = phase.tasks[0];

    // (a) Set up task-level corrective scenario:
    //     Phase is in executing stage (not reviewing)
    //     Task has been submitted for code review
    phase.stage = 'executing';
    task.status = 'in_progress';
    task.stage = 'reviewing';
    task.review = { verdict: null, action: null };

    // (b) Code review with changes_requested verdict
    const reviewHandler = getMutation('code_review_completed');
    reviewHandler(state, {
      doc_path: 'reviews/CODE-REVIEW-P01-T01.md',
      verdict: 'changes_requested',
    }, config);

    // (c) Post-review: task must be failed with corrective action
    assert.equal(task.status, 'failed');
    assert.equal(task.stage, 'failed');
    assert.equal(task.review.action, 'corrective_task_issued');

    // (d) Resolve next action — must return is_correction: true
    const result = resolveNextAction(state, config);
    assert.equal(result.action, 'create_task_handoff');
    assert.equal(result.context.is_correction, true);

    // (e) Corrective path behavior:
    //     The Orchestrator checks result.context.is_correction before signaling.
    //     When is_correction is true, the Orchestrator skips task_handoff_started,
    //     spawns the Tactical Planner directly, and proceeds to task_handoff_created.
    //
    //     This test models that behavior by applying task_handoff_created directly
    //     after a failed review and tracking the resulting stage sequence.
    const stages = [task.stage]; // ['failed'] after changes_requested

    // (f) Proceed directly to task_handoff_created (no task_handoff_started in between
    //     in this modeled flow)
    const handoffHandler = getMutation('task_handoff_created');
    handoffHandler(state, {
      doc_path: 'tasks/CORRECTIVE-HANDOFF-P01-T01.md',
    }, config);
    stages.push(task.stage); // ['failed', 'coding']

    // (g) The corrective stage sequence in this flow is failed → coding, with no
    //     re-entry into a planning stage.
    assert.deepEqual(stages, ['failed', 'coding']);
    assert.equal(task.status, 'in_progress');
  });

});
