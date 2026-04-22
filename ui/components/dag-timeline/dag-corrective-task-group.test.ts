/**
 * Tests for DAGCorrectiveTaskGroup component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-corrective-task-group.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * Helper functions are exported from dag-corrective-task-group.tsx for testability.
 */
import assert from "node:assert";
import {
  buildCorrectiveChildNodeId,
  buildTriggerText,
  GROUP_ARIA_LABEL,
  CORRECTIVE_CHILD_DEPTH,
} from './dag-corrective-task-group';
import { getCommitLinkData, filterCompatibleNodes } from './dag-timeline-helpers';
import {
  stepNode,
  gateNode,
  conditionalNode,
  parallelNode,
  forEachPhaseNode,
  forEachTaskNode,
  baseCorrectiveTask,
} from './__fixtures__';
import type {
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

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nDAGCorrectiveTaskGroup logic tests\n");

// buildChildNodeId
test('buildCorrectiveChildNodeId returns "{parentNodeId}.ct{ctIndex}.{childNodeId}"', () => {
  assert.strictEqual(
    buildCorrectiveChildNodeId("task_loop", 1, "task_handoff"),
    "task_loop.ct1.task_handoff"
  );
});

test('buildCorrectiveChildNodeId works with different indices', () => {
  assert.strictEqual(
    buildCorrectiveChildNodeId("phase_loop", 3, "code_review"),
    "phase_loop.ct3.code_review"
  );
});

// getCommitLinkData — with hash
test('commit_hash "abc1234def" produces label "abc1234" (first 7 chars)', () => {
  const result = getCommitLinkData("abc1234def", null);
  assert.ok(result !== null);
  assert.strictEqual(result.label, "abc1234");
});

test('commit_hash "abc1234def" with null repoBaseUrl produces href null', () => {
  const result = getCommitLinkData("abc1234def", null);
  assert.ok(result !== null);
  assert.strictEqual(result.href, null);
});

// getCommitLinkData — null
test('commit_hash null produces null (no commit link)', () => {
  const result = getCommitLinkData(null, null);
  assert.strictEqual(result, null);
});

// filterCompatibleNodes — exclusions
test('node with kind "for_each_phase" is excluded', () => {
  const nodes: Record<string, NodeState> = { loop: forEachPhaseNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 0);
});

test('node with kind "for_each_task" is excluded', () => {
  const nodes: Record<string, NodeState> = { loop: forEachTaskNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 0);
});

// filterCompatibleNodes — inclusions
test('node with kind "step" is included', () => {
  const nodes: Record<string, NodeState> = { task_handoff: stepNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0][0], 'task_handoff');
});

test('node with kind "gate" is included', () => {
  const nodes: Record<string, NodeState> = { gate_check: gateNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
});

test('node with kind "conditional" is included', () => {
  const nodes: Record<string, NodeState> = { cond: conditionalNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
});

test('node with kind "parallel" is included', () => {
  const nodes: Record<string, NodeState> = { par: parallelNode };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 1);
});

test('filterCompatibleNodes skips for_each nodes while passing compatible ones', () => {
  const nodes: Record<string, NodeState> = {
    task_handoff: stepNode,
    loop: forEachPhaseNode,
    code_review: gateNode,
    task_loop: forEachTaskNode,
  };
  const result = filterCompatibleNodes(nodes);
  assert.strictEqual(result.length, 2);
  const ids = result.map(([id]) => id);
  assert.ok(ids.includes('task_handoff'));
  assert.ok(ids.includes('code_review'));
});

// aria-label constant
test('GROUP_ARIA_LABEL is "Corrective tasks"', () => {
  assert.strictEqual(GROUP_ARIA_LABEL, "Corrective tasks");
});

// filterCompatibleNodes — empty nodes
test('filterCompatibleNodes returns empty array when nodes is {}', () => {
  const taskWithNoNodes: CorrectiveTaskEntry = { ...baseCorrectiveTask, nodes: {} };
  assert.strictEqual(filterCompatibleNodes(taskWithNoNodes.nodes).length, 0);
});

test('non-empty corrective task nodes are filtered compatibly', () => {
  const taskWithNode: CorrectiveTaskEntry = {
    ...baseCorrectiveTask,
    nodes: {
      task_executor: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
    },
  };
  const result = filterCompatibleNodes(taskWithNode.nodes);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0][0], 'task_executor');
});

// buildTriggerText
test('trigger text for index 1 is "Corrective Task 1"', () => {
  assert.strictEqual(buildTriggerText(1), "Corrective Task 1");
});

test('trigger text for index 3 is "Corrective Task 3"', () => {
  assert.strictEqual(buildTriggerText(3), "Corrective Task 3");
});

// Multiple corrective tasks trigger text
test('multiple corrective tasks produce correct trigger text for each', () => {
  const tasks: CorrectiveTaskEntry[] = [
    { ...baseCorrectiveTask, index: 1 },
    { ...baseCorrectiveTask, index: 2 },
    { ...baseCorrectiveTask, index: 3 },
  ];
  const texts = tasks.map((t) => buildTriggerText(t.index));
  assert.deepStrictEqual(texts, ["Corrective Task 1", "Corrective Task 2", "Corrective Task 3"]);
});

// CHILD_DEPTH constant
test('CORRECTIVE_CHILD_DEPTH is 2', () => {
  assert.strictEqual(CORRECTIVE_CHILD_DEPTH, 2);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
