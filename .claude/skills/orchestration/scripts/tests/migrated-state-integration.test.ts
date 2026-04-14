import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import { NEXT_ACTIONS } from '../lib/constants.js';
import type {
  PipelineState,
  PipelineResult,
  OrchestrationConfig,
  IOAdapter,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  IterationEntry,
  CorrectiveTaskEntry,
} from '../lib/types.js';

// ── Path resolution ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORCH_ROOT = path.resolve(__dirname, '../../../..'); // .claude
// Deviation from handoff (path): handoff specified '../../../orchestration-projects' (3 levels
// up from ORCH_ROOT), but the actual directory is at c:\dev\orchestration-projects which
// requires 4 levels up from ORCH_ROOT (.claude) → DAG-PIPELINE-2 → v3-worktrees → orchestration → c:\dev.
const PROJECTS_BASE = path.resolve(ORCH_ROOT, '../../../../orchestration-projects');

const IN_PROGRESS_CTX = { step: 'task_executor', phase: 1, task: 1 } as const;

// ── Default config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: OrchestrationConfig = {
  system: { orch_root: ORCH_ROOT },
  projects: { base_path: '', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 8,
    max_retries_per_task: 5,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'autonomous',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'always',
    auto_pr: 'always',
    provider: 'github',
  },
  default_template: 'full',
};

// ── Mock IOAdapter factory ────────────────────────────────────────────────────

type MockIO = IOAdapter & {
  writtenState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
};

function createMockIO(initialState: PipelineState): MockIO {
  let writtenState: PipelineState | null = null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];

  return {
    get writtenState() {
      return writtenState;
    },
    writeCalls,
    readState(_projectDir: string): PipelineState | null {
      return structuredClone(initialState);
    },
    writeState(_projectDir: string, state: PipelineState): void {
      writtenState = structuredClone(state);
      writeCalls.push({ projectDir: _projectDir, state: structuredClone(state) });
    },
    readConfig(_configPath?: string): OrchestrationConfig {
      return structuredClone(DEFAULT_CONFIG);
    },
    readDocument(_docPath: string): { frontmatter: Record<string, unknown>; content: string } | null {
      return null;
    },
    ensureDirectories(_projectDir: string): void {
      // no-op
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadStateFile(projectName: string): PipelineState {
  const statePath = path.join(PROJECTS_BASE, projectName, 'state.json');
  const raw = fs.readFileSync(statePath, 'utf-8');
  return JSON.parse(raw) as PipelineState;
}

/**
 * Patches all IterationEntry and CorrectiveTaskEntry objects in a loaded state
 * to include commit_hash: null when the field is absent. This is needed for
 * legacy state files that pre-date the v5 commit_hash field on iterations.
 * Does NOT modify the source file — only the in-memory object.
 */
function patchIterationEntries(state: PipelineState): void {
  const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState | undefined;
  if (!phaseLoop || phaseLoop.kind !== 'for_each_phase') return;
  for (const phaseIter of phaseLoop.iterations as IterationEntry[]) {
    if (!('commit_hash' in phaseIter)) {
      (phaseIter as unknown as Record<string, unknown>)['commit_hash'] = null;
    }
    for (const ct of phaseIter.corrective_tasks as CorrectiveTaskEntry[]) {
      if (!('commit_hash' in ct)) {
        (ct as unknown as Record<string, unknown>)['commit_hash'] = null;
      }
    }
    const taskLoop = phaseIter.nodes['task_loop'] as ForEachTaskNodeState | undefined;
    if (taskLoop && taskLoop.kind === 'for_each_task') {
      for (const taskIter of taskLoop.iterations as IterationEntry[]) {
        if (!('commit_hash' in taskIter)) {
          (taskIter as unknown as Record<string, unknown>)['commit_hash'] = null;
        }
        for (const ct of taskIter.corrective_tasks as CorrectiveTaskEntry[]) {
          if (!('commit_hash' in ct)) {
            (ct as unknown as Record<string, unknown>)['commit_hash'] = null;
          }
        }
      }
    }
  }
}

const VALID_ACTIONS = new Set<string>(Object.values(NEXT_ACTIONS));

function assertValidPipelineResult(result: unknown, label: string): asserts result is PipelineResult {
  const r = result as Record<string, unknown>;
  expect(typeof r['success'], `${label}: success must be boolean`).toBe('boolean');
  expect(r['action'] === null || typeof r['action'] === 'string', `${label}: action must be string or null`).toBe(true);
  expect(typeof r['context'], `${label}: context must be object`).toBe('object');
  expect(Array.isArray(r['mutations_applied']), `${label}: mutations_applied must be array`).toBe(true);
  expect(typeof r['orchRoot'], `${label}: orchRoot must be string`).toBe('string');
}

// ── Tests (conditional on orchestration-projects/ existing) ──────────────────

describe.skipIf(!fs.existsSync(PROJECTS_BASE))('Migrated state compatibility', () => {
  let autoCommitState: PipelineState;
  let dagPipelineState: PipelineState;
  let haltedFixture: PipelineState;
  let inProgressFixture: PipelineState;

  beforeEach(() => {
    // Load real state files (read-only)
    autoCommitState = loadStateFile('AUTO-COMMIT');
    dagPipelineState = loadStateFile('DAG-PIPELINE');

    // Patch legacy state files to add commit_hash: null on all iteration/corrective entries.
    // These files pre-date the v5 commit_hash field. Do NOT modify the source files.
    patchIterationEntries(autoCommitState);
    patchIterationEntries(dagPipelineState);

    // Construct synthetic halted fixture from the completed AUTO-COMMIT state
    haltedFixture = structuredClone(autoCommitState);
    haltedFixture.graph.status = 'halted';
    haltedFixture.pipeline.current_tier = 'halted';
    haltedFixture.pipeline.halt_reason = 'synthetic_test_halt';

    // Construct synthetic in-progress fixture from the completed AUTO-COMMIT state
    inProgressFixture = structuredClone(autoCommitState);
    inProgressFixture.graph.status = 'in_progress';
    inProgressFixture.pipeline.current_tier = 'execution';
    inProgressFixture.graph.current_node_path = 'phase_loop[0].task_loop[0].task_executor';
    // Set phase_loop node itself to in_progress so validator doesn't flag in_progress children
    // under a completed parent (checkCompletedParentChildren)
    (inProgressFixture.graph.nodes['phase_loop'] as unknown as ForEachPhaseNodeState).status = 'in_progress';
    // Set phase_loop iteration 0 and its task_loop iteration 0 to in_progress
    const phaseIter = (inProgressFixture.graph.nodes['phase_loop'] as unknown as ForEachPhaseNodeState)
      .iterations[0];
    phaseIter.status = 'in_progress';
    const taskIter = (phaseIter.nodes['task_loop'] as unknown as ForEachTaskNodeState)
      .iterations[0];
    taskIter.status = 'in_progress';
    (taskIter.nodes['task_executor'] as { status: string }).status = 'in_progress';
    // Mark the task_loop itself as in_progress
    (phaseIter.nodes['task_loop'] as unknown as ForEachTaskNodeState).status = 'in_progress';
  });

  // ── Structural correctness ─────────────────────────────────────────────────

  describe('Structural correctness of loaded states', () => {
    it('AUTO-COMMIT state has correct v5 schema and graph fields', () => {
      expect(autoCommitState.$schema).toBe('orchestration-state-v5');
      expect(autoCommitState.graph).toBeDefined();
      expect(typeof autoCommitState.graph).toBe('object');
      expect(autoCommitState.graph.template_id).toBe('full');
      expect(['not_started', 'in_progress', 'completed', 'halted']).toContain(autoCommitState.graph.status);
      expect(Object.keys(autoCommitState.graph.nodes).length).toBeGreaterThan(0);
    });

    it('AUTO-COMMIT is a completed project with no active node path', () => {
      expect(autoCommitState.graph.status).toBe('completed');
      expect(autoCommitState.pipeline.current_tier).toBe('complete');
      expect(autoCommitState.graph.current_node_path).toBeNull();
    });

    it('DAG-PIPELINE state has correct v5 schema and graph fields', () => {
      expect(dagPipelineState.$schema).toBe('orchestration-state-v5');
      expect(dagPipelineState.graph).toBeDefined();
      expect(typeof dagPipelineState.graph).toBe('object');
      expect(dagPipelineState.graph.template_id).toBe('full');
      expect(['not_started', 'in_progress', 'completed', 'halted']).toContain(dagPipelineState.graph.status);
      expect(Object.keys(dagPipelineState.graph.nodes).length).toBeGreaterThan(0);
    });

    it('DAG-PIPELINE is a completed project with corrective_tasks', () => {
      expect(dagPipelineState.graph.status).toBe('completed');
      expect(dagPipelineState.pipeline.current_tier).toBe('complete');
      // Verify corrective_tasks exist with migrated_from_v4_retry reason
      const phaseLoop = dagPipelineState.graph.nodes['phase_loop'] as unknown as ForEachPhaseNodeState;
      const allCorrectiveTasks = phaseLoop.iterations.flatMap((phase) => {
        const taskLoop = phase.nodes['task_loop'] as unknown as ForEachTaskNodeState;
        return taskLoop.iterations.flatMap((task) => task.corrective_tasks);
      });
      const migratedTasks = allCorrectiveTasks.filter((ct) => ct.reason === 'migrated_from_v4_retry');
      expect(migratedTasks.length).toBeGreaterThan(0);
    });

    it('In-progress fixture has correct v5 schema and graph fields', () => {
      expect(inProgressFixture.$schema).toBe('orchestration-state-v5');
      expect(inProgressFixture.graph).toBeDefined();
      expect(typeof inProgressFixture.graph).toBe('object');
      expect(inProgressFixture.graph.template_id).toBe('full');
      expect(['not_started', 'in_progress', 'completed', 'halted']).toContain(inProgressFixture.graph.status);
      expect(Object.keys(inProgressFixture.graph.nodes).length).toBeGreaterThan(0);
    });

    it('In-progress fixture is in-progress in the execution tier', () => {
      expect(inProgressFixture.graph.status).toBe('in_progress');
      expect(inProgressFixture.pipeline.current_tier).toBe('execution');
      expect(inProgressFixture.graph.current_node_path).toBeTruthy();
      expect(typeof inProgressFixture.graph.current_node_path).toBe('string');
    });

    it('Synthetic halted fixture has halted status and halt_reason', () => {
      expect(haltedFixture.$schema).toBe('orchestration-state-v5');
      expect(haltedFixture.graph.template_id).toBe('full');
      expect(haltedFixture.graph.status).toBe('halted');
      expect(haltedFixture.pipeline.current_tier).toBe('halted');
      expect(haltedFixture.pipeline.halt_reason).toBe('synthetic_test_halt');
      expect(Object.keys(haltedFixture.graph.nodes).length).toBeGreaterThan(0);
    });
  });

  // ── processEvent without exceptions ───────────────────────────────────────

  describe('processEvent does not throw for any state variant', () => {
    it('AUTO-COMMIT (completed, simple): processes start event without throwing', () => {
      const io = createMockIO(autoCommitState);
      expect(() => {
        processEvent('start', '/tmp/AUTO-COMMIT', {}, io);
      }).not.toThrow();
    });

    it('DAG-PIPELINE (completed, with corrective_tasks): processes start event without throwing', () => {
      const io = createMockIO(dagPipelineState);
      expect(() => {
        processEvent('start', '/tmp/DAG-PIPELINE', {}, io);
      }).not.toThrow();
    });

    it('In-progress fixture: processes execution_started event without throwing', () => {
      const io = createMockIO(inProgressFixture);
      expect(() => {
        processEvent('execution_started', '/tmp/DAG-PIPELINE-2', IN_PROGRESS_CTX, io);
      }).not.toThrow();
    });

    it('Halted fixture: processes start event without throwing', () => {
      const io = createMockIO(haltedFixture);
      expect(() => {
        processEvent('start', '/tmp/HALTED-FIXTURE', {}, io);
      }).not.toThrow();
    });
  });

  // ── PipelineResult shape ───────────────────────────────────────────────────

  describe('processEvent returns valid PipelineResult shape for all variants', () => {
    it('AUTO-COMMIT (completed, simple): returns valid PipelineResult', () => {
      const io = createMockIO(autoCommitState);
      const result = processEvent('start', '/tmp/AUTO-COMMIT', {}, io);
      assertValidPipelineResult(result, 'AUTO-COMMIT');
    });

    it('DAG-PIPELINE (completed, with corrective_tasks): returns valid PipelineResult', () => {
      const io = createMockIO(dagPipelineState);
      const result = processEvent('start', '/tmp/DAG-PIPELINE', {}, io);
      assertValidPipelineResult(result, 'DAG-PIPELINE');
    });

    it('In-progress fixture: returns valid PipelineResult', () => {
      const io = createMockIO(inProgressFixture);
      const result = processEvent('execution_started', '/tmp/DAG-PIPELINE-2', IN_PROGRESS_CTX, io);
      assertValidPipelineResult(result, 'DAG-PIPELINE-2');
    });

    it('Halted fixture: returns valid PipelineResult', () => {
      const io = createMockIO(haltedFixture);
      const result = processEvent('start', '/tmp/HALTED-FIXTURE', {}, io);
      assertValidPipelineResult(result, 'halted-fixture');
    });
  });

  // ── Action routing correctness ─────────────────────────────────────────────

  describe('Action routing correctness', () => {
    it('AUTO-COMMIT (completed): action is null or valid NEXT_ACTIONS member', () => {
      const io = createMockIO(autoCommitState);
      const result = processEvent('start', '/tmp/AUTO-COMMIT', {}, io);
      if (result.action !== null) {
        expect(VALID_ACTIONS.has(result.action), `'${result.action}' is not in NEXT_ACTIONS`).toBe(true);
      }
    });

    it('DAG-PIPELINE (completed, corrective_tasks): action is null or valid NEXT_ACTIONS member', () => {
      const io = createMockIO(dagPipelineState);
      const result = processEvent('start', '/tmp/DAG-PIPELINE', {}, io);
      if (result.action !== null) {
        expect(VALID_ACTIONS.has(result.action), `'${result.action}' is not in NEXT_ACTIONS`).toBe(true);
      }
    });

    it('In-progress fixture: success === true and action is a valid NEXT_ACTIONS member', () => {
      const io = createMockIO(inProgressFixture);
      const result = processEvent('execution_started', '/tmp/DAG-PIPELINE-2', IN_PROGRESS_CTX, io);
      expect(result.success).toBe(true);
      expect(result.action).not.toBeNull();
      expect(VALID_ACTIONS.has(result.action!), `'${result.action}' is not in NEXT_ACTIONS`).toBe(true);
    });

    it('Halted fixture: action is null or valid NEXT_ACTIONS member (no unhandled exceptions)', () => {
      const io = createMockIO(haltedFixture);
      const result = processEvent('start', '/tmp/HALTED-FIXTURE', {}, io);
      expect(typeof result.success).toBe('boolean');
      if (result.action !== null) {
        expect(VALID_ACTIONS.has(result.action), `'${result.action}' is not in NEXT_ACTIONS`).toBe(true);
      }
    });
  });

  // ── Template resolution proof ──────────────────────────────────────────────

  describe('Template resolution via graph.template_id', () => {
    it('All loaded states have graph.template_id === "full"', () => {
      expect(autoCommitState.graph.template_id).toBe('full');
      expect(dagPipelineState.graph.template_id).toBe('full');
      expect(inProgressFixture.graph.template_id).toBe('full');
      expect(haltedFixture.graph.template_id).toBe('full');
    });

    it('Engine processes all states with template_id "full" without template resolution errors', () => {
      const results = [
        processEvent('start', '/tmp/AUTO-COMMIT', {}, createMockIO(autoCommitState)),
        processEvent('start', '/tmp/DAG-PIPELINE', {}, createMockIO(dagPipelineState)),
        processEvent('execution_started', '/tmp/DAG-PIPELINE-2', IN_PROGRESS_CTX, createMockIO(inProgressFixture)),
        processEvent('start', '/tmp/HALTED-FIXTURE', {}, createMockIO(haltedFixture)),
      ];
      for (const result of results) {
        // If there's an error, it should not be a template-resolution failure
        if (!result.success && result.error) {
          expect(result.error.message).not.toMatch(/template/i);
        }
      }
    });
  });
});
