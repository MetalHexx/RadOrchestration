'use strict';

const {
  PIPELINE_TIERS, PLANNING_STEP_STATUSES,
  PHASE_STATUSES, TASK_STATUSES, REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS, HUMAN_GATE_MODES, NEXT_ACTIONS,
} = require('./constants');

// ─── Planning Step → Action Map ─────────────────────────────────────────────

const PLANNING_STEP_ORDER = [
  { key: 'research',     action: NEXT_ACTIONS.SPAWN_RESEARCH },
  { key: 'prd',          action: NEXT_ACTIONS.SPAWN_PRD },
  { key: 'design',       action: NEXT_ACTIONS.SPAWN_DESIGN },
  { key: 'architecture', action: NEXT_ACTIONS.SPAWN_ARCHITECTURE },
  { key: 'master_plan',  action: NEXT_ACTIONS.SPAWN_MASTER_PLAN },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPhaseId(phaseIndex) {
  return `P${String(phaseIndex + 1).padStart(2, '0')}`;
}

function formatTaskId(phaseIndex, taskIndex) {
  return `P${String(phaseIndex + 1).padStart(2, '0')}-T${String(taskIndex + 1).padStart(2, '0')}`;
}

function halted(details) {
  return { action: NEXT_ACTIONS.DISPLAY_HALTED, context: { details } };
}

// ─── Planning Tier ──────────────────────────────────────────────────────────

function resolvePlanning(state) {
  const stepsByName = new Map(state.planning.steps.map(s => [s.name, s]));

  for (const { key, action } of PLANNING_STEP_ORDER) {
    const step = stepsByName.get(key);
    if (!step || step.status !== PLANNING_STEP_STATUSES.COMPLETE) {
      return { action, context: { step: key } };
    }
  }

  // All steps complete — check human gate
  if (!state.planning.human_approved) {
    return { action: NEXT_ACTIONS.REQUEST_PLAN_APPROVAL, context: {} };
  }

  // Planning complete but tier not yet transitioned — should not normally reach here
  // because mutations would have transitioned tier already.
  return halted('Unreachable: planning approved but no step incomplete');
}

// ─── Execution Tier ─────────────────────────────────────────────────────────

function resolveExecution(state, config) {
  const exec = state.execution;
  const phaseIndex = exec.current_phase;
  const phase = exec.phases[phaseIndex];

  if (!phase) {
    return halted('No phase found at current_phase index ' + phaseIndex);
  }

  // Phase-level halted
  if (phase.status === PHASE_STATUSES.HALTED) {
    return halted(`Phase ${formatPhaseId(phaseIndex)} (${phase.name}) is halted`);
  }

  // Phase not started → need phase plan
  if (phase.status === PHASE_STATUSES.NOT_STARTED) {
    return {
      action: NEXT_ACTIONS.CREATE_PHASE_PLAN,
      context: {
        phase_index: phaseIndex,
        phase_id: formatPhaseId(phaseIndex),
      },
    };
  }

  // Phase in progress → task-level or phase-level resolution
  if (phase.status === PHASE_STATUSES.IN_PROGRESS) {
    return resolvePhaseInProgress(phase, phaseIndex, config);
  }

  // Phase complete — should not normally reach here in execution tier
  return halted('Unexpected phase status: ' + phase.status);
}

function resolvePhaseInProgress(phase, phaseIndex, config) {
  const taskIndex = phase.current_task;

  // All tasks processed → phase-level resolution
  if (taskIndex >= phase.total_tasks) {
    return resolvePhaseCompletion(phase, phaseIndex, config);
  }

  const task = phase.tasks[taskIndex];
  if (!task) {
    return halted(`No task found at index ${taskIndex} in phase ${formatPhaseId(phaseIndex)}`);
  }

  return resolveTask(task, phase, phaseIndex, taskIndex, config);
}

function resolveTask(task, phase, phaseIndex, taskIndex, config) {
  // Task halted
  if (task.status === TASK_STATUSES.HALTED) {
    return halted(`Task ${formatTaskId(phaseIndex, taskIndex)} (${task.name}) is halted`);
  }

  // Corrective: task failed + corrective review action → re-issue handoff
  if (task.status === TASK_STATUSES.FAILED && task.review_action === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
    return {
      action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
      context: {
        is_correction: true,
        previous_review: task.review_doc,
        reason: task.review_verdict,
        phase_index: phaseIndex,
        task_index: taskIndex,
        phase_id: formatPhaseId(phaseIndex),
        task_id: formatTaskId(phaseIndex, taskIndex),
      },
    };
  }

  // Task not started, no handoff → create handoff
  if (task.status === TASK_STATUSES.NOT_STARTED && !task.handoff_doc) {
    return {
      action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
      context: {
        is_correction: false,
        phase_index: phaseIndex,
        task_index: taskIndex,
        phase_id: formatPhaseId(phaseIndex),
        task_id: formatTaskId(phaseIndex, taskIndex),
      },
    };
  }

  // Task in progress with handoff but no report → execute
  if (task.status === TASK_STATUSES.IN_PROGRESS && task.handoff_doc && !task.report_doc) {
    return {
      action: NEXT_ACTIONS.EXECUTE_TASK,
      context: {
        handoff_doc: task.handoff_doc,
        phase_index: phaseIndex,
        task_index: taskIndex,
        phase_id: formatPhaseId(phaseIndex),
        task_id: formatTaskId(phaseIndex, taskIndex),
      },
    };
  }

  // Task complete with no review → spawn reviewer
  if (task.status === TASK_STATUSES.COMPLETE && !task.review_doc) {
    return {
      action: NEXT_ACTIONS.SPAWN_CODE_REVIEWER,
      context: {
        report_doc: task.report_doc,
        phase_index: phaseIndex,
        task_index: taskIndex,
        phase_id: formatPhaseId(phaseIndex),
        task_id: formatTaskId(phaseIndex, taskIndex),
      },
    };
  }

  // Task complete with review + advanced → check task gate
  if (task.status === TASK_STATUSES.COMPLETE && task.review_action === REVIEW_ACTIONS.ADVANCED) {
    return resolveTaskGate(phaseIndex, taskIndex, config);
  }

  return halted(`Unresolvable task state at ${formatTaskId(phaseIndex, taskIndex)}: status=${task.status}, handoff=${!!task.handoff_doc}, report=${!!task.report_doc}, review=${!!task.review_doc}`);
}

function resolveTaskGate(phaseIndex, taskIndex, config) {
  const mode = config.human_gates.execution_mode;
  if (mode === HUMAN_GATE_MODES.TASK) {
    return {
      action: NEXT_ACTIONS.GATE_TASK,
      context: {
        phase_index: phaseIndex,
        task_index: taskIndex,
        phase_id: formatPhaseId(phaseIndex),
        task_id: formatTaskId(phaseIndex, taskIndex),
      },
    };
  }
  // For ask/autonomous/phase modes at task level, no gate — task already advanced
  // This means mutations should advance the pointer; resolver should not be called
  // in this state under normal flow. Return halted as a safety net.
  return halted(`Task ${formatTaskId(phaseIndex, taskIndex)} is advanced but no gate required — expected mutation to advance pointer`);
}

function resolvePhaseCompletion(phase, phaseIndex, config) {
  // Need phase report
  if (!phase.phase_report_doc) {
    return {
      action: NEXT_ACTIONS.GENERATE_PHASE_REPORT,
      context: {
        phase_index: phaseIndex,
        phase_id: formatPhaseId(phaseIndex),
      },
    };
  }

  // Need phase review
  if (!phase.phase_review_doc) {
    return {
      action: NEXT_ACTIONS.SPAWN_PHASE_REVIEWER,
      context: {
        phase_report_doc: phase.phase_report_doc,
        phase_index: phaseIndex,
        phase_id: formatPhaseId(phaseIndex),
      },
    };
  }

  // Phase review exists + advanced → check phase gate
  if (phase.phase_review_action === PHASE_REVIEW_ACTIONS.ADVANCED) {
    return resolvePhaseGate(phaseIndex, config);
  }

  // Phase review exists + corrective → resolve first corrective task
  if (phase.phase_review_action === PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED) {
    // Mutations should have set up corrective tasks and reset pointer
    // The next call to resolveExecution will pick them up via normal task resolution
    return halted(`Phase ${formatPhaseId(phaseIndex)} has corrective tasks but current_task >= total_tasks — expected mutation to reset pointer`);
  }

  // Phase review halted
  if (phase.phase_review_action === PHASE_REVIEW_ACTIONS.HALTED) {
    return halted(`Phase ${formatPhaseId(phaseIndex)} review resulted in halt`);
  }

  return halted(`Unresolvable phase completion state at ${formatPhaseId(phaseIndex)}`);
}

function resolvePhaseGate(phaseIndex, config) {
  const mode = config.human_gates.execution_mode;
  if (mode === HUMAN_GATE_MODES.PHASE || mode === HUMAN_GATE_MODES.TASK) {
    return {
      action: NEXT_ACTIONS.GATE_PHASE,
      context: {
        phase_index: phaseIndex,
        phase_id: formatPhaseId(phaseIndex),
      },
    };
  }
  // ask/autonomous → skip gate; mutations should advance phase
  return halted(`Phase ${formatPhaseId(phaseIndex)} is advanced but no gate required — expected mutation to advance phase`);
}

// ─── Review Tier ────────────────────────────────────────────────────────────

function resolveReview(state) {
  const exec = state.execution;

  if (!exec.final_review_doc) {
    return { action: NEXT_ACTIONS.SPAWN_FINAL_REVIEWER, context: {} };
  }

  if (!exec.final_review_approved) {
    return { action: NEXT_ACTIONS.REQUEST_FINAL_APPROVAL, context: {} };
  }

  // Final review approved but tier not transitioned — should not happen normally
  return halted('Final review approved but tier still in review — expected mutation to transition');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Pure state inspector. Given post-mutation state and config, returns the
 * next external action the Orchestrator should execute.
 *
 * @param {import('./constants').StateJson} state - post-mutation, post-validation state
 * @param {import('./constants').Config} config - parsed orchestration config
 * @returns {{ action: string, context: Object }}
 */
function resolveNextAction(state, config) {
  const tier = state.execution.current_tier;

  // Terminal tiers first
  if (tier === PIPELINE_TIERS.HALTED) {
    return halted(state.execution.halt_reason || 'Pipeline is halted');
  }

  if (tier === PIPELINE_TIERS.COMPLETE) {
    return { action: NEXT_ACTIONS.DISPLAY_COMPLETE, context: {} };
  }

  // Active tiers
  if (tier === PIPELINE_TIERS.PLANNING) {
    return resolvePlanning(state);
  }

  if (tier === PIPELINE_TIERS.EXECUTION) {
    return resolveExecution(state, config);
  }

  if (tier === PIPELINE_TIERS.REVIEW) {
    return resolveReview(state);
  }

  return halted('Unknown tier: ' + tier);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { resolveNextAction };
