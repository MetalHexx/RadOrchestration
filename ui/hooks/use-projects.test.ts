/**
 * Tests for SSE state_change sidebar-patching logic in use-projects hook.
 * Run with: npx tsx ui/hooks/use-projects.test.ts
 *
 * v5 and v6 states are structurally identical; the handler derives sidebar
 * fields from the graph uniformly and only discriminates the reported
 * schemaVersion. These tests mirror that uniform mapping.
 */
import assert from 'node:assert';

// Inline types matching ui/types/components.ts and ui/types/state.ts
type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';
type V5PipelineTier = 'planning' | 'execution' | 'review' | 'halted';
type GraphStatus = 'not_started' | 'in_progress' | 'completed' | 'halted';
type PlanningStatus = 'not_started' | 'in_progress' | 'complete';
type ExecutionStatus = 'not_started' | 'in_progress' | 'complete' | 'halted';
type NodeStatus = 'not_started' | 'in_progress' | 'completed' | 'halted' | 'skipped';

interface NodeState {
  status: NodeStatus;
  [key: string]: unknown;
}
type NodesRecord = Record<string, NodeState>;

interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
  planningStatus?: PlanningStatus;
  executionStatus?: ExecutionStatus;
  lastUpdated?: string;
  schemaVersion?: 'v5' | 'v6';
  graphStatus?: GraphStatus | 'not_initialized';
}

// v5 state shape (minimal fields used by the handler)
interface V5State {
  $schema: 'orchestration-state-v5';
  pipeline: { current_tier: V5PipelineTier };
  graph: { status: GraphStatus; nodes: NodesRecord };
  project?: { name: string; created: string; updated: string };
}

// v6 state shape — structurally identical to v5, discriminated by $schema
interface V6State {
  $schema: 'orchestration-state-v6';
  pipeline: { current_tier: V5PipelineTier };
  graph: { status: GraphStatus; nodes: NodesRecord };
  project?: { name: string; created: string; updated: string };
}

type AnyState = V5State | V6State;

// Inline type guard matching ui/types/state.ts
function isV6State(state: AnyState): state is V6State {
  return state.$schema === 'orchestration-state-v6';
}

// Inline planning/execution derivation matching ui/lib/status-derivation.ts
const PLANNING_NODES = ['research', 'prd', 'design', 'architecture', 'master_plan'];

function derivePlanningStatus(nodes: NodesRecord): PlanningStatus {
  const statuses = PLANNING_NODES.map(id => nodes[id]?.status ?? 'not_started');
  if (statuses.every(s => s === 'completed')) return 'complete';
  if (statuses.some(s => s === 'in_progress')) return 'in_progress';
  return 'not_started';
}

const EXECUTION_NODES = ['phase_loop', 'final_review'];

function deriveExecutionStatus(graphStatus: GraphStatus, nodes: NodesRecord): ExecutionStatus {
  if (graphStatus === 'completed') return 'complete';
  if (graphStatus === 'halted') return 'halted';
  if (
    EXECUTION_NODES.some(id => nodes[id] && nodes[id].status === 'in_progress')
  ) {
    return 'in_progress';
  }
  return 'not_started';
}

// The uniform SSE state_change mapping logic replicated from
// ui/hooks/use-projects.ts. v5 and v6 are handled identically via graph-based
// derivation; only the reported schemaVersion differs.
function applyStateChange(
  p: ProjectSummary,
  payload: { projectName: string; state: AnyState }
): ProjectSummary {
  if (p.name !== payload.projectName) return p;
  const state = payload.state;
  const tier: PipelineTier =
    state.graph.status === 'completed'
      ? 'complete'
      : state.pipeline.current_tier;
  return {
    ...p,
    tier,
    planningStatus: derivePlanningStatus(state.graph.nodes),
    executionStatus: deriveExecutionStatus(state.graph.status, state.graph.nodes),
    lastUpdated: state.project?.updated,
    schemaVersion: isV6State(state) ? 'v6' : 'v5',
    graphStatus: state.graph.status,
  };
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('use-projects — SSE state_change sidebar patching');

  await test('(d) matching project — lastUpdated equals payload.state.project.updated', async () => {
    const p: ProjectSummary = {
      name: 'test',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
      lastUpdated: undefined,
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: { status: 'in_progress', nodes: {} },
      project: {
        name: 'test',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-04-06T14:30:00.000Z',
      },
    };
    const result = applyStateChange(p, { projectName: 'test', state });
    assert.strictEqual(result.lastUpdated, '2026-04-06T14:30:00.000Z');
  });

  await test('(e) non-matching project — original object returned unchanged', async () => {
    const p: ProjectSummary = {
      name: 'other-project',
      tier: 'planning',
      hasState: true,
      hasMalformedState: false,
      lastUpdated: '2026-01-01T00:00:00.000Z',
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: { status: 'in_progress', nodes: {} },
      project: {
        name: 'test',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-04-06T14:30:00.000Z',
      },
    };
    const result = applyStateChange(p, { projectName: 'test', state });
    assert.strictEqual(result, p);
    assert.strictEqual(result.lastUpdated, '2026-01-01T00:00:00.000Z');
  });

  // v6 state — handled uniformly via graph derivation, labeled "v6"
  await test('(f) v6 state_change — schemaVersion is "v6", statuses graph-derived', async () => {
    const p: ProjectSummary = {
      name: 'proj',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
    };
    const state: V6State = {
      $schema: 'orchestration-state-v6',
      pipeline: { current_tier: 'planning' },
      graph: {
        status: 'in_progress',
        nodes: {
          research: { status: 'in_progress' },
        },
      },
      project: { name: 'proj', created: '2026-01-01T00:00:00Z', updated: '2026-04-10T00:00:00Z' },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result.schemaVersion, 'v6');
    assert.strictEqual(result.tier, 'planning');
    assert.strictEqual(result.planningStatus, 'in_progress');
    assert.strictEqual(result.executionStatus, 'not_started');
    assert.strictEqual(result.graphStatus, 'in_progress');
  });

  // v5 completed graph — tier becomes 'complete'
  await test('(g) v5 state_change with completed graph — tier is "complete", schemaVersion is "v5"', async () => {
    const p: ProjectSummary = {
      name: 'proj',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: {
        status: 'completed',
        nodes: {
          research:     { status: 'completed' },
          prd:          { status: 'completed' },
          design:       { status: 'completed' },
          architecture: { status: 'completed' },
          master_plan:  { status: 'completed' },
          phase_loop:   { status: 'completed' },
        },
      },
      project: { name: 'proj', created: '2026-01-01T00:00:00Z', updated: '2026-04-12T10:00:00Z' },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result.schemaVersion, 'v5');
    assert.strictEqual(result.tier, 'complete');
    assert.strictEqual(result.planningStatus, 'complete');
    assert.strictEqual(result.executionStatus, 'complete');
    assert.strictEqual(result.lastUpdated, '2026-04-12T10:00:00Z');
  });

  // v5 in-progress graph — tier from pipeline.current_tier
  await test('(h) v5 state_change with in-progress graph — tier from pipeline.current_tier, schemaVersion is "v5"', async () => {
    const p: ProjectSummary = {
      name: 'proj',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: {
        status: 'in_progress',
        nodes: {
          research:     { status: 'completed' },
          prd:          { status: 'completed' },
          design:       { status: 'completed' },
          architecture: { status: 'completed' },
          master_plan:  { status: 'completed' },
          phase_loop:   { status: 'in_progress' },
        },
      },
      project: { name: 'proj', created: '2026-01-01T00:00:00Z', updated: '2026-04-12T11:00:00Z' },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result.schemaVersion, 'v5');
    assert.strictEqual(result.tier, 'execution');
    assert.strictEqual(result.planningStatus, 'complete');
    assert.strictEqual(result.executionStatus, 'in_progress');
    assert.strictEqual(result.lastUpdated, '2026-04-12T11:00:00Z');
  });

  // v5 non-matching project — returned unchanged
  await test('(i) v5 state_change for non-matching project — original ProjectSummary returned unchanged', async () => {
    const p: ProjectSummary = {
      name: 'other-proj',
      tier: 'planning',
      hasState: true,
      hasMalformedState: false,
      lastUpdated: '2026-01-01T00:00:00Z',
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: { status: 'in_progress', nodes: {} },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result, p);
    assert.strictEqual(result.lastUpdated, '2026-01-01T00:00:00Z');
  });

  // graphStatus tests
  await test('(j) v5 state_change — graphStatus mirrors payload graph.status (in_progress)', async () => {
    const p: ProjectSummary = {
      name: 'proj',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: {
        status: 'in_progress',
        nodes: {
          research:     { status: 'completed' },
          prd:          { status: 'completed' },
          design:       { status: 'completed' },
          architecture: { status: 'completed' },
          master_plan:  { status: 'completed' },
          phase_loop:   { status: 'in_progress' },
        },
      },
      project: { name: 'proj', created: '2026-01-01T00:00:00Z', updated: '2026-04-16T00:00:00Z' },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result.graphStatus, 'in_progress');
  });

  await test('(k) v5 state_change — graphStatus mirrors payload graph.status (completed)', async () => {
    const p: ProjectSummary = {
      name: 'proj',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
    };
    const state: V5State = {
      $schema: 'orchestration-state-v5',
      pipeline: { current_tier: 'execution' },
      graph: {
        status: 'completed',
        nodes: {
          research:     { status: 'completed' },
          prd:          { status: 'completed' },
          design:       { status: 'completed' },
          architecture: { status: 'completed' },
          master_plan:  { status: 'completed' },
          phase_loop:   { status: 'completed' },
          final_review: { status: 'completed' },
        },
      },
      project: { name: 'proj', created: '2026-01-01T00:00:00Z', updated: '2026-04-16T00:00:00Z' },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result.graphStatus, 'completed');
  });

  await test('(l) v6 state_change — graphStatus mirrors payload graph.status', async () => {
    const p: ProjectSummary = {
      name: 'proj',
      tier: 'not_initialized',
      hasState: false,
      hasMalformedState: false,
    };
    const state: V6State = {
      $schema: 'orchestration-state-v6',
      pipeline: { current_tier: 'planning' },
      graph: { status: 'in_progress', nodes: { research: { status: 'in_progress' } } },
      project: { name: 'proj', created: '2026-01-01T00:00:00Z', updated: '2026-04-16T00:00:00Z' },
    };
    const result = applyStateChange(p, { projectName: 'proj', state });
    assert.strictEqual(result.graphStatus, 'in_progress');
    assert.strictEqual(result.schemaVersion, 'v6');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
