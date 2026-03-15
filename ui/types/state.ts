// ─── Enum Union Types ───────────────────────────────────────────────────────
// Ported from src/lib/constants.js frozen enum objects

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';

export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'skipped';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';

export type TaskReviewAction = 'advanced' | 'corrective_task_issued' | 'halted';

export type PhaseReviewAction = 'advanced' | 'corrective_tasks_issued' | 'halted';

export type Severity = 'minor' | 'critical';

export type HumanGateMode = 'ask' | 'phase' | 'task' | 'autonomous';

export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';

// ─── Planning Step Names ────────────────────────────────────────────────────

export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'master_plan'
] as const;

// ─── Raw State Types (as read from disk) ────────────────────────────────────
// Supports both v1 and v2 schemas

export interface RawStateJson {
  $schema?: string;
  project: {
    name: string;
    description?: string;       // v2 only
    created: string;            // ISO 8601
    updated: string;            // ISO 8601
    brainstorming_doc?: string; // v2 only
  };
  pipeline?: {                  // optional in v3 (tier moved to execution)
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, {
      status: PlanningStepStatus;
      output: string | null;
    }> | Array<{ name: string; status: PlanningStepStatus; doc_path: string | null }>; // v3 array format
    human_approved: boolean;
    current_step?: string;      // v3 only
  };
  execution: {
    status: 'not_started' | 'in_progress' | 'complete' | 'halted';
    current_tier?: PipelineTier; // v3: tier moved here from pipeline
    current_phase: number;
    total_phases: number;
    phases: RawPhase[];
  };
  final_review?: {              // optional in v3
    status: FinalReviewStatus;
    report_doc: string | null;
    human_approved: boolean;
  };
  errors?: {                    // optional in v3
    total_retries: number;
    total_halts: number;
    active_blockers: string[];
  };
  limits?: {                    // optional in v3
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
  };
}

export interface RawPhase {
  phase_number?: number;            // optional in v3 (not present)
  title?: string;                   // v2
  name?: string;                    // v1 and v3
  status: PhaseStatus;
  phase_doc?: string | null;        // v2
  plan_doc?: string | null;         // v1
  phase_plan_doc?: string | null;   // v3
  current_task: number;
  total_tasks: number;
  tasks: RawTask[];
  phase_report?: string | null;     // v2
  phase_report_doc?: string | null; // v3
  human_approved?: boolean;         // optional in v3 (not present)
  phase_review?: string | null;     // v2
  phase_review_doc?: string | null; // v3
  phase_review_verdict?: ReviewVerdict | null;
  phase_review_action?: PhaseReviewAction | null;
}

export interface RawTask {
  task_number: number;
  title?: string;               // v2
  name?: string;                // v1
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc?: string | null;
  review_verdict?: ReviewVerdict | null;
  review_action?: TaskReviewAction | null;
}

// ─── Normalized Types (consumed by all UI components) ───────────────────────
// v1 fields are mapped to v2 field names; absent fields default to null

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: {
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: NormalizedFinalReview;
  errors: NormalizedErrors;
  limits: NormalizedLimits;
}

export interface NormalizedProjectMeta {
  name: string;
  description: string | null;
  created: string;
  updated: string;
  brainstorming_doc: string | null;
}

export interface NormalizedPlanning {
  status: PlanningStatus;
  steps: Record<PlanningStepName, {
    status: PlanningStepStatus;
    output: string | null;
  }>;
  human_approved: boolean;
}

export interface NormalizedExecution {
  status: 'not_started' | 'in_progress' | 'complete' | 'halted';
  current_phase: number;
  total_phases: number;
  phases: NormalizedPhase[];
}

export interface NormalizedPhase {
  phase_number: number;
  title: string;
  status: PhaseStatus;
  phase_doc: string | null;
  current_task: number;
  total_tasks: number;
  tasks: NormalizedTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review: string | null;
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: PhaseReviewAction | null;
}

export interface NormalizedTask {
  task_number: number;
  title: string;
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc: string | null;
  review_verdict: ReviewVerdict | null;
  review_action: TaskReviewAction | null;
}

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;
  human_approved: boolean;
}

export interface NormalizedErrors {
  total_retries: number;
  total_halts: number;
  active_blockers: string[];
}

export interface NormalizedLimits {
  max_phases: number;
  max_tasks_per_phase: number;
  max_retries_per_task: number;
}
