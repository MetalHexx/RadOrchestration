// ─── Enum Union Types ───────────────────────────────────────────────────────

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';

// v4: only 3 values — 'failed' and 'skipped' removed
export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete';

export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export type ExecutionStatus = 'not_started' | 'in_progress' | 'complete' | 'halted';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'halted';

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type TaskStage = 'planning' | 'coding' | 'reviewing' | 'complete' | 'failed';

export type PhaseStage = 'planning' | 'executing' | 'reviewing' | 'complete' | 'failed';

export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete';

export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';

export type GateMode = 'task' | 'phase' | 'autonomous';

export type TaskReviewAction = 'advanced' | 'corrective_task_issued' | 'halted';

export type PhaseReviewAction = 'advanced' | 'corrective_tasks_issued' | 'halted';

// ─── Planning Step Order ─────────────────────────────────────────────────────

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'master_plan'
] as const;

// ─── State Root ──────────────────────────────────────────────────────────────

export interface ProjectState {
  $schema: 'orchestration-state-v4';
  project: ProjectMeta;
  pipeline: Pipeline;
  planning: PlanningState;
  execution: ExecutionState;
  final_review: FinalReview;
}

// ─── Source Control ──────────────────────────────────────────────────────────

export interface SourceControl {
  branch: string;
  base_branch: string;
  worktree_path: string;
  auto_commit: 'always' | 'never';
  auto_pr: 'always' | 'never';
  remote_url?: string | null;
  compare_url?: string | null;
  pr_url?: string | null;
}

// ─── Top-Level Sections ──────────────────────────────────────────────────────

export interface ProjectMeta {
  name: string;
  created: string;    // ISO 8601
  updated: string;    // ISO 8601
}

export interface Pipeline {
  current_tier: PipelineTier;
  gate_mode: GateMode | null;         // null = fall back to global config
  source_control?: SourceControl;     // optional — absent on pre-feature state files
}

export interface PlanningState {
  status: PlanningStatus;
  human_approved: boolean;
  steps: PlanningStep[];
}

export interface PlanningStep {
  name: PlanningStepName;
  status: PlanningStepStatus;
  doc_path: string | null;
}

export interface ExecutionState {
  status: ExecutionStatus;
  current_phase: number;    // 1-based; 0 when no phases exist
  phases: Phase[];
}

export interface FinalReview {
  status: FinalReviewStatus;
  doc_path: string | null;
  human_approved: boolean;
}

// ─── Phase ───────────────────────────────────────────────────────────────────

export interface Phase {
  name: string;
  status: PhaseStatus;
  stage: PhaseStage;
  current_task: number;     // 1-based; 0 when no tasks exist
  tasks: Task[];
  docs: PhaseDocs;
  review: PhaseReviewResult;
}

export interface PhaseDocs {
  phase_plan: string | null;
  phase_report: string | null;
  phase_review: string | null;
}

export interface PhaseReviewResult {
  verdict: ReviewVerdict | null;
  action: PhaseReviewAction | null;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface Task {
  name: string;
  status: TaskStatus;
  stage: TaskStage;
  docs: TaskDocs;
  review: TaskReviewResult;
  retries: number;
  commit_hash?: string | null;   // null or missing for pre-feature state files
}

export interface TaskDocs {
  handoff: string | null;
  review: string | null;
}

export interface TaskReviewResult {
  verdict: ReviewVerdict | null;
  action: TaskReviewAction | null;
}

// ─── Gate Approval Types ─────────────────────────────────────────────────────

/** Whitelist of allowed gate events — prevents arbitrary event forwarding. */
export type GateEvent = 'plan_approved' | 'final_approved';

/** POST /api/projects/[name]/gate — request body. */
export interface GateApproveRequest {
  event: GateEvent;
}

/** POST /api/projects/[name]/gate — success response (HTTP 200). */
export interface GateApproveResponse {
  success: true;
  action: string;
  mutations_applied: string[];
}

/** POST /api/projects/[name]/gate — error response (HTTP 400/404/409/500). */
export interface GateErrorResponse {
  error: string;
  detail?: string;
}