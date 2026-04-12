/**
 * Tests for status-derivation utility.
 * Run with: npx tsx ui/lib/status-derivation.test.ts
 */
import assert from 'node:assert';
import { derivePlanningStatus, deriveExecutionStatus } from './status-derivation';
import type { NodesRecord } from '@/types/state';

function makeStepNode(status: import('@/types/state').NodeStatus) {
  return { kind: 'step' as const, status, doc_path: null, retries: 0 };
}

function makePlanningNodes(status: import('@/types/state').NodeStatus): NodesRecord {
  return {
    research: makeStepNode(status),
    prd: makeStepNode(status),
    design: makeStepNode(status),
    architecture: makeStepNode(status),
    master_plan: makeStepNode(status),
  };
}

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

// ─── derivePlanningStatus ────────────────────────────────────────────────────

console.log('derivePlanningStatus');

test('returns complete when all five planning nodes are completed', () => {
  const nodes = makePlanningNodes('completed');
  assert.strictEqual(derivePlanningStatus(nodes), 'complete');
});

test('returns in_progress when any planning node is in_progress', () => {
  const nodes: NodesRecord = {
    ...makePlanningNodes('completed'),
    prd: makeStepNode('in_progress'),
  };
  assert.strictEqual(derivePlanningStatus(nodes), 'in_progress');
});

test('returns not_started when all planning nodes are not_started', () => {
  const nodes = makePlanningNodes('not_started');
  assert.strictEqual(derivePlanningStatus(nodes), 'not_started');
});

test('returns not_started when nodes is an empty record (defensive)', () => {
  assert.strictEqual(derivePlanningStatus({}), 'not_started');
});

test('returns complete when all five are completed and non-planning nodes exist too', () => {
  const nodes: NodesRecord = {
    ...makePlanningNodes('completed'),
    some_other_node: makeStepNode('not_started'),
  };
  assert.strictEqual(derivePlanningStatus(nodes), 'complete');
});

test('returns not_started for mixed not_started/completed without in_progress', () => {
  const nodes: NodesRecord = {
    research: makeStepNode('completed'),
    prd: makeStepNode('not_started'),
    design: makeStepNode('completed'),
    architecture: makeStepNode('not_started'),
    master_plan: makeStepNode('not_started'),
  };
  assert.strictEqual(derivePlanningStatus(nodes), 'not_started');
});

// ─── deriveExecutionStatus ───────────────────────────────────────────────────

console.log('deriveExecutionStatus');

test('returns complete when graphStatus is completed', () => {
  assert.strictEqual(deriveExecutionStatus('completed', {}), 'complete');
});

test('returns halted when graphStatus is halted', () => {
  assert.strictEqual(deriveExecutionStatus('halted', {}), 'halted');
});

test('returns in_progress when phase_loop.status is in_progress', () => {
  const nodes: NodesRecord = {
    phase_loop: makeStepNode('in_progress'),
  };
  assert.strictEqual(deriveExecutionStatus('in_progress', nodes), 'in_progress');
});

test('returns in_progress when final_review.status is in_progress', () => {
  const nodes: NodesRecord = {
    final_review: makeStepNode('in_progress'),
  };
  assert.strictEqual(deriveExecutionStatus('in_progress', nodes), 'in_progress');
});

test('returns not_started when graphStatus is not_started and no execution nodes are in progress', () => {
  const nodes: NodesRecord = {
    phase_loop: makeStepNode('not_started'),
    final_review: makeStepNode('not_started'),
  };
  assert.strictEqual(deriveExecutionStatus('not_started', nodes), 'not_started');
});

test('returns not_started when graphStatus is not_started and nodes is empty', () => {
  assert.strictEqual(deriveExecutionStatus('not_started', {}), 'not_started');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
