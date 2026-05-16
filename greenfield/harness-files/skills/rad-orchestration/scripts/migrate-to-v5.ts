import * as fs from 'node:fs';
import * as path from 'node:path';
import { readState, writeState } from './lib/state-io.js';
import type {
  PipelineState,
  GraphState,
  PipelineSection,
  SourceControlState,
  NodeState,
  StepNodeState,
  GateNodeState,
  ConditionalNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  IterationEntry,
  CorrectiveTaskEntry,
  NodeStatus,
  GraphStatus,
} from './lib/types.js';

// ── V4 State Type Definitions (internal only) ─────────────────────────────────

interface V4Step {
  name: string;
  status: string;
  doc_path: string | null;
}

interface V4TaskDocs {
  handoff: string | null;
  report?: string | null;
  review: string | null;
}

interface V4Task {
  name: string;
  status: string;
  stage: string;
  docs: V4TaskDocs;
  review: {
    verdict: string | null;
    action: string | null;
  };
  retries: number;
  commit_hash?: string;
}

interface V4PhaseDocs {
  phase_plan: string | null;
  phase_report: string | null;
  phase_review: string | null;
}

interface V4Phase {
  name: string;
  status: string;
  stage: string;
  current_task: number;
  tasks: V4Task[];
  docs: V4PhaseDocs;
  review: {
    verdict: string | null;
    action: string | null;
  };
}

interface V4SourceControl {
  branch: string;
  base_branch: string;
  worktree_path: string;
  auto_commit: string;
  auto_pr: string;
  remote_url?: string;
  compare_url?: string;
  pr_url?: string;
  commit_hash?: string;
}

interface V4State {
  $schema: string;
  project: {
    name: string;
    created: string;
    updated: string;
  };
  pipeline: {
    current_tier: string;
    gate_mode: string;
    source_control?: V4SourceControl;
  };
  planning?: {
    status: string;
    human_approved: boolean;
    steps: V4Step[];
  };
  execution?: {
    status: string;
    current_phase: number;
    phases: V4Phase[];
  };
  final_review?: {
    status: string;
    doc_path: string | null;
    human_approved: boolean;
  };
  config?: {
    limits?: {
      max_phases: number;
      max_tasks_per_phase: number;
      max_retries_per_task: number;
      max_consecutive_review_rejections: number;
    };
    human_gates?: {
      after_planning: boolean;
      execution_mode: string;
      after_final_review: boolean;
    };
  };
}

// ── Migration Interfaces (exported) ───────────────────────────────────────────

export interface MigrationOptions {
  dryRun: boolean;
  projectDir?: string;  // single project path, or undefined for all
  basePath: string;     // orchestration-projects base path
}

export interface MigrationEntry {
  project: string;
  status: 'done' | 'skip' | 'error' | 'warn';
  message: string;
  v4Tier?: string;
  phaseCount?: number;
  taskCount?: number;
}

export interface MigrationSummary {
  migrated: number;
  skipped: number;
  errors: number;
  warnings: number;
  details: MigrationEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMITS = {
  max_phases: 10,
  max_tasks_per_phase: 8,
  max_retries_per_task: 2,
  max_consecutive_review_rejections: 3,
};

const PLANNING_STEP_NAMES = [
  'research',
  'prd',
  'design',
  'architecture',
  'master_plan',
] as const;

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Normalizes a doc_path to a project-relative, forward-slash path.
 * Strips everything up to and including /{projectName}/ if present.
 */
function normalizeDocPath(docPath: string | null, projectName: string): string | null {
  if (docPath === null) return null;
  const normalized = docPath.replace(/\\/g, '/');
  const marker = `/${projectName}/`;
  const idx = normalized.indexOf(marker);
  if (idx !== -1) {
    return normalized.slice(idx + marker.length);
  }
  return normalized;
}

/**
 * Maps a v4 status string to a v5 NodeStatus.
 */
function mapStepStatus(v4Status: string): NodeStatus {
  if (v4Status === 'complete') return 'completed';
  if (v4Status === 'in_progress') return 'in_progress';
  return 'not_started';
}

/**
 * Derives v5 graph.status from v4 pipeline.current_tier.
 */
function deriveGraphStatus(currentTier: string): GraphStatus {
  if (currentTier === 'complete') return 'completed';
  if (currentTier === 'halted') return 'halted';
  return 'in_progress';
}

/**
 * Builds planning step nodes from v4 planning section.
 */
function buildPlanningNodes(
  planning: V4State['planning'],
  projectName: string,
): Record<string, NodeState> {
  const nodes: Record<string, NodeState> = {};

  if (!planning) {
    for (const name of PLANNING_STEP_NAMES) {
      const stepNode: StepNodeState = {
        kind: 'step',
        status: 'not_started',
        doc_path: null,
        retries: 0,
      };
      nodes[name] = stepNode;
    }
    return nodes;
  }

  for (const step of planning.steps) {
    const stepNode: StepNodeState = {
      kind: 'step',
      status: mapStepStatus(step.status),
      doc_path: normalizeDocPath(step.doc_path, projectName),
      retries: 0,
    };
    nodes[step.name] = stepNode;
  }

  // Fill in any missing planning steps
  for (const name of PLANNING_STEP_NAMES) {
    if (!(name in nodes)) {
      const stepNode: StepNodeState = {
        kind: 'step',
        status: 'not_started',
        doc_path: null,
        retries: 0,
      };
      nodes[name] = stepNode;
    }
  }

  return nodes;
}

/**
 * Synthesizes CorrectiveTaskEntry objects from v4 task retries.
 */
function buildCorrectiveTasks(task: V4Task): CorrectiveTaskEntry[] {
  const entries: CorrectiveTaskEntry[] = [];
  for (let i = 1; i <= task.retries; i++) {
    const handoffNode: StepNodeState = {
      kind: 'step',
      status: 'completed',
      doc_path: null,
      retries: 0,
    };
    const executorNode: StepNodeState = {
      kind: 'step',
      status: 'completed',
      doc_path: null,
      retries: 0,
    };
    const reviewNode: StepNodeState = {
      kind: 'step',
      status: 'completed',
      doc_path: null,
      verdict: null,
      retries: 0,
    };
    const gateNode: GateNodeState = {
      kind: 'gate',
      status: 'completed',
      gate_active: false,
    };
    entries.push({
      index: i,
      reason: 'migrated_from_v4_retry',
      injected_after: 'code_review',
      status: 'completed',
      nodes: {
        task_handoff: handoffNode,
        task_executor: executorNode,
        code_review: reviewNode,
        task_gate: gateNode,
      },
      commit_hash: null,
    });
  }
  return entries;
}

/**
 * Builds a task IterationEntry from a v4 task.
 */
function buildTaskIteration(task: V4Task, index: number, projectName: string): IterationEntry {
  const taskStatus = mapStepStatus(task.status);

  // task_handoff: If docs.handoff exists → "completed", else "not_started"
  const handoffStatus: NodeStatus = task.docs.handoff ? 'completed' : 'not_started';

  // code_review: If docs.review exists → "completed", else "not_started"
  const reviewStatus: NodeStatus = task.docs.review ? 'completed' : 'not_started';

  // task_executor: complete/has review → "completed", in_progress+handoff → "in_progress", else "not_started"
  let executorStatus: NodeStatus;
  if (task.status === 'complete' || task.docs.review) {
    executorStatus = 'completed';
  } else if (task.status === 'in_progress' && task.docs.handoff) {
    executorStatus = 'in_progress';
  } else {
    executorStatus = 'not_started';
  }

  // task_gate: review.action === "advanced" or task is complete → "completed"
  const gateStatus: NodeStatus =
    task.review.action === 'advanced' || task.status === 'complete'
      ? 'completed'
      : 'not_started';

  const handoffNode: StepNodeState = {
    kind: 'step',
    status: handoffStatus,
    doc_path: normalizeDocPath(task.docs.handoff, projectName),
    retries: 0,
  };
  const executorNode: StepNodeState = {
    kind: 'step',
    status: executorStatus,
    doc_path: null,
    retries: 0,
  };
  const reviewNode: StepNodeState = {
    kind: 'step',
    status: reviewStatus,
    doc_path: normalizeDocPath(task.docs.review, projectName),
    retries: 0,
    verdict: task.review.verdict,
  };
  const gateNode: GateNodeState = {
    kind: 'gate',
    status: gateStatus,
    gate_active: false,
  };

  // commit_gate: task complete → "completed", else "not_started"
  const commitGateStatus: NodeStatus =
    task.status === 'complete' ? 'completed' : 'not_started';
  const commitGateNode: ConditionalNodeState = {
    kind: 'conditional',
    status: commitGateStatus,
    branch_taken: null,
  };

  const nodes: Record<string, NodeState> = {
    task_handoff: handoffNode,
    task_executor: executorNode,
    code_review: reviewNode,
    commit_gate: commitGateNode,
    task_gate: gateNode,
  };

  return {
    index,
    status: taskStatus,
    nodes,
    corrective_tasks: buildCorrectiveTasks(task),
    commit_hash: null,
  };
}

/**
 * Builds a phase IterationEntry from a v4 phase.
 */
function buildPhaseIteration(phase: V4Phase, index: number, projectName: string): IterationEntry {
  const phaseStatus = mapStepStatus(phase.status);

  // phase_planning: If docs.phase_plan exists → "completed", else derive from phase stage
  const phasePlanningStatus: NodeStatus = phase.docs.phase_plan
    ? 'completed'
    : mapStepStatus(phase.stage);

  // Build task iterations
  const taskIterations = phase.tasks.map((task, i) =>
    buildTaskIteration(task, i, projectName),
  );

  // task_loop: all complete → "completed", any in_progress → "in_progress", else "not_started"
  let taskLoopStatus: NodeStatus;
  if (taskIterations.length === 0) {
    taskLoopStatus = 'not_started';
  } else if (taskIterations.every((t) => t.status === 'completed')) {
    taskLoopStatus = 'completed';
  } else if (taskIterations.some((t) => t.status === 'in_progress')) {
    taskLoopStatus = 'in_progress';
  } else {
    taskLoopStatus = 'not_started';
  }

  // phase_report: If docs.phase_report exists → "completed", else "not_started"
  const phaseReportStatus: NodeStatus = phase.docs.phase_report ? 'completed' : 'not_started';

  // phase_review: If docs.phase_review exists → "completed", else "not_started"
  const phaseReviewStatus: NodeStatus = phase.docs.phase_review ? 'completed' : 'not_started';

  // phase_gate: verdict === "approved" or phase complete → "completed"
  const phaseGateStatus: NodeStatus =
    phase.review.verdict === 'approved' || phase.status === 'complete'
      ? 'completed'
      : 'not_started';

  // (commit_gate moved to task scope — no longer scaffolded at phase level)

  const phasePlanningNode: StepNodeState = {
    kind: 'step',
    status: phasePlanningStatus,
    doc_path: normalizeDocPath(phase.docs.phase_plan, projectName),
    retries: 0,
  };
  const taskLoopNode: ForEachTaskNodeState = {
    kind: 'for_each_task',
    status: taskLoopStatus,
    iterations: taskIterations,
  };
  const phaseReportNode: StepNodeState = {
    kind: 'step',
    status: phaseReportStatus,
    doc_path: normalizeDocPath(phase.docs.phase_report, projectName),
    retries: 0,
  };
  const phaseReviewNode: StepNodeState = {
    kind: 'step',
    status: phaseReviewStatus,
    doc_path: normalizeDocPath(phase.docs.phase_review, projectName),
    retries: 0,
    verdict: phase.review.verdict,
  };
  const phaseGateNode: GateNodeState = {
    kind: 'gate',
    status: phaseGateStatus,
    gate_active: false,
  };
  const nodes: Record<string, NodeState> = {
    phase_planning: phasePlanningNode,
    task_loop: taskLoopNode,
    phase_report: phaseReportNode,
    phase_review: phaseReviewNode,
    phase_gate: phaseGateNode,
  };

  return {
    index,
    status: phaseStatus,
    nodes,
    corrective_tasks: [],
    commit_hash: null,
  };
}

/**
 * Builds the phase_loop ForEachPhaseNodeState from v4 execution section.
 */
function buildPhaseLoop(
  execution: V4State['execution'],
  projectName: string,
): ForEachPhaseNodeState {
  if (!execution || execution.phases.length === 0) {
    return {
      kind: 'for_each_phase',
      status: 'not_started',
      iterations: [],
    };
  }

  const iterations = execution.phases.map((phase, i) =>
    buildPhaseIteration(phase, i, projectName),
  );

  let status: NodeStatus;
  if (iterations.length === 0) {
    status = 'not_started';
  } else if (iterations.every((p) => p.status === 'completed')) {
    status = 'completed';
  } else if (iterations.some((p) => p.status === 'in_progress')) {
    status = 'in_progress';
  } else {
    status = 'not_started';
  }

  return {
    kind: 'for_each_phase',
    status,
    iterations,
  };
}

// ── Main Export Functions ─────────────────────────────────────────────────────

/**
 * Migrates a single v4 state.json to v5 format.
 * Does NOT read/write files — pure data transformation.
 */
export function migrateState(
  v4State: Record<string, unknown>,
  projectName: string,
): PipelineState {
  const v4 = v4State as unknown as V4State;

  // 2. Project Section — copy verbatim
  const project = {
    name: v4.project.name,
    created: v4.project.created,
    updated: v4.project.updated,
  };

  // 3. Config Section
  const limits = v4.config?.limits ?? DEFAULT_LIMITS;
  const config = {
    gate_mode:
      v4.pipeline.gate_mode ?? v4.config?.human_gates?.execution_mode ?? 'ask',
    limits: {
      max_phases: limits.max_phases,
      max_tasks_per_phase: limits.max_tasks_per_phase,
      max_retries_per_task: limits.max_retries_per_task,
      max_consecutive_review_rejections: limits.max_consecutive_review_rejections,
    },
    source_control: {
      auto_commit: v4.pipeline.source_control?.auto_commit ?? 'ask',
      auto_pr: v4.pipeline.source_control?.auto_pr ?? 'ask',
    },
  };

  // 4. Pipeline Section — source_control mapping
  let sourceControl: SourceControlState | null = null;
  if (v4.pipeline.source_control) {
    const sc = v4.pipeline.source_control;
    sourceControl = {
      branch: sc.branch,
      base_branch: sc.base_branch,
      worktree_path: sc.worktree_path,
      auto_commit: sc.auto_commit,
      auto_pr: sc.auto_pr,
      remote_url: sc.remote_url ?? null,
      compare_url: sc.compare_url ?? null,
      pr_url: sc.pr_url ?? null,
    };
  }

  const pipeline: PipelineSection = {
    current_tier: v4.pipeline.current_tier,
    gate_mode: v4.pipeline.gate_mode ?? null,
    halt_reason: v4.pipeline.current_tier === 'halted' ? 'migrated_from_v4' : null,
    source_control: sourceControl,
  };

  // 5. Graph Section — derive status from tier
  const graphStatus = deriveGraphStatus(v4.pipeline.current_tier);

  // 6. Planning nodes
  const planningNodes = buildPlanningNodes(v4.planning, projectName);

  // 7. Plan approval gate
  const planApprovalGate: GateNodeState = {
    kind: 'gate',
    status: v4.planning?.human_approved === true ? 'completed' : 'not_started',
    gate_active: false,
  };

  // 8. Phase loop
  const phaseLoop = buildPhaseLoop(v4.execution, projectName);

  // 13. Final review
  let finalReviewNode: StepNodeState;
  let finalApprovalGate: GateNodeState;

  if (v4.final_review) {
    finalReviewNode = {
      kind: 'step',
      status: v4.final_review.status === 'complete' ? 'completed' : 'not_started',
      doc_path: normalizeDocPath(v4.final_review.doc_path, projectName),
      retries: 0,
    };
    finalApprovalGate = {
      kind: 'gate',
      status: v4.final_review.human_approved ? 'completed' : 'not_started',
      gate_active: false,
    };
  } else {
    finalReviewNode = {
      kind: 'step',
      status: 'not_started',
      doc_path: null,
      retries: 0,
    };
    finalApprovalGate = {
      kind: 'gate',
      status: 'not_started',
      gate_active: false,
    };
  }

  // 14. pr_gate conditional
  const prGate: ConditionalNodeState = {
    kind: 'conditional',
    status: v4.pipeline.current_tier === 'complete' ? 'completed' : 'not_started',
    branch_taken: null,
  };

  const graph: GraphState = {
    template_id: 'full',
    status: graphStatus,
    current_node_path: null,
    nodes: {
      ...planningNodes,
      plan_approval_gate: planApprovalGate,
      phase_loop: phaseLoop,
      final_review: finalReviewNode,
      final_approval_gate: finalApprovalGate,
      pr_gate: prGate,
    },
  };

  return {
    $schema: 'orchestration-state-v5',
    project,
    config,
    pipeline,
    graph,
  };
}

// ── Terminal Output ───────────────────────────────────────────────────────────

const C = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

function colorFor(status: 'done' | 'skip' | 'error' | 'warn'): string {
  switch (status) {
    case 'done':
      return C.green;
    case 'skip':
      return C.cyan;
    case 'warn':
      return C.yellow;
    case 'error':
      return C.red;
  }
}

function labelFor(status: 'done' | 'skip' | 'error' | 'warn'): string {
  switch (status) {
    case 'done':
      return '[DONE] ';
    case 'skip':
      return '[SKIP] ';
    case 'warn':
      return '[WARN] ';
    case 'error':
      return '[ERROR]';
  }
}

function printEntry(entry: MigrationEntry, dryRun: boolean): void {
  const color = colorFor(entry.status);
  const label = labelFor(entry.status);
  const prefix = dryRun && entry.status === 'done' ? '[DRY RUN] ' : '';
  let detail = entry.message;
  if (entry.status === 'done' && entry.v4Tier !== undefined) {
    const countParts: string[] = [];
    if (entry.phaseCount !== undefined) countParts.push(`${entry.phaseCount} phases`);
    if (entry.taskCount !== undefined) countParts.push(`${entry.taskCount} tasks`);
    const countStr = countParts.length > 0 ? ` (${countParts.join(', ')})` : '';
    detail = `${entry.v4Tier.padEnd(12)} → ${entry.message}${countStr}`;
  }
  process.stdout.write(
    `  ${prefix}${color}${label}${C.reset} ${entry.project.padEnd(30)} ${detail}\n`,
  );
}

function printSummary(summary: MigrationSummary): void {
  process.stdout.write('\n');
  process.stdout.write('═'.repeat(63) + '\n');
  process.stdout.write('Migration complete:\n');
  process.stdout.write(
    `  ${C.green}\u2713${C.reset}  ${summary.migrated} migrated successfully\n`,
  );
  process.stdout.write(
    `  ${C.cyan}\u2299${C.reset}   ${summary.skipped} skipped (already v5)\n`,
  );
  process.stdout.write(
    `  ${C.red}\u2717${C.reset}   ${summary.errors} errors\n`,
  );
  if (summary.warnings > 0) {
    process.stdout.write(
      `  ${C.yellow}\u26a0${C.reset}   ${summary.warnings} warnings\n`,
    );
  }
}

// ── Project Processing ────────────────────────────────────────────────────────

function processProject(
  projectDir: string,
  projectName: string,
  options: MigrationOptions,
): MigrationEntry {
  let rawResult: PipelineState | null;
  try {
    rawResult = readState(projectDir);
  } catch (err) {
    return {
      project: projectName,
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (rawResult === null) {
    return {
      project: projectName,
      status: 'error',
      message: 'state.json not found',
    };
  }

  const rawState = rawResult as unknown as Record<string, unknown>;
  const schema = rawState['$schema'];

  if (schema === 'orchestration-state-v5') {
    return {
      project: projectName,
      status: 'skip',
      message: 'already v5 (skipped)',
    };
  }

  if (schema !== 'orchestration-state-v4') {
    return {
      project: projectName,
      status: 'warn',
      message: `no schema (skipped — unrecognized format: ${String(schema)})`,
    };
  }

  // It's v4 — migrate
  try {
    const v5State = migrateState(rawState, projectName);
    const v4Typed = rawState as unknown as V4State;
    const phaseCount = v4Typed.execution?.phases.length ?? 0;
    const taskCount =
      v4Typed.execution?.phases.reduce((sum, p) => sum + p.tasks.length, 0) ?? 0;

    if (!options.dryRun) {
      writeState(projectDir, v5State);
    }

    return {
      project: projectName,
      status: 'done',
      message: 'v5',
      v4Tier: v4Typed.pipeline.current_tier,
      phaseCount,
      taskCount,
    };
  } catch (err) {
    return {
      project: projectName,
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── runMigration ──────────────────────────────────────────────────────────────

/**
 * CLI entry point — discovers and migrates all state.json files.
 * Reads/writes via state-io.ts. Prints terminal output.
 */
export function runMigration(options: MigrationOptions): MigrationSummary {
  const summary: MigrationSummary = {
    migrated: 0,
    skipped: 0,
    errors: 0,
    warnings: 0,
    details: [],
  };

  process.stdout.write('State Migration to v5\n');
  process.stdout.write('═'.repeat(63) + '\n');
  process.stdout.write('\n');

  let projectDirs: Array<{ dir: string; name: string }>;

  if (options.projectDir) {
    const projectName = path.basename(options.projectDir);
    projectDirs = [{ dir: options.projectDir, name: projectName }];
    process.stdout.write(`Project: ${options.projectDir}\n`);
  } else {
    process.stdout.write(`Scanning: ${options.basePath}\n`);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(options.basePath, { withFileTypes: true });
    } catch (err) {
      process.stderr.write(
        `Error scanning ${options.basePath}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return summary;
    }

    projectDirs = entries
      .filter((e) => e.isDirectory())
      .filter((e) => fs.existsSync(path.join(options.basePath, e.name, 'state.json')))
      .map((e) => ({
        dir: path.join(options.basePath, e.name),
        name: e.name,
      }));

    process.stdout.write(`Found: ${projectDirs.length} state.json files\n`);
  }

  process.stdout.write('\n');

  for (const { dir, name } of projectDirs) {
    const entry = processProject(dir, name, options);
    summary.details.push(entry);

    switch (entry.status) {
      case 'done':
        summary.migrated++;
        break;
      case 'skip':
        summary.skipped++;
        break;
      case 'error':
        summary.errors++;
        break;
      case 'warn':
        summary.warnings++;
        break;
    }

    printEntry(entry, options.dryRun);
  }

  printSummary(summary);
  return summary;
}

// ── CLI Entry Block ───────────────────────────────────────────────────────────

const scriptName = process.argv[1] ?? '';
if (scriptName.endsWith('migrate-to-v5.ts') || scriptName.endsWith('migrate-to-v5.js')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const projectDirIdx = args.indexOf('--project-dir');
  const projectDir = projectDirIdx !== -1 ? args[projectDirIdx + 1] : undefined;

  const basePath = process.cwd();
  runMigration({ dryRun, projectDir, basePath });
}
