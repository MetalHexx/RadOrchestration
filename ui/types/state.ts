// ─── Enum Union Types ───────────────────────────────────────────────────────

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';

export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete';

export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'requirements' | 'master_plan' | 'explode_master_plan';

export type ExecutionStatus = 'not_started' | 'in_progress' | 'complete' | 'halted';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'halted';

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type TaskStage = 'planning' | 'coding' | 'reviewing' | 'complete' | 'failed';

export type PhaseStage = 'planning' | 'executing' | 'reviewing' | 'complete' | 'failed';

export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete';

export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';

export type TaskReviewAction = 'advanced' | 'corrective_task_issued' | 'halted';

export type PhaseReviewAction = 'advanced' | 'corrective_tasks_issued' | 'halted';

// ─── Planning Step Order ─────────────────────────────────────────────────────

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'requirements', 'master_plan', 'explode_master_plan'
] as const;

export const NODE_ID_PHASE_LOOP = 'phase_loop';
export const NODE_ID_FINAL_REVIEW = 'final_review';

// ─── State-embedded Config (snapshot) ────────────────────────────────────────

export interface StateConfigLimits {
  max_phases: number;
  max_tasks_per_phase: number;
  max_retries_per_task: number;
  max_consecutive_review_rejections: number;
}

// ─── Restored production types (consumed by the MainDashboard sub-tree) ───────
// These types are still imported by active production components and API routes
// (the MainDashboard sub-tree, the API event route). They were removed during the
// v5/v6 migration but their consumers were not, breaking the production build, so
// they are restored here so every `@/types/state` import resolves again.
//
// `ProjectState` and `GateMode` are restored as ALIASES to their current v5
// equivalents rather than as the original v4 definitions: re-introducing the literal
// v4 `ProjectState` interface would re-add its retired v4 schema-version string, which
// the FR-20 regression test `lib/v4-absent.test.ts` asserts must be gone (it scans
// this file's text for that literal). The remaining types (SourceControl, PlanningState, PlanningStep,
// ExecutionState, FinalReview, Phase, Task, and their nested doc/review types) have
// no clean current equivalent and carry no v4 schema literal, so they are restored
// verbatim from the pre-deletion version (commit 63820b20).

export type GateMode = V5GateMode;

export type ProjectState = ProjectStateV5;

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

export interface Task {
  name: string;
  status: TaskStatus;
  stage: TaskStage;
  docs: TaskDocs;
  review: TaskReviewResult;
  retries: number;
  commit_hash?: string | null;   // null or missing for pre-feature state files
  repos?: RepoCommitEntry[];     // multi-repo commit entries; absent on pre-feature state files
}

export interface TaskDocs {
  handoff: string | null;
  review: string | null;
}

export interface TaskReviewResult {
  verdict: ReviewVerdict | null;
  action: TaskReviewAction | null;
}

// ─── Top-Level Sections ──────────────────────────────────────────────────────

export interface ProjectMeta {
  name: string;
  created: string;    // ISO 8601
  updated: string;    // ISO 8601
}

// ─── Repo Commit Entry (shared by IterationEntry, CorrectiveTaskEntry) ──────

export interface RepoCommitEntry {
  name: string;
  commit_hash: string | null;
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
}

/** POST /api/projects/[name]/gate — error response (HTTP 400/404/409/500). */
export interface GateErrorResponse {
  error: string;
  detail?: string;
}

// ─── v5 Enum Union Types ─────────────────────────────────────────────────────

export type NodeKind = 'step' | 'gate' | 'conditional' | 'parallel' | 'for_each_phase' | 'for_each_task';

export type NodeStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'halted' | 'skipped';

export type GraphStatus = 'not_started' | 'in_progress' | 'completed' | 'halted';

/**
 * Config-time gate mode. Includes `'ask'` which means "prompt the operator to
 * choose a concrete mode before execution begins." Stored in `config.gate_mode`.
 */
export type V5GateMode = 'ask' | 'task' | 'phase' | 'autonomous';

export type V5AutoCommit = 'ask' | 'always' | 'never';

export type V5AutoPR = 'ask' | 'always' | 'never';

/** v5 pipeline tier — note: no 'complete' value; use graph.status === 'completed' instead */
export type V5PipelineTier = 'planning' | 'execution' | 'review' | 'halted';

// ─── v5 Node State Variants ──────────────────────────────────────────────────

export interface StepNodeState {
  kind: 'step';
  status: NodeStatus;
  doc_path: string | null;
  retries: number;
  verdict?: string | null;
}

export interface GateNodeState {
  kind: 'gate';
  status: NodeStatus;
  gate_active: boolean;
}

export interface ConditionalNodeState {
  kind: 'conditional';
  status: NodeStatus;
  branch_taken: 'true' | 'false' | null;
}

/** Discriminated union of all v5 node state variants */
export type NodeState =
  | StepNodeState
  | GateNodeState
  | ConditionalNodeState
  | ParallelNodeState
  | ForEachPhaseNodeState
  | ForEachTaskNodeState;

/** Map of node IDs to their state */
export type NodesRecord = Record<string, NodeState>;

export interface ParallelNodeState {
  kind: 'parallel';
  status: NodeStatus;
  nodes: NodesRecord;
}

export interface ForEachPhaseNodeState {
  kind: 'for_each_phase';
  status: NodeStatus;
  iterations: IterationEntry[];
}

export interface ForEachTaskNodeState {
  kind: 'for_each_task';
  status: NodeStatus;
  iterations: IterationEntry[];
}

// ─── v5 Iteration & Corrective Task ──────────────────────────────────────────

export interface IterationEntry {
  index: number;                          // 0-based
  status: NodeStatus;
  nodes: NodesRecord;
  corrective_tasks: CorrectiveTaskEntry[];
  doc_path?: string | null;
  repos: RepoCommitEntry[];
}

export interface CorrectiveTaskEntry {
  index: number;                          // 1-based
  reason: string;
  injected_after: string;
  status: NodeStatus;
  nodes: NodesRecord;
  doc_path?: string | null;
  repos: RepoCommitEntry[];
}

// ─── v5 Source Control ───────────────────────────────────────────────────────

export interface V5SourceControlState {
  branch: string;
  base_branch: string;
  worktree_path: string;
  auto_commit: V5AutoCommit;
  auto_pr: V5AutoPR;
  remote_url: string | null;
  compare_url: string | null;
  pr_url: string | null;
}

// ─── v5 Sections ─────────────────────────────────────────────────────────────

export interface V5Config {
  gate_mode: V5GateMode;
  limits: StateConfigLimits;
  source_control: {
    auto_commit: V5AutoCommit;
    auto_pr: V5AutoPR;
  };
}

export interface V5Pipeline {
  /**
   * Runtime gate mode — narrower than `V5GateMode`. At runtime `'ask'` has
   * already been resolved to a concrete mode (`'task'`, `'phase'`, or
   * `'autonomous'`). `null` means the operator has not yet made a selection
   * (gate_mode_selection gate has not fired).
   */
  gate_mode: 'task' | 'phase' | 'autonomous' | null;
  source_control: V5SourceControlState | null;
  current_tier: V5PipelineTier;
  halt_reason: string | null;
}

export interface GraphState {
  template_id: string;
  status: GraphStatus;
  current_node_path: string | null;
  nodes: NodesRecord;
}

// ─── v5 State Root ───────────────────────────────────────────────────────────

export interface ProjectStateV5 {
  $schema: 'orchestration-state-v5';
  project: ProjectMeta;
  config: V5Config;
  pipeline: V5Pipeline;
  graph: GraphState;
}

// ─── v6 State Root ───────────────────────────────────────────────────────────

/** v6 state — structurally identical to v5 but discriminated by $schema */
export interface ProjectStateV6 {
  $schema: 'orchestration-state-v6';
  project: ProjectMeta;
  config: V5Config;
  pipeline: V5Pipeline;
  graph: GraphState;
}

// ─── Discriminated Union ─────────────────────────────────────────────────────

/** Union of v5 and v6 state — discriminate on $schema */
export type AnyProjectState = ProjectStateV5 | ProjectStateV6;

/** Type guard: returns true when the state is v5 */
export function isV5State(state: AnyProjectState): state is ProjectStateV5 {
  return state.$schema === 'orchestration-state-v5';
}

/** Type guard: returns true when the state is v6 */
export function isV6State(state: AnyProjectState): state is ProjectStateV6 {
  return state.$schema === 'orchestration-state-v6';
}