'use strict';

const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  TASK_STAGES,
  PHASE_STAGES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  DAG_NODE_STATUSES,
} = require('./constants');
const { expandPhases, expandTasks, injectCorrectiveTask, computeExecutionOrder } = require('./dag-expander');

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * @param {Object} state
 * @returns {Object} current phase object (1-based index)
 */
function currentPhase(state) {
  return state.execution.phases[state.execution.current_phase - 1];
}

/**
 * @param {Object} state
 * @returns {Object} current task object (1-based index)
 */
function currentTask(state) {
  const phase = currentPhase(state);
  return phase.tasks[phase.current_task - 1];
}

/**
 * @param {number} retries
 * @param {number} maxRetries
 * @returns {boolean}
 */
function checkRetryBudget(retries, maxRetries) {
  return retries < maxRetries;
}

// ─── V5 / DAG Helpers ───────────────────────────────────────────────────────

function isV5(state) {
  return state.dag != null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Find a DAG node by planning_step field.
 * @param {Object} state
 * @param {string} stepName - e.g., 'research', 'prd'
 * @returns {Object|undefined}
 */
function findPlanningNode(state, stepName) {
  return Object.values(state.dag.nodes).find(n => n.planning_step === stepName);
}

/**
 * Find a phase-level DAG node by template_node_id and phase number.
 * @param {Object} state
 * @param {string} templateNodeId - e.g., 'create_phase_plan'
 * @param {number} phaseNumber - 1-based
 * @returns {Object|undefined}
 */
function findPhaseNode(state, templateNodeId, phaseNumber) {
  const id = `P${pad2(phaseNumber)}.${templateNodeId}`;
  return state.dag.nodes[id];
}

/**
 * Find a task-level DAG node by template_node_id, phase, task, and retry.
 * @param {Object} state
 * @param {string} templateNodeId - e.g., 'create_task_handoff'
 * @param {number} phaseNumber - 1-based
 * @param {number} taskNumber - 1-based
 * @param {number} [retries=0] - retry count; 0 = original, 1+ = corrective
 * @returns {Object|undefined}
 */
function findTaskNode(state, templateNodeId, phaseNumber, taskNumber, retries) {
  const prefix = `P${pad2(phaseNumber)}.T${pad2(taskNumber)}`;
  const suffix = retries > 0 ? `_r${retries}` : '';
  const id = `${prefix}.${templateNodeId}${suffix}`;
  return state.dag.nodes[id];
}

// ─── Decision Tables ────────────────────────────────────────────────────────

/**
 * Task decision table. First-match-wins.
 * Simplified: reportStatus, hasDeviations, deviationType removed — no row branched on them.
 * @param {string} verdict
 * @param {number} retries
 * @param {number} maxRetries
 * @returns {{ taskStatus: string, reviewAction: string }}
 */
function resolveTaskOutcome(verdict, retries, maxRetries) {
  // approved → always complete/advanced (reviewer approval is authoritative)
  if (verdict === REVIEW_VERDICTS.APPROVED) {
    return { taskStatus: TASK_STATUSES.COMPLETE, reviewAction: REVIEW_ACTIONS.ADVANCED };
  }
  // changes_requested → retry if budget allows, otherwise halt
  if (verdict === REVIEW_VERDICTS.CHANGES_REQUESTED) {
    if (checkRetryBudget(retries, maxRetries)) {
      return { taskStatus: TASK_STATUSES.FAILED, reviewAction: REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED };
    }
    return { taskStatus: TASK_STATUSES.HALTED, reviewAction: REVIEW_ACTIONS.HALTED };
  }
  // rejected → always halt
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

  const mutations_applied = [
    `Set planning step "${stepName}" status to complete`,
    `Set planning step "${stepName}" doc_path to "${docPath}"`,
  ];

  if (isV5(state)) {
    const node = findPlanningNode(state, stepName);
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      if (!node.docs) node.docs = {};
      node.docs.doc_path = docPath;
      mutations_applied.push(`DAG: Set node "${node.id}" status to complete`);
      mutations_applied.push(`DAG: Set node "${node.id}" docs.doc_path to "${docPath}"`);
    }
  }

  return {
    state,
    mutations_applied,
  };
}

/**
 * Set a planning step's status to in_progress.
 * Mirrors completePlanningStep() — same signature shape, no doc_path.
 *
 * @param {Object} state - Mutable pipeline state
 * @param {string} stepName - 'research'|'prd'|'design'|'architecture'|'master_plan'
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function startPlanningStep(state, stepName) {
  const step = state.planning.steps.find(s => s.name === stepName);
  step.status = PLANNING_STEP_STATUSES.IN_PROGRESS;

  const mutations_applied = [
    `Set planning step "${stepName}" status to in_progress`,
  ];

  // Advance top-level planning status from not_started → in_progress.
  // Idempotent: never overwrites in_progress or complete.
  if (state.planning.status === PLANNING_STATUSES.NOT_STARTED) {
    state.planning.status = PLANNING_STATUSES.IN_PROGRESS;
    mutations_applied.push('Set planning.status to "in_progress" from "not_started"');
  }

  if (isV5(state)) {
    const node = findPlanningNode(state, stepName);
    if (node) {
      node.status = DAG_NODE_STATUSES.IN_PROGRESS;
      mutations_applied.push(`DAG: Set node "${node.id}" status to in_progress`);
    }
  }

  return {
    state,
    mutations_applied,
  };
}

/** @type {MutationHandler} */
function handleResearchStarted(state, context, config) {
  return startPlanningStep(state, 'research');
}

/** @type {MutationHandler} */
function handlePrdStarted(state, context, config) {
  return startPlanningStep(state, 'prd');
}

/** @type {MutationHandler} */
function handleDesignStarted(state, context, config) {
  return startPlanningStep(state, 'design');
}

/** @type {MutationHandler} */
function handleArchitectureStarted(state, context, config) {
  return startPlanningStep(state, 'architecture');
}

/** @type {MutationHandler} */
function handleMasterPlanStarted(state, context, config) {
  return startPlanningStep(state, 'master_plan');
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
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'not_started'; // explicit reset — idempotent; guards against stale status on re-entry
  state.execution.current_phase = 1; // 1-based; first phase active
  state.execution.phases = [];
  for (let i = 0; i < context.total_phases; i++) {
    state.execution.phases.push({
      name: `Phase ${i + 1}`,
      status: PHASE_STATUSES.NOT_STARTED,
      stage: PHASE_STAGES.PLANNING,
      current_task: 0, // 1-based; 0 = no tasks yet
      tasks: [],
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

  const mutations = [
    'Set planning.human_approved to true',
    `Set pipeline.current_tier to "${PIPELINE_TIERS.EXECUTION}"`,
    'Set execution.status to "not_started"',
    'Set execution.current_phase to 1',
    `Initialized execution.phases with ${context.total_phases} phase(s)`,
  ];

  if (isV5(state)) {
    // Mark planning gate node as complete
    const gateNode = state.dag.nodes['request_plan_approval'];
    if (gateNode) {
      gateNode.status = DAG_NODE_STATUSES.COMPLETE;
      mutations.push('DAG: Set gate node "request_plan_approval" status to complete');
    }

    // Expand for_each_phase container
    const phases = state.execution.phases.map((p, i) => ({ name: p.name }));
    expandPhases(state.dag.nodes, 'for_each_phase', context.total_phases, phases);
    state.dag.execution_order = computeExecutionOrder(state.dag.nodes);
    mutations.push(`DAG: Expanded for_each_phase into ${context.total_phases} phase(s)`);
    mutations.push('DAG: Recomputed execution_order');
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

// ─── Plan Rejection Handler ─────────────────────────────────────────────────

/**
 * plan_rejected — Resets planning to allow revision of the master plan.
 * @param {Object} state
 * @param {Object} context  (no fields required)
 * @param {Object} config
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handlePlanRejected(state, context, config) {
  state.planning.human_approved = false;
  const masterPlanStep = state.planning.steps.find(s => s.name === 'master_plan');
  masterPlanStep.status = PLANNING_STEP_STATUSES.IN_PROGRESS;

  const mutations_applied = [
    'Set planning.human_approved to false',
    `Set planning step "master_plan" status to "${PLANNING_STEP_STATUSES.IN_PROGRESS}"`,
  ];

  if (isV5(state)) {
    // Reset master_plan node to in_progress for re-editing
    const masterPlanNode = findPlanningNode(state, 'master_plan');
    if (masterPlanNode) {
      masterPlanNode.status = DAG_NODE_STATUSES.IN_PROGRESS;
      mutations_applied.push(`DAG: Reset node "${masterPlanNode.id}" status to in_progress`);
    }
    // Reset planning gate to not_started
    const gateNode = state.dag.nodes['request_plan_approval'];
    if (gateNode) {
      gateNode.status = DAG_NODE_STATUSES.NOT_STARTED;
      mutations_applied.push('DAG: Reset gate node "request_plan_approval" status to not_started');
    }
  }

  return {
    state,
    mutations_applied,
  };
}

// ─── Execution Handlers ─────────────────────────────────────────────────────

/**
 * phase_planning_started — Transitions the current phase from not_started
 * to in_progress while keeping stage as 'planning'.
 *
 * @param {Object} state  - deep-cloned pipeline state
 * @param {Object} context - empty object {} (no fields required)
 * @param {Object} config  - merged orchestration config (unused)
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handlePhasePlanningStarted(state, context, config) {
  const phase = currentPhase(state);
  state.execution.status = 'in_progress';   // transition execution to in_progress
  phase.status = PHASE_STATUSES.IN_PROGRESS;
  // Do NOT modify phase.stage — remains 'planning'

  const mutations = [
    'Set execution.status to "in_progress"',
    'Set phase.status to "in_progress"',
  ];

  if (isV5(state)) {
    const phaseNum = state.execution.current_phase;
    const node = findPhaseNode(state, 'create_phase_plan', phaseNum);
    if (node) {
      node.status = DAG_NODE_STATUSES.IN_PROGRESS;
      mutations.push(`DAG: Set node "${node.id}" status to in_progress`);
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

/** @type {MutationHandler} */
function handlePhasePlanCreated(state, context, config) {
  const phase = currentPhase(state);
  const mutations = [];

  // Clear stale review fields from previous cycle (corrective re-entry)
  if (phase.docs.phase_report) {
    phase.docs.phase_report = null;
    mutations.push('Cleared phase.docs.phase_report (corrective re-entry)');
  }
  if (phase.docs.phase_review) {
    phase.docs.phase_review = null;
    phase.review.verdict = null;
    phase.review.action = null;
    mutations.push('Cleared phase.docs.phase_review, review.verdict, and review.action (corrective re-entry)');
  }

  phase.status = PHASE_STATUSES.IN_PROGRESS;
  phase.stage = PHASE_STAGES.EXECUTING;
  phase.docs.phase_plan = context.doc_path;
  if (context.title) phase.name = context.title;
  phase.current_task = 1; // 1-based; first task active
  phase.tasks = context.tasks.map(taskObj => ({
    name: typeof taskObj === 'object' && taskObj !== null ? (taskObj.title ?? taskObj.id ?? String(taskObj)) : taskObj,
    status: TASK_STATUSES.NOT_STARTED,
    stage: TASK_STAGES.PLANNING,
    docs: {
      handoff: null,
      review: null,
    },
    review: {
      verdict: null,
      action: null,
    },
    retries: 0,
  }));

  const allMutations = [
    ...mutations,
    `Set phase.status to "${PHASE_STATUSES.IN_PROGRESS}"`,
    `Set phase.stage to "${PHASE_STAGES.EXECUTING}"`,
    `Set phase.docs.phase_plan to "${context.doc_path}"`,
    ...(context.title ? [`Updated phase.name to "${context.title}"`] : []),
    'Set phase.current_task to 1',
    `Populated phase.tasks with ${context.tasks.length} task(s)`,
  ];

  if (isV5(state)) {
    const phaseNum = state.execution.current_phase;
    const planNode = findPhaseNode(state, 'create_phase_plan', phaseNum);
    if (planNode) {
      planNode.status = DAG_NODE_STATUSES.COMPLETE;
      if (!planNode.docs) planNode.docs = {};
      planNode.docs.doc_path = context.doc_path;
      allMutations.push(`DAG: Set node "${planNode.id}" status to complete`);
    }

    // Expand for_each_task container for this phase
    const containerNodeId = `P${pad2(phaseNum)}.for_each_task`;
    if (state.dag.nodes[containerNodeId]) {
      const taskMeta = context.tasks.map(t => {
        const name = typeof t === 'object' && t !== null ? (t.title ?? t.id ?? String(t)) : t;
        return { name };
      });
      expandTasks(state.dag.nodes, containerNodeId, phaseNum, taskMeta);
      state.dag.execution_order = computeExecutionOrder(state.dag.nodes);
      allMutations.push(`DAG: Expanded ${containerNodeId} into ${context.tasks.length} task(s)`);
      allMutations.push('DAG: Recomputed execution_order');
    }
  }

  return {
    state,
    mutations_applied: allMutations,
  };
}

/**
 * task_handoff_started — Transitions the current task from not_started
 * to in_progress while keeping stage as 'planning'.
 *
 * @param {Object} state  - deep-cloned pipeline state
 * @param {Object} context - empty object {} (no fields required)
 * @param {Object} config  - merged orchestration config (unused)
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleTaskHandoffStarted(state, context, config) {
  const task = currentTask(state);
  task.status = TASK_STATUSES.IN_PROGRESS;
  // Do NOT modify task.stage — remains 'planning'

  const mutations = ['Set task.status to "in_progress"'];

  if (isV5(state)) {
    const phase = currentPhase(state);
    const node = findTaskNode(state, 'create_task_handoff',
      state.execution.current_phase, phase.current_task, task.retries);
    if (node) {
      node.status = DAG_NODE_STATUSES.IN_PROGRESS;
      mutations.push(`DAG: Set node "${node.id}" status to in_progress`);
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

/** @type {MutationHandler} */
function handleTaskHandoffCreated(state, context, config) {
  const task = currentTask(state);
  const mutations = [];

  // Clear stale review from previous attempt (corrective re-execution)
  if (task.docs.review) {
    task.docs.review = null;
    task.review.verdict = null;
    task.review.action = null;
    mutations.push('Cleared task.docs.review, review.verdict, and review.action (corrective re-execution)');
  }

  task.docs.handoff = context.doc_path;
  task.status = TASK_STATUSES.IN_PROGRESS;
  task.stage = TASK_STAGES.CODING;
  mutations.push(`Set task.docs.handoff to "${context.doc_path}"`);
  mutations.push(`Set task.status to "${TASK_STATUSES.IN_PROGRESS}"`);
  mutations.push(`Set task.stage to "${TASK_STAGES.CODING}"`);

  if (isV5(state)) {
    const phase = currentPhase(state);
    const node = findTaskNode(state, 'create_task_handoff',
      state.execution.current_phase, phase.current_task, task.retries);
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      if (!node.docs) node.docs = {};
      node.docs.doc_path = context.doc_path;
      mutations.push(`DAG: Set node "${node.id}" status to complete`);
    }
    // Also mark execute_coding_task as in_progress (handoff triggers coding start)
    const codeNode = findTaskNode(state, 'execute_coding_task',
      state.execution.current_phase, phase.current_task, task.retries);
    if (codeNode) {
      codeNode.status = DAG_NODE_STATUSES.IN_PROGRESS;
      mutations.push(`DAG: Set node "${codeNode.id}" status to in_progress`);
    }
  }

  return { state, mutations_applied: mutations };
}

/** @type {MutationHandler} */
function handleTaskCompleted(state, context, config) {
  const task = currentTask(state);
  task.stage = TASK_STAGES.REVIEWING;
  // task.status stays in_progress — complete is truly terminal (set only after code review approves)

  const mutations = [
    `Set task.stage to "${TASK_STAGES.REVIEWING}"`,
    `task.status stays "${TASK_STATUSES.IN_PROGRESS}" (awaiting code review)`,
  ];

  if (isV5(state)) {
    const phase = currentPhase(state);
    const node = findTaskNode(state, 'execute_coding_task',
      state.execution.current_phase, phase.current_task, task.retries);
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      mutations.push(`DAG: Set node "${node.id}" status to complete`);
    }
    // Also mark code_review as in_progress (task complete triggers review)
    const reviewNode = findTaskNode(state, 'code_review',
      state.execution.current_phase, phase.current_task, task.retries);
    if (reviewNode) {
      reviewNode.status = DAG_NODE_STATUSES.IN_PROGRESS;
      mutations.push(`DAG: Set node "${reviewNode.id}" status to in_progress`);
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

/** @type {MutationHandler} */
function handleCodeReviewCompleted(state, context, config) {
  const task = currentTask(state);
  const phase = currentPhase(state);
  const dagTaskNum = phase.current_task; // capture BEFORE any pointer advancement
  task.docs.review = context.doc_path;
  task.review.verdict = context.verdict;

  const { taskStatus, reviewAction } = resolveTaskOutcome(
    context.verdict,
    task.retries,
    state.config?.limits?.max_retries_per_task ?? config.limits.max_retries_per_task,
  );

  task.status = taskStatus;
  task.review.action = reviewAction;

  const mutations = [
    `Set task.docs.review to "${context.doc_path}"`,
    `Set task.review.verdict to "${context.verdict}"`,
    `Set task.status to "${taskStatus}"`,
    `Set task.review.action to "${reviewAction}"`,
  ];

  if (reviewAction === REVIEW_ACTIONS.ADVANCED) {
    task.stage = TASK_STAGES.COMPLETE;
    mutations.push(`Set task.stage to "${TASK_STAGES.COMPLETE}"`);

    const effectiveGateMode = state.pipeline.gate_mode ?? state.config?.human_gates?.execution_mode ?? config.human_gates.execution_mode;
    const pipelineSC = state.pipeline.source_control;
    const canDeferForAutoCommit =
      pipelineSC?.auto_commit === 'always' &&
      pipelineSC.branch &&
      pipelineSC.worktree_path;
    // v5: defer if an SC commit DAG node is pending for this task (no retry suffix — node is reused across retries)
    const scCommitNode = isV5(state)
      ? findTaskNode(state, 'source_control_commit', state.execution.current_phase, dagTaskNum, 0)
      : null;
    const hasV5ScCommitStep = scCommitNode && scCommitNode.status === DAG_NODE_STATUSES.NOT_STARTED;

    if (effectiveGateMode === 'task') {
      // Defer pointer advancement to handleGateApproved
      mutations.push(`Deferred phase.current_task advancement (gate mode: task)`);
    } else if (canDeferForAutoCommit) {
      // Defer pointer advancement — Source Control Agent will commit, then task_committed bumps pointer
      mutations.push('Deferred phase.current_task advancement (auto_commit: always — awaiting commit)');
    } else if (hasV5ScCommitStep) {
      // v5: defer — task_commit_requested will advance the pointer after the SC commit step
      mutations.push('Deferred phase.current_task advancement (v5 SC commit step pending)');
    } else {
      phase.current_task += 1;
      mutations.push(`Bumped phase.current_task to ${phase.current_task}`);
    }
  } else if (reviewAction === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
    task.stage = TASK_STAGES.FAILED;
    task.status = TASK_STATUSES.FAILED;
    task.retries += 1;
    mutations.push(`Set task.stage to "${TASK_STAGES.FAILED}"`);
    mutations.push(`Incremented task.retries to ${task.retries}`);
  } else if (reviewAction === REVIEW_ACTIONS.HALTED) {
    task.stage = TASK_STAGES.FAILED;
    task.status = TASK_STATUSES.HALTED;
    mutations.push(`Set task.stage to "${TASK_STAGES.FAILED}"`);
    mutations.push('Set task.status to halted (explicit)');
  }

  if (isV5(state)) {
    const phaseNum = state.execution.current_phase;
    const taskNum = dagTaskNum;
    // retries was already incremented for corrective, so use retries-1 to find current review node
    const currentRetries = reviewAction === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED
      ? task.retries - 1 : task.retries;
    const reviewNode = findTaskNode(state, 'code_review', phaseNum, taskNum, currentRetries);

    if (reviewNode) {
      if (!reviewNode.docs) reviewNode.docs = {};
      reviewNode.docs.doc_path = context.doc_path;
      if (!reviewNode.review) reviewNode.review = {};
      reviewNode.review.verdict = context.verdict;
      reviewNode.review.action = reviewAction;

      if (reviewAction === REVIEW_ACTIONS.ADVANCED) {
        reviewNode.status = DAG_NODE_STATUSES.COMPLETE;
        mutations.push(`DAG: Set node "${reviewNode.id}" status to complete`);
      } else if (reviewAction === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
        reviewNode.status = DAG_NODE_STATUSES.FAILED;
        mutations.push(`DAG: Set node "${reviewNode.id}" status to failed`);
        // Inject corrective task nodes
        const newNodeIds = injectCorrectiveTask(
          state.dag.nodes, reviewNode.id, phaseNum, taskNum, task.retries
        );
        state.dag.execution_order = computeExecutionOrder(state.dag.nodes);
        mutations.push(`DAG: Injected corrective nodes: ${newNodeIds.join(', ')}`);
        mutations.push('DAG: Recomputed execution_order');
      } else if (reviewAction === REVIEW_ACTIONS.HALTED) {
        reviewNode.status = DAG_NODE_STATUSES.HALTED;
        mutations.push(`DAG: Set node "${reviewNode.id}" status to halted`);
      }
    }
  }

  return { state, mutations_applied: mutations };
}

/** @type {MutationHandler} */
function handlePhaseReportCreated(state, context, config) {
  const phase = currentPhase(state);
  phase.docs.phase_report = context.doc_path;
  phase.stage = PHASE_STAGES.REVIEWING;

  const mutations = [
    `Set phase.docs.phase_report to "${context.doc_path}"`,
    `Set phase.stage to "${PHASE_STAGES.REVIEWING}"`,
  ];

  if (isV5(state)) {
    const phaseNum = state.execution.current_phase;
    const node = findPhaseNode(state, 'generate_phase_report', phaseNum);
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      if (!node.docs) node.docs = {};
      node.docs.doc_path = context.doc_path;
      mutations.push(`DAG: Set node "${node.id}" status to complete`);
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

/** @type {MutationHandler} */
function handlePhaseReviewCompleted(state, context, config) {
  const phase = currentPhase(state);
  const dagPhaseNum = state.execution.current_phase; // capture BEFORE pointer advancement
  phase.docs.phase_review = context.doc_path;
  phase.review.verdict = context.verdict;

  const { phaseStatus, phaseReviewAction } = resolvePhaseOutcome(
    context.verdict,
    context.exit_criteria_met,
  );

  phase.status = phaseStatus;
  phase.review.action = phaseReviewAction;

  const mutations = [
    `Set phase.docs.phase_review to "${context.doc_path}"`,
    `Set phase.review.verdict to "${context.verdict}"`,
    `Set phase.status to "${phaseStatus}"`,
    `Set phase.review.action to "${phaseReviewAction}"`,
  ];

  if (phaseReviewAction === PHASE_REVIEW_ACTIONS.ADVANCED) {
    phase.stage = PHASE_STAGES.COMPLETE;
    mutations.push(`Set phase.stage to "${PHASE_STAGES.COMPLETE}"`);

    const effectiveGateMode = state.pipeline.gate_mode ?? state.config?.human_gates?.execution_mode ?? config.human_gates.execution_mode;
    if (effectiveGateMode === 'phase' || effectiveGateMode === 'task') {
      // Defer pointer advancement to handleGateApproved
      mutations.push(`Deferred execution.current_phase advancement (gate mode: ${effectiveGateMode})`);
    } else {
      // autonomous mode — advance immediately
      if (state.execution.current_phase < state.execution.phases.length) {
        state.execution.current_phase += 1;
        mutations.push(`Bumped execution.current_phase to ${state.execution.current_phase}`);
      } else {
        state.execution.status = 'complete';
        state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
        mutations.push('Set execution.status to "complete"');
        mutations.push(`Set pipeline.current_tier to "${PIPELINE_TIERS.REVIEW}"`);
      }
    }
  } else if (phaseReviewAction === PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED) {
    phase.stage = PHASE_STAGES.FAILED;
    mutations.push(`Set phase.stage to "${PHASE_STAGES.FAILED}" (corrective re-entry)`);
  } else if (phaseReviewAction === PHASE_REVIEW_ACTIONS.HALTED) {
    phase.stage = PHASE_STAGES.FAILED;
    state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
    mutations.push(`Set phase.stage to "${PHASE_STAGES.FAILED}"`);
    mutations.push(`Set pipeline.current_tier to "${PIPELINE_TIERS.HALTED}"`);
  }

  if (isV5(state)) {
    const phaseNum = dagPhaseNum;
    const node = findPhaseNode(state, 'phase_review', phaseNum);
    if (node) {
      if (!node.review) node.review = {};
      node.review.verdict = context.verdict;
      node.review.action = phaseReviewAction;
      if (phaseReviewAction === PHASE_REVIEW_ACTIONS.ADVANCED) {
        node.status = DAG_NODE_STATUSES.COMPLETE;
      } else if (phaseReviewAction === PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED) {
        node.status = DAG_NODE_STATUSES.FAILED;
      } else {
        node.status = DAG_NODE_STATUSES.HALTED;
      }
      mutations.push(`DAG: Set node "${node.id}" status to ${node.status}`);
    }
  }

  return { state, mutations_applied: mutations };
}

// ─── Gate Handlers ──────────────────────────────────────────────────────────

/**
 * gate_approved — Advances the deferred pointer after gate approval.
 * @param {Object} state
 * @param {{ gate_type: 'task' | 'phase' }} context
 * @param {Object} config
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleGateApproved(state, context, config) {
  const mutations = [];

  if (context.gate_type === 'task') {
    const phase = state.execution.phases[state.execution.current_phase - 1];
    phase.current_task += 1;
    mutations.push(`Bumped phase.current_task to ${phase.current_task} (gate approved)`);
  } else if (context.gate_type === 'phase') {
    if (state.execution.current_phase < state.execution.phases.length) {
      state.execution.current_phase += 1;
      mutations.push(`Bumped execution.current_phase to ${state.execution.current_phase} (gate approved)`);
    } else {
      state.execution.status = 'complete';
      state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      mutations.push('Set execution.status to "complete" (last phase gate approved)');
      mutations.push(`Set pipeline.current_tier to "${PIPELINE_TIERS.REVIEW}"`);
    }
  }

  return { state, mutations_applied: mutations };
}

/**
 * gate_rejected — Halts the pipeline with rejection context.
 * @param {Object} state
 * @param {{ gate_type: 'task' | 'phase', reason: string }} context
 * @param {Object} config
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleGateRejected(state, context, config) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;

  const phase = state.execution.phases[state.execution.current_phase - 1];
  const locationInfo = context.gate_type === 'task'
    ? `phase ${state.execution.current_phase}, task ${phase.current_task}`
    : `phase ${state.execution.current_phase}`;

  return {
    state,
    mutations_applied: [
      `Set pipeline.current_tier to "${PIPELINE_TIERS.HALTED}"`,
      `Gate rejected: ${context.gate_type} gate at ${locationInfo}`,
      `Rejection reason: ${context.reason}`,
    ],
  };
}

/**
 * gate_mode_set — Persists the operator's gate mode choice (from ask-mode resolution).
 * @param {Object} state
 * @param {{ gate_mode: 'task' | 'phase' | 'autonomous' }} context
 * @param {Object} config
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleGateModeSet(state, context, config) {
  state.pipeline.gate_mode = context.gate_mode;
  return {
    state,
    mutations_applied: [`Set pipeline.gate_mode to "${context.gate_mode}"`],
  };
}

// ─── Review Handlers ────────────────────────────────────────────────────────

/** @type {MutationHandler} */
function handleFinalReviewCompleted(state, context, config) {
  state.final_review.doc_path = context.doc_path;
  state.final_review.status = 'complete';

  const mutations = [
    `Set final_review.doc_path to "${context.doc_path}"`,
    'Set final_review.status to "complete"',
  ];

  if (isV5(state)) {
    const node = state.dag.nodes['create_final_review'];
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      if (!node.docs) node.docs = {};
      node.docs.doc_path = context.doc_path;
      mutations.push('DAG: Set node "create_final_review" status to complete');
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

/** @type {MutationHandler} */
function handleFinalApproved(state, context, config) {
  state.final_review.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.COMPLETE;

  const mutations = [
    'Set final_review.human_approved to true',
    `Set pipeline.current_tier to "${PIPELINE_TIERS.COMPLETE}"`,
  ];

  if (isV5(state)) {
    const node = state.dag.nodes['request_final_approval'];
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      mutations.push('DAG: Set gate node "request_final_approval" status to complete');
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

/**
 * final_rejected — Resets final review to allow re-review.
 * @param {Object} state
 * @param {Object} context  (no fields required)
 * @param {Object} config
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleFinalRejected(state, context, config) {
  state.final_review.doc_path = null;
  state.final_review.status = 'not_started';

  const mutations = [
    'Set final_review.doc_path to null',
    'Set final_review.status to "not_started"',
  ];

  if (isV5(state)) {
    const reviewNode = state.dag.nodes['create_final_review'];
    if (reviewNode) {
      reviewNode.status = DAG_NODE_STATUSES.NOT_STARTED;
      mutations.push('DAG: Reset node "create_final_review" status to not_started');
    }
    const gateNode = state.dag.nodes['request_final_approval'];
    if (gateNode) {
      gateNode.status = DAG_NODE_STATUSES.NOT_STARTED;
      mutations.push('DAG: Reset gate node "request_final_approval" status to not_started');
    }
  }

  return {
    state,
    mutations_applied: mutations,
  };
}

// ─── Halt Handler ───────────────────────────────────────────────────────────

/** @type {MutationHandler} */
function handleHalt(state, context, config) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  return {
    state,
    mutations_applied: [`Set pipeline.current_tier to "${PIPELINE_TIERS.HALTED}"`],
  };
}

// ─── Source Control Handlers ────────────────────────────────────────────────

/**
 * source_control_init — Writes source control metadata to pipeline.source_control.
 * Full replacement (not merge) — idempotent. Validates all 5 required fields
 * before writing; throws Error on any missing field (caller is responsible for handling).
 *
 * @param {Object} state  - deep-cloned pipeline state
 * @param {Object} context - { branch, base_branch, worktree_path, auto_commit, auto_pr }
 * @param {Object} config  - merged orchestration config (unused)
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleSourceControlInit(state, context, config) {
  // Validate all required fields before writing (reject partial context)
  const required = ['branch', 'base_branch', 'worktree_path', 'auto_commit', 'auto_pr'];
  for (const field of required) {
    if (!context[field]) throw new Error(`source_control_init: missing required field "${field}"`);
  }
  // Full replacement (not merge) — idempotent
  state.pipeline.source_control = {
    branch:        context.branch,
    base_branch:   context.base_branch,
    worktree_path: context.worktree_path,
    auto_commit:   context.auto_commit,
    auto_pr:       context.auto_pr,
    remote_url:    context.remote_url  ?? null,   // new — nullable write
    compare_url:   context.compare_url ?? null,   // new — nullable write
  };
  return {
    state,
    mutations_applied: [
      `Set pipeline.source_control.branch to "${context.branch}"`,
      `Set pipeline.source_control.base_branch to "${context.base_branch}"`,
      `Set pipeline.source_control.worktree_path to "${context.worktree_path}"`,
      `Set pipeline.source_control.auto_commit to "${context.auto_commit}"`,
      `Set pipeline.source_control.auto_pr to "${context.auto_pr}"`,
      `Set pipeline.source_control.remote_url to ${JSON.stringify(context.remote_url ?? null)}`,
      `Set pipeline.source_control.compare_url to ${JSON.stringify(context.compare_url ?? null)}`,
    ],
  };
}

/**
 * task_commit_requested — Validation checkpoint before spawning Source Control Agent.
 * If source_control metadata is absent or branch is falsy: graceful skip — advance
 * phase.current_task so pipeline resumes without a commit step.
 * If branch is present: validation passed, no state change — log success.
 *
 * @param {Object} state  - deep-cloned pipeline state
 * @param {Object} context - { task_id, phase_number, task_number }
 * @param {Object} config  - merged orchestration config (unused)
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleTaskCommitRequested(state, context, config) {
  const sc = state.pipeline.source_control;
  const mutations = [];

  // Capture pre-bump phase/task values for v5 DAG node lookup (source_control_commit has no retry suffix)
  const preBumpPhaseNum = state.execution.current_phase;
  const preBumpPhase = state.execution.phases[preBumpPhaseNum - 1];
  const preBumpTaskNum = preBumpPhase ? preBumpPhase.current_task : 1;

  if (!sc || !sc.branch) {
    // Graceful skip: no branch metadata → advance pointer immediately
    const phase = state.execution.phases[state.execution.current_phase - 1];
    phase.current_task += 1;
    mutations.push(
      'source_control not initialized — skipping commit: ' +
      `bumped phase.current_task to ${phase.current_task}`
    );
  } else {
    // Branch metadata present — validation passed, no state change
    mutations.push(`Commit request validated: branch = "${sc.branch}"`);
  }

  if (isV5(state)) {
    const node = findTaskNode(state, 'source_control_commit', preBumpPhaseNum, preBumpTaskNum, 0);
    if (node) {
      if (!sc || !sc.branch) {
        node.status = DAG_NODE_STATUSES.SKIPPED;
        mutations.push(`DAG: Set node "${node.id}" status to skipped (no branch)`);
      } else {
        node.status = DAG_NODE_STATUSES.IN_PROGRESS;
        mutations.push(`DAG: Set node "${node.id}" status to in_progress`);
      }
    }
  }

  return { state, mutations_applied: mutations };
}

/**
 * task_committed — Finalizes the commit step by advancing the task pointer.
 * Always succeeds unconditionally — even on partial push failure — to prevent
 * pipeline stall. The Source Control Agent signals this event after commit
 * completes (success or partial failure).
 *
 * @param {Object} state  - deep-cloned pipeline state
 * @param {Object} context - { task_id, committed, pushed }
 * @param {Object} config  - merged orchestration config (unused)
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handleTaskCommitted(state, context, config) {
  const phase = state.execution.phases[state.execution.current_phase - 1];
  const taskIndex = phase.current_task - 1;   // capture BEFORE incrementing
  const task = phase.tasks[taskIndex];
  const mutations = [];
  // Write commit_hash onto the current task BEFORE advancing the pointer
  if (task) {
    task.commit_hash = context.commitHash ?? null;
    mutations.push(`Set task[${taskIndex}].commit_hash to ${JSON.stringify(task.commit_hash)}`);
  }

  if (isV5(state)) {
    const phaseNum = state.execution.current_phase;
    const taskNum = phase.current_task; // current_task is still pre-increment at this point
    const retries = task?.retries ?? 0;
    const node = findTaskNode(state, 'source_control_commit', phaseNum, taskNum, retries);
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      if (context.commitHash) {
        if (!node.docs) node.docs = {};
        node.docs.commit_hash = context.commitHash;
      }
      mutations.push(`DAG: Set node "${node.id}" status to complete`);
    }
  }

  phase.current_task += 1;
  mutations.push(`Bumped phase.current_task to ${phase.current_task} (task committed)`);
  return {
    state,
    mutations_applied: mutations,
  };
}

// ─── PR Handlers ────────────────────────────────────────────────────────────

/**
 * pr_requested — Validation checkpoint before spawning Source Control Agent in PR mode.
 * If source_control metadata is absent or branch is falsy: graceful skip — no state change,
 * resolver will fall through to request_final_approval.
 * If branch is present: validation passed, no state change.
 *
 * @param {Object} state   - deep-cloned pipeline state
 * @param {Object} context - {} (no fields required)
 * @param {Object} config  - merged orchestration config (unused)
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handlePrRequested(state, context, config) {
  const sc = state.pipeline.source_control;
  const mutations = [];

  if (!sc || !sc.branch) {
    mutations.push('source_control not initialized or branch absent — skipping PR creation');
  } else {
    mutations.push(`PR request validated: branch = "${sc.branch}"`);
  }

  if (isV5(state)) {
    const node = state.dag.nodes['invoke_source_control_pr'];
    if (node) {
      if (!sc || !sc.branch) {
        node.status = DAG_NODE_STATUSES.SKIPPED;
        mutations.push('DAG: Set node "invoke_source_control_pr" status to skipped');
      } else {
        node.status = DAG_NODE_STATUSES.IN_PROGRESS;
        mutations.push('DAG: Set node "invoke_source_control_pr" status to in_progress');
      }
    }
  }

  return { state, mutations_applied: mutations };
}

function handlePrCreated(state, context, config) {
  const prUrl = context.pr_url ?? null;
  const mutations = [];

  if (state?.pipeline?.source_control) {
    state.pipeline.source_control.pr_url = prUrl;
    mutations.push(
      `Set pipeline.source_control.pr_url to ${JSON.stringify(prUrl)}`
    );
  } else {
    mutations.push(
      'source_control not initialized — skipping pr_url update'
    );
  }

  if (isV5(state)) {
    const node = state.dag.nodes['invoke_source_control_pr'];
    if (node) {
      node.status = DAG_NODE_STATUSES.COMPLETE;
      mutations.push('DAG: Set node "invoke_source_control_pr" status to complete');
    }
  }

  return { state, mutations_applied: mutations };
}

// ─── MUTATIONS Map ──────────────────────────────────────────────────────────

const MUTATIONS = Object.freeze({
  // Planning (11)
  research_started:         handleResearchStarted,
  research_completed:       handleResearchCompleted,
  prd_started:              handlePrdStarted,
  prd_completed:            handlePrdCompleted,
  design_started:           handleDesignStarted,
  design_completed:         handleDesignCompleted,
  architecture_started:     handleArchitectureStarted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_started:      handleMasterPlanStarted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,

  // Planning rejection (1)
  plan_rejected:            handlePlanRejected,

  // Execution (8)
  phase_planning_started:   handlePhasePlanningStarted,
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_started:     handleTaskHandoffStarted,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,

  // Source control (5)
  source_control_init:        handleSourceControlInit,
  task_commit_requested:      handleTaskCommitRequested,
  task_committed:             handleTaskCommitted,
  pr_requested:               handlePrRequested,
  pr_created:                 handlePrCreated,

  // Gate events (3)
  gate_mode_set:            handleGateModeSet,
  gate_approved:            handleGateApproved,
  gate_rejected:            handleGateRejected,

  // Review (3)
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  final_rejected:           handleFinalRejected,

  // Utility (1)
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
  handleSourceControlInit,
  handleTaskCommitRequested,
  handleTaskCommitted,
  handlePrRequested,
  handlePrCreated,
  isV5,
  findPlanningNode,
  findPhaseNode,
  findTaskNode,
};
