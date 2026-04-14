import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../../lib/engine.js';
import type {
  PipelineState,
  OrchestrationConfig,
  IOAdapter,
  PipelineResult,
  StepNodeState,
} from '../../lib/types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = '/tmp/test-project/PARITY-TEST';
export const ORCH_ROOT = path.resolve(__dirname, '../../../../..');

export const DEFAULT_CONFIG: OrchestrationConfig = {
  system: { orch_root: ORCH_ROOT },
  projects: { base_path: '', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 2,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'ask',
    auto_pr: 'ask',
    provider: 'github',
  },
  default_template: 'full',
};

// Map of doc_path → document content used by mock readDocument
export const DOC_STORE: Record<string, { frontmatter: Record<string, unknown>; content: string }> = {};

// ── Mock IOAdapter factory ────────────────────────────────────────────────────

export type MockIO = IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
  ensureDirCalls: string[];
};

export function createMockIO(initialState: PipelineState | null = null): MockIO {
  let currentState = initialState ? structuredClone(initialState) : null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];
  const ensureDirCalls: string[] = [];

  return {
    get currentState() {
      return currentState;
    },
    writeCalls,
    ensureDirCalls,
    readState(_projectDir: string): PipelineState | null {
      return currentState ? structuredClone(currentState) : null;
    },
    writeState(_projectDir: string, state: PipelineState): void {
      currentState = structuredClone(state);
      writeCalls.push({ projectDir: _projectDir, state: structuredClone(state) });
    },
    readConfig(_configPath?: string): OrchestrationConfig {
      return structuredClone(DEFAULT_CONFIG);
    },
    readDocument(docPath: string): { frontmatter: Record<string, unknown>; content: string } | null {
      return DOC_STORE[docPath.replace(/\\/g, '/')] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── Scaffold helper ───────────────────────────────────────────────────────────

export function createScaffoldedState(): PipelineState {
  const io = createMockIO(null);
  processEvent('start', PROJECT_DIR, {}, io);
  return io.currentState!;
}

// ── Seed document helper ──────────────────────────────────────────────────────

export function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
  DOC_STORE[docPath.replace(/\\/g, '/')] = {
    frontmatter: {
      title: path.basename(docPath, path.extname(docPath)),
      status: 'completed',
      ...extraFrontmatter,
    },
    content: `# ${path.basename(docPath)}`,
  };
}

// ── Complete planning steps helper ────────────────────────────────────────────

const PLANNING_STEP_ORDER = ['research', 'prd', 'design', 'architecture', 'master_plan'] as const;

export function completePlanningSteps(state: PipelineState, through: string): void {
  const throughIndex = PLANNING_STEP_ORDER.indexOf(through as (typeof PLANNING_STEP_ORDER)[number]);
  if (throughIndex === -1) {
    throw new Error(`Unknown planning step: ${through}`);
  }
  for (let i = 0; i <= throughIndex; i++) {
    const step = PLANNING_STEP_ORDER[i];
    const node = state.graph.nodes[step] as StepNodeState;
    node.status = 'completed';
    node.doc_path = `/tmp/${step}.md`;
  }
}

// ── Config factory ────────────────────────────────────────────────────────────

export function createConfig(overrides: {
  human_gates?: Partial<OrchestrationConfig['human_gates']>;
  source_control?: Partial<OrchestrationConfig['source_control']>;
  system?: Partial<OrchestrationConfig['system']>;
  projects?: Partial<OrchestrationConfig['projects']>;
  limits?: Partial<OrchestrationConfig['limits']>;
}): OrchestrationConfig {
  return {
    system: { ...DEFAULT_CONFIG.system, ...overrides.system },
    projects: { ...DEFAULT_CONFIG.projects, ...overrides.projects },
    limits: { ...DEFAULT_CONFIG.limits, ...overrides.limits },
    human_gates: { ...DEFAULT_CONFIG.human_gates, ...overrides.human_gates },
    source_control: { ...DEFAULT_CONFIG.source_control, ...overrides.source_control },
    default_template: DEFAULT_CONFIG.default_template,
  };
}

// ── Mock IOAdapter with config override ───────────────────────────────────────

export function createMockIOWithConfig(
  initialState: PipelineState | null,
  config: OrchestrationConfig,
): MockIO {
  let currentState = initialState ? structuredClone(initialState) : null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];
  const ensureDirCalls: string[] = [];

  return {
    get currentState() {
      return currentState;
    },
    writeCalls,
    ensureDirCalls,
    readState(_projectDir: string): PipelineState | null {
      return currentState ? structuredClone(currentState) : null;
    },
    writeState(_projectDir: string, state: PipelineState): void {
      currentState = structuredClone(state);
      writeCalls.push({ projectDir: _projectDir, state: structuredClone(state) });
    },
    readConfig(_configPath?: string): OrchestrationConfig {
      return structuredClone(config);
    },
    readDocument(docPath: string): { frontmatter: Record<string, unknown>; content: string } | null {
      return DOC_STORE[docPath.replace(/\\/g, '/')] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── Shared task/doc-path helpers ───────────────────────────────────────────────

export const TASKS_2 = [
  { id: 'T01', title: 'Task 1' },
  { id: 'T02', title: 'Task 2' },
];

export const phasePlanDoc = (phase: number): string =>
  path.posix.join(PROJECT_DIR, 'phases', `phase-${phase}-plan.md`);
export const taskHandoffDoc = (phase: number, task: number): string =>
  path.posix.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-handoff.md`);
export const codeReviewDoc = (phase: number, task: number): string =>
  path.posix.join(PROJECT_DIR, 'tasks', `p${phase}-t${task}-review.md`);
export const phaseReportDoc = (phase: number): string =>
  path.posix.join(PROJECT_DIR, 'phases', `phase-${phase}-report.md`);
export const phaseReviewDoc = (phase: number): string =>
  path.posix.join(PROJECT_DIR, 'phases', `phase-${phase}-review.md`);

// ── Drive to execution tier helper ────────────────────────────────────────────

/**
 * Scaffolds state, completes planning, seeds master plan, approves plan.
 * Returns MockIO positioned at the execution tier.
 */
export function driveToExecutionWithConfig(config: OrchestrationConfig, totalPhases = 1): MockIO {
  const io = createMockIOWithConfig(null, config);
  processEvent('start', PROJECT_DIR, {}, io);
  const state = io.currentState!;
  completePlanningSteps(state, 'master_plan');
  const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
  seedDoc(mpDoc, { total_phases: totalPhases });
  const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

  // gate_mode_selection fires ask_gate_mode for ask configs.
  // Pass through by setting a gate mode, then reset so subsequent gates still see ask behavior.
  if (result.action === 'ask_gate_mode') {
    processEvent('gate_mode_set', PROJECT_DIR, { gate_mode: 'task' }, io);
    io.currentState!.pipeline.gate_mode = null;
  }

  return io;
}

// ── Drive single task helper ──────────────────────────────────────────────────

/**
 * Drives a single task through handoff→execute→review(approve).
 */
export function driveTaskWith(io: MockIO, phase: number, task: number): PipelineResult {
  const ctx = { phase, task };
  processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
  const handoffDoc = taskHandoffDoc(phase, task);
  seedDoc(handoffDoc);
  processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: handoffDoc }, io);
  processEvent('execution_started', PROJECT_DIR, ctx, io);
  processEvent('task_completed', PROJECT_DIR, ctx, io);
  processEvent('code_review_started', PROJECT_DIR, ctx, io);
  const reviewDoc = codeReviewDoc(phase, task);
  seedDoc(reviewDoc);
  let result = processEvent('code_review_completed', PROJECT_DIR, {
    ...ctx,
    doc_path: reviewDoc,
    verdict: 'approved',
  }, io);

  // If commit conditional fires, drive commit events at task scope
  if (result.action === 'invoke_source_control_commit') {
    processEvent('commit_started', PROJECT_DIR, ctx, io);
    result = processEvent('commit_completed', PROJECT_DIR, ctx, io);
  }

  // If task gate fires, approve it to continue (matches drivePhaseReviewApproval pattern)
  if (result.action === 'gate_task') {
    result = processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
  }

  return result;
}

// ── Drive phase review approval helper ────────────────────────────────────────

/**
 * Drives phase report + review + gate approval to phase completion.
 */
export function drivePhaseReviewApproval(io: MockIO, phase: number): PipelineResult {
  processEvent('phase_report_started', PROJECT_DIR, { phase }, io);
  seedDoc(phaseReportDoc(phase));
  processEvent('phase_report_created', PROJECT_DIR, { phase, doc_path: phaseReportDoc(phase) }, io);

  processEvent('phase_review_started', PROJECT_DIR, { phase }, io);
  seedDoc(phaseReviewDoc(phase));
  let result = processEvent('phase_review_completed', PROJECT_DIR, {
    phase, doc_path: phaseReviewDoc(phase), verdict: 'approved', exit_criteria_met: true,
  }, io);

  // If phase gate fires, approve it to reach commit conditional
  if (result.action === 'gate_phase') {
    result = processEvent('phase_gate_approved', PROJECT_DIR, { phase }, io);
  }

  return result;
}

// ── Drive to review tier helper ───────────────────────────────────────────────

/**
 * Drives the pipeline from scaffold through one phase (two tasks) to the review
 * tier. Handles gate approvals and commit steps based on the provided config.
 * Returns MockIO positioned at the review tier (ready for final_review tests).
 */
export function driveToReviewTier(config: OrchestrationConfig): MockIO {
  const io = createMockIOWithConfig(null, config);
  processEvent('start', PROJECT_DIR, {}, io);

  const state = io.currentState!;
  completePlanningSteps(state, 'master_plan');
  const mpDoc = (state.graph.nodes['master_plan'] as StepNodeState).doc_path!;
  seedDoc(mpDoc, { total_phases: 1 });

  processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);

  // Phase 1 planning
  processEvent('phase_planning_started', PROJECT_DIR, { phase: 1 }, io);
  const ppDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-plan.md');
  seedDoc(ppDoc, { tasks: [{ id: 'T01', title: 'Task 1' }, { id: 'T02', title: 'Task 2' }] });
  processEvent('phase_plan_created', PROJECT_DIR, { phase: 1, doc_path: ppDoc }, io);

  // Drive two tasks
  for (const t of [1, 2]) {
    const ctx = { phase: 1, task: t };
    processEvent('task_handoff_started', PROJECT_DIR, ctx, io);
    const thDoc = path.join(PROJECT_DIR, 'tasks', `p1-t${t}-handoff.md`);
    seedDoc(thDoc);
    processEvent('task_handoff_created', PROJECT_DIR, { ...ctx, doc_path: thDoc }, io);
    processEvent('execution_started', PROJECT_DIR, ctx, io);
    processEvent('task_completed', PROJECT_DIR, ctx, io);
    processEvent('code_review_started', PROJECT_DIR, ctx, io);
    const crDoc = path.join(PROJECT_DIR, 'tasks', `p1-t${t}-review.md`);
    seedDoc(crDoc);
    let result = processEvent('code_review_completed', PROJECT_DIR, {
      ...ctx, doc_path: crDoc, verdict: 'approved',
    }, io);

    // If commit conditional fires, drive commit events at task scope
    if (result.action === 'invoke_source_control_commit') {
      processEvent('commit_started', PROJECT_DIR, ctx, io);
      result = processEvent('commit_completed', PROJECT_DIR, ctx, io);
    }

    // If task gate fires (e.g., ask mode), approve it
    if (result.action === 'gate_task') {
      processEvent('task_gate_approved', PROJECT_DIR, ctx, io);
    }
  }

  // Phase report + review
  processEvent('phase_report_started', PROJECT_DIR, { phase: 1 }, io);
  const prDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-report.md');
  seedDoc(prDoc);
  processEvent('phase_report_created', PROJECT_DIR, { phase: 1, doc_path: prDoc }, io);

  processEvent('phase_review_started', PROJECT_DIR, { phase: 1 }, io);
  const prvDoc = path.join(PROJECT_DIR, 'phases', 'phase-1-review.md');
  seedDoc(prvDoc);
  let result: PipelineResult = processEvent('phase_review_completed', PROJECT_DIR, {
    phase: 1, doc_path: prvDoc, verdict: 'approved', exit_criteria_met: true,
  }, io);

  // If phase gate fires, approve it
  if (result.action === 'gate_phase') {
    result = processEvent('phase_gate_approved', PROJECT_DIR, { phase: 1 }, io);
  }

  return io;
}
