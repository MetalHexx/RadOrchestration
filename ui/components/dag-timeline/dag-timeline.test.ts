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
import { deriveGateActive } from './dag-timeline';
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

// ─── Tests: deriveGateActive helper ──────────────────────────────────────────

const activeGateNode: GateNodeState = {
  kind: 'gate',
  status: 'in_progress',
  gate_active: true,
};

test('deriveGateActive(gateNode) returns false (shared fixture has gate_active: false)', () => {
  assert.strictEqual(deriveGateActive(gateNode), false);
});

test('deriveGateActive({ kind: "gate", status: "in_progress", gate_active: true }) returns true', () => {
  assert.strictEqual(deriveGateActive(activeGateNode), true);
});

test('deriveGateActive(stepNode) returns undefined', () => {
  assert.strictEqual(deriveGateActive(stepNode), undefined);
});

test('deriveGateActive(conditionalNode) returns undefined', () => {
  assert.strictEqual(deriveGateActive(conditionalNode), undefined);
});

test('deriveGateActive(parallelNode) returns undefined', () => {
  assert.strictEqual(deriveGateActive(parallelNode), undefined);
});

test('deriveGateActive(forEachPhaseNode) returns undefined', () => {
  assert.strictEqual(deriveGateActive(forEachPhaseNode), undefined);
});

test('deriveGateActive(forEachTaskNode) returns undefined', () => {
  assert.strictEqual(deriveGateActive(forEachTaskNode), undefined);
});

// ─── Integration: shouldRenderGateButton composition ─────────────────────────

/**
 * Mirrors the gate-render decision logic in DAGNodeRow. Local copy of the
 * helper used in dag-node-row.test.ts — validates that the composition of
 * `node.kind`, `gateActive`, `projectName`, and `getGateNodeConfig(nodeId)`
 * produces the correct top-level-only scope for `ApproveGateButton` rendering.
 */
function shouldRenderGateButton(
  node: StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState,
  nodeId: string,
  projectName: string | undefined,
  gateActive: boolean | undefined
): boolean {
  if (node.kind !== 'gate') return false;
  if (gateActive !== true) return false;
  if (projectName === undefined) return false;
  return getGateNodeConfig(nodeId) !== null;
}

test('integration: plan_approval_gate with gate_active: true and projectName defined → shouldRenderGateButton true', () => {
  const nodeId = 'plan_approval_gate';
  const node = activeGateNode;
  assert.strictEqual(
    shouldRenderGateButton(node, nodeId, 'my-project', deriveGateActive(node)),
    true
  );
});

test('integration: final_approval_gate with gate_active: true and projectName defined → shouldRenderGateButton true', () => {
  const nodeId = 'final_approval_gate';
  const node = activeGateNode;
  assert.strictEqual(
    shouldRenderGateButton(node, nodeId, 'my-project', deriveGateActive(node)),
    true
  );
});

test('integration: plan_approval_gate with gate_active: false → shouldRenderGateButton false (hide-after-approval / inactive)', () => {
  const nodeId = 'plan_approval_gate';
  const inactiveNode: GateNodeState = { kind: 'gate', status: 'completed', gate_active: false };
  assert.strictEqual(
    shouldRenderGateButton(inactiveNode, nodeId, 'my-project', deriveGateActive(inactiveNode)),
    false
  );
});

test('integration: gate_mode_selection with gate_active: true and projectName defined → shouldRenderGateButton false (excluded from GATE_NODE_CONFIG)', () => {
  const nodeId = 'gate_mode_selection';
  const node = activeGateNode;
  assert.strictEqual(
    shouldRenderGateButton(node, nodeId, 'my-project', deriveGateActive(node)),
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
  // gateActive is derived to undefined for non-gate kinds
  assert.strictEqual(
    shouldRenderGateButton(prGateConditional, nodeId, 'my-project', deriveGateActive(prGateConditional)),
    false
  );
});

// ─── Source-text: dag-timeline.tsx forwards projectName + gateActive ─────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const timelineSource = readFileSync(join(__dirname, 'dag-timeline.tsx'), 'utf-8');

/**
 * Returns true if every `<DAGNodeRow ...>` opening tag in the given source
 * forwards both `projectName={projectName}` and `gateActive={deriveGateActive(node)}`
 * — i.e. the gate-rendering inputs are wired on every top-level node-row call
 * site. The check is line-by-line: when a line opens `<DAGNodeRow`, all
 * subsequent lines up to the end of the opening tag (`>` or `/>`) are
 * inspected for the required props. Returns false if no `<DAGNodeRow>` tags
 * are found, or if any tag is missing either prop.
 */
function hasGateForwardingOnDAGNodeRow(source: string): boolean {
  // Strip JSDoc / line comments first so backticked references in doc text
  // (e.g. "`<DAGNodeRow>`") don't get mistaken for real opening tags.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const lines = codeOnly.split(/\r?\n/);
  let foundAny = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('<DAGNodeRow')) continue;
    foundAny = true;
    let sawProjectName = false;
    let sawGateActive = false;
    let j = i;
    while (j < lines.length) {
      const line = lines[j];
      if (line.includes('projectName={projectName}')) sawProjectName = true;
      if (line.includes('gateActive={deriveGateActive(node)}')) sawGateActive = true;
      if (line.includes('/>') || (j > i && line.includes('>'))) break;
      j++;
    }
    if (!sawProjectName || !sawGateActive) return false;
  }
  return foundAny;
}

test('dag-timeline.tsx forwards `projectName={projectName}` on every <DAGNodeRow> call site (>= 2 total occurrences across DAGNodeRow + DAGLoopNode forwarding)', () => {
  const matches = timelineSource.match(/projectName=\{projectName\}/g) ?? [];
  // After the renderNodeEntry helper refactor, the file forwards projectName
  // to DAGLoopNode (once) and to DAGNodeRow (once) inside the shared helper = 2 total.
  assert.ok(
    matches.length >= 2,
    `expected at least 2 projectName={projectName} occurrences, got ${matches.length}`
  );
  assert.ok(
    hasGateForwardingOnDAGNodeRow(timelineSource),
    'every <DAGNodeRow> opening tag must forward both projectName={projectName} and gateActive={deriveGateActive(node)}'
  );
});

test('dag-timeline.tsx forwards `gateActive={deriveGateActive(node)}` on every <DAGNodeRow> call site', () => {
  assert.ok(
    hasGateForwardingOnDAGNodeRow(timelineSource),
    'every <DAGNodeRow> opening tag must forward both projectName={projectName} and gateActive={deriveGateActive(node)}'
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
