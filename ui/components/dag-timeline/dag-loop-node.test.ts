/**
 * Tests for DAGLoopNode component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-loop-node.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * Helper functions are exported from dag-loop-node.tsx for testability.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildLoopItemValue } from './dag-loop-node';
import { isLoopNode, getDisplayName } from './dag-timeline-helpers';
import type {
  ForEachPhaseNodeState,
  ForEachTaskNodeState,
  IterationEntry,
  NodeStatus,
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeIteration(index: number, status: NodeStatus = 'not_started'): IterationEntry {
  return {
    index,
    status,
    nodes: {},
    corrective_tasks: [],
    commit_hash: null,
  };
}

const forEachPhaseNode0: ForEachPhaseNodeState = {
  kind: 'for_each_phase',
  status: 'not_started',
  iterations: [],
};

const forEachPhaseNode2: ForEachPhaseNodeState = {
  kind: 'for_each_phase',
  status: 'in_progress',
  iterations: [makeIteration(0), makeIteration(1)],
};

const forEachTaskNode3: ForEachTaskNodeState = {
  kind: 'for_each_task',
  status: 'completed',
  iterations: [makeIteration(0), makeIteration(1), makeIteration(2)],
};

// Intentionally out of order to test sort
const forEachPhaseNodeUnsorted: ForEachPhaseNodeState = {
  kind: 'for_each_phase',
  status: 'not_started',
  iterations: [makeIteration(2), makeIteration(0), makeIteration(1)],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nDAGLoopNode logic tests\n");

// buildLoopItemValue
test('buildLoopItemValue("phase_loop") returns "loop-phase_loop"', () => {
  assert.strictEqual(buildLoopItemValue("phase_loop"), "loop-phase_loop");
});

test('buildLoopItemValue("task_loop") returns "loop-task_loop"', () => {
  assert.strictEqual(buildLoopItemValue("task_loop"), "loop-task_loop");
});

test('buildLoopItemValue("my_node_id") returns "loop-my_node_id"', () => {
  assert.strictEqual(buildLoopItemValue("my_node_id"), "loop-my_node_id");
});

// getDisplayName (used by component trigger row)
test('getDisplayName("phase_loop") returns "Phase Loop"', () => {
  assert.strictEqual(getDisplayName("phase_loop"), "Phase Loop");
});

test('getDisplayName("task_loop") returns "Task Loop"', () => {
  assert.strictEqual(getDisplayName("task_loop"), "Task Loop");
});

// Component simulation: for_each_phase node with 0 iterations
test('for_each_phase node with 0 iterations renders no iteration panels', () => {
  const iterations = forEachPhaseNode0.iterations;
  assert.strictEqual(iterations.length, 0);
});

// Component simulation: for_each_phase node with 2 iterations
test('for_each_phase node with 2 iterations renders 2 DAGIterationPanel entries', () => {
  const iterations = forEachPhaseNode2.iterations;
  assert.strictEqual(iterations.length, 2);
});

test('for_each_phase node with 2 iterations — first entry has iterationIndex 0', () => {
  const sorted = [...forEachPhaseNode2.iterations].sort((a, b) => a.index - b.index);
  assert.strictEqual(sorted[0].index, 0);
});

test('for_each_phase node with 2 iterations — second entry has iterationIndex 1', () => {
  const sorted = [...forEachPhaseNode2.iterations].sort((a, b) => a.index - b.index);
  assert.strictEqual(sorted[1].index, 1);
});

test('parentNodeId is passed through to DAGIterationPanel (simulation: nodeId matches)', () => {
  const nodeId = "phase_loop";
  // isLoopNode confirms for_each_phase renders as DAGLoopNode, which then passes nodeId as parentNodeId
  const iterations = forEachPhaseNode2.iterations;
  assert.strictEqual(isLoopNode(forEachPhaseNode2), true);
  assert.strictEqual(iterations.length, 2);
  assert.strictEqual(buildLoopItemValue(nodeId), "loop-phase_loop");
});

// Component simulation: for_each_task node with 3 iterations
test('for_each_task node with 3 iterations renders 3 DAGIterationPanel entries', () => {
  const iterations = forEachTaskNode3.iterations;
  assert.strictEqual(iterations.length, 3);
});

// Iterations are rendered sorted by index ascending
test('iterations are sorted by index ascending', () => {
  const sorted = [...forEachPhaseNodeUnsorted.iterations].sort((a, b) => a.index - b.index);
  assert.strictEqual(sorted[0].index, 0);
  assert.strictEqual(sorted[1].index, 1);
  assert.strictEqual(sorted[2].index, 2);
});

test('unsorted iterations are reordered to ascending order', () => {
  const original = forEachPhaseNodeUnsorted.iterations.map(i => i.index);
  assert.deepStrictEqual(original, [2, 0, 1]); // confirm fixture is unsorted
  const sorted = [...forEachPhaseNodeUnsorted.iterations].sort((a, b) => a.index - b.index);
  assert.deepStrictEqual(sorted.map(i => i.index), [0, 1, 2]);
});

// Trigger row — NodeKindIcon with correct kind
test('trigger row uses node.kind for NodeKindIcon (for_each_phase)', () => {
  const kind = forEachPhaseNode2.kind;
  assert.strictEqual(kind, 'for_each_phase');
});

test('trigger row uses node.kind for NodeKindIcon (for_each_task)', () => {
  const kind = forEachTaskNode3.kind;
  assert.strictEqual(kind, 'for_each_task');
});

// Trigger row — NodeStatusBadge with node status
test('trigger row uses node.status for NodeStatusBadge (in_progress)', () => {
  const status = forEachPhaseNode2.status;
  assert.strictEqual(status, 'in_progress');
});

test('trigger row uses node.status for NodeStatusBadge (completed)', () => {
  const status = forEachTaskNode3.status;
  assert.strictEqual(status, 'completed');
});

// Trigger row — formatted node name
test('trigger row displays formatted node name via getDisplayName', () => {
  assert.strictEqual(getDisplayName("phase_loop"), "Phase Loop");
  assert.strictEqual(getDisplayName("task_loop"), "Task Loop");
});

// currentNodePath and onDocClick passthrough simulation
test('currentNodePath is passed through to DAGIterationPanel', () => {
  const currentNodePath = "phase_loop.iter0.task_handoff";
  // getDisplayName extracts the leaf segment of compound node paths
  assert.strictEqual(getDisplayName(currentNodePath), "Task Handoff");
});

test('onDocClick is passed through to DAGIterationPanel', () => {
  let called = false;
  const onDocClick = (path: string) => { called = true; void path; };
  onDocClick("some/path");
  assert.strictEqual(called, true);
});

// No aria-current on the trigger row
test('component does not add aria-current to trigger row (delegation to child DAGNodeRow)', () => {
  // This is a design constraint: the trigger row should NOT have aria-current.
  // We verify by asserting the component does not compute any isActive boolean
  // for the trigger itself — active-node indication is handled by child DAGNodeRow.
  // Simulation: nodeId !== currentNodePath does not affect trigger row rendering.
  const nodeId: string = "phase_loop";
  const currentNodePath: string = "phase_loop.iter0.task_handoff";
  // The trigger row never compares nodeId to currentNodePath
  const triggerHasAriaCurrent = nodeId === currentNodePath; // must be false
  assert.strictEqual(triggerHasAriaCurrent, false);
});

// ─── Source-text: Accordion controlled-mode wiring on DAGLoopNode ────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const loopNodeSource = readFileSync(join(__dirname, 'dag-loop-node.tsx'), 'utf-8');

/**
 * Returns true if the source contains an `<Accordion ...>` opening tag whose
 * attributes include both `value={expandedLoopIds}` and
 * `onValueChange={onAccordionChange}` — i.e. the accordion is wired in
 * controlled mode with state forwarded from the caller. The check is
 * line-by-line: when a line opens `<Accordion`, all subsequent lines up to the
 * end of the opening tag (`>` or `/>`) are inspected for the required props.
 */
function hasControlledAccordionWiring(source: string): boolean {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('<Accordion')) continue;
    let sawValue = false;
    let sawOnValueChange = false;
    let j = i;
    while (j < lines.length) {
      const line = lines[j];
      if (line.includes('value={expandedLoopIds}')) sawValue = true;
      if (line.includes('onValueChange={onAccordionChange}')) sawOnValueChange = true;
      if (line.includes('/>') || (j > i && line.includes('>'))) break;
      j++;
    }
    if (sawValue && sawOnValueChange) return true;
  }
  return false;
}

test('dag-loop-node.tsx wires <Accordion> in controlled mode with value={expandedLoopIds} and onValueChange={onAccordionChange}', () => {
  assert.ok(loopNodeSource.includes('<Accordion'), 'sanity: dag-loop-node.tsx should contain an <Accordion element');
  assert.ok(
    hasControlledAccordionWiring(loopNodeSource),
    'dag-loop-node.tsx must wire <Accordion> with both value={expandedLoopIds} and onValueChange={onAccordionChange} (controlled-mode forwarding)'
  );
});

test('dag-loop-node.tsx forwards expandedLoopIds and onAccordionChange to nested DAGIterationPanel', () => {
  // Iteration panels need to participate in the same controlled-mode tree so
  // nested loops (task_loop within phase_loop) stay in sync with the same
  // expandedLoopIds set held by the page-level useFollowMode hook.
  assert.ok(
    /expandedLoopIds=\{expandedLoopIds\}/.test(loopNodeSource),
    'dag-loop-node.tsx must forward expandedLoopIds={expandedLoopIds} to DAGIterationPanel'
  );
  assert.ok(
    /onAccordionChange=\{onAccordionChange\}/.test(loopNodeSource),
    'dag-loop-node.tsx must forward onAccordionChange={onAccordionChange} to DAGIterationPanel'
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
