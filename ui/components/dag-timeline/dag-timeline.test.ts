/**
 * Tests for DAGTimeline component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-timeline.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * isLoopNode is exported from dag-timeline.tsx for testability.
 */
import assert from "node:assert";
import { isLoopNode } from './dag-timeline';
import type { NodeKind, NodeState, NodesRecord } from '@/types/state';
import {
  stepNode,
  gateNode,
  conditionalNode,
  parallelNode,
  forEachPhaseNode,
  forEachTaskNode,
} from './__fixtures__';

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

// ─── Tests: Dispatch Logic (isLoopNode) ───────────────────────────────────────

test('step node is NOT identified as a loop node', () => {
  assert.strictEqual(isLoopNode(stepNode), false);
});

test('gate node is NOT identified as a loop node', () => {
  assert.strictEqual(isLoopNode(gateNode), false);
});

test('conditional node is NOT identified as a loop node', () => {
  assert.strictEqual(isLoopNode(conditionalNode), false);
});

test('parallel node is NOT identified as a loop node', () => {
  assert.strictEqual(isLoopNode(parallelNode), false);
});

test('for_each_phase node IS identified as a loop node', () => {
  assert.strictEqual(isLoopNode(forEachPhaseNode), true);
});

test('for_each_task node IS identified as a loop node', () => {
  assert.strictEqual(isLoopNode(forEachTaskNode), true);
});

// ─── Tests: Insertion Order Preserved ────────────────────────────────────────

test('Object.entries preserves insertion order for a mixed NodesRecord', () => {
  const nodes: NodesRecord = {
    gate_start: gateNode,
    step_one: stepNode,
    loop_phase: forEachPhaseNode,
    step_two: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
    loop_task: forEachTaskNode,
  };
  const keys = Object.entries(nodes).map(([k]) => k);
  assert.deepStrictEqual(keys, ['gate_start', 'step_one', 'loop_phase', 'step_two', 'loop_task']);
});

test('Object.entries of single-entry NodesRecord returns that single entry', () => {
  const nodes: NodesRecord = { only_step: stepNode };
  const entries = Object.entries(nodes);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0][0], 'only_step');
});

// ─── Tests: Empty NodesRecord ─────────────────────────────────────────────────

test('empty NodesRecord produces zero entries', () => {
  const nodes: NodesRecord = {};
  const entries = Object.entries(nodes);
  assert.strictEqual(entries.length, 0);
});

// ─── Tests: All NodeKind Values Covered ──────────────────────────────────────

test('all NodeKind values are classified without throwing', () => {
  const allKinds: NodeKind[] = ['step', 'gate', 'conditional', 'parallel', 'for_each_phase', 'for_each_task'];
  const loopKinds = ['for_each_phase', 'for_each_task'];
  const nonLoopKinds = ['step', 'gate', 'conditional', 'parallel'];

  // Check every loop kind returns true
  for (const kind of loopKinds) {
    const node = { kind } as NodeState;
    assert.strictEqual(isLoopNode(node), true, `Expected ${kind} to be a loop node`);
  }

  // Check every non-loop kind returns false
  for (const kind of nonLoopKinds) {
    const node = { kind } as NodeState;
    assert.strictEqual(isLoopNode(node), false, `Expected ${kind} to NOT be a loop node`);
  }

  // Verify total coverage
  assert.strictEqual(allKinds.length, loopKinds.length + nonLoopKinds.length);
});

test('loop kinds form exactly the set {for_each_phase, for_each_task}', () => {
  const allKinds: NodeKind[] = ['step', 'gate', 'conditional', 'parallel', 'for_each_phase', 'for_each_task'];
  const identified = allKinds.filter((kind) => isLoopNode({ kind } as NodeState));
  assert.deepStrictEqual(identified.sort(), ['for_each_phase', 'for_each_task'].sort());
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
