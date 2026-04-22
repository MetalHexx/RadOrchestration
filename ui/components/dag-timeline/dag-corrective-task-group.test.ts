/**
 * Tests for DAGCorrectiveTaskGroup component logic.
 * Run with: npx tsx ui/components/dag-timeline/dag-corrective-task-group.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 * Helper functions are exported from dag-corrective-task-group.tsx for testability.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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

// ─── Doc button rendering (post-unify: entry.doc_path owns the link) ─────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const correctiveTaskGroupSource = readFileSync(join(__dirname, 'dag-corrective-task-group.tsx'), 'utf-8');

test('dag-corrective-task-group.tsx imports DocumentLink from @/components/documents', () => {
  // Post-unify, CorrectiveTaskEntry.doc_path replaces the synthesized task_handoff step node
  // that used to own the Doc button via DAGNodeRow. The group component must import DocumentLink
  // so its accordion header row can render a Doc link off entry.doc_path. DocumentLink renders
  // as a SIBLING of AccordionTrigger (not nested inside it) to avoid invalid nested <button>s.
  assert.ok(
    /import\s+\{[^}]*DocumentLink[^}]*\}\s+from\s+['"]@\/components\/documents['"]/.test(correctiveTaskGroupSource),
    'corrective task group must import DocumentLink so the accordion header row can render a Doc link when entry.doc_path resolves'
  );
});

test('dag-corrective-task-group.tsx renders a <DocumentLink path={entry.doc_path} label="Doc" onDocClick={onDocClick} /> in the accordion header row', () => {
  // Mirrors the iteration-panel pattern (dag-iteration-panel.tsx:132-138): post-unify corrective
  // handoff docs are carried on CorrectiveTaskEntry.doc_path and entry.nodes can be empty, so
  // the group component itself must render the Doc button off entry.doc_path to keep corrective
  // handoffs accessible from the timeline now that the synthetic task_handoff step node is gone.
  assert.ok(
    correctiveTaskGroupSource.includes('<DocumentLink'),
    'corrective task group must render <DocumentLink> for the corrective task\'s doc link'
  );
  assert.ok(
    /<DocumentLink\s+path=\{entry\.doc_path\}/.test(correctiveTaskGroupSource),
    '<DocumentLink> path prop must be entry.doc_path (the new CorrectiveTaskEntry.doc_path field)'
  );
  assert.ok(
    /<DocumentLink[^/]*label="Doc"/.test(correctiveTaskGroupSource),
    '<DocumentLink> label prop must be "Doc" to match the iteration-panel / DAGNodeRow idiom'
  );
  assert.ok(
    /<DocumentLink[^/]*onDocClick=\{onDocClick\}/.test(correctiveTaskGroupSource),
    '<DocumentLink> must forward the onDocClick prop plumbed through to the corrective task group'
  );
});

test('dag-corrective-task-group.tsx gates <DocumentLink> on entry.doc_path (no render when null/empty)', () => {
  // Gate expression mirrors dag-iteration-panel.tsx:132 exactly:
  //   entry.doc_path != null && entry.doc_path !== ''
  // No render when doc_path is absent — a completed-without-handoff-doc corrective task would
  // show an empty Doc button otherwise.
  const lines = correctiveTaskGroupSource.split(/\r?\n/);
  const docLinkLineIdx = lines.findIndex((l) => l.includes('<DocumentLink'));
  assert.ok(docLinkLineIdx > 0, 'DocumentLink line must exist');
  // Scan the preceding 10 lines for the gate expression (headroom for an explanatory comment block).
  const precedingWindow = lines.slice(Math.max(0, docLinkLineIdx - 10), docLinkLineIdx).join('\n');
  assert.ok(
    /entry\.doc_path\s*!=\s*null/.test(precedingWindow),
    'DocumentLink must be gated on `entry.doc_path != null` so corrective tasks without a handoff doc do not render an empty Doc button'
  );
});

test('dag-corrective-task-group.tsx <DocumentLink> does NOT pass tabIndex (keyboard accessibility — default tab order required)', () => {
  // The AccordionTrigger consumes Enter/Space to expand/collapse the corrective task panel.
  // If DocumentLink were tabIndex={-1} (as DAGNodeRow uses internally to preserve roving
  // tabindex), a keyboard-only user would have NO path to open the corrective handoff doc.
  // Same rationale as dag-iteration-panel.tsx — header-level DocumentLinks must use default
  // tab order.
  const docLinkMatch = correctiveTaskGroupSource.match(/<DocumentLink\b[^>]*\/>/);
  assert.ok(docLinkMatch, 'corrective task group must contain a self-closing <DocumentLink ... /> element');
  assert.ok(
    !/tabIndex\s*=/.test(docLinkMatch[0]),
    '<DocumentLink> in the corrective accordion header row must NOT pass tabIndex — the AccordionTrigger consumes Enter/Space so a keyboard user must reach the Doc link via natural tab order'
  );
});

test('dag-corrective-task-group.tsx <ExternalLink> does NOT pass tabIndex (keyboard accessibility — same rationale as DocumentLink)', () => {
  // Same rationale as the DocumentLink case above. ExternalLink is a sibling of
  // AccordionTrigger (not nested inside it — enforced by the segment-scan test), so
  // the trigger does not own its focus. The surrounding <div> has no row-level focus
  // wiring (no tabIndex, no keydown handler). If ExternalLink were tabIndex={-1}, a
  // keyboard-only user would have NO path to open the commit link. The original
  // tabIndex={-1} was carried over from an earlier shape where ExternalLink was
  // nested inside AccordionTrigger; post-restructure it is a sibling and the
  // override now breaks keyboard reachability.
  const extLinkMatch = correctiveTaskGroupSource.match(/<ExternalLink\b[\s\S]*?\/>/);
  assert.ok(extLinkMatch, 'corrective task group must contain a self-closing <ExternalLink ... /> element');
  assert.ok(
    !/tabIndex\s*=/.test(extLinkMatch[0]),
    '<ExternalLink> in the corrective header must NOT pass tabIndex — the AccordionTrigger consumes Enter/Space so a keyboard user must reach the commit link via natural tab order'
  );
});

test('dag-corrective-task-group.tsx <DocumentLink> renders OUTSIDE <AccordionTrigger> (no nested interactive controls)', () => {
  // AccordionTrigger renders AccordionPrimitive.Trigger, which is a <button>.
  // DocumentLink renders a <button>. Nesting <button> inside <button> is invalid HTML
  // and breaks click/keyboard behavior (the inner click bubbles and toggles the accordion,
  // ARIA/focus is undefined). The Doc link MUST be a sibling of AccordionTrigger, not a
  // child. Enforce the invariant by scanning every AccordionTrigger span in the source
  // and asserting <DocumentLink appears in NONE of them.
  //
  // Approach: split the source on </AccordionTrigger>. Each segment except the last ends
  // with a trigger's body; within each such segment find the nearest preceding
  // <AccordionTrigger and check the body between them for <DocumentLink.
  const segments = correctiveTaskGroupSource.split('</AccordionTrigger>');
  // Skip the final segment — it is the tail after the last closing tag (no matching open).
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const openIdx = seg.lastIndexOf('<AccordionTrigger');
    assert.ok(openIdx >= 0, `segment ${i} missing matching <AccordionTrigger open tag`);
    const triggerBody = seg.slice(openIdx);
    assert.ok(
      !/<DocumentLink\b/.test(triggerBody),
      `<DocumentLink> must NOT render inside <AccordionTrigger> — invalid nested <button> breaks HTML + click/keyboard (Copilot R6). Found inside AccordionTrigger segment ${i}.`
    );
    assert.ok(
      !/<ExternalLink\b/.test(triggerBody),
      `<ExternalLink> must NOT render inside <AccordionTrigger> — invalid nested <a> inside <button> breaks HTML + click/keyboard (Copilot R6). Found inside AccordionTrigger segment ${i}.`
    );
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
