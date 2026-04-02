'use strict';

const path = require('node:path');

const {
  PIPELINE_TIERS,
  PHASE_STATUSES,
  TASK_STATUSES,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
  ALLOWED_TASK_STAGE_TRANSITIONS,
  ALLOWED_PHASE_STAGE_TRANSITIONS,
} = require('./constants.js');

// Load the v4 JSON Schema once at module initialization
const v4Schema = require(path.resolve(__dirname, '../../schemas/state-v4.schema.json'));

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationError
 * @property {string} invariant - invariant ID (e.g., 'V1', 'V14')
 * @property {string} message - human-readable description
 * @property {string} field - dotpath to the violating field
 * @property {*} [current] - current value (for transition checks V11–V15 only)
 * @property {*} [proposed] - proposed value (for transition checks V11–V15 only)
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

/** V1 — current_phase within [1, phases.length]; 0 only when phases empty */
function checkV1(proposed) {
  const { current_phase, phases } = proposed.execution;
  if (phases.length === 0 && current_phase === 0) return [];
  if (current_phase < 1 || current_phase > phases.length) {
    return [makeError('V1', `current_phase ${current_phase} out of bounds [1, ${phases.length}]`, 'execution.current_phase')];
  }
  return [];
}

/** V2 — current_task within [1, tasks.length] for the active phase; 0 only when tasks empty.
 *  current_task may equal tasks.length + 1 as a transient "all tasks processed" state while
 *  awaiting phase_report_created (mutations advance it past the last task to signal completion). */
function checkV2(proposed) {
  const { current_phase, phases } = proposed.execution;
  if (phases.length === 0) return [];
  if (current_phase < 1 || current_phase > phases.length) return []; // V1 catches this
  const phase = phases[current_phase - 1];
  const { current_task, tasks } = phase;
  if (tasks.length === 0 && current_task === 0) return [];
  if (current_task < 1 || current_task > tasks.length + 1) {
    return [makeError('V2', `current_task ${current_task} out of bounds [1, ${tasks.length + 1}] for phase ${current_phase}`, `execution.phases[${current_phase - 1}].current_task`)];
  }
  return [];
}

// V3 — REMOVED (total_phases no longer exists in v4)
// V4 — REMOVED (total_tasks no longer exists in v4)

/** V5 — phases and tasks within config limits */
function checkV5(proposed, config) {
  const errors = [];
  const { phases } = proposed.execution;
  const effectiveMaxPhases = proposed.config?.limits?.max_phases ?? config.limits.max_phases;
  const effectiveMaxTasksPerPhase = proposed.config?.limits?.max_tasks_per_phase ?? config.limits.max_tasks_per_phase;
  if (phases.length > effectiveMaxPhases) {
    errors.push(makeError('V5', `phases.length ${phases.length} exceeds max_phases ${effectiveMaxPhases}`, 'execution.phases.length'));
  }
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].tasks.length > effectiveMaxTasksPerPhase) {
      errors.push(makeError('V5', `phase[${i}].tasks.length ${phases[i].tasks.length} exceeds max_tasks_per_phase ${effectiveMaxTasksPerPhase}`, `execution.phases[${i}].tasks.length`));
    }
  }
  return errors;
}

// ─── Gate Checks (proposed-only) ────────────────────────────────────────────

/** V6 — execution tier requires planning.human_approved */
function checkV6(proposed) {
  if (proposed.pipeline.current_tier === PIPELINE_TIERS.EXECUTION && !proposed.planning.human_approved) {
    return [makeError('V6', 'execution tier requires planning.human_approved to be true', 'planning.human_approved')];
  }
  return [];
}

/** V7 — complete tier with after_final_review gate requires final_review.human_approved */
function checkV7(proposed, config) {
  if (
    proposed.pipeline.current_tier === PIPELINE_TIERS.COMPLETE &&
    (proposed.config?.human_gates?.after_final_review ?? config.human_gates.after_final_review) === true &&
    !proposed.final_review.human_approved
  ) {
    return [makeError('V7', 'complete tier with after_final_review gate requires final_review.human_approved', 'final_review.human_approved')];
  }
  return [];
}

// ─── Phase-Status vs Tier Check ─────────────────────────────────────────────

/** V10 — phase status consistency with pipeline.current_tier */
function checkV10(proposed) {
  const errors = [];
  const tier = proposed.pipeline.current_tier;
  const { current_phase, phases } = proposed.execution;

  if (tier === PIPELINE_TIERS.EXECUTION) {
    if (current_phase >= 1 && current_phase <= phases.length) {
      const activePhase = phases[current_phase - 1];
      const { status, stage } = activePhase;
      // Gate-hold exception: when the phase is in a gate-deferred state the mutation sets both
      // phase.status = 'complete' and phase.stage = 'complete' while the pointer has not yet
      // advanced (pending gate_approved). Allow this transient state to pass V10.
      if (status !== PHASE_STATUSES.NOT_STARTED &&
          status !== PHASE_STATUSES.IN_PROGRESS &&
          !(status === PHASE_STATUSES.COMPLETE && stage === 'complete')) {
        errors.push(makeError('V10', `active phase status '${status}' invalid during execution tier`, `execution.phases[${current_phase - 1}].status`));
      }
    }
  } else if (tier === PIPELINE_TIERS.PLANNING) {
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].status === PHASE_STATUSES.IN_PROGRESS) {
        errors.push(makeError('V10', `phase[${i}] is in_progress during planning tier`, `execution.phases[${i}].status`));
      }
    }
  } else if (tier === PIPELINE_TIERS.REVIEW || tier === PIPELINE_TIERS.COMPLETE) {
    for (let i = 0; i < phases.length; i++) {
      const s = phases[i].status;
      if (s !== PHASE_STATUSES.COMPLETE && s !== PHASE_STATUSES.HALTED) {
        errors.push(makeError('V10', `phase[${i}] status '${s}' must be complete or halted during ${tier} tier`, `execution.phases[${i}].status`));
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

/** V14 — task stage transitions must follow allowed maps */
function checkV14(current, proposed) {
  const errors = [];
  const curPhases = current.execution.phases;
  const propPhases = proposed.execution.phases;
  const pLen = Math.min(curPhases.length, propPhases.length);
  for (let p = 0; p < pLen; p++) {
    const curTasks = curPhases[p].tasks;
    const propTasks = propPhases[p].tasks;
    const tLen = Math.min(curTasks.length, propTasks.length);
    for (let t = 0; t < tLen; t++) {
      const fromStage = curTasks[t].stage;
      const toStage = propTasks[t].stage;
      if (fromStage !== toStage) {
        const allowed = ALLOWED_TASK_STAGE_TRANSITIONS[fromStage];
        if (!allowed || !allowed.includes(toStage)) {
          errors.push(makeError('V14', `task[${p}][${t}] stage transition '${fromStage}' → '${toStage}' not allowed`, `execution.phases[${p}].tasks[${t}].stage`, fromStage, toStage));
        }
      }
    }
  }
  return errors;
}

/** V15 — phase stage transitions must follow allowed maps */
function checkV15(current, proposed) {
  const errors = [];
  const curPhases = current.execution.phases;
  const propPhases = proposed.execution.phases;
  const pLen = Math.min(curPhases.length, propPhases.length);
  for (let p = 0; p < pLen; p++) {
    const fromStage = curPhases[p].stage;
    const toStage = propPhases[p].stage;
    if (fromStage !== toStage) {
      const allowed = ALLOWED_PHASE_STAGE_TRANSITIONS[fromStage];
      if (!allowed || !allowed.includes(toStage)) {
        errors.push(makeError('V15', `phase[${p}] stage transition '${fromStage}' → '${toStage}' not allowed`, `execution.phases[${p}].stage`, fromStage, toStage));
      }
    }
  }
  return errors;
}

// ─── V16 — JSON Schema Validation ───────────────────────────────────────────

/**
 * Validate a value against a schema node, appending ValidationError entries to errors[].
 * This is a purpose-built validator for the patterns used in state-v4.schema.json only.
 * @param {Object} schema - JSON Schema node
 * @param {*} value - value to validate
 * @param {string} fieldPath - dotpath for error reporting
 * @param {ValidationError[]} errors - accumulator
 */
function validateNode(schema, value, fieldPath, errors) {
  if (value === undefined || value === null) {
    // null is only valid if explicitly allowed (oneOf with null type)
    // If no oneOf, and value is null, check type constraints below
    if (value === null) {
      // allow null to pass through — oneOf will handle nullable fields
      // top-level required check will catch missing keys
      if (schema.type && schema.type !== 'null') {
        // null where a concrete type is expected
        errors.push(makeError('V16', `field '${fieldPath}' expected type '${schema.type}' but got null`, fieldPath));
      }
      return;
    }
    return;
  }

  // Handle oneOf (used for nullable fields in state-v4.schema.json)
  if (schema.oneOf) {
    const matchesAny = schema.oneOf.some(sub => {
      const subErrors = [];
      validateNode(sub, value, fieldPath, subErrors);
      return subErrors.length === 0;
    });
    if (!matchesAny) {
      errors.push(makeError('V16', `field '${fieldPath}' does not match any oneOf alternative`, fieldPath));
    }
    return;
  }

  // Type check
  if (schema.type) {
    let typeOk = false;
    switch (schema.type) {
      case 'string':  typeOk = typeof value === 'string'; break;
      case 'boolean': typeOk = typeof value === 'boolean'; break;
      case 'integer': typeOk = typeof value === 'number' && Number.isInteger(value); break;
      case 'number':  typeOk = typeof value === 'number'; break;
      case 'object':  typeOk = value !== null && typeof value === 'object' && !Array.isArray(value); break;
      case 'array':   typeOk = Array.isArray(value); break;
      case 'null':    typeOk = value === null; break;
      default:        typeOk = true;
    }
    if (!typeOk) {
      const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      errors.push(makeError('V16', `field '${fieldPath}' expected type '${schema.type}' but got '${actual}'`, fieldPath));
      return; // no point checking further
    }
  }

  // const check
  if (schema.const !== undefined) {
    if (value !== schema.const) {
      errors.push(makeError('V16', `field '${fieldPath}' must equal '${schema.const}' but got '${value}'`, fieldPath));
    }
    return;
  }

  // enum check
  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      errors.push(makeError('V16', `field '${fieldPath}' value '${value}' not in enum [${schema.enum.join(', ')}]`, fieldPath));
    }
    return;
  }

  // minimum check (for integers)
  if (schema.minimum !== undefined && typeof value === 'number') {
    if (value < schema.minimum) {
      errors.push(makeError('V16', `field '${fieldPath}' value ${value} is less than minimum ${schema.minimum}`, fieldPath));
    }
  }

  // Object-specific checks
  if (schema.type === 'object' || schema.properties || schema.required) {
    // required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!(req in value)) {
          errors.push(makeError('V16', `field '${fieldPath}' is missing required property '${req}'`, `${fieldPath}.${req}`));
        }
      }
    }

    // additionalProperties: false
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          errors.push(makeError('V16', `field '${fieldPath}' has additional property '${key}' which is not allowed`, `${fieldPath}.${key}`));
        }
      }
    }

    // Recurse into properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in value) {
          const childPath = fieldPath ? `${fieldPath}.${propName}` : propName;
          validateNode(propSchema, value[propName], childPath, errors);
        }
      }
    }
  }

  // Array-specific checks
  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      validateNode(schema.items, value[i], `${fieldPath}[${i}]`, errors);
    }
  }
}

/** V16 — JSON Schema structural validation against state-v4.schema.json */
function checkV16(proposed) {
  const errors = [];
  validateNode(v4Schema, proposed, '', errors);
  return errors;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Validate a v4 state transition. Runs structural, gate, and transition guards.
 * Returns empty array if valid.
 *
 * @param {import('./constants.js').StateJson | null} current - state before mutation (null on init)
 * @param {import('./constants.js').StateJson} proposed - state after mutation
 * @param {import('./constants.js').Config} config - parsed orchestration config
 * @returns {ValidationError[]}
 */
function validateTransition(current, proposed, config) {
  const errors = [
    ...checkV1(proposed),
    ...checkV2(proposed),
    ...checkV5(proposed, config),
    ...checkV6(proposed),
    ...checkV7(proposed, config),
    ...checkV10(proposed),
    ...checkV16(proposed),
  ];
  if (current !== null) {
    errors.push(
      ...checkV11(current, proposed),
      ...checkV12(current, proposed),
      ...checkV13(current, proposed),
      ...checkV14(current, proposed),
      ...checkV15(current, proposed),
    );
  }
  return errors;
}

module.exports = { validateTransition };
