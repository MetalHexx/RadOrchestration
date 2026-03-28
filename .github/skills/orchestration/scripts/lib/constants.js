'use strict';

const SCHEMA_VERSION = 'orchestration-state-v4';

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
  ASK_GATE_MODE: 'ask_gate_mode',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
  INVOKE_SOURCE_CONTROL_COMMIT: 'invoke_source_control_commit',
});

// ─── Stage Enums (v4) ──────────────────────────────────────────────────────

const TASK_STAGES = Object.freeze({
  PLANNING:  'planning',
  CODING:    'coding',
  REPORTING: 'reporting',
  REVIEWING: 'reviewing',
  COMPLETE:  'complete',
  FAILED:    'failed',
});

const PHASE_STAGES = Object.freeze({
  PLANNING:  'planning',
  EXECUTING: 'executing',
  REPORTING: 'reporting',
  REVIEWING: 'reviewing',
  COMPLETE:  'complete',
  FAILED:    'failed',
});

// ─── Stage Transition Maps (v4) ────────────────────────────────────────────

const ALLOWED_TASK_STAGE_TRANSITIONS = Object.freeze({
  'planning':  ['coding'],
  'coding':    ['reviewing'],
  'reviewing': ['complete', 'failed'],
  'complete':  [],
  'failed':    ['coding'],       // corrective re-entry (skips planning)
});

const ALLOWED_PHASE_STAGE_TRANSITIONS = Object.freeze({
  'planning':  ['executing'],
  'executing': ['reviewing'],
  'reviewing': ['complete', 'failed'],
  'complete':  [],
  'failed':    ['executing'],   // corrective tasks re-enter execution
});

// ─── Status Transition Maps ────────────────────────────────────────────────

// UPDATED — 'complete' is now truly terminal (was ['failed', 'halted'] in v3)
const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    [],              // CHANGED from v3: truly terminal
  'halted':      [],
});

// UNCHANGED from v3
const ALLOWED_PHASE_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'halted'],
  'complete':    [],
  'halted':      [],
});

// ─── JSDoc Typedefs ─────────────────────────────────────────────────────────

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
 * v4 State — root object.
 * Top-level sections: project, pipeline, planning, execution, final_review.
 * No total_phases, total_tasks, or current_step fields.
 * current_phase and current_task are 1-based (0 = no item active).
 *
 * @typedef {Object} StateJson
 * @property {'orchestration-state-v4'} $schema
 * @property {ProjectMeta} project
 * @property {Pipeline} pipeline
 * @property {Planning} planning
 * @property {Execution} execution
 * @property {FinalReview} final_review
 */

/**
 * @typedef {Object} ProjectMeta
 * @property {string} name
 * @property {string} created - ISO 8601
 * @property {string} updated - ISO 8601
 */

/**
 * Top-level pipeline section. Contains current_tier (promoted from execution in v3).
 * @typedef {Object} Pipeline
 * @property {string} current_tier - one of PIPELINE_TIERS
 */

/**
 * No current_step field (removed — dead field in v3; never updated).
 * @typedef {Object} Planning
 * @property {string} status - one of PLANNING_STATUSES
 * @property {boolean} human_approved
 * @property {PlanningStep[]} steps
 */

/**
 * @typedef {Object} PlanningStep
 * @property {string} name - one of: 'research', 'prd', 'design', 'architecture', 'master_plan'
 * @property {string} status - one of PLANNING_STEP_STATUSES
 * @property {string | null} doc_path
 */

/**
 * No current_tier (promoted to pipeline section) or total_phases (derivable from phases.length).
 * current_phase is 1-based; 0 when no phases exist.
 * @typedef {Object} Execution
 * @property {string} status - one of: 'not_started', 'in_progress', 'complete', 'halted'
 * @property {number} current_phase - 1-based; 0 when no phases exist
 * @property {Phase[]} phases
 */

/**
 * Phase object with stage field and nested docs/review objects.
 * No total_tasks (derivable from tasks.length). current_task is 1-based; 0 when no tasks exist.
 * @typedef {Object} Phase
 * @property {string} name
 * @property {string} status - one of PHASE_STATUSES
 * @property {string} stage - one of PHASE_STAGES: 'planning', 'executing', 'reporting', 'reviewing', 'complete', 'failed'
 * @property {number} current_task - 1-based; 0 when no tasks exist
 * @property {Task[]} tasks
 * @property {PhaseDocs} docs
 * @property {PhaseReviewResult} review
 */

/**
 * Grouped phase document paths (was flat on Phase in v3).
 * @typedef {Object} PhaseDocs
 * @property {string | null} phase_plan
 * @property {string | null} phase_report
 * @property {string | null} phase_review
 */

/**
 * Grouped phase review result (was flat on Phase in v3).
 * @typedef {Object} PhaseReviewResult
 * @property {string | null} verdict - one of REVIEW_VERDICTS or null
 * @property {string | null} action - one of PHASE_REVIEW_ACTIONS or null
 */

/**
 * Task object with stage field and nested docs/review objects.
 * @typedef {Object} Task
 * @property {string} name
 * @property {string} status - one of TASK_STATUSES
 * @property {string} stage - one of TASK_STAGES: 'planning', 'coding', 'reporting', 'reviewing', 'complete', 'failed'
 * @property {TaskDocs} docs
 * @property {TaskReviewResult} review
 * @property {'complete' | 'failed' | null} report_status
 * @property {boolean} has_deviations
 * @property {string | null} deviation_type
 * @property {number} retries
 */

/**
 * Grouped task document paths (was flat on Task in v3).
 * @typedef {Object} TaskDocs
 * @property {string | null} handoff
 * @property {string | null} report
 * @property {string | null} review
 */

/**
 * Grouped task review result (was flat on Task in v3).
 * @typedef {Object} TaskReviewResult
 * @property {string | null} verdict - one of REVIEW_VERDICTS or null
 * @property {string | null} action - one of REVIEW_ACTIONS or null
 */

/**
 * Top-level final review section (promoted from execution.* fields in v3).
 * @typedef {Object} FinalReview
 * @property {string} status - one of: 'not_started', 'in_progress', 'complete'
 * @property {string | null} doc_path
 * @property {boolean} human_approved
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
  TASK_STAGES,
  PHASE_STAGES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS,
  HUMAN_GATE_MODES,
  NEXT_ACTIONS,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
  ALLOWED_TASK_STAGE_TRANSITIONS,
  ALLOWED_PHASE_STAGE_TRANSITIONS,
};
