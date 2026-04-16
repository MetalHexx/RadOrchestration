/**
 * Tests for DAGTimeline component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-timeline.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * isLoopNode is exported from dag-timeline-helpers.ts for testability.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isLoopNode, getGateNodeConfig } from './dag-timeline-helpers';
import type { NodeKind, NodeState, NodesRecord, GateNodeState, StepNodeState, ConditionalNodeState, ParallelNodeState } from '@/types/state';
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

// ─── Integration: shouldRenderGateButton composition ─────────────────────────

// Gate awaiting human approval — walker leaves status as 'not_started' while
// blocking. This is the realistic pre-approval shape.
const pendingGateNode: GateNodeState = {
  kind: 'gate',
  status: 'not_started',
  gate_active: true,
};

/**
 * Mirrors the gate-render decision logic in DAGNodeRow. Local copy of the
 * helper used in dag-node-row.test.ts — validates that the composition of
 * `node.kind`, `node.status`, `projectName`, and `getGateNodeConfig(nodeId)`
 * produces the correct top-level-only scope for `ApproveGateButton` rendering.
 */
function shouldRenderGateButton(
  node: StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState,
  nodeId: string,
  projectName: string | undefined
): boolean {
  if (node.kind !== 'gate') return false;
  if (node.status === 'completed') return false;
  if (projectName === undefined) return false;
  return getGateNodeConfig(nodeId) !== null;
}

test('integration: plan_approval_gate pending (status: not_started) with projectName defined → shouldRenderGateButton true', () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'plan_approval_gate', 'my-project'),
    true
  );
});

test('integration: final_approval_gate pending (status: not_started) with projectName defined → shouldRenderGateButton true', () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'final_approval_gate', 'my-project'),
    true
  );
});

test('integration: plan_approval_gate completed → shouldRenderGateButton false (hide-after-approval)', () => {
  const approvedNode: GateNodeState = { kind: 'gate', status: 'completed', gate_active: true };
  assert.strictEqual(
    shouldRenderGateButton(approvedNode, 'plan_approval_gate', 'my-project'),
    false
  );
});

test('integration: gate_mode_selection pending with projectName defined → shouldRenderGateButton false (excluded from GATE_NODE_CONFIG)', () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'gate_mode_selection', 'my-project'),
    false
  );
});

test('integration: pr_gate as conditional node → shouldRenderGateButton false regardless of other props (not a gate kind)', () => {
  const nodeId = 'pr_gate';
  const prGateConditional: ConditionalNodeState = {
    kind: 'conditional',
    status: 'in_progress',
    branch_taken: null,
  };
  assert.strictEqual(
    shouldRenderGateButton(prGateConditional, nodeId, 'my-project'),
    false
  );
});

// ─── Source-text: dag-timeline.tsx forwards projectName (no gateActive) ──────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const timelineSource = readFileSync(join(__dirname, 'dag-timeline.tsx'), 'utf-8');

test('dag-timeline.tsx forwards `projectName={projectName}` on every <DAGNodeRow> / <DAGLoopNode> call site (>= 2 total occurrences)', () => {
  const matches = timelineSource.match(/projectName=\{projectName\}/g) ?? [];
  // The file forwards projectName to DAGLoopNode (once) and to DAGNodeRow (once)
  // inside the shared renderNodeEntry helper = 2 total.
  assert.ok(
    matches.length >= 2,
    `expected at least 2 projectName={projectName} occurrences, got ${matches.length}`
  );
});

test('dag-timeline.tsx does NOT forward `gateActive` (button visibility is driven by node.status inside DAGNodeRow)', () => {
  // Strip JSDoc / line comments so doc-comment references don't trip the check.
  const codeOnly = timelineSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.ok(
    !/gateActive\s*=/.test(codeOnly),
    'dag-timeline.tsx must NOT pass a gateActive prop to DAGNodeRow — render logic must key off node.status'
  );
  assert.ok(
    !/deriveGateActive/.test(codeOnly),
    'dag-timeline.tsx must NOT reference deriveGateActive (helper was removed)'
  );
});

// ─── No-side-effects contract: DAGTimeline delegates gate API to ApproveGateButton ─

test('dag-timeline.tsx does NOT import fetch, api-client, or useApproveGate directly', () => {
  // Confirm no direct network side-effects. All gate API calls are delegated
  // through ApproveGateButton (via useApproveGate), which is owned by the
  // node-row scope — not by DAGTimeline.
  assert.ok(
    !/from\s+['"].*api\/projects\/.*gate['"]/.test(timelineSource),
    'dag-timeline.tsx must NOT import from the gate API route'
  );
  assert.ok(
    !/useApproveGate/.test(timelineSource),
    'dag-timeline.tsx must NOT reference useApproveGate'
  );
  assert.ok(
    !/\bfetch\s*\(/.test(timelineSource),
    'dag-timeline.tsx must NOT call fetch() directly'
  );
  // Strip JSDoc / line comments before checking for ApproveGateButton references
  // — a doc comment that names the component is allowed, but no import/JSX use.
  const codeOnly = timelineSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.ok(
    !/ApproveGateButton/.test(codeOnly),
    'dag-timeline.tsx must NOT import or render ApproveGateButton directly (it is wired inside DAGNodeRow)'
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
