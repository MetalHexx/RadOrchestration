/**
 * Tests for dag-timeline-helpers utility functions.
 * Run with: npx tsx ui/components/dag-timeline/dag-timeline-helpers.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 */
import assert from "node:assert";
import { getCommitLinkData, formatNodeId, getDisplayName, parsePhaseNameFromDocPath, parseTaskNameFromDocPath, groupNodesBySection, deriveCurrentPhase, derivePhaseProgress, NODE_SECTION_MAP } from './dag-timeline-helpers';
import { compoundNodeIds, stepNode, gateNode, forEachPhaseNode } from './__fixtures__';

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

console.log("\ndag-timeline-helpers tests\n");

test("valid commit hash returns href and 7-char label", () => {
  const result = getCommitLinkData("abc1234def");
  assert.deepStrictEqual(result, { href: "#abc1234def", label: "abc1234" });
});

test("null returns null", () => {
  const result = getCommitLinkData(null);
  assert.strictEqual(result, null);
});

test("undefined returns null without throwing", () => {
  const result = getCommitLinkData(undefined);
  assert.strictEqual(result, null);
});

test("empty string returns null", () => {
  const result = getCommitLinkData("");
  assert.strictEqual(result, null);
});

test("short hash (fewer than 7 chars) returns full hash as label", () => {
  const result = getCommitLinkData("abc");
  assert.deepStrictEqual(result, { href: "#abc", label: "abc" });
});

console.log("\nformatNodeId tests\n");

test("phase_planning returns Phase Planning", () => {
  assert.strictEqual(formatNodeId("phase_planning"), "Phase Planning");
});

test("code_review returns Code Review", () => {
  assert.strictEqual(formatNodeId("code_review"), "Code Review");
});

test("commit (single word) returns Commit", () => {
  assert.strictEqual(formatNodeId("commit"), "Commit");
});

console.log("\ngetDisplayName tests\n");

test("simple ID with no dot passes through to formatNodeId", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.simple), "Phase Planning");
});

test("two-segment ID extracts leaf after dot", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.twoSegment), "Phase Planning");
});

test("three-segment ID extracts leaf after last dot", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.threeSegment), "Phase Planning");
});

test("deeply nested ID extracts leaf", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.deeplyNested), "Code Review");
});

test("loop node ID extracts leaf", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.loopNode), "Task Loop");
});

test("single word with no dot and no underscore returns capitalized", () => {
  assert.strictEqual(getDisplayName(compoundNodeIds.singleWord), "Commit");
});

console.log("\nparsePhaseNameFromDocPath tests\n");

test("valid doc path with multi-word title returns Phase N — Title Case", () => {
  const result = parsePhaseNameFromDocPath("phases/MY-PROJECT-PHASE-02-CORE-RESEARCH-BRANCH.md", 1);
  assert.strictEqual(result, "Phase 2 \u2014 Core Research Branch");
});

test("null doc path returns fallback Phase N", () => {
  const result = parsePhaseNameFromDocPath(null, 0);
  assert.strictEqual(result, "Phase 1");
});

test("non-matching doc path returns fallback Phase N", () => {
  const result = parsePhaseNameFromDocPath("some/random/file.md", 2);
  assert.strictEqual(result, "Phase 3");
});

test("single-word title returns Phase N — Word", () => {
  const result = parsePhaseNameFromDocPath("phases/FOO-PHASE-01-SETUP.md", 0);
  assert.strictEqual(result, "Phase 1 \u2014 Setup");
});

test("case-insensitive: lowercase -phase- segment parses correctly", () => {
  const result = parsePhaseNameFromDocPath("phases/foo-phase-01-setup.md", 0);
  assert.strictEqual(result, "Phase 1 \u2014 Setup");
});

console.log("\nparseTaskNameFromDocPath tests\n");

test("valid doc path with single-word title returns Task N — Word", () => {
  const result = parseTaskNameFromDocPath("tasks/MY-PROJECT-TASK-P01-T03-WORKFLOW.md", 2);
  assert.strictEqual(result, "Task 3 \u2014 Workflow");
});

test("null doc path returns fallback Task N", () => {
  const result = parseTaskNameFromDocPath(null, 0);
  assert.strictEqual(result, "Task 1");
});

test("non-matching doc path returns fallback Task N", () => {
  const result = parseTaskNameFromDocPath("some/random/file.md", 4);
  assert.strictEqual(result, "Task 5");
});

test("multi-word title returns Task N — Title Case", () => {
  const result = parseTaskNameFromDocPath("tasks/X-TASK-P02-T01-UI-COMPONENT-SETUP.md", 0);
  assert.strictEqual(result, "Task 1 \u2014 Ui Component Setup");
});

test("case-insensitive: lowercase -task- segment parses correctly", () => {
  const result = parseTaskNameFromDocPath("tasks/x-task-p02-t01-ui-component-setup.md", 0);
  assert.strictEqual(result, "Task 1 \u2014 Ui Component Setup");
});

console.log("\ngroupNodesBySection tests\n");

test("all 11 NODE_SECTION_MAP keys produce 4 sections in correct order with correct counts", () => {
  const allNodes = {
    prd: stepNode,
    research: stepNode,
    design: stepNode,
    architecture: stepNode,
    master_plan: stepNode,
    plan_approval_gate: gateNode,
    gate_mode_selection: gateNode,
    phase_loop: forEachPhaseNode,
    final_review: stepNode,
    pr_gate: gateNode,
    final_approval_gate: gateNode,
  };
  assert.strictEqual(Object.keys(allNodes).length, Object.keys(NODE_SECTION_MAP).length);
  const result = groupNodesBySection(allNodes);
  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[0].label, "Planning");
  assert.strictEqual(result[0].entries.length, 5);
  assert.strictEqual(result[1].label, "Gates");
  assert.strictEqual(result[1].entries.length, 2);
  assert.strictEqual(result[2].label, "Execution");
  assert.strictEqual(result[2].entries.length, 1);
  assert.strictEqual(result[3].label, "Completion");
  assert.strictEqual(result[3].entries.length, 3);
});

test("empty NodesRecord returns empty array", () => {
  const result = groupNodesBySection({});
  assert.deepStrictEqual(result, []);
});

test("only Planning keys returns single-element array with label Planning", () => {
  const result = groupNodesBySection({ prd: stepNode, design: stepNode });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].label, "Planning");
  assert.strictEqual(result[0].entries.length, 2);
});

test("unknown node IDs are silently excluded from all groups", () => {
  const result = groupNodesBySection({ unknown_step: stepNode, another_unknown: gateNode });
  assert.deepStrictEqual(result, []);
});

test("section order is Planning → Gates → Execution → Completion regardless of insertion order", () => {
  const result = groupNodesBySection({
    final_approval_gate: gateNode,
    prd: stepNode,
    phase_loop: forEachPhaseNode,
    plan_approval_gate: gateNode,
  });
  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[0].label, "Planning");
  assert.strictEqual(result[1].label, "Gates");
  assert.strictEqual(result[2].label, "Execution");
  assert.strictEqual(result[3].label, "Completion");
});

console.log("\nderiveCurrentPhase tests\n");

test("undefined phaseLoopNode returns null", () => {
  const result = deriveCurrentPhase(undefined);
  assert.strictEqual(result, null);
});

test("phase loop with no iterations returns null", () => {
  const result = deriveCurrentPhase({ ...forEachPhaseNode, iterations: [] });
  assert.strictEqual(result, null);
});

test("phase loop with all completed iterations returns null", () => {
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "completed",
    iterations: [
      { index: 0, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "completed", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.strictEqual(result, null);
});

test("phase loop with in_progress iteration and doc_path returns parsed phase name", () => {
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      {
        index: 0,
        status: "in_progress",
        nodes: {
          phase_planning: { kind: "step", status: "in_progress", doc_path: "phases/MY-PROJECT-PHASE-01-CORE-SETUP.md", retries: 0 },
        },
        corrective_tasks: [],
      },
    ],
  });
  assert.strictEqual(result, "Phase 1 \u2014 Core Setup");
});

test("phase loop with in_progress iteration and null doc_path returns fallback Phase N", () => {
  const result = deriveCurrentPhase({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      {
        index: 1,
        status: "in_progress",
        nodes: {
          phase_planning: { kind: "step", status: "in_progress", doc_path: null, retries: 0 },
        },
        corrective_tasks: [],
      },
    ],
  });
  assert.strictEqual(result, "Phase 2");
});

console.log("\nderivePhaseProgress tests\n");

test("undefined phaseLoopNode returns null", () => {
  const result = derivePhaseProgress(undefined);
  assert.strictEqual(result, null);
});

test("phase loop with no iterations returns null", () => {
  const result = derivePhaseProgress({ ...forEachPhaseNode, iterations: [] });
  assert.strictEqual(result, null);
});

test("3 iterations (2 completed, 1 in_progress) returns {completed:2, total:3}", () => {
  const result = derivePhaseProgress({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      { index: 0, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 2, status: "in_progress", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.deepStrictEqual(result, { completed: 2, total: 3 });
});

test("all iterations completed returns {completed:N, total:N}", () => {
  const result = derivePhaseProgress({
    ...forEachPhaseNode,
    status: "completed",
    iterations: [
      { index: 0, status: "completed", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "completed", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.deepStrictEqual(result, { completed: 2, total: 2 });
});

test("no completed iterations returns {completed:0, total:N}", () => {
  const result = derivePhaseProgress({
    ...forEachPhaseNode,
    status: "in_progress",
    iterations: [
      { index: 0, status: "in_progress", nodes: {}, corrective_tasks: [] },
      { index: 1, status: "not_started", nodes: {}, corrective_tasks: [] },
    ],
  });
  assert.deepStrictEqual(result, { completed: 0, total: 2 });
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
