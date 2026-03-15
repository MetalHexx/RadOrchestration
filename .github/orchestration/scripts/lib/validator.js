'use strict';

const {
  PIPELINE_TIERS,
  PHASE_STATUSES,
  TASK_STATUSES,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
} = require('./constants.js');

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationError
 * @property {string} invariant - invariant ID (e.g., 'V1', 'V12')
 * @property {string} message - human-readable description
 * @property {string} field - dotpath to the violating field
 * @property {*} [current] - current value (for transition checks V11–V13 only)
 * @property {*} [proposed] - proposed value (for transition checks V11–V13 only)
 */

/**
 * Create a ValidationError object.
 * @param {string} invariant
 * @param {string} message
 * @param {string} field
 * @param {*} [current]
 * @param {*} [proposed]
 * @returns {ValidationError}
 */
function makeError(invariant, message, field, current, proposed) {
  const err = { invariant, message, field };
  if (current !== undefined) err.current = current;
  if (proposed !== undefined) err.proposed = proposed;
  return err;
}

// ─── Structural Checks (proposed-only) ─────────────────────────────────────

/** V1 — current_phase within [0, phases.length) ; allow 0 when phases empty */
function checkV1(proposed) {
  const { current_phase, phases } = proposed.execution;
  if (phases.length === 0 && current_phase === 0) return [];
  if (current_phase < 0 || current_phase >= phases.length) {
    return [makeError('V1', `current_phase ${current_phase} out of bounds [0, ${phases.length})`, 'execution.current_phase')];
  }
  return [];
}

/** V2 — current_task within bounds for the active phase */
function checkV2(proposed) {
  const { current_phase, phases } = proposed.execution;
  if (phases.length === 0) return [];
  if (current_phase < 0 || current_phase >= phases.length) return []; // V1 catches this
  const phase = phases[current_phase];
  const { current_task, tasks } = phase;
  if (tasks.length === 0 && current_task === 0) return [];
  // Allow current_task === tasks.length when all tasks are complete
  if (current_task === tasks.length && tasks.every(t => t.status === TASK_STATUSES.COMPLETE)) return [];
  if (current_task < 0 || current_task >= tasks.length) {
    return [makeError('V2', `current_task ${current_task} out of bounds [0, ${tasks.length}) for phase ${current_phase}`, `execution.phases[${current_phase}].current_task`)];
  }
  return [];
}

/** V3 — total_phases === phases.length */
function checkV3(proposed) {
  const { total_phases, phases } = proposed.execution;
  if (total_phases !== phases.length) {
    return [makeError('V3', `total_phases ${total_phases} !== phases.length ${phases.length}`, 'execution.total_phases')];
  }
  return [];
}

/** V4 — total_tasks === tasks.length for every phase */
function checkV4(proposed) {
  const errors = [];
  for (let i = 0; i < proposed.execution.phases.length; i++) {
    const phase = proposed.execution.phases[i];
    if (phase.total_tasks !== phase.tasks.length) {
      errors.push(makeError('V4', `phase[${i}].total_tasks ${phase.total_tasks} !== tasks.length ${phase.tasks.length}`, `execution.phases[${i}].total_tasks`));
    }
  }
  return errors;
}

/** V5 — phases and tasks within config limits */
function checkV5(proposed, config) {
  const errors = [];
  const { phases } = proposed.execution;
  if (phases.length > config.limits.max_phases) {
    errors.push(makeError('V5', `phases.length ${phases.length} exceeds max_phases ${config.limits.max_phases}`, 'execution.phases.length'));
  }
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].tasks.length > config.limits.max_tasks_per_phase) {
      errors.push(makeError('V5', `phase[${i}].tasks.length ${phases[i].tasks.length} exceeds max_tasks_per_phase ${config.limits.max_tasks_per_phase}`, `execution.phases[${i}].tasks.length`));
    }
  }
  return errors;
}

// ─── Gate Checks (proposed-only) ────────────────────────────────────────────

/** V6 — execution tier requires human_approved */
function checkV6(proposed) {
  if (proposed.execution.current_tier === PIPELINE_TIERS.EXECUTION && !proposed.planning.human_approved) {
    return [makeError('V6', 'execution tier requires planning.human_approved to be true', 'planning.human_approved')];
  }
  return [];
}

/** V7 — complete tier with after_final_review gate requires human_approved */
function checkV7(proposed, config) {
  if (
    proposed.execution.current_tier === PIPELINE_TIERS.COMPLETE &&
    config.human_gates.after_final_review === true &&
    !proposed.planning.human_approved
  ) {
    return [makeError('V7', 'complete tier with after_final_review gate requires planning.human_approved to be true', 'planning.human_approved')];
  }
  return [];
}

// ─── Phase-Status vs Tier Check ─────────────────────────────────────────────

/** V10 — phase status consistency with current_tier */
function checkV10(proposed) {
  const errors = [];
  const { current_tier, current_phase, phases } = proposed.execution;

  if (current_tier === PIPELINE_TIERS.EXECUTION) {
    if (current_phase >= 0 && current_phase < phases.length) {
      const status = phases[current_phase].status;
      if (status !== PHASE_STATUSES.NOT_STARTED && status !== PHASE_STATUSES.IN_PROGRESS) {
        errors.push(makeError('V10', `active phase status '${status}' invalid during execution tier`, `execution.phases[${current_phase}].status`));
      }
    }
  } else if (current_tier === PIPELINE_TIERS.PLANNING) {
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].status === PHASE_STATUSES.IN_PROGRESS) {
        errors.push(makeError('V10', `phase[${i}] is in_progress during planning tier`, `execution.phases[${i}].status`));
      }
    }
  } else if (current_tier === PIPELINE_TIERS.REVIEW || current_tier === PIPELINE_TIERS.COMPLETE) {
    for (let i = 0; i < phases.length; i++) {
      const s = phases[i].status;
      if (s !== PHASE_STATUSES.COMPLETE && s !== PHASE_STATUSES.HALTED) {
        errors.push(makeError('V10', `phase[${i}] status '${s}' must be complete or halted during ${current_tier} tier`, `execution.phases[${i}].status`));
      }
    }
  }

  return errors;
}

// ─── Transition Checks (current + proposed) ────────────────────────────────

/** V11 — task retries monotonically non-decreasing */
function checkV11(current, proposed) {
  const errors = [];
  const curPhases = current.execution.phases;
  const propPhases = proposed.execution.phases;
  const len = Math.min(curPhases.length, propPhases.length);

  for (let p = 0; p < len; p++) {
    const curTasks = curPhases[p].tasks;
    const propTasks = propPhases[p].tasks;
    const tLen = Math.min(curTasks.length, propTasks.length);
    for (let t = 0; t < tLen; t++) {
      if (propTasks[t].retries < curTasks[t].retries) {
        errors.push(makeError('V11', `task[${p}][${t}] retries decreased from ${curTasks[t].retries} to ${propTasks[t].retries}`, `execution.phases[${p}].tasks[${t}].retries`, curTasks[t].retries, propTasks[t].retries));
      }
    }
  }
  return errors;
}

/** V12 — status transitions must follow allowed maps */
function checkV12(current, proposed) {
  const errors = [];
  const curPhases = current.execution.phases;
  const propPhases = proposed.execution.phases;
  const pLen = Math.min(curPhases.length, propPhases.length);

  for (let p = 0; p < pLen; p++) {
    // Phase transitions
    const fromPhase = curPhases[p].status;
    const toPhase = propPhases[p].status;
    if (fromPhase !== toPhase) {
      const allowed = ALLOWED_PHASE_TRANSITIONS[fromPhase];
      if (!allowed || !allowed.includes(toPhase)) {
        errors.push(makeError('V12', `phase[${p}] transition '${fromPhase}' → '${toPhase}' not allowed`, `execution.phases[${p}].status`, fromPhase, toPhase));
      }
    }

    // Task transitions
    const curTasks = curPhases[p].tasks;
    const propTasks = propPhases[p].tasks;
    const tLen = Math.min(curTasks.length, propTasks.length);
    for (let t = 0; t < tLen; t++) {
      const fromTask = curTasks[t].status;
      const toTask = propTasks[t].status;
      if (fromTask !== toTask) {
        const allowed = ALLOWED_TASK_TRANSITIONS[fromTask];
        if (!allowed || !allowed.includes(toTask)) {
          errors.push(makeError('V12', `task[${p}][${t}] transition '${fromTask}' → '${toTask}' not allowed`, `execution.phases[${p}].tasks[${t}].status`, fromTask, toTask));
        }
      }
    }
  }
  return errors;
}

/** V13 — proposed.project.updated must be strictly greater than current */
function checkV13(current, proposed) {
  if (proposed.project.updated <= current.project.updated) {
    return [makeError('V13', `proposed timestamp '${proposed.project.updated}' must be greater than current '${current.project.updated}'`, 'project.updated', current.project.updated, proposed.project.updated)];
  }
  return [];
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Validate a state transition. Runs structural and transition guards.
 * Returns empty array if valid.
 *
 * @param {import('./constants.js').StateJson | null} current - state before mutation (null on init)
 * @param {import('./constants.js').StateJson} proposed - state after mutation
 * @param {import('./constants.js').Config} config - parsed orchestration config (for V5, V7)
 * @returns {ValidationError[]}
 */
function validateTransition(current, proposed, config) {
  const errors = [
    ...checkV1(proposed),
    ...checkV2(proposed),
    ...checkV3(proposed),
    ...checkV4(proposed),
    ...checkV5(proposed, config),
    ...checkV6(proposed),
    ...checkV7(proposed, config),
    ...checkV10(proposed),
  ];

  if (current !== null) {
    errors.push(
      ...checkV11(current, proposed),
      ...checkV12(current, proposed),
      ...checkV13(current, proposed),
    );
  }

  return errors;
}

module.exports = { validateTransition };
