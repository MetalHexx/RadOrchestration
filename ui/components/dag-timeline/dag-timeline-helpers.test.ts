/**
 * Tests for dag-timeline-helpers utility functions.
 * Run with: npx tsx ui/components/dag-timeline/dag-timeline-helpers.test.ts
 *
 * NOTE: Tests use the established .test.ts pattern (no DOM/JSX rendering).
 */
import assert from "node:assert";
import { getCommitLinkData, formatNodeId, getDisplayName } from './dag-timeline-helpers';
import { compoundNodeIds } from './__fixtures__';

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

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
