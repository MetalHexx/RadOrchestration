import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateState } from '../lib/validator.js';
import { processEvent } from '../lib/engine.js';
import { loadTemplate } from '../lib/template-loader.js';
import { scaffoldNodeState } from '../lib/scaffold.js';
import type {
  PipelineState,
  OrchestrationConfig,
  PipelineTemplate,
  IOAdapter,
  NodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  ParallelNodeState,
  CorrectiveTaskEntry,
  IterationEntry,
  StepNodeState,
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/full.yml');
const PROJECT_DIR = '/tmp/test-project/VALIDATOR-TEST';
const ORCH_ROOT = path.resolve(__dirname, '../../../..');

const DEFAULT_CONFIG: OrchestrationConfig = {
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

const loaded = loadTemplate(path.join(ORCH_ROOT, 'skills/rad-orchestration/templates/full.yml'));
const TEMPLATE = loaded.template;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalState(): PipelineState {
  const nodes: Record<string, NodeState> = {};
  for (const nodeDef of TEMPLATE.nodes) {
    nodes[nodeDef.id] = scaffoldNodeState(nodeDef);
  }
  return {
    $schema: 'orchestration-state-v5',
    project: { name: 'TEST', created: '2025-01-01T00:00:00Z', updated: '2025-01-01T00:00:00Z' },
    config: {
      gate_mode: 'ask',
      limits: {
        max_phases: 10,
        max_tasks_per_phase: 8,
        max_retries_per_task: 2,
        max_consecutive_review_rejections: 3,
      },
      source_control: { auto_commit: 'ask', auto_pr: 'ask' },
    },
    pipeline: {
      gate_mode: null,
      source_control: null,
      current_tier: 'planning',
      halt_reason: null,
    },
    graph: {
      template_id: 'full',
      status: 'not_started',
      current_node_path: null,
      nodes,
    },
  };
}

function makeValidCorrectiveEntry(overrides?: Partial<CorrectiveTaskEntry>): CorrectiveTaskEntry {
  return {
    index: 1,
    reason: 'review failed',
    injected_after: 'code_review',
    status: 'not_started',
    nodes: {
      fix_task: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 } as StepNodeState,
    },
    commit_hash: null,
    ...overrides,
  };
}

function makeIterationEntry(index: number, overrides?: Partial<IterationEntry>): IterationEntry {
  return {
    index,
    status: 'not_started',
    nodes: {
      task_step: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 } as StepNodeState,
    },
    corrective_tasks: [],
    commit_hash: null,
    ...overrides,
  };
}

function createMockIO(initialState: PipelineState | null = null): IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
} {
  let currentState = initialState ? structuredClone(initialState) : null;
  const writeCalls: Array<{ projectDir: string; state: PipelineState }> = [];

  return {
    get currentState() { return currentState; },
    writeCalls,
    readState(_pd: string) { return currentState ? structuredClone(currentState) : null; },
    writeState(_pd: string, state: PipelineState) {
      currentState = structuredClone(state);
      writeCalls.push({ projectDir: _pd, state: structuredClone(state) });
    },
    readConfig() { return structuredClone(DEFAULT_CONFIG); },
    readDocument() { return null; },
    ensureDirectories() {},
  };
}

// ── Tests: validateState ──────────────────────────────────────────────────────

describe('validator – validateState', () => {
  describe('valid state', () => {
    it('returns empty array for scaffolded state', () => {
      const state = makeMinimalState();
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors).toEqual([]);
    });

    it('returns empty array when for_each has zero iterations', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      expect(phaseLoop.iterations).toEqual([]);
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors).toEqual([]);
    });
  });

  describe('invalid graph status', () => {
    it('detects invalid graph status value', () => {
      const state = makeMinimalState();
      (state.graph as any).status = 'running';
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('running'))).toBe(true);
    });
  });

  describe('invalid node statuses', () => {
    it('detects invalid status on top-level step node', () => {
      const state = makeMinimalState();
      (state.graph.nodes['master_plan'] as any).status = 'active';
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('active'))).toBe(true);
    });

    it('detects invalid status nested inside for_each_phase iteration', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        nodes: {
          inner: { kind: 'step', status: 'bogus' as any, doc_path: null, retries: 0 } as any,
        },
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('bogus'))).toBe(true);
    });

    it('detects invalid status nested inside corrective_tasks entry', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        corrective_tasks: [
          makeValidCorrectiveEntry({
            nodes: {
              fix: { kind: 'step', status: 'invalid_status' as any, doc_path: null, retries: 0 } as any,
            },
          }),
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('invalid_status'))).toBe(true);
    });
  });

  describe('iteration indices', () => {
    it('detects out-of-order iteration indices', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(
        makeIterationEntry(0),
        makeIterationEntry(2),  // should be 1
        makeIterationEntry(1),  // should be 2
      );
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('index mismatch'))).toBe(true);
    });

    it('detects out-of-order corrective task indices', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        corrective_tasks: [
          makeValidCorrectiveEntry({ index: 1 }),
          makeValidCorrectiveEntry({ index: 3 }),  // should be 2
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Corrective task index mismatch'))).toBe(true);
    });

    it('detects corrective task with index 0 (should be 1-based)', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        corrective_tasks: [
          makeValidCorrectiveEntry({ index: 0 }),
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      // Index 0 should trigger both index mismatch (expected 1, got 0) and structure check (index < 1)
      expect(errors.some(e => e.includes('0'))).toBe(true);
    });
  });

  describe('completed parent with in_progress children', () => {
    it('detects in_progress child in completed for_each_phase', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.status = 'completed';
      phaseLoop.iterations.push(makeIterationEntry(0, {
        status: 'completed',
        nodes: {
          task_step: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } as StepNodeState,
        },
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('in_progress') && e.includes('completed'))).toBe(true);
    });

    it('detects in_progress child in completed parallel node', () => {
      const state = makeMinimalState();
      // Find or create a parallel node
      const parallelNode: ParallelNodeState = {
        kind: 'parallel',
        status: 'completed',
        nodes: {
          child_a: { kind: 'step', status: 'completed', doc_path: null, retries: 0 } as StepNodeState,
          child_b: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } as StepNodeState,
        },
      };
      state.graph.nodes['test_parallel'] = parallelNode;
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('in_progress') && e.includes('completed'))).toBe(true);
    });

    it('detects in_progress node inside corrective_tasks when for_each parent is completed', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.status = 'completed';
      phaseLoop.iterations.push(makeIterationEntry(0, {
        status: 'completed',
        corrective_tasks: [
          makeValidCorrectiveEntry({
            nodes: {
              fix_task: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 } as StepNodeState,
            },
          }),
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('in_progress') && e.includes('completed'))).toBe(true);
    });
  });

  describe('corrective task structure', () => {
    it('detects corrective task with empty reason', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        corrective_tasks: [
          makeValidCorrectiveEntry({ reason: '' }),
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('reason'))).toBe(true);
    });

    it('detects corrective task with empty nodes', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        corrective_tasks: [
          makeValidCorrectiveEntry({ nodes: {} }),
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('nodes'))).toBe(true);
    });

    it('detects corrective task with invalid status', () => {
      const state = makeMinimalState();
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        corrective_tasks: [
          makeValidCorrectiveEntry({ status: 'bad_status' as any }),
        ],
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('bad_status'))).toBe(true);
    });
  });

  describe('iteration count limits', () => {
    it('detects for_each_phase iterations exceeding max_phases', () => {
      const state = makeMinimalState();
      const configWithLowLimit = structuredClone(DEFAULT_CONFIG);
      configWithLowLimit.limits.max_phases = 2;
      state.config.limits.max_phases = 2;
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(
        makeIterationEntry(0),
        makeIterationEntry(1),
        makeIterationEntry(2),  // 3 exceeds limit of 2
      );
      const errors = validateState(null, state, configWithLowLimit, TEMPLATE);
      expect(errors.some(e => e.includes('max_phases'))).toBe(true);
    });

    it('detects for_each_task iterations exceeding max_tasks_per_phase', () => {
      const state = makeMinimalState();
      const configWithLowLimit = structuredClone(DEFAULT_CONFIG);
      configWithLowLimit.limits.max_tasks_per_phase = 1;
      state.config.limits.max_tasks_per_phase = 1;
      // Create a for_each_task node inside a phase iteration
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      const taskLoop: ForEachTaskNodeState = {
        kind: 'for_each_task',
        status: 'in_progress',
        iterations: [
          makeIterationEntry(0),
          makeIterationEntry(1),  // 2 exceeds limit of 1
        ],
      };
      phaseLoop.iterations.push(makeIterationEntry(0, {
        nodes: { task_loop: taskLoop },
      }));
      const errors = validateState(null, state, configWithLowLimit, TEMPLATE);
      expect(errors.some(e => e.includes('max_tasks_per_phase'))).toBe(true);
    });
  });

  describe('node kind matches template', () => {
    it('detects kind mismatch between state and template', () => {
      const state = makeMinimalState();
      // master_plan is a 'step' in the template — change it to 'gate'
      (state.graph.nodes['master_plan'] as any).kind = 'gate';
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('master_plan') && e.includes('gate') && e.includes('step'))).toBe(true);
    });

    it('detects kind mismatch for node nested inside for_each_phase body iteration', () => {
      const state = makeMinimalState();
      // phase_review is a 'step' in the template body of phase_loop — inject an iteration with wrong kind
      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(makeIterationEntry(0, {
        nodes: {
          phase_review: { kind: 'gate', status: 'not_started', gate_active: false } as any,
        },
      }));
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('phase_review') && e.includes('gate') && e.includes('step'))).toBe(true);
    });
  });

  describe('config parameter authority', () => {
    it('uses passed config.limits over state.config.limits for iteration checks', () => {
      const state = makeMinimalState();
      // State says max_phases=10 (permissive)
      state.config.limits.max_phases = 10;
      // Config says max_phases=1 (restrictive)
      const restrictiveConfig = structuredClone(DEFAULT_CONFIG);
      restrictiveConfig.limits.max_phases = 1;

      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(
        makeIterationEntry(0),
        makeIterationEntry(1), // 2 iterations > config's max_phases=1
      );
      const errors = validateState(null, state, restrictiveConfig, TEMPLATE);
      expect(errors.some(e => e.includes('max_phases'))).toBe(true);
    });

    it('does not flag when state.config.limits is low but passed config is permissive', () => {
      const state = makeMinimalState();
      // State says max_phases=1 (would trigger if read from state)
      state.config.limits.max_phases = 1;

      const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
      phaseLoop.iterations.push(
        makeIterationEntry(0),
        makeIterationEntry(1), // 2 iterations — state says too many, config says fine
      );
      // DEFAULT_CONFIG has max_phases=10 (permissive)
      const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
      expect(errors.some(e => e.includes('max_phases'))).toBe(false);
    });
  });
});

// ── Tests: status transitions ─────────────────────────────────────────────────

describe('validator – status transitions', () => {
  it('illegal: skipped → in_progress produces validation error', () => {
    const prev = makeMinimalState();
    (prev.graph.nodes['master_plan'] as StepNodeState).status = 'skipped';
    const proposed = structuredClone(prev);
    (proposed.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('skipped') && e.includes('in_progress'))).toBe(true);
  });

  it('illegal: halted → completed produces validation error', () => {
    const prev = makeMinimalState();
    (prev.graph.nodes['master_plan'] as StepNodeState).status = 'halted';
    const proposed = structuredClone(prev);
    (proposed.graph.nodes['master_plan'] as StepNodeState).status = 'completed';
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('halted') && e.includes('completed'))).toBe(true);
  });

  it('legal: not_started → completed produces no error', () => {
    const prev = makeMinimalState();
    const proposed = structuredClone(prev);
    (proposed.graph.nodes['master_plan'] as StepNodeState).status = 'completed';
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('Illegal status transition') && e.includes('master_plan'))).toBe(false);
  });

  it('legal: completed → not_started produces no error (plan_rejected reset)', () => {
    const prev = makeMinimalState();
    (prev.graph.nodes['master_plan'] as StepNodeState).status = 'completed';
    const proposed = structuredClone(prev);
    (proposed.graph.nodes['master_plan'] as StepNodeState).status = 'not_started';
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('Illegal status transition') && e.includes('master_plan'))).toBe(false);
  });

  it('legal: completed → in_progress produces no error (rejection re-entry)', () => {
    const prev = makeMinimalState();
    (prev.graph.nodes['master_plan'] as StepNodeState).status = 'completed';
    const proposed = structuredClone(prev);
    (proposed.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('Illegal status transition') && e.includes('master_plan'))).toBe(false);
  });

  it('null previous state (init) produces no transition errors', () => {
    const proposed = makeMinimalState();
    const errors = validateState(null, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('Illegal status transition'))).toBe(false);
  });

  it('new node in proposed state absent from previous produces no error', () => {
    const prev = makeMinimalState();
    const proposed = structuredClone(prev);
    // Add a new node only in proposed state
    (proposed.graph.nodes['brand_new_node'] as any) = { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 };
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('brand_new_node') && e.includes('Illegal'))).toBe(false);
  });

  it('illegal: skipped → in_progress inside for_each iteration produces error with path', () => {
    const prev = makeMinimalState();
    const phaseLoop = prev.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations.push(makeIterationEntry(0, {
      nodes: {
        task_step: { kind: 'step', status: 'skipped', doc_path: null, retries: 0 } as StepNodeState,
      },
    }));
    const proposed = structuredClone(prev);
    const proposedPhaseLoop = proposed.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    (proposedPhaseLoop.iterations[0].nodes['task_step'] as StepNodeState).status = 'in_progress';
    const errors = validateState(prev, proposed, DEFAULT_CONFIG, TEMPLATE);
    expect(errors.some(e => e.includes('iterations[0]') && e.includes('skipped') && e.includes('in_progress'))).toBe(true);
  });

  it('engine integration: illegal transition prevents state write', () => {
    // Scaffold valid initial state via the engine
    const initIO = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, initIO);
    const scaffolded = initIO.currentState!;

    // Corrupt the previous state so 'master_plan' is skipped
    const corrupted = structuredClone(scaffolded);
    (corrupted.graph.nodes['master_plan'] as StepNodeState).status = 'skipped';

    // Proposed state (what master_plan_started would produce) has master_plan as in_progress
    // We simulate this by feeding the engine a previous state with master_plan=skipped
    // so when master_plan_started fires and sets it to in_progress, validation catches it
    const io = createMockIO(corrupted);
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(io.writeCalls.length).toBe(0);
  });
});

// ── Tests: engine integration ─────────────────────────────────────────────────

describe('validator – engine integration', () => {
  it('engine returns success: false and does NOT write state when validation fails', () => {
    // Create a state with an invalid node status to trigger validation failure
    // Corrupt a node that the master_plan_started mutation won't touch (final_review, not master_plan)
    const state = makeMinimalState();
    state.graph.status = 'in_progress';
    (state.graph.nodes['final_review'] as any).status = 'invalid_bogus';
    const io = createMockIO(state);
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(io.writeCalls.length).toBe(0);
  });

  it('engine returns success: true and DOES write state when validation passes', () => {
    // Use the start event to scaffold valid state first
    const initIO = createMockIO(null);
    processEvent('start', PROJECT_DIR, {}, initIO);
    const scaffoldedState = initIO.currentState!;

    // Now process master_plan_started with existing state (standard route)
    const io = createMockIO(scaffoldedState);
    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(io.writeCalls.length).toBe(1);
  });
});

// ── Tests: schema validation integration ─────────────────────────────────────

describe('validator – schema validation integration', () => {
  it('schema violation on proposed state causes validateState to return [schema]-prefixed errors', () => {
    const state = makeMinimalState();
    (state.graph as any).status = 'running';
    const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
    const schemaErrors = errors.filter(e => e.startsWith('[schema]'));
    expect(schemaErrors.length).toBeGreaterThan(0);
    expect(schemaErrors[0]).toContain('graph.status');
  });

  it('mixed schema + structural violations: [schema] errors appear before non-prefixed structural errors', () => {
    const state = makeMinimalState();
    // Introduce a schema violation (invalid enum)
    (state.graph as any).status = 'running';
    // Introduce a structural violation (corrective task with empty reason)
    const phaseLoop = state.graph.nodes['phase_loop'] as ForEachPhaseNodeState;
    phaseLoop.iterations.push(makeIterationEntry(0, {
      corrective_tasks: [
        makeValidCorrectiveEntry({ reason: '' }),
      ],
    }));
    const errors = validateState(null, state, DEFAULT_CONFIG, TEMPLATE);
    const firstSchemaIdx = errors.findIndex(e => e.startsWith('[schema]'));
    const firstStructuralIdx = errors.findIndex(e => !e.startsWith('[schema]'));
    expect(firstSchemaIdx).toBeGreaterThanOrEqual(0);
    expect(firstStructuralIdx).toBeGreaterThanOrEqual(0);
    expect(firstSchemaIdx).toBeLessThan(firstStructuralIdx);
  });
});
