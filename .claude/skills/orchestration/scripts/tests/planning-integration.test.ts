import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../lib/engine.js';
import { loadTemplate } from '../lib/template-loader.js';
import type {
  PipelineState,
  OrchestrationConfig,
  IOAdapter,
  PipelineResult,
  StepNodeState,
  GateNodeState,
} from '../lib/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/full.yml');
const PROJECT_DIR = '/tmp/test-project/INTEGRATION-TEST';
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
    execution_mode: 'autonomous',
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
const DOC_STORE: Record<string, { frontmatter: Record<string, unknown>; content: string }> = {};

// ── Mock IOAdapter factory ────────────────────────────────────────────────────

type MockIO = IOAdapter & {
  currentState: PipelineState | null;
  writeCalls: Array<{ projectDir: string; state: PipelineState }>;
  ensureDirCalls: string[];
};

function createMockIO(initialState: PipelineState | null = null): MockIO {
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

// Helper: scaffold a state by running the start event
function makeScaffoldedState(): PipelineState {
  const io = createMockIO(null);
  processEvent('start', PROJECT_DIR, {}, io);
  return io.currentState!;
}

// Helper: seed a document into DOC_STORE for readDocument lookups
function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
  DOC_STORE[docPath.replace(/\\/g, '/')] = {
    frontmatter: { title: path.basename(docPath, path.extname(docPath)), status: 'completed', ...extraFrontmatter },
    content: `# ${path.basename(docPath)}`,
  };
}

// ── Planning-tier integration — full sequence ─────────────────────────────────

describe('Planning-tier integration — full sequence', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('walks init → plan_approved producing correct action and state at every step', () => {
    const io = createMockIO(null);
    let result: PipelineResult;

    // ── Step 1: Init (null state → scaffold) ─────────────────────────────
    result = processEvent('start', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
    expect(result.mutations_applied).toContain('scaffold_initial_state');
    // Scaffolded state has all nodes at not_started
    {
      const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
      expect(n.status).toBe('not_started');
    }

    // ── Step 2: master_plan_started ──────────────────────────────────────
    result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
    {
      const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
      expect(n.status).toBe('in_progress');
      expect(io.currentState!.graph.status).toBe('in_progress');
    }

    // ── Step 3: master_plan_completed ────────────────────────────────────
    const mpDoc = path.posix.join(PROJECT_DIR, 'docs', 'master-plan.md');
    seedDoc(mpDoc, { total_phases: 1, total_tasks: 1 });
    result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');
    // Gate returns empty context
    expect(result.context).toEqual({});
    {
      const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
      expect(n.status).toBe('completed');
      expect(n.doc_path).toBe(mpDoc);
    }

    // ── Step 4: plan_approved ────────────────────────────────────────────
    // Post-Iter 7: with phase_planning + task_handoff body nodes removed from
    // full.yml, the walker can no longer expand task_loop without an explosion
    // script seeding phase_planning.doc_path. The plan_approval_gate still
    // closes correctly; the next action is null (walker stalls — production
    // pipeline would have invoked the explosion script before reaching here).
    result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBeNull();
    {
      const g = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
      expect(g.status).toBe('completed');
      expect(g.gate_active).toBe(true);
    }
  });
});

// ── Planning-tier — individual step checks ────────────────────────────────────

describe('Planning-tier — individual step checks', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('master_plan_started sets graph.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('in_progress');
  });

  it('master_plan_started sets master_plan.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('master_plan_completed stores doc_path and returns request_plan_approval', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.posix.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(docPath, { total_phases: 1 });
    const io = createMockIO(state);

    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('request_plan_approval');
    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('plan_approved sets plan_approval_gate.gate_active to true', () => {
    const state = makeScaffoldedState();
    // Mark master_plan completed so plan_approval_gate deps are met
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'completed';
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/tmp/master_plan.md';
    const io = createMockIO(state);
    DOC_STORE['/tmp/master_plan.md'] = {
      frontmatter: { total_phases: 3, total_tasks: 6 },
      content: '---\ntotal_phases: 3\ntotal_tasks: 6\n---\n# Master Plan',
    };

    const result = processEvent('plan_approved', PROJECT_DIR, { doc_path: '/tmp/master_plan.md' }, io);

    expect(result.success).toBe(true);
    const g = io.currentState!.graph.nodes['plan_approval_gate'] as GateNodeState;
    expect(g.status).toBe('completed');
    expect(g.gate_active).toBe(true);
  });
});

// ── Planning-tier — error scenarios ──────────────────────────────────────────

describe('Planning-tier — error scenarios', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('unknown event returns success: false with error containing the event name', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('bogus_event', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('bogus_event');
    expect(result.error!.event).toBe('bogus_event');
  });

  it('unknown event does not write state', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    processEvent('bogus_event', PROJECT_DIR, {}, io);

    expect(io.writeCalls.length).toBe(0);
  });

  it('missing doc_path on _completed event returns success: false with field: doc_path', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);

    // master_plan_completed requires doc_path (master_plan has doc_output_field)
    const result = processEvent('master_plan_completed', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
  });

  it('missing doc_path on _completed event does not write state', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);

    processEvent('master_plan_completed', PROJECT_DIR, {}, io);

    expect(io.writeCalls.length).toBe(0);
  });

  it('unreadable document (doc_path not in DOC_STORE) returns success: false with field: doc_path', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);
    // doc_path is absolute but NOT seeded in DOC_STORE
    const missingDoc = path.join(PROJECT_DIR, 'nonexistent', 'doc.md');

    const result = processEvent('master_plan_completed', PROJECT_DIR, { doc_path: missingDoc }, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
  });

  it('unreadable document does not write state', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);
    const missingDoc = path.join(PROJECT_DIR, 'nonexistent', 'doc.md');

    processEvent('master_plan_completed', PROJECT_DIR, { doc_path: missingDoc }, io);

    expect(io.writeCalls.length).toBe(0);
  });

  it('error responses conform to full contract shape', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const unknownResult = processEvent('bogus_event', PROJECT_DIR, {}, io);
    expect(unknownResult).toMatchObject({
      success: false,
      action: null,
      context: {},
      mutations_applied: [],
      orchRoot: ORCH_ROOT,
      error: { message: expect.any(String), event: 'bogus_event' },
    });

    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const io2 = createMockIO(state);
    const missingFieldResult = processEvent('master_plan_completed', PROJECT_DIR, {}, io2);
    expect(missingFieldResult).toMatchObject({
      success: false,
      action: null,
      context: {},
      mutations_applied: [],
      orchRoot: ORCH_ROOT,
      error: { message: expect.any(String), event: 'master_plan_completed', field: 'doc_path' },
    });
  });
});

// ── Planning-tier — state invariants ─────────────────────────────────────────

describe('Planning-tier — state invariants', () => {
  beforeEach(() => {
    for (const key of Object.keys(DOC_STORE)) {
      delete DOC_STORE[key];
    }
  });

  it('project.updated advances after each successful event', () => {
    const state = makeScaffoldedState();
    // Pin the timestamp to a known past value so any real call will differ
    const pastTimestamp = '2000-01-01T00:00:00.000Z';
    state.project.updated = pastTimestamp;
    const io = createMockIO(state);

    processEvent('master_plan_started', PROJECT_DIR, {}, io);

    const updated = io.currentState!.project.updated;
    expect(updated).toBeTruthy();
    expect(typeof updated).toBe('string');
    // Must be a parseable ISO string
    expect(() => new Date(updated)).not.toThrow();
    // Must have advanced past the pinned timestamp
    expect(updated).not.toBe(pastTimestamp);
    expect(new Date(updated).getTime()).toBeGreaterThan(new Date(pastTimestamp).getTime());
  });

  it('graph.current_node_path is set to the event node path after each successful event', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(io.currentState!.graph.current_node_path).toBe('master_plan');

    const mpPath = path.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(mpPath, { total_phases: 1 });
    processEvent('master_plan_completed', PROJECT_DIR, { doc_path: mpPath }, io);
    expect(io.currentState!.graph.current_node_path).toBe('master_plan');
  });

  it('graph.current_node_path is set to plan_approval_gate after plan_approved', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'completed';
    (state.graph.nodes['master_plan'] as StepNodeState).doc_path = '/tmp/master_plan.md';
    const io = createMockIO(state);
    DOC_STORE['/tmp/master_plan.md'] = {
      frontmatter: { total_phases: 3, total_tasks: 6 },
      content: '---\ntotal_phases: 3\ntotal_tasks: 6\n---\n# Master Plan',
    };

    processEvent('plan_approved', PROJECT_DIR, { doc_path: '/tmp/master_plan.md' }, io);

    expect(io.currentState!.graph.current_node_path).toBe('plan_approval_gate');
  });

  it('deep-clone guarantee: original state passed to createMockIO is not mutated', () => {
    const state = makeScaffoldedState();
    // Take a snapshot before passing to IO
    const snapshot = structuredClone(state);
    const io = createMockIO(state);

    processEvent('master_plan_started', PROJECT_DIR, {}, io);

    // The original state object must be unchanged
    expect(state).toEqual(snapshot);
  });

  it('template loads correctly from TEMPLATE_PATH', () => {
    // Verify the template is reachable and contains expected planning nodes
    const loaded = loadTemplate(TEMPLATE_PATH);
    const nodeIds = loaded.template.nodes.map((n) => n.id);
    expect(nodeIds).toContain('master_plan');
    expect(nodeIds).toContain('plan_approval_gate');
    expect(nodeIds).toContain('phase_loop');
  });
});
