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
const TEMPLATE_PATH = path.resolve(__dirname, '../templates/full.yml');
const PROJECT_DIR = '/tmp/test-project/INTEGRATION-TEST';
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
      return DOC_STORE[docPath] ?? null;
    },
    ensureDirectories(projectDir: string): void {
      ensureDirCalls.push(projectDir);
    },
  };
}

// Helper: scaffold a state by running the init route
function makeScaffoldedState(): PipelineState {
  const io = createMockIO(null);
  processEvent('research_started', PROJECT_DIR, {}, io);
  return io.currentState!;
}

// Helper: seed a document into DOC_STORE for readDocument lookups
function seedDoc(docPath: string, extraFrontmatter: Record<string, unknown> = {}): void {
  DOC_STORE[docPath] = {
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
    result = processEvent('research_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_research');
    expect(result.context).toEqual({ step: 'research' });
    expect(result.mutations_applied).toContain('scaffold_initial_state');
    // Scaffolded state has all nodes at not_started
    {
      const n = io.currentState!.graph.nodes['research'] as StepNodeState;
      expect(n.status).toBe('not_started');
    }

    // ── Step 2: research_started ──────────────────────────────────────────
    result = processEvent('research_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_research');
    expect(result.context).toEqual({ step: 'research' });
    {
      const n = io.currentState!.graph.nodes['research'] as StepNodeState;
      expect(n.status).toBe('in_progress');
      expect(io.currentState!.graph.status).toBe('in_progress');
    }

    // ── Step 3: research_completed ────────────────────────────────────────
    const researchDoc = path.join(PROJECT_DIR, 'docs', 'research.md');
    seedDoc(researchDoc);
    result = processEvent('research_completed', PROJECT_DIR, { doc_path: researchDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
    {
      const n = io.currentState!.graph.nodes['research'] as StepNodeState;
      expect(n.status).toBe('completed');
      expect(n.doc_path).toBe(researchDoc);
    }

    // ── Step 4: prd_started ───────────────────────────────────────────────
    result = processEvent('prd_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    expect(result.context).toEqual({ step: 'prd' });
    {
      const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
      expect(n.status).toBe('in_progress');
    }

    // ── Step 5: prd_completed ─────────────────────────────────────────────
    const prdDoc = path.join(PROJECT_DIR, 'docs', 'prd.md');
    seedDoc(prdDoc);
    result = processEvent('prd_completed', PROJECT_DIR, { doc_path: prdDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
    {
      const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
      expect(n.status).toBe('completed');
      expect(n.doc_path).toBe(prdDoc);
    }

    // ── Step 6: design_started ────────────────────────────────────────────
    result = processEvent('design_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    expect(result.context).toEqual({ step: 'design' });
    {
      const n = io.currentState!.graph.nodes['design'] as StepNodeState;
      expect(n.status).toBe('in_progress');
    }

    // ── Step 7: design_completed ──────────────────────────────────────────
    const designDoc = path.join(PROJECT_DIR, 'docs', 'design.md');
    seedDoc(designDoc);
    result = processEvent('design_completed', PROJECT_DIR, { doc_path: designDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
    {
      const n = io.currentState!.graph.nodes['design'] as StepNodeState;
      expect(n.status).toBe('completed');
      expect(n.doc_path).toBe(designDoc);
    }

    // ── Step 8: architecture_started ─────────────────────────────────────
    result = processEvent('architecture_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    expect(result.context).toEqual({ step: 'architecture' });
    {
      const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
      expect(n.status).toBe('in_progress');
    }

    // ── Step 9: architecture_completed ───────────────────────────────────
    const archDoc = path.join(PROJECT_DIR, 'docs', 'architecture.md');
    seedDoc(archDoc);
    result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: archDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
    {
      const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
      expect(n.status).toBe('completed');
      expect(n.doc_path).toBe(archDoc);
    }

    // ── Step 10: master_plan_started ──────────────────────────────────────
    result = processEvent('master_plan_started', PROJECT_DIR, {}, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    expect(result.context).toEqual({ step: 'master_plan' });
    {
      const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
      expect(n.status).toBe('in_progress');
    }

    // ── Step 11: master_plan_completed ────────────────────────────────────
    const mpDoc = path.join(PROJECT_DIR, 'docs', 'master-plan.md');
    seedDoc(mpDoc, { total_phases: 1 });
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

    // ── Step 12: plan_approved ────────────────────────────────────────────
    // With total_phases: 1, the walker expands the phase_loop and returns
    // the first phase action (create_phase_plan)
    result = processEvent('plan_approved', PROJECT_DIR, { doc_path: mpDoc }, io);
    expect(result.success).toBe(true);
    expect(result.action).toBe('create_phase_plan');
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

  it('research_started sets graph.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('research_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    expect(io.currentState!.graph.status).toBe('in_progress');
  });

  it('prd_started sets prd.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('prd_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('design_started sets design.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('design_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const n = io.currentState!.graph.nodes['design'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('architecture_started sets architecture.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('architecture_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('master_plan_started sets master_plan.status to in_progress', () => {
    const state = makeScaffoldedState();
    const io = createMockIO(state);

    const result = processEvent('master_plan_started', PROJECT_DIR, {}, io);

    expect(result.success).toBe(true);
    const n = io.currentState!.graph.nodes['master_plan'] as StepNodeState;
    expect(n.status).toBe('in_progress');
  });

  it('research_completed stores doc_path and returns spawn_prd', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'research.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_prd');
    const n = io.currentState!.graph.nodes['research'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('prd_completed stores doc_path and returns spawn_design', () => {
    const state = makeScaffoldedState();
    // Set research completed so resolver moves past it
    (state.graph.nodes['research'] as StepNodeState).status = 'completed';
    (state.graph.nodes['research'] as StepNodeState).doc_path = '/tmp/r.md';
    (state.graph.nodes['prd'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'prd.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('prd_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_design');
    const n = io.currentState!.graph.nodes['prd'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('design_completed stores doc_path and returns spawn_architecture', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'completed';
    (state.graph.nodes['research'] as StepNodeState).doc_path = '/tmp/r.md';
    (state.graph.nodes['prd'] as StepNodeState).status = 'completed';
    (state.graph.nodes['prd'] as StepNodeState).doc_path = '/tmp/p.md';
    (state.graph.nodes['design'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'design.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('design_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_architecture');
    const n = io.currentState!.graph.nodes['design'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('architecture_completed stores doc_path and returns spawn_master_plan', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'completed';
    (state.graph.nodes['research'] as StepNodeState).doc_path = '/tmp/r.md';
    (state.graph.nodes['prd'] as StepNodeState).status = 'completed';
    (state.graph.nodes['prd'] as StepNodeState).doc_path = '/tmp/p.md';
    (state.graph.nodes['design'] as StepNodeState).status = 'completed';
    (state.graph.nodes['design'] as StepNodeState).doc_path = '/tmp/d.md';
    (state.graph.nodes['architecture'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'architecture.md');
    seedDoc(docPath);
    const io = createMockIO(state);

    const result = processEvent('architecture_completed', PROJECT_DIR, { doc_path: docPath }, io);

    expect(result.success).toBe(true);
    expect(result.action).toBe('spawn_master_plan');
    const n = io.currentState!.graph.nodes['architecture'] as StepNodeState;
    expect(n.status).toBe('completed');
    expect(n.doc_path).toBe(docPath);
  });

  it('master_plan_completed stores doc_path and returns request_plan_approval', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'completed';
    (state.graph.nodes['research'] as StepNodeState).doc_path = '/tmp/r.md';
    (state.graph.nodes['prd'] as StepNodeState).status = 'completed';
    (state.graph.nodes['prd'] as StepNodeState).doc_path = '/tmp/p.md';
    (state.graph.nodes['design'] as StepNodeState).status = 'completed';
    (state.graph.nodes['design'] as StepNodeState).doc_path = '/tmp/d.md';
    (state.graph.nodes['architecture'] as StepNodeState).status = 'completed';
    (state.graph.nodes['architecture'] as StepNodeState).doc_path = '/tmp/a.md';
    (state.graph.nodes['master_plan'] as StepNodeState).status = 'in_progress';
    const docPath = path.join(PROJECT_DIR, 'master-plan.md');
    seedDoc(docPath);
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
    // Mark all planning steps completed so plan_approval_gate deps are met
    for (const nodeId of ['research', 'prd', 'design', 'architecture', 'master_plan']) {
      (state.graph.nodes[nodeId] as StepNodeState).status = 'completed';
      (state.graph.nodes[nodeId] as StepNodeState).doc_path = `/tmp/${nodeId}.md`;
    }
    const io = createMockIO(state);

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
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);

    // research_completed requires doc_path (research has doc_output_field)
    const result = processEvent('research_completed', PROJECT_DIR, {}, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
  });

  it('missing doc_path on _completed event does not write state', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);

    processEvent('research_completed', PROJECT_DIR, {}, io);

    expect(io.writeCalls.length).toBe(0);
  });

  it('unreadable document (doc_path not in DOC_STORE) returns success: false with field: doc_path', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);
    // doc_path is absolute but NOT seeded in DOC_STORE
    const missingDoc = path.join(PROJECT_DIR, 'nonexistent', 'doc.md');

    const result = processEvent('research_completed', PROJECT_DIR, { doc_path: missingDoc }, io);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.field).toBe('doc_path');
  });

  it('unreadable document does not write state', () => {
    const state = makeScaffoldedState();
    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const io = createMockIO(state);
    const missingDoc = path.join(PROJECT_DIR, 'nonexistent', 'doc.md');

    processEvent('research_completed', PROJECT_DIR, { doc_path: missingDoc }, io);

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

    (state.graph.nodes['research'] as StepNodeState).status = 'in_progress';
    const io2 = createMockIO(state);
    const missingFieldResult = processEvent('research_completed', PROJECT_DIR, {}, io2);
    expect(missingFieldResult).toMatchObject({
      success: false,
      action: null,
      context: {},
      mutations_applied: [],
      orchRoot: ORCH_ROOT,
      error: { message: expect.any(String), event: 'research_completed', field: 'doc_path' },
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

    processEvent('research_started', PROJECT_DIR, {}, io);

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

    processEvent('research_started', PROJECT_DIR, {}, io);
    expect(io.currentState!.graph.current_node_path).toBe('research');

    const docPath = path.join(PROJECT_DIR, 'research.md');
    seedDoc(docPath);
    processEvent('research_completed', PROJECT_DIR, { doc_path: docPath }, io);
    expect(io.currentState!.graph.current_node_path).toBe('research');

    processEvent('prd_started', PROJECT_DIR, {}, io);
    expect(io.currentState!.graph.current_node_path).toBe('prd');

    const prdPath = path.join(PROJECT_DIR, 'prd.md');
    seedDoc(prdPath);
    processEvent('prd_completed', PROJECT_DIR, { doc_path: prdPath }, io);
    expect(io.currentState!.graph.current_node_path).toBe('prd');

    processEvent('design_started', PROJECT_DIR, {}, io);
    expect(io.currentState!.graph.current_node_path).toBe('design');
  });

  it('graph.current_node_path is set to plan_approval_gate after plan_approved', () => {
    const state = makeScaffoldedState();
    for (const nodeId of ['research', 'prd', 'design', 'architecture', 'master_plan']) {
      (state.graph.nodes[nodeId] as StepNodeState).status = 'completed';
      (state.graph.nodes[nodeId] as StepNodeState).doc_path = `/tmp/${nodeId}.md`;
    }
    const io = createMockIO(state);

    processEvent('plan_approved', PROJECT_DIR, { doc_path: '/tmp/master_plan.md' }, io);

    expect(io.currentState!.graph.current_node_path).toBe('plan_approval_gate');
  });

  it('deep-clone guarantee: original state passed to createMockIO is not mutated', () => {
    const state = makeScaffoldedState();
    // Take a snapshot before passing to IO
    const snapshot = structuredClone(state);
    const io = createMockIO(state);

    processEvent('research_started', PROJECT_DIR, {}, io);

    // The original state object must be unchanged
    expect(state).toEqual(snapshot);
  });

  it('template loads correctly from TEMPLATE_PATH', () => {
    // Verify the template is reachable and contains expected planning nodes
    const loaded = loadTemplate(TEMPLATE_PATH);
    const nodeIds = loaded.template.nodes.map((n) => n.id);
    expect(nodeIds).toContain('research');
    expect(nodeIds).toContain('prd');
    expect(nodeIds).toContain('design');
    expect(nodeIds).toContain('architecture');
    expect(nodeIds).toContain('master_plan');
    expect(nodeIds).toContain('plan_approval_gate');
    expect(nodeIds).toContain('phase_loop');
  });
});
