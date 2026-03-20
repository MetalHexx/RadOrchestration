'use strict';

const {
  PIPELINE_TIERS, PLANNING_STEP_STATUSES,
  PHASE_STATUSES, TASK_STATUSES,
  PHASE_STAGES, TASK_STAGES,
  REVIEW_ACTIONS, PHASE_REVIEW_ACTIONS,
  HUMAN_GATE_MODES, NEXT_ACTIONS,
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

// phaseNumber is already 1-based — no + 1 needed
function formatPhaseId(phaseNumber) {
  return `P${String(phaseNumber).padStart(2, '0')}`;
}

// phaseNumber and taskNumber are already 1-based — no + 1 needed
function formatTaskId(phaseNumber, taskNumber) {
  return `P${String(phaseNumber).padStart(2, '0')}-T${String(taskNumber).padStart(2, '0')}`;
}

function halted(details) {
  return { action: NEXT_ACTIONS.DISPLAY_HALTED, context: { details } };
}

/**
 * Resolve effective gate mode for a project.
 * Reads from state first; falls back to config when state value is null/undefined.
 * @param {Object} state - post-mutation state
 * @param {Object} config - merged orchestration config
 * @returns {'task' | 'phase' | 'autonomous' | 'ask'}
 */
function resolveGateMode(state, config) {
  return state.pipeline.gate_mode ?? config.human_gates.execution_mode;
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
  // Ask-mode detection — prompt operator to choose gate mode once
  const effectiveMode = resolveGateMode(state, config);
  if (effectiveMode === HUMAN_GATE_MODES.ASK && state.pipeline.gate_mode == null) {
    return { action: NEXT_ACTIONS.ASK_GATE_MODE, context: {} };
  }

  const exec = state.execution;
  const phaseNumber = exec.current_phase;          // 1-based
  const phase = exec.phases[phaseNumber - 1];      // 1-based access

  if (!phase) {
    return halted('No phase found at current_phase ' + phaseNumber);
  }

  // Phase-level halted (check status first, before stage)
  if (phase.status === PHASE_STATUSES.HALTED) {
    return halted(`Phase ${formatPhaseId(phaseNumber)} (${phase.name}) is halted`);
  }

  // Route on phase stage
  if (phase.stage === PHASE_STAGES.PLANNING) {
    return {
      action: NEXT_ACTIONS.CREATE_PHASE_PLAN,
      context: {
        phase_number: phaseNumber,
        phase_id: formatPhaseId(phaseNumber),
      },
    };
  }

  if (phase.stage === PHASE_STAGES.EXECUTING) {
    return resolvePhaseExecuting(phase, phaseNumber, state, config);
  }

  if (phase.stage === PHASE_STAGES.REVIEWING) {
    return {
      action: NEXT_ACTIONS.SPAWN_PHASE_REVIEWER,
      context: {
        phase_report_doc: phase.docs.phase_report,
        phase_number: phaseNumber,
        phase_id: formatPhaseId(phaseNumber),
      },
    };
  }

  if (phase.stage === PHASE_STAGES.COMPLETE && phase.review.action === PHASE_REVIEW_ACTIONS.ADVANCED) {
    return resolvePhaseGate(phaseNumber, state, config);
  }

  return halted(`Unresolvable phase state at ${formatPhaseId(phaseNumber)}: stage=${phase.stage}`);
}

function resolvePhaseExecuting(phase, phaseNumber, state, config) {
  // Edge case: empty phase (0 tasks) — treat as all tasks done
  if (phase.current_task === 0 && phase.tasks.length === 0) {
    return {
      action: NEXT_ACTIONS.GENERATE_PHASE_REPORT,
      context: {
        phase_number: phaseNumber,
        phase_id: formatPhaseId(phaseNumber),
      },
    };
  }

  // All tasks processed: 1-based pointer has advanced past last task
  if (phase.current_task > phase.tasks.length) {
    return {
      action: NEXT_ACTIONS.GENERATE_PHASE_REPORT,
      context: {
        phase_number: phaseNumber,
        phase_id: formatPhaseId(phaseNumber),
      },
    };
  }

  const taskNumber = phase.current_task;            // 1-based
  const task = phase.tasks[taskNumber - 1];         // 1-based access
  if (!task) {
    return halted(`No task found at current_task ${taskNumber} in phase ${formatPhaseId(phaseNumber)}`);
  }

  return resolveTask(task, phase, phaseNumber, taskNumber, state, config);
}

function resolveTask(task, phase, phaseNumber, taskNumber, state, config) {
  // Task-level halted (check status first, before stage)
  if (task.status === TASK_STATUSES.HALTED) {
    return halted(`Task ${formatTaskId(phaseNumber, taskNumber)} (${task.name}) is halted`);
  }

  // Stage-based routing — no null-path inference
  if (task.stage === TASK_STAGES.PLANNING) {
    return {
      action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
      context: {
        is_correction: false,
        phase_number: phaseNumber,
        task_number: taskNumber,
        phase_id: formatPhaseId(phaseNumber),
        task_id: formatTaskId(phaseNumber, taskNumber),
      },
    };
  }

  if (task.stage === TASK_STAGES.CODING) {
    return {
      action: NEXT_ACTIONS.EXECUTE_TASK,
      context: {
        handoff_doc: task.docs.handoff,
        phase_number: phaseNumber,
        task_number: taskNumber,
        phase_id: formatPhaseId(phaseNumber),
        task_id: formatTaskId(phaseNumber, taskNumber),
      },
    };
  }

  if (task.stage === TASK_STAGES.REVIEWING) {
    return {
      action: NEXT_ACTIONS.SPAWN_CODE_REVIEWER,
      context: {
        report_doc: task.docs.report,
        phase_number: phaseNumber,
        task_number: taskNumber,
        phase_id: formatPhaseId(phaseNumber),
        task_id: formatTaskId(phaseNumber, taskNumber),
      },
    };
  }

  if (task.stage === TASK_STAGES.COMPLETE && task.review.action === REVIEW_ACTIONS.ADVANCED) {
    return resolveTaskGate(phaseNumber, taskNumber, state, config);
  }

  if (task.stage === TASK_STAGES.FAILED && task.review.action === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
    return {
      action: NEXT_ACTIONS.CREATE_TASK_HANDOFF,
      context: {
        is_correction: true,
        previous_review: task.docs.review,
        reason: task.review.verdict,
        phase_number: phaseNumber,
        task_number: taskNumber,
        phase_id: formatPhaseId(phaseNumber),
        task_id: formatTaskId(phaseNumber, taskNumber),
      },
    };
  }

  return halted(`Unresolvable task state at ${formatTaskId(phaseNumber, taskNumber)}: status=${task.status}, stage=${task.stage}`);
}

function resolveTaskGate(phaseNumber, taskNumber, state, config) {
  const mode = resolveGateMode(state, config);
  if (mode === HUMAN_GATE_MODES.TASK) {
    return {
      action: NEXT_ACTIONS.GATE_TASK,
      context: {
        phase_number: phaseNumber,
        task_number: taskNumber,
        phase_id: formatPhaseId(phaseNumber),
        task_id: formatTaskId(phaseNumber, taskNumber),
      },
    };
  }
  // ask/autonomous/phase modes at task level: no gate — mutations should advance pointer
  return halted(`Task ${formatTaskId(phaseNumber, taskNumber)} is advanced but no gate required — expected mutation to advance pointer`);
}

function resolvePhaseGate(phaseNumber, state, config) {
  const mode = resolveGateMode(state, config);
  if (mode === HUMAN_GATE_MODES.PHASE || mode === HUMAN_GATE_MODES.TASK) {
    return {
      action: NEXT_ACTIONS.GATE_PHASE,
      context: {
        phase_number: phaseNumber,
        phase_id: formatPhaseId(phaseNumber),
      },
    };
  }
  // ask/autonomous: skip gate; mutations should advance phase
  return halted(`Phase ${formatPhaseId(phaseNumber)} is advanced but no gate required — expected mutation to advance phase`);
}

// ─── Review Tier ────────────────────────────────────────────────────────────

function resolveReview(state) {
  const final_review = state.final_review;

  if (!final_review.doc_path) {
    return { action: NEXT_ACTIONS.SPAWN_FINAL_REVIEWER, context: {} };
  }

  if (!final_review.human_approved) {
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
 * v4: Uses task.stage and phase.stage for resolution instead of
 * inferring work focus from null doc paths.
 *
 * @param {import('./constants').StateJson} state - post-mutation, post-validation state
 * @param {import('./constants').Config} config - parsed orchestration config
 * @returns {{ action: string, context: Object }}
 */
function resolveNextAction(state, config) {
  const tier = state.pipeline.current_tier;

  // Terminal tiers first
  if (tier === PIPELINE_TIERS.HALTED) {
    return halted('Pipeline is halted');
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
