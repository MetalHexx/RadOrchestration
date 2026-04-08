// Type Aliases

export type NodeKind = 'step' | 'gate' | 'for_each_phase' | 'for_each_task' | 'conditional' | 'parallel';

export type NodeStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'halted' | 'skipped';

export type GraphStatus = 'not_started' | 'in_progress' | 'completed' | 'halted';

export type EventPhase = 'started' | 'completed' | 'approved';

export type ConditionOperator = 'eq' | 'neq' | 'in' | 'not_in' | 'truthy' | 'falsy';

// Template Node Definitions (parsed from YAML)

export interface BaseNodeDef {
  id: string;
  kind: NodeKind;
  depends_on?: string[];
  label?: string;
}

export interface StepNodeDef extends BaseNodeDef {
  kind: 'step';
  action: string;
  events: {
    started: string;
    completed: string;
  };
  context?: Record<string, unknown>;
  doc_output_field?: string;
  retries_ref?: string;
}

export interface GateNodeDef extends BaseNodeDef {
  kind: 'gate';
  mode_ref: string;
  action_if_needed: string;
  approved_event: string;
  auto_approve_modes?: string[];
}

export interface ForEachPhaseNodeDef extends BaseNodeDef {
  kind: 'for_each_phase';
  source_doc_ref: string;
  total_field: string;
  body: NodeDef[];
}

export interface ForEachTaskNodeDef extends BaseNodeDef {
  kind: 'for_each_task';
  source_doc_ref: string;
  tasks_field: string;
  body: NodeDef[];
}

export interface ConditionExpression {
  config_ref?: string;   // dot-path into config (e.g., "source_control.auto_commit")
  state_ref?: string;    // dot-path into state (mutually exclusive with config_ref)
  operator: ConditionOperator;
  value?: unknown;       // comparison value (not needed for truthy/falsy)
}

export interface ConditionalNodeDef extends BaseNodeDef {
  kind: 'conditional';
  condition: ConditionExpression;
  branches: {
    true: NodeDef[];
    false: NodeDef[];
  };
}

export interface ParallelNodeDef extends BaseNodeDef {
  kind: 'parallel';
  serialize: boolean;
  children: NodeDef[];
}

export type NodeDef =
  | StepNodeDef
  | GateNodeDef
  | ForEachPhaseNodeDef
  | ForEachTaskNodeDef
  | ConditionalNodeDef
  | ParallelNodeDef;

// Pipeline Template (top-level YAML structure)

export interface TemplateHeader {
  id: string;
  version: string;
  description: string;
}

export interface PipelineTemplate {
  template: TemplateHeader;
  nodes: NodeDef[];
}

// Node State (per-node execution tracking in state.json)

export interface BaseNodeState {
  kind: NodeKind;
  status: NodeStatus;
}

export interface StepNodeState extends BaseNodeState {
  kind: 'step';
  doc_path: string | null;
  retries: number;
  verdict?: string | null;
}

export interface GateNodeState extends BaseNodeState {
  kind: 'gate';
  gate_active: boolean;
}

export interface ConditionalNodeState extends BaseNodeState {
  kind: 'conditional';
  branch_taken: 'true' | 'false' | null;
}

export interface ParallelNodeState extends BaseNodeState {
  kind: 'parallel';
  nodes: Record<string, NodeState>;
}

export interface CorrectiveTaskEntry {
  index: number;              // 1-based corrective attempt number
  reason: string;             // human-readable injection reason
  injected_after: string;     // node ID that triggered injection (e.g., "code_review")
  status: NodeStatus;
  nodes: Record<string, NodeState>;
}

export interface IterationEntry {
  index: number;              // 0-based iteration index
  status: NodeStatus;
  nodes: Record<string, NodeState>;
  corrective_tasks: CorrectiveTaskEntry[];
}

export interface ForEachPhaseNodeState extends BaseNodeState {
  kind: 'for_each_phase';
  iterations: IterationEntry[];
}

export interface ForEachTaskNodeState extends BaseNodeState {
  kind: 'for_each_task';
  iterations: IterationEntry[];
}

export type NodeState =
  | StepNodeState
  | GateNodeState
  | ForEachPhaseNodeState
  | ForEachTaskNodeState
  | ConditionalNodeState
  | ParallelNodeState;

// Pipeline State (top-level state.json schema)

export interface GraphState {
  template_id: string;
  status: GraphStatus;
  current_node_path: string | null;  // dot/bracket path for observability (e.g., "phase_loop[1].task_loop[2].code_review")
  nodes: Record<string, NodeState>;
}

export interface PipelineState {
  $schema: 'orchestration-state-v5';
  project: {
    name: string;
    created: string;   // ISO 8601
    updated: string;   // ISO 8601
  };
  config: {
    gate_mode: string;
    limits: {
      max_phases: number;
      max_tasks_per_phase: number;
      max_retries_per_task: number;
      max_consecutive_review_rejections: number;
    };
    source_control: {
      auto_commit: string;
      auto_pr: string;
    };
  };
  graph: GraphState;
}

// Pipeline Result (CLI output contract — SACRED, no changes)

export interface PipelineResult {
  success: boolean;
  action: string | null;
  context: Record<string, unknown>;
  mutations_applied: string[];
  orchRoot: string;
  error?: {
    message: string;
    event: string;
    field?: string;
  };
}

// Event Context (parsed from CLI arguments)

export interface EventContext {
  // ── Required ──
  event: string;
  project_dir: string;
  config_path: string;

  // ── Optional CLI-mapped fields (v4 parity) ──
  doc_path?: string;
  branch?: string;
  base_branch?: string;
  worktree_path?: string;
  auto_commit?: string;
  auto_pr?: string;
  gate_type?: string;
  gate_mode?: string;
  reason?: string;
  commit_hash?: string;
  pushed?: string;
  remote_url?: string;
  compare_url?: string;
  pr_url?: string;

  // ── Internal fields (v5 DAG walker; NOT required from callers) ──
  step?: string;
  phase?: number;
  task?: number;
  verdict?: string;

  // ── Frontmatter-derived fields (populated by pre-read) ──
  total_phases?: number;
  tasks?: unknown[];
  exit_criteria_met?: boolean;
}

// Orchestration Config (from orchestration.yml)

export interface OrchestrationConfig {
  system: {
    orch_root: string;
  };
  projects: {
    base_path: string;
    naming: string;
  };
  limits: {
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
    max_consecutive_review_rejections: number;
  };
  human_gates: {
    after_planning: boolean;
    execution_mode: string;
    after_final_review: boolean;
  };
  source_control: {
    auto_commit: string;
    auto_pr: string;
    provider: string;
  };
}

// Event Index (built at template load time)

export interface EventIndexEntry {
  nodeDef: NodeDef;
  eventPhase: EventPhase;
  templatePath: string;   // structural path in template (e.g., "phase_loop.body.task_loop.body.code_review")
}

export type EventIndex = Map<string, EventIndexEntry>;

// Module-Level Contract Interfaces

export interface LoadedTemplate {
  template: PipelineTemplate;
  eventIndex: EventIndex;
}

export interface IOAdapter {
  readState(projectDir: string): PipelineState | null;
  writeState(projectDir: string, state: PipelineState): void;
  readConfig(configPath?: string): OrchestrationConfig;
  readDocument(docPath: string): { frontmatter: Record<string, unknown>; content: string } | null;
  ensureDirectories(projectDir: string): void;
}

export interface WalkerResult {
  action: string;
  context: Record<string, unknown>;
}

export interface MutationResult {
  state: PipelineState;
  mutations_applied: string[];
}

export type MutationFn = (
  state: PipelineState,
  context: Partial<EventContext>,
  config: OrchestrationConfig,
  template: PipelineTemplate
) => MutationResult;

export interface PreReadResult {
  context: Partial<EventContext> & Record<string, unknown>;
  error?: {
    message: string;
    event: string;
    field?: string;
  };
}
