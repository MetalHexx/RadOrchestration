'use strict';

const SCHEMA_VERSION = 'orchestration-state-v3';

// ─── Frozen Enums ───────────────────────────────────────────────────────────

const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const PLANNING_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted',
});

const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted',
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted',
});

const SEVERITY_LEVELS = Object.freeze({
  CRITICAL: 'critical',
  MINOR: 'minor',
});

const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask',
  PHASE: 'phase',
  TASK: 'task',
  AUTONOMOUS: 'autonomous',
});

const NEXT_ACTIONS = Object.freeze({
  // Planning (6)
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
});

const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    ['failed', 'halted'],
  'halted':      [],
});

const ALLOWED_PHASE_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'halted'],
  'complete':    [],
  'halted':      [],
});

/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS values when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error info on failure
 * @property {string[]} mutations_applied - human-readable mutation descriptions; empty on failure
 */

/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => StateJson | null} readState
 * @property {(projectDir: string, state: StateJson) => void} writeState
 * @property {(configPath?: string) => Config} readConfig
 * @property {(docPath: string) => ParsedDocument | null} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */

/**
 * @typedef {Object} ParsedDocument
 * @property {Object | null} frontmatter
 * @property {string} body
 */

/**
 * @typedef {Object} StateJson
 * @property {'orchestration-state-v3'} $schema
 * @property {ProjectMeta} project
 * @property {Planning} planning
 * @property {Execution} execution
 */

/**
 * @typedef {Object} ProjectMeta
 * @property {string} name
 * @property {string} created
 * @property {string} updated
 */

/**
 * @typedef {Object} Planning
 * @property {string} status - one of PLANNING_STATUSES
 * @property {boolean} human_approved
 * @property {PlanningStep[]} steps
 * @property {string} current_step
 */

/**
 * @typedef {Object} PlanningStep
 * @property {string} name
 * @property {string} status - one of PLANNING_STEP_STATUSES
 * @property {string | null} doc_path
 */

/**
 * @typedef {Object} Execution
 * @property {string} status - one of PHASE_STATUSES or 'not_started' | 'complete'
 * @property {string} current_tier - one of PIPELINE_TIERS
 * @property {number} current_phase - 0-indexed
 * @property {number} total_phases
 * @property {Phase[]} phases
 */

/**
 * @typedef {Object} Phase
 * @property {string} name
 * @property {string} status - one of PHASE_STATUSES
 * @property {number} current_task - 0-indexed
 * @property {number} total_tasks
 * @property {Task[]} tasks
 * @property {string | null} phase_plan_doc
 * @property {string | null} phase_report_doc
 * @property {string | null} phase_review_doc
 * @property {string | null} phase_review_verdict
 * @property {string | null} phase_review_action
 */

/**
 * @typedef {Object} Task
 * @property {string} name
 * @property {string} status - one of TASK_STATUSES
 * @property {string | null} handoff_doc
 * @property {string | null} report_doc
 * @property {string | null} review_doc
 * @property {string | null} review_verdict
 * @property {string | null} review_action
 * @property {boolean} has_deviations
 * @property {string | null} deviation_type
 * @property {number} retries
 */

/**
 * @typedef {Object} Config
 * @property {Object} limits
 * @property {number} limits.max_phases
 * @property {number} limits.max_tasks_per_phase
 * @property {number} limits.max_retries_per_task
 * @property {Object} human_gates
 * @property {string} human_gates.execution_mode - one of HUMAN_GATE_MODES
 * @property {boolean} human_gates.after_final_review
 */

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  SCHEMA_VERSION,
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  PHASE_STATUSES,
  TASK_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS,
  HUMAN_GATE_MODES,
  NEXT_ACTIONS,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
};
