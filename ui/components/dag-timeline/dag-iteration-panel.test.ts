/**
 * Tests for DAGIterationPanel component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-iteration-panel.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * Helper functions are exported from dag-iteration-panel.tsx for testability.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildIterationLabel,
  buildIterationChildNodeId,
  buildCorrectiveGroupParentId,
  ITERATION_CHILD_DEPTH,
} from './dag-iteration-panel';
import { getCommitLinkData, filterCompatibleNodes } from './dag-timeline-helpers';
import { isLoopNode } from './dag-timeline-helpers';
import {
  stepNode,
  gateNode,
  conditionalNode,
  parallelNode,
  forEachPhaseNode,
  forEachTaskNode,
  taskLoopIteration,
  taskLoopIterationWithCorrective,
} from './__fixtures__';
import type {
  NodeState,
  ForEachTaskNodeState,
  IterationEntry,
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

console.log("\nDAGIterationPanel logic tests\n");

// buildIterationLabel
test('buildIterationLabel(0) returns "Iteration 1" (0-based index → 1-based display)', () => {
  assert.strictEqual(buildIterationLabel(0), "Iteration 1");
});

test('buildIterationLabel(4) returns "Iteration 5"', () => {
  assert.strictEqual(buildIterationLabel(4), "Iteration 5");
});

// buildChildNodeId
test('buildIterationChildNodeId("phase_loop", 0, "phase_planning") returns "phase_loop.iter0.phase_planning"', () => {
  assert.strictEqual(
    buildIterationChildNodeId("phase_loop", 0, "phase_planning"),
    "phase_loop.iter0.phase_planning"
  );
});

test('buildIterationChildNodeId("task_loop", 2, "task_handoff") returns "task_loop.iter2.task_handoff"', () => {
  assert.strictEqual(
    buildIterationChildNodeId("task_loop", 2, "task_handoff"),
    "task_loop.iter2.task_handoff"
  );
});

// getCommitLinkData — linked state (drives ExternalLink icon="external-link" branch)
test('getCommitLinkData("abc1234def", "https://github.com/user/repo") returns { href: "https://github.com/user/repo/commit/abc1234def", label: "abc1234" } (linked-state branch)', () => {
  const result = getCommitLinkData("abc1234def", "https://github.com/user/repo");
  assert.ok(result !== null);
  assert.strictEqual(result.href, "https://github.com/user/repo/commit/abc1234def");
  assert.strictEqual(result.label, "abc1234");
});

// getCommitLinkData — unlinked state (drives plain-monospace-span branch)
test('getCommitLinkData("abc1234def", null) returns { href: null, label: "abc1234" } (unlinked-state branch receives href === null and 7-char label)', () => {
  const result = getCommitLinkData("abc1234def", null);
  assert.ok(result !== null);
  assert.strictEqual(result.label, "abc1234");
  assert.strictEqual(result.label.length, 7);
  assert.strictEqual(result.href, null);
});

// getCommitLinkData — absent state (outer commitData !== null guard suppresses render)
test('getCommitLinkData(null, null) returns null (absent-state outer guard suppresses render)', () => {
  const result = getCommitLinkData(null, null);
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
test('ITERATION_CHILD_DEPTH is exported and equals 1', () => {
  assert.strictEqual(ITERATION_CHILD_DEPTH, 1);
});

// buildCorrectiveGroupParentId
test('buildCorrectiveGroupParentId("phase_loop", 0) returns "phase_loop.iter0"', () => {
  assert.strictEqual(buildCorrectiveGroupParentId("phase_loop", 0), "phase_loop.iter0");
});

test('buildCorrectiveGroupParentId("task_loop", 3) returns "task_loop.iter3"', () => {
  assert.strictEqual(buildCorrectiveGroupParentId("task_loop", 3), "task_loop.iter3");
});

// ─── Loop dispatch classification within iteration nodes ─────────────────────

test('isLoopNode() returns true for the for_each_task node inside taskLoopIteration.nodes', () => {
  const forEachTask = taskLoopIteration.nodes['for_each_task'];
  assert.ok(forEachTask !== undefined);
  assert.strictEqual(isLoopNode(forEachTask), true);
});

test('isLoopNode() returns false for all non-loop nodes in taskLoopIteration.nodes', () => {
  const nonLoopKeys = ['phase_planning', 'phase_report', 'phase_review', 'phase_gate'];
  for (const key of nonLoopKeys) {
    const node = taskLoopIteration.nodes[key];
    assert.ok(node !== undefined, `Expected node "${key}" to exist`);
    assert.strictEqual(isLoopNode(node), false, `Expected isLoopNode(${key}) to be false`);
  }
});

test('partitioning taskLoopIteration.nodes by isLoopNode() yields 1 loop node and 4 non-loop nodes', () => {
  const entries = Object.entries(taskLoopIteration.nodes);
  const loopNodes = entries.filter(([, node]) => isLoopNode(node));
  const nonLoopNodes = entries.filter(([, node]) => !isLoopNode(node));
  assert.strictEqual(loopNodes.length, 1);
  assert.strictEqual(nonLoopNodes.length, 4);
});

// ─── Compound node ID construction through nesting chain ─────────────────────

test('phase-level child ID: buildIterationChildNodeId("phase_loop", 0, "task_loop") -> "phase_loop.iter0.task_loop"', () => {
  assert.strictEqual(
    buildIterationChildNodeId("phase_loop", 0, "task_loop"),
    "phase_loop.iter0.task_loop"
  );
});

test('task-level nested child ID: buildIterationChildNodeId("phase_loop.iter0.task_loop", 0, "code_review") -> "phase_loop.iter0.task_loop.iter0.code_review"', () => {
  assert.strictEqual(
    buildIterationChildNodeId("phase_loop.iter0.task_loop", 0, "code_review"),
    "phase_loop.iter0.task_loop.iter0.code_review"
  );
});

test('task-level child ID at iteration index 2: buildIterationChildNodeId("phase_loop.iter0.task_loop", 2, "task_handoff") -> "phase_loop.iter0.task_loop.iter2.task_handoff"', () => {
  assert.strictEqual(
    buildIterationChildNodeId("phase_loop.iter0.task_loop", 2, "task_handoff"),
    "phase_loop.iter0.task_loop.iter2.task_handoff"
  );
});

test('multi-level chaining: deeply nested corrective task ID construction', () => {
  const level1 = buildIterationChildNodeId("phase_loop", 0, "task_loop");
  const level2 = buildIterationChildNodeId(level1, 0, "ct1");
  assert.strictEqual(level1, "phase_loop.iter0.task_loop");
  assert.strictEqual(level2, "phase_loop.iter0.task_loop.iter0.ct1");
  const level3 = buildIterationChildNodeId(level2, 0, "task_handoff");
  assert.strictEqual(level3, "phase_loop.iter0.task_loop.iter0.ct1.iter0.task_handoff");
});

// ─── Nested state data safety ─────────────────────────────────────────────────

test('traversing taskLoopIteration nested data completes without error and yields 5 child node keys', () => {
  const entries = Object.entries(taskLoopIteration.nodes);
  const found = entries.find(([, n]) => isLoopNode(n));
  assert.ok(found !== undefined);
  const forEachTask = found[1] as ForEachTaskNodeState;
  const innerKeys = Object.keys(forEachTask.iterations[0].nodes);
  assert.deepStrictEqual(
    innerKeys.sort(),
    ['code_review', 'commit_gate', 'task_executor', 'task_gate', 'task_handoff'].sort()
  );
});

test('traversing taskLoopIterationWithCorrective nested data completes without error and corrective_tasks has length 1', () => {
  const entries = Object.entries(taskLoopIterationWithCorrective.nodes);
  const found = entries.find(([, n]) => isLoopNode(n));
  assert.ok(found !== undefined);
  const forEachTask = found[1] as ForEachTaskNodeState;
  const innerIteration = forEachTask.iterations[0];
  assert.strictEqual(innerIteration.corrective_tasks.length, 1);
});

test('inner task iteration does NOT contain any further loop nodes (recursion naturally terminates)', () => {
  const entries = Object.entries(taskLoopIteration.nodes);
  const found = entries.find(([, n]) => isLoopNode(n));
  assert.ok(found !== undefined);
  const forEachTask = found[1] as ForEachTaskNodeState;
  const innerEntries = Object.entries(forEachTask.iterations[0].nodes);
  const innerLoopNodes = innerEntries.filter(([, n]) => isLoopNode(n));
  assert.strictEqual(innerLoopNodes.length, 0);
});

// ─── Corrective task fixture structure ───────────────────────────────────────

test('taskLoopIterationWithCorrective corrective task has reason "Code review found issues"', () => {
  const entries = Object.entries(taskLoopIterationWithCorrective.nodes);
  const found = entries.find(([, n]) => isLoopNode(n));
  assert.ok(found !== undefined);
  const forEachTask = found[1] as ForEachTaskNodeState;
  const correctiveTask = forEachTask.iterations[0].corrective_tasks[0];
  assert.strictEqual(correctiveTask.reason, 'Code review found issues');
});

test('taskLoopIterationWithCorrective corrective task nodes contains a task_handoff step node', () => {
  const entries = Object.entries(taskLoopIterationWithCorrective.nodes);
  const found = entries.find(([, n]) => isLoopNode(n));
  assert.ok(found !== undefined);
  const forEachTask = found[1] as ForEachTaskNodeState;
  const correctiveTask = forEachTask.iterations[0].corrective_tasks[0];
  assert.ok('task_handoff' in correctiveTask.nodes);
  assert.strictEqual(correctiveTask.nodes['task_handoff'].kind, 'step');
});

test('taskLoopIterationWithCorrective corrective task commit_hash is null', () => {
  const entries = Object.entries(taskLoopIterationWithCorrective.nodes);
  const found = entries.find(([, n]) => isLoopNode(n));
  assert.ok(found !== undefined);
  const forEachTask = found[1] as ForEachTaskNodeState;
  const correctiveTask = forEachTask.iterations[0].corrective_tasks[0];
  assert.strictEqual(correctiveTask.commit_hash, null);
});

// ─── Phase-scope corrective forwarding ──────────────────────────────────────

// DAGIterationPanel is generic over parentKind ('for_each_phase' | 'for_each_task').
// It always forwards iteration.corrective_tasks to <DAGCorrectiveTaskGroup> regardless
// of parentKind. This block verifies the structural wiring at fixture + source-text level.

test('phase-scope corrective iteration fixture has corrective_tasks.length === 1', () => {
  // A for_each_phase IterationEntry carrying a synthesized phase-scope corrective
  // (task_handoff pre-completed + code_review scaffolded body node).
  const phaseCorrectiveIteration: IterationEntry = {
    index: 0,
    status: 'in_progress',
    corrective_tasks: [
      {
        index: 1,
        reason: 'Phase review requested changes',
        injected_after: 'phase_review',
        status: 'in_progress',
        nodes: {
          task_handoff: {
            kind: 'step',
            status: 'completed',
            doc_path: 'tasks/PROJ-TASK-P01-PHASE-C1.md',
            retries: 0,
          },
          code_review: {
            kind: 'step',
            status: 'not_started',
            doc_path: null,
            retries: 0,
          },
        },
        commit_hash: null,
      },
    ],
    nodes: {
      phase_review: { kind: 'step', status: 'in_progress', doc_path: 'reports/PROJ-PHASE-REVIEW-P01.md', retries: 0 },
    },
    commit_hash: null,
  };

  assert.strictEqual(phaseCorrectiveIteration.corrective_tasks.length, 1);
  const corrective = phaseCorrectiveIteration.corrective_tasks[0];
  assert.strictEqual(corrective.index, 1);
  assert.strictEqual(corrective.injected_after, 'phase_review');
  assert.strictEqual(corrective.reason, 'Phase review requested changes');
  assert.ok('task_handoff' in corrective.nodes);
  assert.ok('code_review' in corrective.nodes);
  assert.strictEqual((corrective.nodes['task_handoff'] as NodeState & { doc_path?: string | null }).doc_path, 'tasks/PROJ-TASK-P01-PHASE-C1.md');
});

test('phase-scope corrective task nodes contain synthesized pre-completed task_handoff step node', () => {
  const corrective: CorrectiveTaskEntry = {
    index: 1,
    reason: 'Phase review requested changes',
    injected_after: 'phase_review',
    status: 'in_progress',
    nodes: {
      task_handoff: { kind: 'step', status: 'completed', doc_path: 'tasks/PROJ-TASK-P01-PHASE-C1.md', retries: 0 },
      code_review: { kind: 'step', status: 'not_started', doc_path: null, retries: 0 },
    },
    commit_hash: null,
  };

  const taskHandoff = corrective.nodes['task_handoff'];
  assert.ok(taskHandoff !== undefined);
  assert.strictEqual(taskHandoff.kind, 'step');
  // Pre-completed synthesized task_handoff has status 'completed' and a non-null doc_path.
  const handoffStep = taskHandoff as { kind: 'step'; status: string; doc_path: string | null; retries: number };
  assert.strictEqual(handoffStep.status, 'completed');
  assert.notStrictEqual(handoffStep.doc_path, null);
});

// ─── Source-text: no projectName / gateActive forwarding into iteration scope ─

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const iterationPanelSource = readFileSync(join(__dirname, 'dag-iteration-panel.tsx'), 'utf-8');
const correctiveTaskGroupSource = readFileSync(join(__dirname, 'dag-corrective-task-group.tsx'), 'utf-8');

/**
 * Returns true if any <DAGNodeRow ...> JSX element in the given source text
 * contains a `projectName=` or `gateActive=` prop. The check is performed
 * line-by-line: when a line references `<DAGNodeRow`, all subsequent lines up
 * to the closing `/>` or `>` (end of the opening tag) are inspected for the
 * forbidden substrings. This guards against accidental future forwarding of
 * gate activation state into iteration-internal (`task_gate`, `phase_gate`)
 * rows, which are intentionally out of scope for approval-button rendering.
 */
function hasGateForwardingOnDAGNodeRow(source: string): boolean {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('<DAGNodeRow')) continue;
    // Scan the opening tag (may span multiple lines)
    let j = i;
    while (j < lines.length) {
      const line = lines[j];
      if (line.includes('projectName=') || line.includes('gateActive=')) {
        return true;
      }
      if (line.includes('/>') || (j > i && line.includes('>'))) break;
      j++;
    }
  }
  return false;
}

test('dag-iteration-panel.tsx <DAGNodeRow> elements do NOT forward projectName or gateActive', () => {
  assert.ok(iterationPanelSource.includes('<DAGNodeRow'), 'sanity: iteration panel should contain a <DAGNodeRow element');
  assert.strictEqual(
    hasGateForwardingOnDAGNodeRow(iterationPanelSource),
    false,
    'dag-iteration-panel.tsx must NOT forward projectName or gateActive on any <DAGNodeRow> — iteration-internal gate nodes (task_gate, phase_gate) are intentionally out of scope'
  );
});

test('dag-iteration-panel.tsx forwards iteration.corrective_tasks to DAGCorrectiveTaskGroup (phase-scope wiring)', () => {
  // Verifies the panel unconditionally forwards corrective_tasks to the group
  // component, meaning phase-scope corrective entries surface identically to
  // task-scope ones — no parentKind guard on the forwarding call.
  assert.ok(
    iterationPanelSource.includes('<DAGCorrectiveTaskGroup'),
    'sanity: iteration panel must render <DAGCorrectiveTaskGroup>'
  );
  assert.ok(
    iterationPanelSource.includes('correctiveTasks={iteration.corrective_tasks}'),
    'iteration panel must forward iteration.corrective_tasks to DAGCorrectiveTaskGroup'
  );
  // The corrective_tasks forwarding must NOT be inside a parentKind conditional block
  // (i.e., it appears once unconditionally for both for_each_phase and for_each_task).
  const lines = iterationPanelSource.split(/\r?\n/);
  const forwardingLine = lines.findIndex((l) => l.includes('correctiveTasks={iteration.corrective_tasks}'));
  assert.ok(forwardingLine >= 0, 'correctiveTasks forwarding line must exist');
  // Check the forwarding is not nested inside a parentKind === 'for_each_task' guard
  // by verifying it is NOT preceded (within 5 lines) by a for_each_task branch condition.
  const windowStart = Math.max(0, forwardingLine - 5);
  const precedingLines = lines.slice(windowStart, forwardingLine).join('\n');
  assert.ok(
    !precedingLines.includes("parentKind === 'for_each_task'"),
    "corrective_tasks forwarding must not be gated on parentKind === 'for_each_task'"
  );
});

test('dag-corrective-task-group.tsx does NOT contain projectName= or gateActive=', () => {
  assert.ok(correctiveTaskGroupSource.includes('<DAGNodeRow'), 'sanity: corrective task group should contain a <DAGNodeRow element');
  assert.ok(
    !correctiveTaskGroupSource.includes('projectName='),
    'dag-corrective-task-group.tsx must NOT contain projectName= (confirms no nested-scope forwarding)'
  );
  assert.ok(
    !correctiveTaskGroupSource.includes('gateActive='),
    'dag-corrective-task-group.tsx must NOT contain gateActive= (confirms no nested-scope forwarding)'
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
