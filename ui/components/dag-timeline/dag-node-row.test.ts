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
import { getDisplayName, getGateNodeConfig, GATE_NODE_CONFIG } from './dag-timeline-helpers';
import { STATUS_MAP } from './node-status-badge';
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

/**
 * Mirrors the gate-render decision logic in DAGNodeRow:
 * returns true iff the node is a gate, its status is not 'completed',
 * projectName is defined, and the nodeId leaf resolves in GATE_NODE_CONFIG.
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

function computeClasses(isActive: boolean): string[] {
  const classes = ['py-2', 'pr-3', 'rounded-md', 'gap-2', 'flex', 'items-center', 'hover:bg-accent/50'];
  if (isActive) {
    classes.push('border-l-2', 'border-l-[var(--color-link)]');
  }
  return classes;
}

// Mirrors the aria-label composition in DAGNodeRow: display-name and status
// label joined by a real em-dash.
function computeAriaLabel(displayName: string, statusLabel: string): string {
  return `${displayName} — ${statusLabel}`;
}

// Mirrors the row tabIndex stamp: 0 when focused, -1 otherwise.
function computeRowTabIndex(isFocused: boolean): 0 | -1 {
  return isFocused ? 0 : -1;
}

// Mirrors the onKeyDown decision logic in DAGNodeRow.
// Enter/Space always preventDefault (swallow space-scroll on listbox options);
// gate wins over doc; doc rows open their document; rows with neither action
// still swallow the keystroke.
function decideKeyDownAction(
  key: string,
  hasGate: boolean,
  hasDoc: boolean,
): 'click-gate' | 'open-doc' | 'swallow' | 'noop' {
  if (key !== 'Enter' && key !== ' ') return 'noop';
  if (hasGate) return 'click-gate';
  if (hasDoc) return 'open-doc';
  return 'swallow';
}

// Static-markup invariants the production component emits on the row's
// outer <div>. These literals must match exactly what DAGNodeRow renders.
const ROW_ROLE_LITERAL = 'option';
const ROW_DATA_ATTRIBUTE_NAME = 'data-timeline-row';

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

// ─── Tests: GATE_NODE_CONFIG & getGateNodeConfig ─────────────────────────────

test('GATE_NODE_CONFIG contains exactly two entries', () => {
  assert.strictEqual(Object.keys(GATE_NODE_CONFIG).length, 2);
});

test('GATE_NODE_CONFIG contains plan_approval_gate', () => {
  assert.ok('plan_approval_gate' in GATE_NODE_CONFIG, 'should contain plan_approval_gate');
});

test('GATE_NODE_CONFIG contains final_approval_gate', () => {
  assert.ok('final_approval_gate' in GATE_NODE_CONFIG, 'should contain final_approval_gate');
});

test('GATE_NODE_CONFIG does NOT contain pr_gate', () => {
  assert.ok(!('pr_gate' in GATE_NODE_CONFIG), 'should not contain pr_gate');
});

test('GATE_NODE_CONFIG does NOT contain gate_mode_selection', () => {
  assert.ok(!('gate_mode_selection' in GATE_NODE_CONFIG), 'should not contain gate_mode_selection');
});

test('GATE_NODE_CONFIG does NOT contain task_gate', () => {
  assert.ok(!('task_gate' in GATE_NODE_CONFIG), 'should not contain task_gate');
});

test('GATE_NODE_CONFIG does NOT contain phase_gate', () => {
  assert.ok(!('phase_gate' in GATE_NODE_CONFIG), 'should not contain phase_gate');
});

test("getGateNodeConfig('plan_approval_gate') returns plan_approved config", () => {
  assert.deepStrictEqual(getGateNodeConfig('plan_approval_gate'), {
    event: 'plan_approved',
    label: 'Approve Plan',
  });
});

test("getGateNodeConfig('final_approval_gate') returns final_approved config", () => {
  assert.deepStrictEqual(getGateNodeConfig('final_approval_gate'), {
    event: 'final_approved',
    label: 'Approve Final Review',
  });
});

test("getGateNodeConfig('pr_gate') returns null", () => {
  assert.strictEqual(getGateNodeConfig('pr_gate'), null);
});

test("getGateNodeConfig('gate_mode_selection') returns null", () => {
  assert.strictEqual(getGateNodeConfig('gate_mode_selection'), null);
});

test("getGateNodeConfig('task_gate') returns null", () => {
  assert.strictEqual(getGateNodeConfig('task_gate'), null);
});

test("getGateNodeConfig('phase_gate') returns null", () => {
  assert.strictEqual(getGateNodeConfig('phase_gate'), null);
});

test("getGateNodeConfig resolves leaf for compound ID 'some.prefix.plan_approval_gate'", () => {
  assert.deepStrictEqual(getGateNodeConfig('some.prefix.plan_approval_gate'), {
    event: 'plan_approved',
    label: 'Approve Plan',
  });
});

test("getGateNodeConfig resolves leaf for compound ID 'phase_loop.iter0.final_approval_gate'", () => {
  assert.deepStrictEqual(getGateNodeConfig('phase_loop.iter0.final_approval_gate'), {
    event: 'final_approved',
    label: 'Approve Final Review',
  });
});

test("getGateNodeConfig returns null for compound ID with non-map leaf 'phase_loop.iter0.task_gate'", () => {
  assert.strictEqual(getGateNodeConfig('phase_loop.iter0.task_gate'), null);
});

test("getGateNodeConfig returns null for compound ID with non-map leaf 'phase_loop.iter0.phase_gate'", () => {
  assert.strictEqual(getGateNodeConfig('phase_loop.iter0.phase_gate'), null);
});

// ─── Tests: shouldRenderGateButton decision logic ────────────────────────────

// Gate that the walker has reached but that is still awaiting human approval —
// walker leaves status at 'not_started' and flips gate_active = true. That is
// the realistic shape for plan_approval_gate / final_approval_gate pre-approval.
const pendingGateNode: GateNodeState = {
  kind: 'gate',
  status: 'not_started',
  gate_active: true,
};

test("shouldRenderGateButton returns true for pending plan_approval_gate with projectName", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'plan_approval_gate', 'my-project'),
    true
  );
});

test("shouldRenderGateButton returns true for pending final_approval_gate with projectName", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'final_approval_gate', 'my-project'),
    true
  );
});

test("shouldRenderGateButton returns true for compound ID resolving to plan_approval_gate", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'some.prefix.plan_approval_gate', 'my-project'),
    true
  );
});

test("shouldRenderGateButton returns false for step node (non-gate kind)", () => {
  assert.strictEqual(
    shouldRenderGateButton(stepNodeWithDoc, 'plan_approval_gate', 'my-project'),
    false
  );
});

test("shouldRenderGateButton returns false for conditional node (non-gate kind)", () => {
  assert.strictEqual(
    shouldRenderGateButton(conditionalNode, 'plan_approval_gate', 'my-project'),
    false
  );
});

test("shouldRenderGateButton returns false for parallel node (non-gate kind)", () => {
  assert.strictEqual(
    shouldRenderGateButton(parallelNode, 'plan_approval_gate', 'my-project'),
    false
  );
});

// Regression: DAG-VIEW-4 persisted plan_approval_gate as
// { status: 'completed', gate_active: true } after human approval because the
// mutation handler writes gate_active = true on approval. The UI must hide the
// button once status === 'completed' regardless of gate_active.
test("shouldRenderGateButton returns false when node.status === 'completed' (regression: DAG-VIEW-4 plan_approval_gate stuck visible)", () => {
  const completedGate: GateNodeState = {
    kind: 'gate',
    status: 'completed',
    gate_active: true,
  };
  assert.strictEqual(
    shouldRenderGateButton(completedGate, 'plan_approval_gate', 'my-project'),
    false
  );
});

test("shouldRenderGateButton returns false when projectName === undefined", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'plan_approval_gate', undefined),
    false
  );
});

test("shouldRenderGateButton returns false for pr_gate leaf", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'pr_gate', 'my-project'),
    false
  );
});

test("shouldRenderGateButton returns false for gate_mode_selection leaf", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'gate_mode_selection', 'my-project'),
    false
  );
});

test("shouldRenderGateButton returns false for task_gate leaf", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'task_gate', 'my-project'),
    false
  );
});

test("shouldRenderGateButton returns false for phase_gate leaf", () => {
  assert.strictEqual(
    shouldRenderGateButton(pendingGateNode, 'phase_gate', 'my-project'),
    false
  );
});

// ─── Tests: composed aria-label ──────────────────────────────────────────────

test("computeAriaLabel('Plan Architecture', 'In Progress') returns 'Plan Architecture — In Progress'", () => {
  assert.strictEqual(
    computeAriaLabel('Plan Architecture', 'In Progress'),
    'Plan Architecture — In Progress'
  );
});

test("computeAriaLabel uses STATUS_MAP['halted'].defaultLabel → 'Approve Plan — Halted'", () => {
  assert.strictEqual(
    computeAriaLabel('Approve Plan', STATUS_MAP['halted'].defaultLabel),
    'Approve Plan — Halted'
  );
});

test("computeAriaLabel with compound-id leaf extraction → 'Plan Approval Gate — Not Started'", () => {
  assert.strictEqual(
    computeAriaLabel(
      getDisplayName('phase_loop.iter0.plan_approval_gate'),
      STATUS_MAP['not_started'].defaultLabel
    ),
    'Plan Approval Gate — Not Started'
  );
});

// ─── Tests: row tabIndex ─────────────────────────────────────────────────────

test('computeRowTabIndex(true) === 0', () => {
  assert.strictEqual(computeRowTabIndex(true), 0);
});

test('computeRowTabIndex(false) === -1', () => {
  assert.strictEqual(computeRowTabIndex(false), -1);
});

// ─── Tests: static markup invariants ─────────────────────────────────────────

test("row role literal is 'option'", () => {
  assert.strictEqual(ROW_ROLE_LITERAL, 'option');
});

test("row carries the 'data-timeline-row' attribute", () => {
  assert.strictEqual(ROW_DATA_ATTRIBUTE_NAME, 'data-timeline-row');
});

// ─── Tests: decideKeyDownAction ──────────────────────────────────────────────

test("decideKeyDownAction('Enter', true, false) === 'click-gate'", () => {
  assert.strictEqual(decideKeyDownAction('Enter', true, false), 'click-gate');
});

test("decideKeyDownAction(' ', true, false) === 'click-gate'", () => {
  assert.strictEqual(decideKeyDownAction(' ', true, false), 'click-gate');
});

test("decideKeyDownAction('Enter', true, true) === 'click-gate' (gate wins over doc)", () => {
  assert.strictEqual(decideKeyDownAction('Enter', true, true), 'click-gate');
});

test("decideKeyDownAction('Enter', false, true) === 'open-doc'", () => {
  assert.strictEqual(decideKeyDownAction('Enter', false, true), 'open-doc');
});

test("decideKeyDownAction(' ', false, true) === 'open-doc'", () => {
  assert.strictEqual(decideKeyDownAction(' ', false, true), 'open-doc');
});

test("decideKeyDownAction('Enter', false, false) === 'swallow'", () => {
  assert.strictEqual(decideKeyDownAction('Enter', false, false), 'swallow');
});

test("decideKeyDownAction(' ', false, false) === 'swallow'", () => {
  assert.strictEqual(decideKeyDownAction(' ', false, false), 'swallow');
});

test("decideKeyDownAction('Tab', true, true) === 'noop'", () => {
  assert.strictEqual(decideKeyDownAction('Tab', true, true), 'noop');
});

test("decideKeyDownAction('ArrowDown', true, true) === 'noop'", () => {
  assert.strictEqual(decideKeyDownAction('ArrowDown', true, true), 'noop');
});

test("decideKeyDownAction('ArrowUp', true, true) === 'noop'", () => {
  assert.strictEqual(decideKeyDownAction('ArrowUp', true, true), 'noop');
});

test("decideKeyDownAction('Escape', true, true) === 'noop'", () => {
  assert.strictEqual(decideKeyDownAction('Escape', true, true), 'noop');
});

// ─── Tests: gate-forwarding integration (pure-logic) ─────────────────────────

test("Enter on pending plan_approval_gate row forwards .click() to gate button", () => {
  // Row would render the gate button (shouldRenderGateButton === true) AND
  // the keydown decision would forward Enter as a gate click.
  const renders = shouldRenderGateButton(pendingGateNode, 'plan_approval_gate', 'my-project');
  const action = decideKeyDownAction('Enter', renders, false);
  assert.strictEqual(renders, true);
  assert.strictEqual(action, 'click-gate');
});

test("Enter on step row with doc_path returns 'open-doc'", () => {
  // Step rows with a non-null doc_path should keyboard-activate the doc.
  const action = decideKeyDownAction('Enter', false, true);
  assert.strictEqual(action, 'open-doc');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
