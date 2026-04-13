/**
 * Tests for DAGIterationPanel component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-iteration-panel.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * Helper functions are exported from dag-iteration-panel.tsx for testability.
 */
import assert from "node:assert";
import {
  buildIterationLabel,
  buildChildNodeId,
  buildCorrectiveGroupParentId,
  shouldRenderCorrectiveTasks,
  CHILD_DEPTH,
} from './dag-iteration-panel';
import { getCommitLinkData, filterCompatibleNodes } from './dag-timeline-helpers';
import type {
  StepNodeState,
  GateNodeState,
  ConditionalNodeState,
  ParallelNodeState,
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  NodeState,
  CorrectiveTaskEntry,
} from '@/types/state';

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

// ─── Fixture Nodes ───────────────────────────────────────────────────────────

const stepNode: StepNodeState = {
  kind: 'step',
  status: 'not_started',
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
  status: 'not_started',
  branch_taken: null,
};

const parallelNode: ParallelNodeState = {
  kind: 'parallel',
  status: 'not_started',
  nodes: {},
};

const forEachPhaseNode: ForEachPhaseNodeState = {
  kind: 'for_each_phase',
  status: 'not_started',
  iterations: [],
};

const forEachTaskNode: ForEachTaskNodeState = {
  kind: 'for_each_task',
  status: 'not_started',
  iterations: [],
};

const baseCorrectiveTask: CorrectiveTaskEntry = {
  index: 1,
  reason: 'Test reason',
  injected_after: 'task_executor',
  status: 'not_started',
  nodes: { task_handoff: stepNode },
  commit_hash: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nDAGIterationPanel logic tests\n");

// buildIterationLabel
test('buildIterationLabel(0) returns "Iteration 1" (0-based index → 1-based display)', () => {
  assert.strictEqual(buildIterationLabel(0), "Iteration 1");
});

test('buildIterationLabel(4) returns "Iteration 5"', () => {
  assert.strictEqual(buildIterationLabel(4), "Iteration 5");
});

// buildChildNodeId
test('buildChildNodeId("phase_loop", 0, "phase_planning") returns "phase_loop.iter0.phase_planning"', () => {
  assert.strictEqual(
    buildChildNodeId("phase_loop", 0, "phase_planning"),
    "phase_loop.iter0.phase_planning"
  );
});

test('buildChildNodeId("task_loop", 2, "task_handoff") returns "task_loop.iter2.task_handoff"', () => {
  assert.strictEqual(
    buildChildNodeId("task_loop", 2, "task_handoff"),
    "task_loop.iter2.task_handoff"
  );
});

// getCommitLinkData — with hash
test('getCommitLinkData("abc1234def") returns { href: "#abc1234def", label: "abc1234" }', () => {
  const result = getCommitLinkData("abc1234def");
  assert.ok(result !== null);
  assert.strictEqual(result.label, "abc1234");
  assert.strictEqual(result.href, "#abc1234def");
});

// getCommitLinkData — null
test('getCommitLinkData(null) returns null', () => {
  const result = getCommitLinkData(null);
  assert.strictEqual(result, null);
});

// filterCompatibleNodes — inclusions
test('filterCompatibleNodes includes nodes with kind "step"', () => {
  const nodes: Record<string, NodeState> = { task_handoff: stepNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0][0], 'task_handoff');
});

test('filterCompatibleNodes includes nodes with kind "gate"', () => {
  const nodes: Record<string, NodeState> = { gate_check: gateNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
});

test('filterCompatibleNodes includes nodes with kind "conditional"', () => {
  const nodes: Record<string, NodeState> = { cond: conditionalNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
});

test('filterCompatibleNodes includes nodes with kind "parallel"', () => {
  const nodes: Record<string, NodeState> = { par: parallelNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
});

// filterCompatibleNodes — exclusions
test('filterCompatibleNodes excludes nodes with kind "for_each_phase"', () => {
  const nodes: Record<string, NodeState> = { loop: forEachPhaseNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 0);
});

test('filterCompatibleNodes excludes nodes with kind "for_each_task"', () => {
  const nodes: Record<string, NodeState> = { loop: forEachTaskNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 0);
});

// filterCompatibleNodes — mixed
test('filterCompatibleNodes with mixed kinds returns only compatible entries in original order', () => {
  const nodes: Record<string, NodeState> = {
    task_handoff: stepNode,
    loop: forEachPhaseNode,
    code_review: gateNode,
    task_loop: forEachTaskNode,
  };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 2);
  const ids = result.map(([id]) => id);
  assert.deepStrictEqual(ids, ['task_handoff', 'code_review']);
});

// CHILD_DEPTH constant
test('CHILD_DEPTH is exported and equals 1', () => {
  assert.strictEqual(CHILD_DEPTH, 1);
});

// buildCorrectiveGroupParentId
test('buildCorrectiveGroupParentId("phase_loop", 0) returns "phase_loop.iter0"', () => {
  assert.strictEqual(buildCorrectiveGroupParentId("phase_loop", 0), "phase_loop.iter0");
});

test('buildCorrectiveGroupParentId("task_loop", 3) returns "task_loop.iter3"', () => {
  assert.strictEqual(buildCorrectiveGroupParentId("task_loop", 3), "task_loop.iter3");
});

// shouldRenderCorrectiveTasks
test('shouldRenderCorrectiveTasks([]) returns false', () => {
  assert.strictEqual(shouldRenderCorrectiveTasks([]), false);
});

test('shouldRenderCorrectiveTasks([...tasks]) returns true', () => {
  assert.strictEqual(shouldRenderCorrectiveTasks([baseCorrectiveTask]), true);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
