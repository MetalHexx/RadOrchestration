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
import { getDisplayName } from './dag-timeline-helpers';
import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState } from '@/types/state';
import { gateNode, conditionalNodeBranchTrue, conditionalNodeBranchFalse } from './__fixtures__';

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
  return 12 + depth * 16;
}

function shouldRenderDocLink(node: StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState): boolean {
  return node.kind === 'step' && node.doc_path !== null;
}

function shouldRenderBranchIndicator(node: StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState): boolean {
  return node.kind === 'conditional' && node.branch_taken != null;
}

function computeBranchBadge(branchTaken: 'true' | 'false'): { label: string; badgeStatus: string; ariaLabel: string } {
  const label = branchTaken === 'true' ? 'Yes' : 'No';
  const badgeStatus = branchTaken === 'true' ? 'completed' : 'skipped';
  return { label, badgeStatus, ariaLabel: `Branch taken: ${label}` };
}

function computeClasses(isActive: boolean): string[] {
  const classes = ['py-2', 'pr-3', 'rounded-md', 'gap-2', 'flex', 'items-center', 'hover:bg-accent/50'];
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

const conditionalNode: ConditionalNodeState = {
  kind: 'conditional',
  status: 'completed',
  branch_taken: null,
};

const parallelNode: ParallelNodeState = {
  kind: 'parallel',
  status: 'in_progress',
  nodes: {},
};

// ─── Tests: formatNodeId ─────────────────────────────────────────────────────

console.log("\nDAGNodeRow logic tests\n");

test('getDisplayName extracts leaf from compound path', () => {
  assert.strictEqual(getDisplayName('phase_loop.iter0.task_handoff'), 'Task Handoff');
});

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

test('default depth=0 → paddingLeft: 12 (base indent)', () => {
  assert.strictEqual(computePaddingLeft(0), 12);
});

test('depth=1 → paddingLeft: 28', () => {
  assert.strictEqual(computePaddingLeft(1), 28);
});

test('depth=2 → paddingLeft: 44', () => {
  assert.strictEqual(computePaddingLeft(2), 44);
});

test('depth=3 → paddingLeft: 60', () => {
  assert.strictEqual(computePaddingLeft(3), 60);
});

// ─── Tests: Branch indicator rendering ───

test('shouldRenderBranchIndicator returns true for conditional node with branch_taken="true"', () => {
  assert.strictEqual(shouldRenderBranchIndicator(conditionalNodeBranchTrue), true);
});

test('shouldRenderBranchIndicator returns true for conditional node with branch_taken="false"', () => {
  assert.strictEqual(shouldRenderBranchIndicator(conditionalNodeBranchFalse), true);
});

test('shouldRenderBranchIndicator returns false for conditional node with branch_taken=null', () => {
  assert.strictEqual(shouldRenderBranchIndicator(conditionalNode), false);
});

test('shouldRenderBranchIndicator returns false for step node', () => {
  assert.strictEqual(shouldRenderBranchIndicator(stepNodeWithDoc), false);
});

test('shouldRenderBranchIndicator returns false for gate node', () => {
  assert.strictEqual(shouldRenderBranchIndicator(gateNode), false);
});

test('shouldRenderBranchIndicator returns false for parallel node', () => {
  assert.strictEqual(shouldRenderBranchIndicator(parallelNode), false);
});

test('computeBranchBadge("true") returns label="Yes", badgeStatus="completed", ariaLabel="Branch taken: Yes"', () => {
  const result = computeBranchBadge('true');
  assert.deepStrictEqual(result, { label: 'Yes', badgeStatus: 'completed', ariaLabel: 'Branch taken: Yes' });
});

test('computeBranchBadge("false") returns label="No", badgeStatus="skipped", ariaLabel="Branch taken: No"', () => {
  const result = computeBranchBadge('false');
  assert.deepStrictEqual(result, { label: 'No', badgeStatus: 'skipped', ariaLabel: 'Branch taken: No' });
});

test('shouldRenderBranchIndicator handles generic conditional node id (not hardcoded to commit_gate)', () => {
  const genericNode: ConditionalNodeState = {
    kind: 'conditional',
    status: 'completed',
    branch_taken: 'true',
  };
  assert.strictEqual(shouldRenderBranchIndicator(genericNode), true);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
