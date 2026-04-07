import * as path from 'node:path';
import { processEvent } from '../../lib/engine.js';
import type {
  PipelineState,
  OrchestrationConfig,
  IOAdapter,
  StepNodeState,
} from '../../lib/types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PROJECT_DIR = '/tmp/test-project/PARITY-TEST';
export const ORCH_ROOT = path.resolve(__dirname, '../../../../..'); // points to .github

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
      return DOC_STORE[docPath] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// ── Scaffold helper ───────────────────────────────────────────────────────────

export function createScaffoldedState(): PipelineState {
  const io = createMockIO(null);
  processEvent('research_started', PROJECT_DIR, {}, io);
  return io.currentState!;
}

// ── Seed document helper ──────────────────────────────────────────────────────

export function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
  DOC_STORE[docPath] = {
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
