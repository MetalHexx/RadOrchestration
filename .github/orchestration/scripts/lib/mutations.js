'use strict';

const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
} = require('./constants');

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * @param {Object} state
 * @returns {Object} current phase object
 */
function currentPhase(state) {
  return state.execution.phases[state.execution.current_phase];
}

/**
 * @param {Object} state
 * @returns {Object} current task object
 */
function currentTask(state) {
  const phase = currentPhase(state);
  return phase.tasks[phase.current_task];
}

/**
 * @param {number} retries
 * @param {number} maxRetries
 * @returns {boolean}
 */
function checkRetryBudget(retries, maxRetries) {
  return retries < maxRetries;
}

// ─── Decision Tables ────────────────────────────────────────────────────────

/**
 * 8-row task decision table. First-match-wins.
 * @param {string} verdict
 * @param {string} reportStatus
 * @param {boolean} hasDeviations
 * @param {string|null} deviationType
 * @param {number} retries
 * @param {number} maxRetries
 * @returns {{ taskStatus: string, reviewAction: string }}
 */
function resolveTaskOutcome(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries) {
  // Row 1-3: approved + complete → always complete/advanced regardless of deviations
  if (verdict === REVIEW_VERDICTS.APPROVED && reportStatus === 'complete') {
    return { taskStatus: TASK_STATUSES.COMPLETE, reviewAction: REVIEW_ACTIONS.ADVANCED };
  }
  // Row 4-5: changes_requested + complete
  if (verdict === REVIEW_VERDICTS.CHANGES_REQUESTED && reportStatus === 'complete') {
    if (checkRetryBudget(retries, maxRetries)) {
      return { taskStatus: TASK_STATUSES.FAILED, reviewAction: REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED };
    }
    return { taskStatus: TASK_STATUSES.HALTED, reviewAction: REVIEW_ACTIONS.HALTED };
  }
  // Row 6-7: changes_requested + failed
  if (verdict === REVIEW_VERDICTS.CHANGES_REQUESTED && reportStatus === 'failed') {
    if (checkRetryBudget(retries, maxRetries)) {
      return { taskStatus: TASK_STATUSES.FAILED, reviewAction: REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED };
    }
    return { taskStatus: TASK_STATUSES.HALTED, reviewAction: REVIEW_ACTIONS.HALTED };
  }
  // Row 8: rejected
  if (verdict === REVIEW_VERDICTS.REJECTED) {
    return { taskStatus: TASK_STATUSES.HALTED, reviewAction: REVIEW_ACTIONS.HALTED };
  }
  // Fallback (should not be reached with valid inputs)
  return { taskStatus: TASK_STATUSES.HALTED, reviewAction: REVIEW_ACTIONS.HALTED };
}

/**
 * 5-row phase decision table. First-match-wins.
 * @param {string} verdict
 * @param {boolean} exitCriteriaMet
 * @returns {{ phaseStatus: string, phaseReviewAction: string }}
 */
function resolvePhaseOutcome(verdict, exitCriteriaMet) {
  // Row 1-2: approved → always complete/advanced regardless of exit criteria
  if (verdict === REVIEW_VERDICTS.APPROVED) {
    return { phaseStatus: PHASE_STATUSES.COMPLETE, phaseReviewAction: PHASE_REVIEW_ACTIONS.ADVANCED };
  }
  // Row 3: changes_requested
  if (verdict === REVIEW_VERDICTS.CHANGES_REQUESTED) {
    return { phaseStatus: PHASE_STATUSES.IN_PROGRESS, phaseReviewAction: PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED };
  }
  // Row 4-5: rejected → always halted regardless of exit criteria
  if (verdict === REVIEW_VERDICTS.REJECTED) {
    return { phaseStatus: PHASE_STATUSES.HALTED, phaseReviewAction: PHASE_REVIEW_ACTIONS.HALTED };
  }
  // Fallback
  return { phaseStatus: PHASE_STATUSES.HALTED, phaseReviewAction: PHASE_REVIEW_ACTIONS.HALTED };
}

// ─── Path Utility ───────────────────────────────────────────────────────────

/**
 * Normalize a document path to project-relative form.
 * Converts backslashes to forward slashes before prefix comparison.
 * Returns input unchanged if null/undefined or no prefix match (fail-safe).
 *
 * @param {string|null|undefined} docPath - Raw document path (may be workspace-relative or project-relative)
 * @param {string} basePath - The base_path value from config (e.g., ".github/projects")
 * @param {string} projectName - The project name (e.g., "MYAPP")
 * @returns {string|null|undefined} Project-relative path (e.g., "tasks/TASK-P01-T01.md")
 */
function normalizeDocPath(docPath, basePath, projectName) {
  if (!docPath) return docPath;
  const normalized = docPath.replace(/\\/g, '/');
  const prefix = basePath + '/' + projectName + '/';
  if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
  return normalized;
}

// ─── Planning Handlers ──────────────────────────────────────────────────────

/**
 * Shared helper for the 5 planning step-completion handlers.
 * @param {Object} state
 * @param {string} stepName
 * @param {string} docPath
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function completePlanningStep(state, stepName, docPath) {
  const step = state.planning.steps.find(s => s.name === stepName);
  step.status = PLANNING_STEP_STATUSES.COMPLETE;
  step.doc_path = docPath;
  return {
    state,
    mutations_applied: [`Set planning step "${stepName}" status to complete`, `Set planning step "${stepName}" doc_path to "${docPath}"`],
  };
}

/** @type {MutationHandler} */
function handleResearchCompleted(state, context, config) {
  return completePlanningStep(state, 'research', context.doc_path);
}

/** @type {MutationHandler} */
function handlePrdCompleted(state, context, config) {
  return completePlanningStep(state, 'prd', context.doc_path);
}

/** @type {MutationHandler} */
function handleDesignCompleted(state, context, config) {
  return completePlanningStep(state, 'design', context.doc_path);
}

/** @type {MutationHandler} */
function handleArchitectureCompleted(state, context, config) {
  return completePlanningStep(state, 'architecture', context.doc_path);
}

/** @type {MutationHandler} */
function handleMasterPlanCompleted(state, context, config) {
  const result = completePlanningStep(state, 'master_plan', context.doc_path);
  state.planning.status = PLANNING_STATUSES.COMPLETE;
  result.mutations_applied.push('Set planning.status to complete');
  return result;
}

// ─── Plan Approved Handler ──────────────────────────────────────────────────

/** @type {MutationHandler} */
function handlePlanApproved(state, context, config) {
  state.planning.human_approved = true;
  state.execution.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  state.execution.total_phases = context.total_phases;
  state.execution.phases = [];
  for (let i = 0; i < context.total_phases; i++) {
    state.execution.phases.push({
      name: `Phase ${i + 1}`,
      status: PHASE_STATUSES.NOT_STARTED,
      current_task: 0,
      total_tasks: 0,
      tasks: [],
      phase_plan_doc: null,
      phase_report_doc: null,
      phase_review_doc: null,
      phase_review_verdict: null,
      phase_review_action: null,
    });
  }
  state.execution.current_phase = 0;
  return {
    state,
    mutations_applied: [
      'Set planning.human_approved to true',
      `Set execution.current_tier to "${PIPELINE_TIERS.EXECUTION}"`,
      'Set execution.status to "in_progress"',
      `Set execution.total_phases to ${context.total_phases}`,
      `Initialized execution.phases with ${context.total_phases} phase(s)`,
      'Set execution.current_phase to 0',
    ],
  };
}

// ─── Execution Handlers ─────────────────────────────────────────────────────

/** @type {MutationHandler} */
function handlePhasePlanCreated(state, context, config) {
  const phase = currentPhase(state);
  phase.status = PHASE_STATUSES.IN_PROGRESS;
  phase.phase_plan_doc = context.doc_path;
  if (context.title) phase.name = context.title;
  phase.total_tasks = context.tasks.length;
  phase.tasks = context.tasks.map(taskObj => ({
    name: typeof taskObj === 'object' && taskObj !== null ? (taskObj.title ?? taskObj.id ?? String(taskObj)) : taskObj,
    status: TASK_STATUSES.NOT_STARTED,
    handoff_doc: null,
    report_doc: null,
    review_doc: null,
    review_verdict: null,
    review_action: null,
    has_deviations: false,
    deviation_type: null,
    retries: 0,
    report_status: null,
  }));
  return {
    state,
    mutations_applied: [
      `Set phase.status to "${PHASE_STATUSES.IN_PROGRESS}"`,
      `Set phase.phase_plan_doc to "${context.doc_path}"`,
      ...(context.title ? [`Updated phase.name to "${context.title}"`] : []),
      `Set phase.total_tasks to ${context.tasks.length}`,
      `Populated phase.tasks with ${context.tasks.length} task(s)`,
    ],
  };
}

/** @type {MutationHandler} */
function handleTaskHandoffCreated(state, context, config) {
  const task = currentTask(state);
  const mutations = [];

  // Clear stale report/review from previous attempt (corrective re-execution)
  if (task.report_doc) {
    task.report_doc = null;
    task.report_status = null;
    mutations.push('Cleared task.report_doc and report_status (corrective re-execution)');
  }
  if (task.review_doc) {
    task.review_doc = null;
    task.review_verdict = null;
    task.review_action = null;
    mutations.push('Cleared task.review_doc, review_verdict, and review_action (corrective re-execution)');
  }

  task.handoff_doc = context.doc_path;
  task.status = TASK_STATUSES.IN_PROGRESS;
  mutations.push(`Set task.handoff_doc to "${context.doc_path}"`);
  mutations.push(`Set task.status to "${TASK_STATUSES.IN_PROGRESS}"`);

  return { state, mutations_applied: mutations };
}

/** @type {MutationHandler} */
function handleTaskCompleted(state, context, config) {
  const task = currentTask(state);
  task.report_doc = context.doc_path;
  task.has_deviations = context.has_deviations;
  task.deviation_type = context.deviation_type;
  task.report_status = context.report_status || 'complete';
  task.status = TASK_STATUSES.COMPLETE;
  return {
    state,
    mutations_applied: [
      `Set task.report_doc to "${context.doc_path}"`,
      `Set task.has_deviations to ${context.has_deviations}`,
      `Set task.deviation_type to ${context.deviation_type}`,
      `Set task.report_status to "${task.report_status}"`,
      `Set task.status to "${TASK_STATUSES.COMPLETE}"`,
    ],
  };
}

/** @type {MutationHandler} */
function handleCodeReviewCompleted(state, context, config) {
  const task = currentTask(state);
  const phase = currentPhase(state);
  task.review_doc = context.doc_path;
  task.review_verdict = context.verdict;

  const { taskStatus, reviewAction } = resolveTaskOutcome(
    context.verdict,
    task.report_status || 'complete',
    task.has_deviations,
    task.deviation_type,
    task.retries,
    config.limits.max_retries_per_task,
  );

  task.status = taskStatus;
  task.review_action = reviewAction;

  const mutations = [
    `Set task.review_doc to "${context.doc_path}"`,
    `Set task.review_verdict to "${context.verdict}"`,
    `Set task.status to "${taskStatus}"`,
    `Set task.review_action to "${reviewAction}"`,
  ];

  if (reviewAction === REVIEW_ACTIONS.ADVANCED) {
    phase.current_task += 1;
    mutations.push(`Bumped phase.current_task to ${phase.current_task}`);
  } else if (reviewAction === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
    task.retries += 1;
    task.status = TASK_STATUSES.FAILED;
    mutations.push(`Incremented task.retries to ${task.retries}`);
  } else if (reviewAction === REVIEW_ACTIONS.HALTED) {
    task.status = TASK_STATUSES.HALTED;
    mutations.push('Set task.status to halted (explicit)');
  }

  return { state, mutations_applied: mutations };
}

/** @type {MutationHandler} */
function handlePhaseReportCreated(state, context, config) {
  const phase = currentPhase(state);
  phase.phase_report_doc = context.doc_path;
  return {
    state,
    mutations_applied: [
      `Set phase.phase_report_doc to "${context.doc_path}"`,
    ],
  };
}

/** @type {MutationHandler} */
function handlePhaseReviewCompleted(state, context, config) {
  const phase = currentPhase(state);
  phase.phase_review_doc = context.doc_path;
  phase.phase_review_verdict = context.verdict;

  const { phaseStatus, phaseReviewAction } = resolvePhaseOutcome(
    context.verdict,
    context.exit_criteria_met,
  );

  phase.status = phaseStatus;
  phase.phase_review_action = phaseReviewAction;

  const mutations = [
    `Set phase.phase_review_doc to "${context.doc_path}"`,
    `Set phase.phase_review_verdict to "${context.verdict}"`,
    `Set phase.status to "${phaseStatus}"`,
    `Set phase.phase_review_action to "${phaseReviewAction}"`,
  ];

  if (phaseReviewAction === PHASE_REVIEW_ACTIONS.ADVANCED) {
    if (state.execution.current_phase < state.execution.total_phases - 1) {
      state.execution.current_phase += 1;
      mutations.push(`Bumped execution.current_phase to ${state.execution.current_phase}`);
    } else {
      state.execution.status = 'complete';
      state.execution.current_tier = PIPELINE_TIERS.REVIEW;
      mutations.push('Set execution.status to "complete"');
      mutations.push(`Set execution.current_tier to "${PIPELINE_TIERS.REVIEW}"`);
    }
  } else if (phaseReviewAction === PHASE_REVIEW_ACTIONS.HALTED) {
    state.execution.current_tier = PIPELINE_TIERS.HALTED;
    mutations.push(`Set execution.current_tier to "${PIPELINE_TIERS.HALTED}"`);
  }

  return { state, mutations_applied: mutations };
}

// ─── Gate Handlers ──────────────────────────────────────────────────────────

/** @type {MutationHandler} */
function handleTaskApproved(state, context, config) {
  return { state, mutations_applied: ['Task gate approved (no-op)'] };
}

/** @type {MutationHandler} */
function handlePhaseApproved(state, context, config) {
  return { state, mutations_applied: ['Phase gate approved (no-op)'] };
}

// ─── Review Handlers ────────────────────────────────────────────────────────

/** @type {MutationHandler} */
function handleFinalReviewCompleted(state, context, config) {
  state.execution.final_review_doc = context.doc_path;
  state.execution.final_review_status = 'complete';
  return {
    state,
    mutations_applied: [
      `Set execution.final_review_doc to "${context.doc_path}"`,
      'Set execution.final_review_status to "complete"',
    ],
  };
}

/** @type {MutationHandler} */
function handleFinalApproved(state, context, config) {
  state.execution.final_review_approved = true;
  state.execution.current_tier = PIPELINE_TIERS.COMPLETE;
  return {
    state,
    mutations_applied: [
      'Set execution.final_review_approved to true',
      `Set execution.current_tier to "${PIPELINE_TIERS.COMPLETE}"`,
    ],
  };
}

// ─── Halt Handler ───────────────────────────────────────────────────────────

/** @type {MutationHandler} */
function handleHalt(state, context, config) {
  state.execution.current_tier = PIPELINE_TIERS.HALTED;
  return {
    state,
    mutations_applied: [`Set execution.current_tier to "${PIPELINE_TIERS.HALTED}"`],
  };
}

// ─── MUTATIONS Map ─────────────────────────────────────────────

const MUTATIONS = Object.freeze({
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,
  task_approved:            handleTaskApproved,
  phase_approved:           handlePhaseApproved,
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  halt:                     handleHalt,
});

/**
 * Look up the mutation handler for a given event.
 * @param {string} event
 * @returns {Function|undefined}
 */
function getMutation(event) {
  return MUTATIONS[event];
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  getMutation,
  normalizeDocPath,
};

// Expose internals for testing only
module.exports._test = {
  resolveTaskOutcome,
  resolvePhaseOutcome,
  checkRetryBudget,
};
