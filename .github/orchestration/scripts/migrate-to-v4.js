'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA_VERSION } = require('./lib/constants.js');
const { validateTransition } = require('./lib/validator.js');

// ─── Default Config for Validation ──────────────────────────────────────────

const DEFAULT_CONFIG = {
  projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
};

// ─── Version Detection ───────────────────────────────────────────────────────

/**
 * Detect schema version from the $schema field.
 * @param {Object} rawState - parsed state.json (any version)
 * @returns {1 | 2 | 3}
 * @throws {Error} on unknown or missing $schema
 */
function detectVersion(rawState) {
  switch (rawState.$schema) {
    case 'orchestration-state-v1': return 1;
    case 'orchestration-state-v2': return 2;
    case 'orchestration-state-v3': return 3;
    default:
      throw new Error(`Unknown or missing $schema: ${rawState.$schema}`);
  }
}

// ─── Index Conversion ────────────────────────────────────────────────────────

/**
 * Convert a 0-based index to 1-based, handling edge cases.
 * @param {number} zeroBasedIndex
 * @param {number} arrayLength
 * @returns {number}
 */
function convertIndex(zeroBasedIndex, arrayLength) {
  if (arrayLength === 0) return 0;
  return Math.min(zeroBasedIndex + 1, arrayLength);
}

// ─── Planning Steps Conversion ───────────────────────────────────────────────

/**
 * Convert planning steps from Record (v1/v2) or Array (v3) to v4 Array format.
 * @param {Object|Array} steps
 * @returns {Array}
 */
function convertPlanningSteps(steps) {
  if (Array.isArray(steps)) {
    // v3: already an array — copy keeping only name, status, doc_path
    return steps.map(item => ({
      name: item.name,
      status: item.status,
      doc_path: item.doc_path,
    }));
  }

  // v1/v2: Record/Object — iterate in fixed order
  const ORDER = ['research', 'prd', 'design', 'architecture', 'master_plan'];
  return ORDER.map(key => {
    const entry = steps[key] || {};
    const status = entry.status === 'skipped' ? 'complete' : (entry.status || 'not_started');
    return {
      name: key,
      status,
      doc_path: entry.output !== undefined ? entry.output : null,
    };
  });
}

// ─── Action Value Normalization ──────────────────────────────────────────────

/**
 * Normalize legacy task review.action values to v4 enum values.
 * Old values: "advance" / "proceed" -> "advanced"
 * @param {string|null|undefined} action
 * @returns {'advanced'|'corrective_task_issued'|'halted'|null}
 */
function normalizeTaskAction(action) {
  if (action == null) return null;
  if (action === 'advance' || action === 'proceed') return 'advanced';
  if (action === 'advanced' || action === 'corrective_task_issued' || action === 'halted') return action;
  return null;
}

/**
 * Normalize legacy phase review.action values to v4 enum values.
 * Old values: "advance" / "proceed" -> "advanced"
 * @param {string|null|undefined} action
 * @returns {'advanced'|'corrective_tasks_issued'|'halted'|null}
 */
function normalizePhaseAction(action) {
  if (action == null) return null;
  if (action === 'advance' || action === 'proceed') return 'advanced';
  if (action === 'advanced' || action === 'corrective_tasks_issued' || action === 'halted') return action;
  return null;
}

// ─── Stage Inference ─────────────────────────────────────────────────────────

/**
 * Infer v4 task stage from pre-v4 status + doc paths.
 * Called on field-normalized intermediate (flat handoff_doc, report_doc, etc.).
 * @param {Object} task - task with flat field names
 * @returns {'planning'|'coding'|'reporting'|'reviewing'|'complete'|'failed'}
 */
function inferTaskStage(task) {
  if (task.status === 'halted') return 'failed';
  if (task.status === 'failed') return 'failed';
  if (task.status === 'complete' && task.review_action === 'advanced') return 'complete';
  if (task.status === 'complete' && !task.review_doc) return 'reviewing';
  if (task.status === 'in_progress' && task.handoff_doc && !task.report_doc) return 'coding';
  if (task.status === 'in_progress' && task.report_doc) return 'reviewing';
  if (task.status === 'not_started') return 'planning';
  return 'planning'; // safe fallback
}

/**
 * Infer v4 phase stage from pre-v4 status + doc paths.
 * Called on field-normalized intermediate (flat phase_plan_doc, etc.).
 * @param {Object} phase - phase with flat field names
 * @returns {'planning'|'executing'|'reporting'|'reviewing'|'complete'|'failed'}
 */
function inferPhaseStage(phase) {
  if (phase.status === 'halted') return 'failed';
  if (phase.status === 'complete') return 'complete';
  if (phase.status === 'in_progress' && phase.phase_review_doc) return 'reviewing';
  if (phase.status === 'in_progress' && phase.phase_report_doc) return 'reviewing';
  if (phase.status === 'in_progress' && phase.phase_plan_doc) return 'executing';
  if (phase.status === 'not_started') return 'planning';
  return 'planning'; // safe fallback
}

// ─── Task Migration ──────────────────────────────────────────────────────────

/**
 * Migrate a single task to v4 format.
 * @param {Object} rawTask - raw task from any version
 * @returns {Object} v4 task
 */
function migrateTask(rawTask) {
  // Normalize name (v1 may use 'name', v2 uses 'title', v3 uses 'name')
  const name = rawTask.name || rawTask.title || '';

  // Normalize flat doc fields
  const handoff_doc = rawTask.handoff_doc != null ? rawTask.handoff_doc : null;
  const report_doc = rawTask.report_doc != null ? rawTask.report_doc : null;
  const review_doc = rawTask.review_doc != null ? rawTask.review_doc : null;
  const review_verdict = rawTask.review_verdict != null ? rawTask.review_verdict : null;
  const review_action = normalizeTaskAction(rawTask.review_action);

  // Build flat intermediate for stage inference
  const flat = {
    status: rawTask.status,
    handoff_doc,
    report_doc,
    review_doc,
    review_action,
  };

  return {
    name,
    status: rawTask.status,
    stage: inferTaskStage(flat),
    docs: {
      handoff: handoff_doc,
      report: report_doc,
      review: review_doc,
    },
    review: {
      verdict: review_verdict,
      action: review_action,
    },
    report_status: rawTask.report_status !== undefined ? rawTask.report_status : null,
    has_deviations: rawTask.has_deviations !== undefined ? rawTask.has_deviations : false,
    deviation_type: rawTask.deviation_type !== undefined ? rawTask.deviation_type : null,
    retries: rawTask.retries !== undefined ? rawTask.retries : 0,
  };
}

// ─── Phase Migration ─────────────────────────────────────────────────────────

/**
 * Migrate a single phase to v4 format.
 * @param {Object} rawPhase - raw phase from any version
 * @param {1|2|3} version
 * @returns {Object} v4 phase
 */
function migratePhase(rawPhase, version) {
  // Normalize name (v1 may use 'name' or 'title', v2 uses 'title', v3 uses 'name')
  const name = rawPhase.name || rawPhase.title || '';

  // Normalize phase doc fields based on version
  let phase_plan_doc, phase_report_doc, phase_review_doc, phase_review_verdict, phase_review_action;

  if (version === 3) {
    phase_plan_doc = rawPhase.phase_plan_doc != null ? rawPhase.phase_plan_doc : null;
    phase_report_doc = rawPhase.phase_report_doc != null ? rawPhase.phase_report_doc : null;
    phase_review_doc = rawPhase.phase_review_doc != null ? rawPhase.phase_review_doc : null;
    phase_review_verdict = rawPhase.phase_review_verdict != null ? rawPhase.phase_review_verdict : null;
    phase_review_action = normalizePhaseAction(rawPhase.phase_review_action);

  } else {
    // v1/v2: plan_doc or phase_doc → phase_plan; phase_report (no _doc suffix); no review fields in v1
    phase_plan_doc = rawPhase.plan_doc != null ? rawPhase.plan_doc
      : rawPhase.phase_doc != null ? rawPhase.phase_doc : null;
    phase_report_doc = rawPhase.phase_report != null ? rawPhase.phase_report : null;
    phase_review_doc = rawPhase.phase_review != null ? rawPhase.phase_review : null;
    phase_review_verdict = rawPhase.phase_review_verdict != null ? rawPhase.phase_review_verdict : null;
    phase_review_action = normalizePhaseAction(rawPhase.phase_review_action);
  }

  // Migrate all tasks
  const tasks = (rawPhase.tasks || []).map(migrateTask);

  // Build flat intermediate for stage inference
  const flat = {
    status: rawPhase.status,
    phase_plan_doc,
    phase_report_doc,
    phase_review_doc,
  };

  return {
    name,
    status: rawPhase.status,
    stage: inferPhaseStage(flat),
    current_task: convertIndex(rawPhase.current_task != null ? rawPhase.current_task : 0, tasks.length),
    tasks,
    docs: {
      phase_plan: phase_plan_doc,
      phase_report: phase_report_doc,
      phase_review: phase_review_doc,
    },
    review: {
      verdict: phase_review_verdict,
      action: phase_review_action,
    },
  };
}

// ─── Full State Migration ─────────────────────────────────────────────────────

/**
 * Migrate a state.json from v1, v2, or v3 to v4.
 * @param {Object} rawState - parsed state.json (any version)
 * @param {1 | 2 | 3} version - detected schema version
 * @returns {Object} valid v4 state object
 */
function migrateToV4(rawState, version) {
  // Build pipeline section — current_tier is in different locations per version
  let current_tier;
  if (version === 3) {
    current_tier = rawState.execution.current_tier;
  } else {
    // v1/v2: top-level pipeline section
    current_tier = rawState.pipeline.current_tier;
  }

  // Convert planning steps
  const planningSteps = convertPlanningSteps(rawState.planning.steps);

  // Migrate execution phases
  const rawExecution = rawState.execution;
  const rawPhases = rawExecution.phases || [];
  const phases = rawPhases.map(p => migratePhase(p, version));

  // Build final_review section
  let finalReview;
  if (version === 3) {
    // v3: final_review fields are scattered under execution
    finalReview = {
      status: rawExecution.final_review_status || 'not_started',
      doc_path: rawExecution.final_review_doc != null ? rawExecution.final_review_doc : null,
      human_approved: rawExecution.final_review_approved || false,
    };
  } else {
    // v1/v2: top-level final_review section; rename report_doc → doc_path
    const rawFinalReview = rawState.final_review || {};
    finalReview = {
      status: rawFinalReview.status || 'not_started',
      doc_path: rawFinalReview.report_doc !== undefined ? rawFinalReview.report_doc : null,
      human_approved: rawFinalReview.human_approved || false,
    };
  }

  return {
    $schema: SCHEMA_VERSION,
    project: {
      name: rawState.project.name,
      created: rawState.project.created,
      updated: rawState.project.updated,
    },
    pipeline: {
      current_tier,
    },
    planning: {
      status: rawState.planning.status,
      human_approved: rawState.planning.human_approved || false,
      steps: planningSteps,
    },
    execution: {
      status: rawExecution.status,
      current_phase: convertIndex(rawExecution.current_phase != null ? rawExecution.current_phase : 0, phases.length),
      phases,
    },
    final_review: finalReview,
  };
}

// ─── Project Migration ────────────────────────────────────────────────────────

/**
 * Run migration on a single project directory.
 * Backs up original as state.{version}.json.bak, validates and writes v4 output.
 * @param {string} projectDir - absolute path to project directory
 * @returns {{ success: boolean, backed_up: string|null, errors: string[] }}
 */
function migrateProject(projectDir) {
  const stateFile = path.join(projectDir, 'state.json');
  let rawState;

  try {
    const content = fs.readFileSync(stateFile, 'utf8');
    rawState = JSON.parse(content);
  } catch (err) {
    return { success: false, backed_up: null, errors: [`Failed to read state.json: ${err.message}`] };
  }

  let version;
  try {
    version = detectVersion(rawState);
  } catch (err) {
    return { success: false, backed_up: null, errors: [`Failed to detect version: ${err.message}`] };
  }

  let migrated;
  try {
    migrated = migrateToV4(rawState, version);
  } catch (err) {
    return { success: false, backed_up: null, errors: [`Migration failed: ${err.message}`] };
  }

  const validationErrors = validateTransition(null, migrated, DEFAULT_CONFIG);
  if (validationErrors.length > 0) {
    return {
      success: false,
      backed_up: null,
      errors: validationErrors.map(e => `[${e.invariant}] ${e.field}: ${e.message}`),
    };
  }

  // Backup original before writing
  const backupFile = path.join(projectDir, `state.${version}.json.bak`);
  try {
    fs.copyFileSync(stateFile, backupFile);
  } catch (err) {
    return { success: false, backed_up: null, errors: [`Failed to create backup: ${err.message}`] };
  }

  // Write migrated state
  try {
    fs.writeFileSync(stateFile, JSON.stringify(migrated, null, 2), 'utf8');
  } catch (err) {
    return { success: false, backed_up: backupFile, errors: [`Failed to write migrated state: ${err.message}`] };
  }

  return { success: true, backed_up: backupFile, errors: [] };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0]) {
    const projectDir = path.resolve(argv[0]);
    console.log(`Migrating project at: ${projectDir}`);
    const result = migrateProject(projectDir);
    if (result.success) {
      console.log(`Migration successful. Backup: ${result.backed_up}`);
    } else {
      console.error('Migration failed:');
      result.errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
  } else {
    console.log('Usage: node migrate-to-v4.js <project-dir>');
    console.log('  <project-dir>  Absolute path to project directory containing state.json');
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  detectVersion,
  migrateToV4,
  inferTaskStage,
  inferPhaseStage,
  migrateProject,
};
