import type { NodeKind, NodeStatus, GraphStatus, ConditionOperator } from './types.js';

// ── Node Kinds ────────────────────────────────────────────────────────────────
export const NODE_KINDS = Object.freeze({
  STEP: 'step',
  GATE: 'gate',
  FOR_EACH_PHASE: 'for_each_phase',
  FOR_EACH_TASK: 'for_each_task',
  CONDITIONAL: 'conditional',
  PARALLEL: 'parallel',
} as const) satisfies Record<string, NodeKind>;

// ── Node Statuses ─────────────────────────────────────────────────────────────
export const NODE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  HALTED: 'halted',
  SKIPPED: 'skipped',
} as const) satisfies Record<string, NodeStatus>;

// ── Graph Statuses ────────────────────────────────────────────────────────────
export const GRAPH_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  HALTED: 'halted',
} as const) satisfies Record<string, GraphStatus>;

// ── Condition Operators ───────────────────────────────────────────────────────
export const CONDITION_OPERATORS = Object.freeze({
  EQ: 'eq',
  NEQ: 'neq',
  IN: 'in',
  NOT_IN: 'not_in',
  TRUTHY: 'truthy',
  FALSY: 'falsy',
} as const) satisfies Record<string, ConditionOperator>;

// ── Next Actions ──────────────────────────────────────────────────────────────
export const NEXT_ACTIONS = Object.freeze({
  // Planning agent spawns
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  CREATE_REQUIREMENTS: 'create_requirements',
  CREATE_EXECUTION_PLAN: 'create_execution_plan',

  // Human gates
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  ASK_GATE_MODE: 'ask_gate_mode',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',

  // Execution agent spawns
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',

  // Source control
  INVOKE_SOURCE_CONTROL_COMMIT: 'invoke_source_control_commit',
  INVOKE_SOURCE_CONTROL_PR: 'invoke_source_control_pr',

  // Terminal states
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
} as const);

// ── Events ────────────────────────────────────────────────────────────────────
export const EVENTS = Object.freeze({
  // ── Planning step events ──────────────────────────────────────────────
  RESEARCH_STARTED: 'research_started',
  RESEARCH_COMPLETED: 'research_completed',
  PRD_STARTED: 'prd_started',
  PRD_COMPLETED: 'prd_completed',
  DESIGN_STARTED: 'design_started',
  DESIGN_COMPLETED: 'design_completed',
  ARCHITECTURE_STARTED: 'architecture_started',
  ARCHITECTURE_COMPLETED: 'architecture_completed',
  MASTER_PLAN_STARTED: 'master_plan_started',
  MASTER_PLAN_COMPLETED: 'master_plan_completed',
  REQUIREMENTS_STARTED: 'requirements_started',
  REQUIREMENTS_COMPLETED: 'requirements_completed',
  EXECUTION_PLAN_STARTED: 'execution_plan_started',
  EXECUTION_PLAN_COMPLETED: 'execution_plan_completed',

  // ── Gate approved events ──────────────────────────────────────────────
  PLAN_APPROVED: 'plan_approved',
  TASK_GATE_APPROVED: 'task_gate_approved',
  PHASE_GATE_APPROVED: 'phase_gate_approved',
  FINAL_APPROVED: 'final_approved',

  // ── Phase execution events ────────────────────────────────────────────
  PHASE_PLANNING_STARTED: 'phase_planning_started',
  PHASE_PLAN_CREATED: 'phase_plan_created',

  // ── Task execution events ─────────────────────────────────────────────
  TASK_HANDOFF_STARTED: 'task_handoff_started',
  TASK_HANDOFF_CREATED: 'task_handoff_created',
  EXECUTION_STARTED: 'execution_started',
  TASK_COMPLETED: 'task_completed',
  CODE_REVIEW_STARTED: 'code_review_started',
  CODE_REVIEW_COMPLETED: 'code_review_completed',

  // ── Phase review events ───────────────────────────────────────────────
  PHASE_REPORT_STARTED: 'phase_report_started',
  PHASE_REPORT_CREATED: 'phase_report_created',
  PHASE_REVIEW_STARTED: 'phase_review_started',
  PHASE_REVIEW_COMPLETED: 'phase_review_completed',

  // ── Final review events ───────────────────────────────────────────────
  FINAL_REVIEW_STARTED: 'final_review_started',
  FINAL_REVIEW_COMPLETED: 'final_review_completed',

  // ── Source control events ─────────────────────────────────────────────
  COMMIT_STARTED: 'commit_started',
  COMMIT_COMPLETED: 'commit_completed',
  PR_REQUESTED: 'pr_requested',
  PR_CREATED: 'pr_created',

  // ── Out-of-band events ────────────────────────────────────────────────
  PLAN_REJECTED: 'plan_rejected',
  GATE_REJECTED: 'gate_rejected',
  FINAL_REJECTED: 'final_rejected',
  HALT: 'halt',
  GATE_MODE_SET: 'gate_mode_set',
  SOURCE_CONTROL_INIT: 'source_control_init',
} as const);

export const OUT_OF_BAND_EVENTS = new Set<string>([
  'plan_rejected',
  'gate_rejected',
  'final_rejected',
  'halt',
  'gate_mode_set',
  'source_control_init',
]);

export const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
} as const);

export const VALID_VERDICTS = new Set<string>(Object.values(REVIEW_VERDICTS));

export const ALLOWED_NODE_TRANSITIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['not_started', new Set(['in_progress', 'skipped', 'completed'])],
  ['in_progress', new Set(['completed', 'failed', 'halted'])],
  ['completed',   new Set(['not_started', 'in_progress'])],
  ['failed',      new Set(['in_progress'])],
  ['halted',      new Set([])],
  ['skipped',     new Set([])],
]);
