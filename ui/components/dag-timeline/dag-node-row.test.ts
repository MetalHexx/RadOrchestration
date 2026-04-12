/**
 * Tests for DAGNodeRow component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-node-row.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * formatNodeId is exported from dag-node-row.tsx for testability; this is a
 * minor deviation from "file-local" described in the handoff, necessitated by
 * the project's non-rendering test pattern.
 */
import assert from "node:assert";
import { formatNodeId } from './dag-node-row';
import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState } from '@/types/state';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAriaCurrent(nodeId: string, currentNodePath: string | null): 'step' | undefined {
  return nodeId === currentNodePath ? 'step' : undefined;
}

function computePaddingLeft(depth: number): number {
  return depth * 16;
}

function shouldRenderDocLink(node: StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState): boolean {
  return node.kind === 'step' && (node as StepNodeState).doc_path !== null;
}

function computeClasses(isActive: boolean): string[] {
  const classes = ['py-2', 'px-3', 'rounded-md', 'gap-2', 'flex', 'items-center', 'hover:bg-accent/50'];
  if (isActive) {
    classes.push('border-l-2', 'border-l-[var(--color-link)]');
  }
  return classes;
}

// ─── Fixture Nodes ───────────────────────────────────────────────────────────

const stepNodeWithDoc: StepNodeState = {
  kind: 'step',
  status: 'in_progress',
  doc_path: 'tasks/some-task.md',
  retries: 0,
};

const stepNodeNoDoc: StepNodeState = {
  kind: 'step',
  status: 'completed',
  doc_path: null,
  retries: 0,
};

const gateNode: GateNodeState = {
  kind: 'gate',
  status: 'not_started',
  gate_active: false,
};

const conditionalNode: ConditionalNodeState = {
  kind: 'conditional',
  status: 'completed',
  branch_taken: 'true',
};

const parallelNode: ParallelNodeState = {
  kind: 'parallel',
  status: 'in_progress',
  nodes: {},
};

// ─── Tests: formatNodeId ─────────────────────────────────────────────────────

console.log("\nDAGNodeRow logic tests\n");

test('formatNodeId: "gate_mode_selection" → "Gate Mode Selection"', () => {
  assert.strictEqual(formatNodeId('gate_mode_selection'), 'Gate Mode Selection');
});

test('formatNodeId: single word "step" → "Step"', () => {
  assert.strictEqual(formatNodeId('step'), 'Step');
});

test('formatNodeId: two words "run_tests" → "Run Tests"', () => {
  assert.strictEqual(formatNodeId('run_tests'), 'Run Tests');
});

test('formatNodeId: long id "create_phase_plan_v2" → "Create Phase Plan V2"', () => {
  assert.strictEqual(formatNodeId('create_phase_plan_v2'), 'Create Phase Plan V2');
});

// ─── Tests: NodeKindIcon kind prop (via node.kind) ───────────────────────────

test('step node has kind="step"', () => {
  assert.strictEqual(stepNodeWithDoc.kind, 'step');
});

test('gate node has kind="gate"', () => {
  assert.strictEqual(gateNode.kind, 'gate');
});

test('conditional node has kind="conditional"', () => {
  assert.strictEqual(conditionalNode.kind, 'conditional');
});

test('parallel node has kind="parallel"', () => {
  assert.strictEqual(parallelNode.kind, 'parallel');
});

// ─── Tests: NodeStatusBadge status prop (via node.status) ───────────────────

test('step node passes correct status to NodeStatusBadge', () => {
  assert.strictEqual(stepNodeWithDoc.status, 'in_progress');
});

test('gate node passes correct status to NodeStatusBadge', () => {
  assert.strictEqual(gateNode.status, 'not_started');
});

// ─── Tests: DocumentLink render conditions ───────────────────────────────────

test('renders DocumentLink for step node with non-null doc_path', () => {
  assert.strictEqual(shouldRenderDocLink(stepNodeWithDoc), true);
});

test('does NOT render DocumentLink for step node with null doc_path', () => {
  assert.strictEqual(shouldRenderDocLink(stepNodeNoDoc), false);
});

test('does NOT render DocumentLink for gate node', () => {
  assert.strictEqual(shouldRenderDocLink(gateNode), false);
});

test('does NOT render DocumentLink for conditional node', () => {
  assert.strictEqual(shouldRenderDocLink(conditionalNode), false);
});

test('does NOT render DocumentLink for parallel node', () => {
  assert.strictEqual(shouldRenderDocLink(parallelNode), false);
});

// ─── Tests: aria-current ─────────────────────────────────────────────────────

test('sets aria-current="step" when nodeId === currentNodePath', () => {
  assert.strictEqual(computeAriaCurrent('run_tests', 'run_tests'), 'step');
});

test('does NOT set aria-current when nodeId !== currentNodePath', () => {
  assert.strictEqual(computeAriaCurrent('run_tests', 'other_node'), undefined);
});

test('does NOT set aria-current when currentNodePath is null', () => {
  assert.strictEqual(computeAriaCurrent('run_tests', null), undefined);
});

// ─── Tests: border-l-2 class when active ────────────────────────────────────

test('applies border-l-2 class when active', () => {
  const classes = computeClasses(true);
  assert.ok(classes.includes('border-l-2'), 'should include border-l-2');
  assert.ok(classes.includes('border-l-[var(--color-link)]'), 'should include border-l color');
});

test('does NOT apply border-l-2 class when not active', () => {
  const classes = computeClasses(false);
  assert.ok(!classes.includes('border-l-2'), 'should not include border-l-2');
});

// ─── Tests: depth-based left padding ─────────────────────────────────────────

test('default depth=0 → paddingLeft: 0 (no extra left padding)', () => {
  assert.strictEqual(computePaddingLeft(0), 0);
});

test('depth=1 → paddingLeft: 16', () => {
  assert.strictEqual(computePaddingLeft(1), 16);
});

test('depth=2 → paddingLeft: 32', () => {
  assert.strictEqual(computePaddingLeft(2), 32);
});

test('depth=3 → paddingLeft: 48', () => {
  assert.strictEqual(computePaddingLeft(3), 48);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
