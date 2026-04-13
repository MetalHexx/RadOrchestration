import assert from "node:assert";
import { getCommitLinkData } from './dag-timeline-helpers';

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

test("empty string returns href and empty label", () => {
  const result = getCommitLinkData("");
  assert.deepStrictEqual(result, { href: "#", label: "" });
});

test("short hash (fewer than 7 chars) returns full hash as label", () => {
  const result = getCommitLinkData("abc");
  assert.deepStrictEqual(result, { href: "#abc", label: "abc" });
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
