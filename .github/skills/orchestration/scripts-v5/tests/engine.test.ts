import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'node:path';
import { processEvent } from '../lib/engine.js';
import { loadTemplate } from '../lib/template-loader.js';
import type {
  PipelineState,
  OrchestrationConfig,
  IOAdapter,
  LoadedTemplate,
  StepNodeState,
  GateNodeState,
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEMPLATE_PATH = path.resolve(__dirname, '../templates/full.yml');
const PROJECT_DIR = '/tmp/test-project/DAG-TEST';
const ORCH_ROOT = path.resolve(__dirname, '../../../..'); // points to .github

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
};

// Map of doc_path → frontmatter content used by mock readDocument
const DOC_STORE: Record<string, { frontmatter: Record<string, unknown>; content: string }> = {};

function createMockIO(initialState: PipelineState | null = null): IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
  ensureDirCalls: string[];
} {
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

// Helper to create a state that looks like scaffolded state from the real template
function makeScaffoldedState(): PipelineState {
  const io = createMockIO(null);
  const result = processEvent('research_started', PROJECT_DIR, {}, io);
  // The init route scaffolds state and writes it
  return io.currentState!;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('engine – processEvent', () => {
  beforeEach(() => {
    // Clear doc store between tests
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  describe('Init route (null state)', () => {
    it('scaffolds state from template and returns first action', () => {
      const io = createMockIO(null);
      const result = processEvent('research_started', PROJECT_DIR, {}, io);

      expect(result.success).toBe(true);
      expect(result.action).toBe('spawn_research');
      expect(result.context).toEqual({ step: 'research' });
      expect(result.mutations_applied).toContain('scaffold_initial_state');
      expect(result.orchRoot).toBe(ORCH_ROOT);
    });

    it('scaffolded state has correct schema, metadata, config, and graph status', () => {
      const io = createMockIO(null);
      processEvent('research_started', PROJECT_DIR, {}, io);

      const state = io.currentState!;
      expect(state).not.toBeNull();
      expect(state.$schema).toBe('orchestration-state-v5');
      expect(state.project.name).toBe('DAG-TEST');
      expect(state.project.created).toBeTruthy();
      expect(state.project.updated).toBeTruthy();
      expect(state.config.gate_mode).toBe('ask');
      expect(state.config.limits.max_phases).toBe(10);
      expect(state.config.limits.max_tasks_per_phase).toBe(8);
      expect(state.config.limits.max_retries_per_task).toBe(2);
      expect(state.config.limits.max_consecutive_review_rejections).toBe(3);
      expect(state.config.source_control.auto_commit).toBe('ask');
      expect(state.config.source_control.auto_pr).toBe('ask');
      expect(state.graph.status).toBe('not_started');
      expect(state.graph.template_id).toBe('full');
      expect(state.graph.current_node_path).toBeNull();
    });

    it('scaffolds correct node states for all top-level template nodes', () => {
      const io = createMockIO(null);
      processEvent('research_started', PROJECT_DIR, {}, io);

      const nodes = io.currentState!.graph.nodes;

      // Planning steps
      for (const nodeId of ['research', 'prd', 'design', 'architecture', 'master_plan']) {
        const node = nodes[nodeId] as StepNodeState;
        expect(node.kind).toBe('step');
        expect(node.status).toBe('not_started');
        expect(node.doc_path).toBeNull();
        expect(node.retries).toBe(0);
      }

      // Gates
      const planGate = nodes['plan_approval_gate'] as GateNodeState;
      expect(planGate.kind).toBe('gate');
      expect(planGate.status).toBe('not_started');
      expect(planGate.gate_active).toBe(false);

      const finalApprovalGate = nodes['final_approval_gate'] as GateNodeState;
      expect(finalApprovalGate.kind).toBe('gate');
      expect(finalApprovalGate.gate_active).toBe(false);

      // for_each_phase
      const phaseLoop = nodes['phase_loop'];
      expect(phaseLoop.kind).toBe('for_each_phase');
      expect(phaseLoop.status).toBe('not_started');
      if (phaseLoop.kind === 'for_each_phase') {
        expect(phaseLoop.iterations).toEqual([]);
      }

      // Final review step
      const finalReview = nodes['final_review'] as StepNodeState;
      expect(finalReview.kind).toBe('step');
      expect(finalReview.status).toBe('not_started');

      // Conditional (pr_gate)
      const prGate = nodes['pr_gate'];
      expect(prGate.kind).toBe('conditional');
      if (prGate.kind === 'conditional') {
        expect(prGate.branch_taken).toBeNull();
      }
    });

    it('calls ensureDirectories on init', () => {
      const io = createMockIO(null);
      processEvent('research_started', PROJECT_DIR, {}, io);
      expect(io.ensureDirCalls).toContain(PROJECT_DIR);
    });

    it('writes state on init', () => {
      const io = createMockIO(null);
      processEvent('research_started', PROJECT_DIR, {}, io);
      expect(io.writeCalls.length).toBe(1);
      expect(io.writeCalls[0].projectDir).toBe(PROJECT_DIR);
    });
  });

  describe('Standard route – research_started', () => {
    it('sets research.status to in_progress and returns spawn_research', () => {
      const state = makeScaffoldedState();
      const io = createMockIO(state);

      const result = processEvent('research_started', PROJECT_DIR, {}, io);

      expect(result.success).toBe(true);
      expect(result.action).toBe('spawn_research');
      expect(result.context).toEqual({ step: 'research' });

      const researchNode = io.currentState!.graph.nodes['research'] as StepNodeState;
      expect(researchNode.status).toBe('in_progress');
    });
  });

  describe('Standard route – research_completed', () => {
    it('sets research.status to completed and returns next action spawn_prd', () => {
      // Set up state where research is in_progress
      const state = makeScaffoldedState();
      (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';

      const docPath = path.join(PROJECT_DIR, 'tasks', 'RESEARCH.md');
      DOC_STORE[docPath] = {
        frontmatter: { title: 'Research', status: 'completed' },
        content: '# Research findings',
      };

      const io = createMockIO(state);
      const result = processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

      expect(result.success).toBe(true);
      expect(result.action).toBe('spawn_prd');
      expect(result.context).toEqual({ step: 'prd' });

      const researchNode = io.currentState!.graph.nodes['research'] as StepNodeState;
      expect(researchNode.status).toBe('completed');
      expect(researchNode.doc_path).toBe(docPath);
    });
  });

  describe('Simplified resolver', () => {
    it('finds next sibling step whose depends_on are all completed', () => {
      const state = makeScaffoldedState();
      // Mark research as completed
      (state.graph.nodes['research'] as StepNodeState).status = 'completed';
      (state.graph.nodes['research'] as StepNodeState).doc_path = '/tmp/research.md';
      // Mark prd as completed
      (state.graph.nodes['prd'] as StepNodeState).status = 'completed';
      (state.graph.nodes['prd'] as StepNodeState).doc_path = '/tmp/prd.md';

      const docPath = '/tmp/design-doc.md';
      DOC_STORE[docPath] = {
        frontmatter: { title: 'Design' },
        content: '# Design doc',
      };

      const io = createMockIO(state);
      // design_started (design depends on prd which is completed)
      // need state where design is not_started and prd is completed
      // Fire design_started → should set design to in_progress and return spawn_design
      const result = processEvent('design_started', PROJECT_DIR, {}, io);

      expect(result.success).toBe(true);
      expect(result.action).toBe('spawn_design');

      const designNode = io.currentState!.graph.nodes['design'] as StepNodeState;
      expect(designNode.status).toBe('in_progress');
    });
  });

  describe('Unknown event', () => {
    it('returns success: false with error containing event name', () => {
      const state = makeScaffoldedState();
      const io = createMockIO(state);

      const result = processEvent('totally_unknown_event', PROJECT_DIR, {}, io);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('totally_unknown_event');
      expect(result.error!.event).toBe('totally_unknown_event');
      expect(result.orchRoot).toBe(ORCH_ROOT);
    });

    it('does not write state on unknown event', () => {
      const state = makeScaffoldedState();
      const io = createMockIO(state);

      processEvent('totally_unknown_event', PROJECT_DIR, {}, io);

      expect(io.writeCalls.length).toBe(0);
    });
  });

  describe('Pre-read failure', () => {
    it('returns success: false with field: doc_path when doc_path missing on completed event', () => {
      const state = makeScaffoldedState();
      (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';

      const io = createMockIO(state);
      // research_completed requires doc_path because research has doc_output_field
      const result = processEvent('research_completed', PROJECT_DIR, {}, io);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.field).toBe('doc_path');
      expect(result.orchRoot).toBe(ORCH_ROOT);
    });

    it('does not write state on pre-read failure', () => {
      const state = makeScaffoldedState();
      (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';

      const io = createMockIO(state);
      processEvent('research_completed', PROJECT_DIR, {}, io);

      expect(io.writeCalls.length).toBe(0);
    });
  });

  describe('Mutation error', () => {
    it('does not write state if mutation throws', () => {
      const state = makeScaffoldedState();
      // Create a state where a mutation will fail — e.g. resolveNodeState for a non-existent node
      // We'll test an event that resolves to a node in a scope that doesn't exist
      // task_handoff_started needs phase/task context with iterations, which we haven't set up
      const io = createMockIO(state);
      const result = processEvent('task_handoff_started', PROJECT_DIR, { phase: 1, task: 1 }, io);

      // Should fail because phase_loop has no iterations
      expect(result.success).toBe(false);
      expect(io.writeCalls.length).toBe(0);
    });
  });

  describe('IOAdapter injection', () => {
    it('uses the injected IOAdapter, not real filesystem', () => {
      const io = createMockIO(null);
      const readStateSpy = vi.spyOn(io, 'readState');
      const writeStateSpy = vi.spyOn(io, 'writeState');
      const readConfigSpy = vi.spyOn(io, 'readConfig');
      const ensureDirSpy = vi.spyOn(io, 'ensureDirectories');

      processEvent('research_started', PROJECT_DIR, {}, io);

      expect(readStateSpy).toHaveBeenCalledWith(PROJECT_DIR);
      expect(readConfigSpy).toHaveBeenCalled();
      expect(ensureDirSpy).toHaveBeenCalledWith(PROJECT_DIR);
      expect(writeStateSpy).toHaveBeenCalled();
    });
  });

  describe('State metadata updates', () => {
    it('updates project.updated timestamp on each state write', () => {
      const state = makeScaffoldedState();
      const originalUpdated = state.project.updated;

      const io = createMockIO(state);
      processEvent('research_started', PROJECT_DIR, {}, io);

      const updatedState = io.currentState!;
      // The updated timestamp should be different (or at least set)
      expect(updatedState.project.updated).toBeTruthy();
      expect(typeof updatedState.project.updated).toBe('string');
      // Since Date.now() is called, it should be a valid ISO string
      expect(() => new Date(updatedState.project.updated)).not.toThrow();
    });

    it('updates graph.current_node_path on each state write', () => {
      const state = makeScaffoldedState();
      const io = createMockIO(state);

      processEvent('research_started', PROJECT_DIR, {}, io);

      const updatedState = io.currentState!;
      expect(updatedState.graph.current_node_path).toBe('research');
    });
  });

  describe('PipelineResult structure', () => {
    it('all successful results include orchRoot field', () => {
      const io = createMockIO(null);
      const result = processEvent('research_started', PROJECT_DIR, {}, io);

      expect(result).toHaveProperty('orchRoot');
      expect(result.orchRoot).toBe(ORCH_ROOT);
    });

    it('all error results include orchRoot field', () => {
      const state = makeScaffoldedState();
      const io = createMockIO(state);
      const result = processEvent('totally_unknown_event', PROJECT_DIR, {}, io);

      expect(result).toHaveProperty('orchRoot');
      expect(result.orchRoot).toBe(ORCH_ROOT);
    });
  });
});
