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

// ─── Roving-tabindex coordinator: pure-logic helpers ─────────────────────────

/**
 * Mirrors the production `useState<string | null>(() => focusableRowKeys[0] ?? null)`
 * lazy initializer so tests can assert the initial-focus derivation without
 * rendering the component.
 */
function deriveInitialFocusedRowKey(orderedKeys: readonly string[]): string | null {
  return orderedKeys[0] ?? null;
}

/**
 * Mirrors the `handleKeyDown` wrap-around index computation:
 * - ArrowDown: `currentIndex < length - 1 ? currentIndex + 1 : 0`
 * - ArrowUp:   `currentIndex > 0 ? currentIndex - 1 : length - 1`
 * When `currentIndex === -1` (no row has focus), ArrowDown resolves to 0 and
 * ArrowUp resolves to `length - 1` by the same expressions.
 */
function computeNextIndex(
  direction: 'ArrowDown' | 'ArrowUp',
  currentIndex: number,
  length: number,
): number {
  if (direction === 'ArrowDown') {
    return currentIndex < length - 1 ? currentIndex + 1 : 0;
  }
  return currentIndex > 0 ? currentIndex - 1 : length - 1;
}

/**
 * Mirrors the production `tabIndex={isFocused ? 0 : -1}` expression where
 * `isFocused` is `focusedRowKey === rowKey`. Returns `0` when the row is the
 * currently focused row in the coordinator state, `-1` otherwise.
 */
function computeRowTabIndex(rowKey: string, focusedRowKey: string | null): 0 | -1 {
  return rowKey === focusedRowKey ? 0 : -1;
}

// ─── Tests: deriveInitialFocusedRowKey ───────────────────────────────────────

test('deriveInitialFocusedRowKey([]) === null (empty timeline has no initial focus)', () => {
  assert.strictEqual(deriveInitialFocusedRowKey([]), null);
});

test('deriveInitialFocusedRowKey(["a"]) === "a" (single-row timeline)', () => {
  assert.strictEqual(deriveInitialFocusedRowKey(['a']), 'a');
});

test('deriveInitialFocusedRowKey(["a", "b", "c"]) === "a" (first in document order)', () => {
  assert.strictEqual(deriveInitialFocusedRowKey(['a', 'b', 'c']), 'a');
});

// ─── Tests: computeNextIndex ─────────────────────────────────────────────────

test('computeNextIndex("ArrowDown", 0, 3) === 1 (advance forward)', () => {
  assert.strictEqual(computeNextIndex('ArrowDown', 0, 3), 1);
});

test('computeNextIndex("ArrowDown", 1, 3) === 2 (advance forward)', () => {
  assert.strictEqual(computeNextIndex('ArrowDown', 1, 3), 2);
});

test('computeNextIndex("ArrowDown", 2, 3) === 0 (wrap to start from last)', () => {
  assert.strictEqual(computeNextIndex('ArrowDown', 2, 3), 0);
});

test('computeNextIndex("ArrowDown", -1, 3) === 0 (no current focus → first row)', () => {
  assert.strictEqual(computeNextIndex('ArrowDown', -1, 3), 0);
});

test('computeNextIndex("ArrowUp", 2, 3) === 1 (advance backward)', () => {
  assert.strictEqual(computeNextIndex('ArrowUp', 2, 3), 1);
});

test('computeNextIndex("ArrowUp", 1, 3) === 0 (advance backward)', () => {
  assert.strictEqual(computeNextIndex('ArrowUp', 1, 3), 0);
});

test('computeNextIndex("ArrowUp", 0, 3) === 2 (wrap to end from first)', () => {
  assert.strictEqual(computeNextIndex('ArrowUp', 0, 3), 2);
});

test('computeNextIndex("ArrowUp", -1, 3) === 2 (no current focus → last row)', () => {
  assert.strictEqual(computeNextIndex('ArrowUp', -1, 3), 2);
});

test('computeNextIndex("ArrowDown", 0, 1) === 0 (single-row wrap-to-self)', () => {
  assert.strictEqual(computeNextIndex('ArrowDown', 0, 1), 0);
});

test('computeNextIndex("ArrowUp", 0, 1) === 0 (single-row wrap-to-self)', () => {
  assert.strictEqual(computeNextIndex('ArrowUp', 0, 1), 0);
});

// ─── Tests: computeRowTabIndex ───────────────────────────────────────────────

test('computeRowTabIndex("a", "a") === 0 (focused row is tabbable)', () => {
  assert.strictEqual(computeRowTabIndex('a', 'a'), 0);
});

test('computeRowTabIndex("a", "b") === -1 (unfocused row is not tabbable)', () => {
  assert.strictEqual(computeRowTabIndex('a', 'b'), -1);
});

test('computeRowTabIndex("a", null) === -1 (no focused row → row not tabbable)', () => {
  assert.strictEqual(computeRowTabIndex('a', null), -1);
});

test('computeRowTabIndex("b", null) === -1 (no focused row → row not tabbable)', () => {
  assert.strictEqual(computeRowTabIndex('b', null), -1);
});

// ─── Tests: single-tabindex=0 invariant ──────────────────────────────────────

test('single-tabindex=0 invariant: focusedRowKey="b" in ["a","b","c"] → [-1, 0, -1]', () => {
  const orderedKeys = ['a', 'b', 'c'];
  const result = orderedKeys.map((k) => computeRowTabIndex(k, 'b'));
  assert.deepStrictEqual(result, [-1, 0, -1]);
  const zeros = result.filter((v) => v === 0);
  assert.strictEqual(zeros.length, 1, 'exactly one row should carry tabindex=0');
});

test('single-tabindex=0 invariant: focusedRowKey=null in ["a","b","c"] → all -1 (empty coordinator state)', () => {
  const orderedKeys = ['a', 'b', 'c'];
  const result = orderedKeys.map((k) => computeRowTabIndex(k, null));
  assert.deepStrictEqual(result, [-1, -1, -1]);
  const zeros = result.filter((v) => v === 0);
  assert.strictEqual(zeros.length, 0, 'no row should carry tabindex=0 when focusedRowKey is null');
});

// ─── Source-text invariants: dag-timeline.tsx coordinator wiring ─────────────

test('dag-timeline.tsx contains role="listbox" (outer container role swap)', () => {
  assert.ok(
    timelineSource.includes('role="listbox"'),
    'dag-timeline.tsx must declare role="listbox" on the outer container'
  );
});

test('dag-timeline.tsx contains aria-label="Pipeline timeline"', () => {
  assert.ok(
    timelineSource.includes('aria-label="Pipeline timeline"'),
    'dag-timeline.tsx must declare aria-label="Pipeline timeline" on the outer container'
  );
});

test('dag-timeline.tsx contains ref={containerRef} (ref attachment for descendant query)', () => {
  assert.ok(
    timelineSource.includes('ref={containerRef}'),
    'dag-timeline.tsx must attach a containerRef to the outer container for the [data-timeline-row] descendant query'
  );
});

test('dag-timeline.tsx contains onKeyDown={handleKeyDown} (arrow-key handler wired on container)', () => {
  assert.ok(
    timelineSource.includes('onKeyDown={handleKeyDown}'),
    'dag-timeline.tsx must attach onKeyDown={handleKeyDown} to the outer container'
  );
});

test('dag-timeline.tsx contains [data-timeline-row] (descendant query selector for roving coordinator)', () => {
  assert.ok(
    timelineSource.includes('[data-timeline-row]'),
    'dag-timeline.tsx must query [data-timeline-row] descendants (not [role="option"]) so loop triggers are reached on equal footing'
  );
});

test('dag-timeline.tsx contains isFocused={focusedRowKey === nodeId} on both renderNodeEntry branches (>= 2 occurrences)', () => {
  const matches = timelineSource.match(/isFocused=\{focusedRowKey === nodeId\}/g) ?? [];
  assert.ok(
    matches.length >= 2,
    `expected at least 2 isFocused={focusedRowKey === nodeId} occurrences (one per DAGLoopNode / DAGNodeRow branch), got ${matches.length}`
  );
});

test('dag-timeline.tsx contains onFocusChange={handleFocusChange} on both renderNodeEntry branches (>= 2 occurrences)', () => {
  const matches = timelineSource.match(/onFocusChange=\{handleFocusChange\}/g) ?? [];
  assert.ok(
    matches.length >= 2,
    `expected at least 2 onFocusChange={handleFocusChange} occurrences (one per branch), got ${matches.length}`
  );
});

test('dag-timeline.tsx does NOT contain role="list" (regression guard: container role flipped from list to listbox)', () => {
  // Strip JSDoc / line comments so doc-comment references don't trip the check.
  const codeOnly = timelineSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.ok(
    !codeOnly.includes('role="list"'),
    'dag-timeline.tsx must NOT contain role="list" — the container role flipped to "listbox" and per-entry wrappers flipped to "presentation"'
  );
});

test('dag-timeline.tsx does NOT contain placeholder isFocused={false} (regression guard: all placeholders replaced)', () => {
  assert.ok(
    !timelineSource.includes('isFocused={false}'),
    'dag-timeline.tsx must NOT contain isFocused={false} — all placeholder literals must be replaced by the coordinator wiring'
  );
});

test('dag-timeline.tsx does NOT contain placeholder onFocusChange={() => {}} (regression guard: all placeholders replaced)', () => {
  assert.ok(
    !timelineSource.includes('onFocusChange={() => {}}'),
    'dag-timeline.tsx must NOT contain onFocusChange={() => {}} — all placeholder literals must be replaced by handleFocusChange'
  );
});

// ─── Source-text invariants: dag-iteration-panel.tsx coordinator wiring ──────

const iterationPanelSourceForCoordinator = readFileSync(
  join(__dirname, 'dag-iteration-panel.tsx'),
  'utf-8'
);

test('dag-iteration-panel.tsx does NOT contain placeholder isFocused={false} (regression guard)', () => {
  assert.ok(
    !iterationPanelSourceForCoordinator.includes('isFocused={false}'),
    'dag-iteration-panel.tsx must NOT contain isFocused={false} — all placeholder literals must be replaced by focusedRowKey === childKey'
  );
});

test('dag-iteration-panel.tsx does NOT contain placeholder onFocusChange={() => {}} (regression guard)', () => {
  assert.ok(
    !iterationPanelSourceForCoordinator.includes('onFocusChange={() => {}}'),
    'dag-iteration-panel.tsx must NOT contain onFocusChange={() => {}} — all placeholder literals must be replaced by onFocusChange (coordinator-forwarded)'
  );
});

test('dag-iteration-panel.tsx contains isFocused={focusedRowKey === childKey} on both iteration-child branches (>= 2 occurrences)', () => {
  const matches = iterationPanelSourceForCoordinator.match(/isFocused=\{focusedRowKey === childKey\}/g) ?? [];
  assert.ok(
    matches.length >= 2,
    `expected at least 2 isFocused={focusedRowKey === childKey} occurrences (one per DAGLoopNode / DAGNodeRow branch), got ${matches.length}`
  );
});

test('dag-iteration-panel.tsx contains focusedRowKey={focusedRowKey} forwarded to nested DAGLoopNode and DAGCorrectiveTaskGroup (>= 2 occurrences)', () => {
  const matches = iterationPanelSourceForCoordinator.match(/focusedRowKey=\{focusedRowKey\}/g) ?? [];
  assert.ok(
    matches.length >= 2,
    `expected at least 2 focusedRowKey={focusedRowKey} occurrences (forwarded to DAGLoopNode and DAGCorrectiveTaskGroup), got ${matches.length}`
  );
});

test('dag-iteration-panel.tsx contains onFocusChange={onFocusChange} forwarded to DAGLoopNode, DAGNodeRow, and DAGCorrectiveTaskGroup (>= 3 occurrences)', () => {
  const matches = iterationPanelSourceForCoordinator.match(/onFocusChange=\{onFocusChange\}/g) ?? [];
  assert.ok(
    matches.length >= 3,
    `expected at least 3 onFocusChange={onFocusChange} occurrences (forwarded to DAGLoopNode, DAGNodeRow, DAGCorrectiveTaskGroup), got ${matches.length}`
  );
});

// ─── Source-text invariants: dag-corrective-task-group.tsx coordinator wiring ─

const correctiveTaskGroupSourceForCoordinator = readFileSync(
  join(__dirname, 'dag-corrective-task-group.tsx'),
  'utf-8'
);

test('dag-corrective-task-group.tsx does NOT contain placeholder isFocused={false} (regression guard)', () => {
  assert.ok(
    !correctiveTaskGroupSourceForCoordinator.includes('isFocused={false}'),
    'dag-corrective-task-group.tsx must NOT contain isFocused={false} — placeholder replaced by focusedRowKey === childKey'
  );
});

test('dag-corrective-task-group.tsx does NOT contain placeholder onFocusChange={() => {}} (regression guard)', () => {
  assert.ok(
    !correctiveTaskGroupSourceForCoordinator.includes('onFocusChange={() => {}}'),
    'dag-corrective-task-group.tsx must NOT contain onFocusChange={() => {}} — placeholder replaced by onFocusChange (coordinator-forwarded)'
  );
});

test('dag-corrective-task-group.tsx contains isFocused={focusedRowKey === childKey} on the DAGNodeRow branch (>= 1 occurrence)', () => {
  const matches = correctiveTaskGroupSourceForCoordinator.match(/isFocused=\{focusedRowKey === childKey\}/g) ?? [];
  assert.ok(
    matches.length >= 1,
    `expected at least 1 isFocused={focusedRowKey === childKey} occurrence on the DAGNodeRow branch, got ${matches.length}`
  );
});

// ─── TypeScript-level fixtures: new required-prop contracts compile ──────────

// These declarations fail TypeScript compilation if the new required fields
// (focusedRowKey, onFocusChange) are missing or mistyped on the component
// prop interfaces — mirroring the test-fixture pattern already used in
// dag-loop-node.test.ts for asserting prop-contract shape.
import type { DAGLoopNodeProps } from './dag-loop-node';

const _loopPropsContractFixture: DAGLoopNodeProps = {
  nodeId: 'phase_loop',
  node: {
    kind: 'for_each_phase',
    status: 'not_started',
    iterations: [],
  },
  currentNodePath: null,
  onDocClick: (path: string) => { void path; },
  expandedLoopIds: [],
  onAccordionChange: (value: string[], eventDetails: { reason: string }) => { void value; void eventDetails; },
  repoBaseUrl: null,
  projectName: 'test-project',
  focusedRowKey: null,
  isFocused: false,
  onFocusChange: (nodeId: string) => { void nodeId; },
};

test('DAGLoopNodeProps contract fixture: focusedRowKey is string|null and onFocusChange is (nodeId: string) => void', () => {
  assert.strictEqual(_loopPropsContractFixture.focusedRowKey, null);
  assert.strictEqual(typeof _loopPropsContractFixture.onFocusChange, 'function');
});

// The DAGIterationPanel and DAGCorrectiveTaskGroup prop interfaces are not
// exported (they are internal `interface` declarations). Build an equivalent
// structural type locally and assert that an object with the expected shape
// compiles. This exercises the same contract that the parent components
// satisfy when rendering those elements.

interface _DAGIterationPanelPropsContract {
  iteration: {
    index: number;
    status: string;
    nodes: Record<string, unknown>;
    corrective_tasks: unknown[];
    commit_hash: string | null;
  };
  iterationIndex: number;
  parentNodeId: string;
  parentKind: 'for_each_phase' | 'for_each_task';
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  projectName: string;
  expandedLoopIds: string[];
  onAccordionChange: (value: string[], eventDetails: { reason: string }) => void;
  focusedRowKey: string | null;
  onFocusChange: (nodeId: string) => void;
}

const _iterationPanelPropsContractFixture: _DAGIterationPanelPropsContract = {
  iteration: {
    index: 0,
    status: 'not_started',
    nodes: {},
    corrective_tasks: [],
    commit_hash: null,
  },
  iterationIndex: 0,
  parentNodeId: 'phase_loop',
  parentKind: 'for_each_phase',
  currentNodePath: null,
  onDocClick: (path: string) => { void path; },
  repoBaseUrl: null,
  projectName: 'test-project',
  expandedLoopIds: [],
  onAccordionChange: (value: string[], eventDetails: { reason: string }) => { void value; void eventDetails; },
  focusedRowKey: null,
  onFocusChange: (nodeId: string) => { void nodeId; },
};

test('DAGIterationPanelProps structural fixture: focusedRowKey and onFocusChange are present and typed correctly', () => {
  assert.strictEqual(_iterationPanelPropsContractFixture.focusedRowKey, null);
  assert.strictEqual(typeof _iterationPanelPropsContractFixture.onFocusChange, 'function');
});

interface _DAGCorrectiveTaskGroupPropsContract {
  correctiveTasks: unknown[];
  parentNodeId: string;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  focusedRowKey: string | null;
  onFocusChange: (nodeId: string) => void;
}

const _correctiveTaskGroupPropsContractFixture: _DAGCorrectiveTaskGroupPropsContract = {
  correctiveTasks: [],
  parentNodeId: 'phase_loop.iter0',
  currentNodePath: null,
  onDocClick: (path: string) => { void path; },
  repoBaseUrl: null,
  focusedRowKey: null,
  onFocusChange: (nodeId: string) => { void nodeId; },
};

test('DAGCorrectiveTaskGroupProps structural fixture: focusedRowKey and onFocusChange are present and typed correctly', () => {
  assert.strictEqual(_correctiveTaskGroupPropsContractFixture.focusedRowKey, null);
  assert.strictEqual(typeof _correctiveTaskGroupPropsContractFixture.onFocusChange, 'function');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
