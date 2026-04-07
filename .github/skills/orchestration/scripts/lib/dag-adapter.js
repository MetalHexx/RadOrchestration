'use strict';

const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  PHASE_STATUSES,
  PHASE_STAGES,
  TASK_STATUSES,
  TASK_STAGES,
  DAG_NODE_STATUSES,
} = require('./constants');

// ─── mapPlanningSteps ────────────────────────────────────────────────────────

/**
 * Map DAG nodes with a `planning_step` field to the v4-compatible planning steps array.
 * Steps are returned in insertion order (template expansion order).
 * Steps absent from the template are omitted entirely — no N/A or skipped entries.
 *
 * @param {Object.<string, DagNode>} nodes
 * @returns {Array<{ name: string, status: string, doc_path: string|null }>}
 */
function mapPlanningSteps(nodes) {
  const steps = [];
  for (const node of Object.values(nodes)) {
    if (node.planning_step) {
      steps.push({
        name: node.planning_step,
        status: node.status,
        doc_path: node.docs?.doc_path ?? null,
      });
    }
  }
  return steps;
}

// ─── mapExecution ────────────────────────────────────────────────────────────

/**
 * Map phase-scoped DAG nodes to the v4-compatible execution object.
 *
 * @param {Object.<string, DagNode>} nodes
 * @returns {{ status: string, current_phase: number, phases: Array }}
 */
function mapExecution(nodes) {
  // Group nodes by phase_number
  const phaseMap = new Map();
  for (const node of Object.values(nodes)) {
    if (node.phase_number == null) continue;
    const p = node.phase_number;
    if (!phaseMap.has(p)) phaseMap.set(p, []);
    phaseMap.get(p).push(node);
  }

  const sortedPhaseNumbers = [...phaseMap.keys()].sort((a, b) => a - b);
  const phases = sortedPhaseNumbers.map(phaseNum => _buildPhase(phaseNum, phaseMap.get(phaseNum)));

  const status = _deriveExecutionStatus(phases);
  const current_phase = _deriveCurrentPhase(phases, sortedPhaseNumbers);

  return { status, current_phase, phases };
}

function _buildPhase(phaseNum, phaseNodes) {
  // Phase name: first node in the group with phase_name set
  const nameNode = phaseNodes.find(n => n.phase_name);
  const name = nameNode ? nameNode.phase_name : `Phase ${phaseNum}`;

  // Separate phase-level nodes from task-scoped nodes
  const phaseLevelNodes = phaseNodes.filter(n => n.task_number == null);
  const taskNodes = phaseNodes.filter(n => n.task_number != null);

  // Derive phase status
  const status = _derivePhaseStatus(phaseNodes);

  // Derive phase stage
  const stage = _derivePhaseStage(phaseLevelNodes, taskNodes);

  // Build tasks grouped by task_number
  const taskMap = new Map();
  for (const node of taskNodes) {
    const t = node.task_number;
    if (!taskMap.has(t)) taskMap.set(t, []);
    taskMap.get(t).push(node);
  }
  const sortedTaskNumbers = [...taskMap.keys()].sort((a, b) => a - b);
  const tasks = sortedTaskNumbers.map(taskNum => _buildTask(taskNum, taskMap.get(taskNum)));

  // Derive current_task
  let current_task = 0;
  for (let i = 0; i < sortedTaskNumbers.length; i++) {
    const t = tasks[i];
    if (t.status !== TASK_STATUSES.NOT_STARTED) current_task = sortedTaskNumbers[i];
  }

  // Phase docs
  const docs = _buildPhaseDocs(phaseLevelNodes);

  // Phase review
  const review = _buildPhaseReview(phaseLevelNodes);

  return { name, status, stage, current_task, tasks, docs, review };
}

function _derivePhaseStatus(phaseNodes) {
  if (phaseNodes.every(n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED)) {
    return PHASE_STATUSES.COMPLETE;
  }
  if (phaseNodes.some(n => n.status === DAG_NODE_STATUSES.HALTED)) {
    return PHASE_STATUSES.HALTED;
  }
  if (phaseNodes.some(n => n.status === DAG_NODE_STATUSES.IN_PROGRESS || n.status === DAG_NODE_STATUSES.COMPLETE)) {
    return PHASE_STATUSES.IN_PROGRESS;
  }
  return PHASE_STATUSES.NOT_STARTED;
}

function _derivePhaseStage(phaseLevelNodes, taskNodes) {
  // Phase plan node (template_node_id: 'create_phase_plan')
  const phasePlanNode = phaseLevelNodes.find(n => n.template_node_id === 'create_phase_plan');
  if (phasePlanNode && (phasePlanNode.status === DAG_NODE_STATUSES.NOT_STARTED || phasePlanNode.status === DAG_NODE_STATUSES.IN_PROGRESS)) {
    return PHASE_STAGES.PLANNING;
  }

  // Phase review node
  const phaseReviewNode = phaseLevelNodes.find(n => n.template_node_id === 'phase_review');
  if (phaseReviewNode && phaseReviewNode.status === DAG_NODE_STATUSES.IN_PROGRESS) {
    return PHASE_STAGES.REVIEWING;
  }
  if (phaseReviewNode && phaseReviewNode.status === DAG_NODE_STATUSES.NOT_STARTED &&
      taskNodes.length > 0 && taskNodes.every(n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED)) {
    return PHASE_STAGES.REVIEWING;
  }

  // Any node failed/halted
  const allNodes = [...phaseLevelNodes, ...taskNodes];
  if (allNodes.some(n => n.status === DAG_NODE_STATUSES.HALTED || n.status === DAG_NODE_STATUSES.FAILED)) {
    return PHASE_STAGES.FAILED;
  }

  // All nodes complete
  if (allNodes.every(n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED)) {
    return PHASE_STAGES.COMPLETE;
  }

  // Task nodes exist and any are active
  if (taskNodes.some(n => n.status === DAG_NODE_STATUSES.IN_PROGRESS || n.status === DAG_NODE_STATUSES.COMPLETE)) {
    return PHASE_STAGES.EXECUTING;
  }

  return PHASE_STAGES.PLANNING;
}

function _buildTask(taskNum, taskNodes) {
  const nameNode = taskNodes.find(n => n.task_name);
  const name = nameNode ? nameNode.task_name : `Task ${taskNum}`;

  const status = _deriveTaskStatus(taskNodes);
  const stage = _deriveTaskStage(taskNodes);

  // Docs: handoff and review
  const handoffNode = taskNodes.find(n => n.template_node_id === 'create_task_handoff');
  const reviewNode = taskNodes.find(n => n.template_node_id === 'code_review');
  const commitNode = taskNodes.find(n => n.template_node_id === 'source_control_commit');
  const codingNode = taskNodes.find(n => n.template_node_id === 'execute_coding_task');

  const docs = {
    handoff: handoffNode?.docs?.doc_path ?? null,
    review: reviewNode?.docs?.doc_path ?? null,
  };

  const review = {
    verdict: reviewNode?.review?.verdict ?? null,
    action: reviewNode?.review?.action ?? null,
  };

  // retries: from coding node or review node
  const retries = codingNode?.retries ?? reviewNode?.retries ?? 0;

  const commit_hash = commitNode?.docs?.commit_hash ?? null;

  return { name, status, stage, docs, review, retries, commit_hash };
}

function _deriveTaskStatus(taskNodes) {
  if (taskNodes.every(n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED)) {
    return TASK_STATUSES.COMPLETE;
  }
  if (taskNodes.some(n => n.status === DAG_NODE_STATUSES.HALTED)) {
    return TASK_STATUSES.HALTED;
  }
  if (taskNodes.some(n => n.status === DAG_NODE_STATUSES.FAILED)) {
    return TASK_STATUSES.FAILED;
  }
  if (taskNodes.some(n => n.status === DAG_NODE_STATUSES.IN_PROGRESS || n.status === DAG_NODE_STATUSES.COMPLETE)) {
    return TASK_STATUSES.IN_PROGRESS;
  }
  return TASK_STATUSES.NOT_STARTED;
}

function _deriveTaskStage(taskNodes) {
  const handoffNode = taskNodes.find(n => n.template_node_id === 'create_task_handoff');
  const codingNode = taskNodes.find(n => n.template_node_id === 'execute_coding_task');
  const reviewNode = taskNodes.find(n => n.template_node_id === 'code_review');

  if (taskNodes.some(n => n.status === DAG_NODE_STATUSES.FAILED)) {
    return TASK_STAGES.FAILED;
  }
  if (taskNodes.every(n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED)) {
    return TASK_STAGES.COMPLETE;
  }
  if (reviewNode && reviewNode.status === DAG_NODE_STATUSES.IN_PROGRESS) {
    return TASK_STAGES.REVIEWING;
  }
  if (reviewNode && reviewNode.status === DAG_NODE_STATUSES.NOT_STARTED && codingNode?.status === DAG_NODE_STATUSES.COMPLETE) {
    return TASK_STAGES.REVIEWING;
  }
  if (codingNode && codingNode.status === DAG_NODE_STATUSES.IN_PROGRESS) {
    return TASK_STAGES.CODING;
  }
  if (handoffNode && handoffNode.status === DAG_NODE_STATUSES.IN_PROGRESS) {
    return TASK_STAGES.PLANNING;
  }
  return TASK_STAGES.PLANNING;
}

function _buildPhaseDocs(phaseLevelNodes) {
  const phasePlanNode = phaseLevelNodes.find(n => n.template_node_id === 'create_phase_plan');
  const phaseReportNode = phaseLevelNodes.find(n => n.template_node_id === 'generate_phase_report');
  const phaseReviewNode = phaseLevelNodes.find(n => n.template_node_id === 'phase_review');

  return {
    phase_plan: phasePlanNode?.docs?.doc_path ?? null,
    phase_report: phaseReportNode?.docs?.doc_path ?? null,
    phase_review: phaseReviewNode?.docs?.doc_path ?? null,
  };
}

function _buildPhaseReview(phaseLevelNodes) {
  const phaseReviewNode = phaseLevelNodes.find(n => n.template_node_id === 'phase_review');
  return {
    verdict: phaseReviewNode?.review?.verdict ?? null,
    action: phaseReviewNode?.review?.action ?? null,
  };
}

function _deriveExecutionStatus(phases) {
  if (phases.length === 0) return PHASE_STATUSES.NOT_STARTED;
  if (phases.some(p => p.status === PHASE_STATUSES.HALTED)) return PHASE_STATUSES.HALTED;
  if (phases.every(p => p.status === PHASE_STATUSES.COMPLETE)) return PHASE_STATUSES.COMPLETE;
  if (phases.some(p => p.status === PHASE_STATUSES.IN_PROGRESS)) return PHASE_STATUSES.IN_PROGRESS;
  return PHASE_STATUSES.NOT_STARTED;
}

function _deriveCurrentPhase(phases, sortedPhaseNumbers) {
  let current_phase = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].status !== PHASE_STATUSES.NOT_STARTED) {
      current_phase = sortedPhaseNumbers[i];
    }
  }
  return current_phase;
}

// ─── deriveTier ──────────────────────────────────────────────────────────────

/**
 * Inspect DAG node statuses to determine the active pipeline tier.
 *
 * @param {Object.<string, DagNode>} nodes
 * @returns {'planning' | 'execution' | 'review' | 'complete' | 'halted'}
 */
function deriveTier(nodes) {
  const allNodes = Object.values(nodes);

  // All complete/skipped → complete
  if (allNodes.every(n => n.status === DAG_NODE_STATUSES.COMPLETE || n.status === DAG_NODE_STATUSES.SKIPPED)) {
    return PIPELINE_TIERS.COMPLETE;
  }

  // Any halted → halted (always terminal)
  if (allNodes.some(n => n.status === DAG_NODE_STATUSES.HALTED)) {
    return PIPELINE_TIERS.HALTED;
  }

  // Failed nodes are only terminal when there is no remaining pending work.
  // Corrective task injection sets review nodes to FAILED while adding new
  // NOT_STARTED corrective nodes; the pipeline must continue in that case.
  const hasFailedNode = allNodes.some(n => n.status === DAG_NODE_STATUSES.FAILED);
  if (hasFailedNode) {
    const hasPendingWork = allNodes.some(
      n => n.status === DAG_NODE_STATUSES.NOT_STARTED || n.status === DAG_NODE_STATUSES.IN_PROGRESS
    );
    if (!hasPendingWork) {
      return PIPELINE_TIERS.HALTED;
    }
  }

  // Planning tier: any planning step node active, or planning gate not yet complete
  const planningStepNodes = allNodes.filter(n => n.planning_step);
  if (planningStepNodes.some(n => n.status === DAG_NODE_STATUSES.NOT_STARTED || n.status === DAG_NODE_STATUSES.IN_PROGRESS)) {
    return PIPELINE_TIERS.PLANNING;
  }

  const planningGateNode = allNodes.find(n => n.gate_type === 'planning');
  if (planningGateNode && planningGateNode.status === DAG_NODE_STATUSES.NOT_STARTED) {
    return PIPELINE_TIERS.PLANNING;
  }

  // Review tier: final review creation node in_progress, or final gate not yet complete
  const finalReviewNode = allNodes.find(n => n.template_node_id === 'create_final_review');
  if (finalReviewNode && finalReviewNode.status === DAG_NODE_STATUSES.IN_PROGRESS) {
    return PIPELINE_TIERS.REVIEW;
  }

  const finalGateNode = allNodes.find(n => n.gate_type === 'final');
  if (finalGateNode && (finalGateNode.status === DAG_NODE_STATUSES.IN_PROGRESS || finalGateNode.status === DAG_NODE_STATUSES.NOT_STARTED)) {
    if (finalReviewNode && finalReviewNode.status === DAG_NODE_STATUSES.COMPLETE) {
      return PIPELINE_TIERS.REVIEW;
    }
  }

  // Execution tier: any phase-scoped node active
  const phaseNodes = allNodes.filter(n => n.phase_number != null);
  if (phaseNodes.some(n => n.status === DAG_NODE_STATUSES.IN_PROGRESS || n.status === DAG_NODE_STATUSES.NOT_STARTED)) {
    return PIPELINE_TIERS.EXECUTION;
  }

  return PIPELINE_TIERS.EXECUTION;
}

// ─── computeNestedView ───────────────────────────────────────────────────────

/**
 * Top-level adapter entry point. Transforms DAG state into the v4-compatible
 * nested view consumed by the dashboard.
 *
 * @param {DagState} dagState - state.dag from the v5 state object
 * @returns {{ planning: Object, execution: Object, final_review: Object }}
 */
function computeNestedView(dagState) {
  const nodes = dagState.nodes;
  const steps = mapPlanningSteps(nodes);
  const execution = mapExecution(nodes);

  // Planning status
  let planningStatus;
  if (steps.length > 0 && steps.every(s => s.status === DAG_NODE_STATUSES.COMPLETE)) {
    planningStatus = PLANNING_STATUSES.COMPLETE;
  } else if (steps.some(s => s.status === DAG_NODE_STATUSES.IN_PROGRESS)) {
    planningStatus = PLANNING_STATUSES.IN_PROGRESS;
  } else {
    planningStatus = PLANNING_STATUSES.NOT_STARTED;
  }

  // Planning human_approved: planning gate node status === complete
  const allNodes = Object.values(nodes);
  const planningGateNode = allNodes.find(n => n.gate_type === 'planning');
  const planningHumanApproved = planningGateNode ? planningGateNode.status === DAG_NODE_STATUSES.COMPLETE : false;

  // Final review status + doc_path
  const finalReviewNode = allNodes.find(n => n.template_node_id === 'create_final_review');
  const finalReviewStatus = finalReviewNode ? finalReviewNode.status : DAG_NODE_STATUSES.NOT_STARTED;
  const finalReviewDocPath = finalReviewNode?.docs?.doc_path ?? null;

  // Final review human_approved: final gate node status === complete
  const finalGateNode = allNodes.find(n => n.gate_type === 'final');
  const finalHumanApproved = finalGateNode ? finalGateNode.status === DAG_NODE_STATUSES.COMPLETE : false;

  const planning = {
    status: planningStatus,
    human_approved: planningHumanApproved,
    steps,
  };

  const final_review = {
    status: finalReviewStatus,
    doc_path: finalReviewDocPath,
    human_approved: finalHumanApproved,
  };

  return { planning, execution, final_review };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { computeNestedView, mapPlanningSteps, mapExecution, deriveTier };
