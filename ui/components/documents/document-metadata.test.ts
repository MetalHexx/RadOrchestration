/**
 * Tests for DocumentMetadata formatting helpers.
 * Run with: npx tsx ui/components/documents/document-metadata.test.ts
 *
 * Covers stringifyFrontmatterItem, which renders array/object frontmatter
 * values as readable strings (regression: naive String(value) produced
 * "[object Object],[object Object]" for phase plan frontmatter like
 * tasks: [{ id, title }, ...]).
 */
import assert from "node:assert";
import { stringifyFrontmatterItem, formatValue } from "./document-metadata";

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

console.log("\nDocumentMetadata frontmatter formatting tests\n");

test("stringifyFrontmatterItem primitive string returns the string", () => {
  assert.strictEqual(stringifyFrontmatterItem("FR-1"), "FR-1");
});

test("stringifyFrontmatterItem primitive number returns the stringified number", () => {
  assert.strictEqual(stringifyFrontmatterItem(42), "42");
});

test("stringifyFrontmatterItem primitive boolean returns the stringified boolean", () => {
  assert.strictEqual(stringifyFrontmatterItem(true), "true");
});

test("stringifyFrontmatterItem null returns empty string", () => {
  assert.strictEqual(stringifyFrontmatterItem(null), "");
});

test("stringifyFrontmatterItem undefined returns empty string", () => {
  assert.strictEqual(stringifyFrontmatterItem(undefined), "");
});

test("stringifyFrontmatterItem flat object renders as key: value pairs", () => {
  // Regression: naive String({id:'T01', title:'X'}) was '[object Object]'.
  const result = stringifyFrontmatterItem({ id: "T01", title: "Scaffold" });
  assert.strictEqual(result, "id: T01, title: Scaffold");
});

test("stringifyFrontmatterItem object with nested object stringifies the nested as JSON", () => {
  const result = stringifyFrontmatterItem({ id: "T01", nested: { a: 1 } });
  assert.ok(result.includes("id: T01"), `result should mention id: T01, got: ${result}`);
  assert.ok(result.includes('nested: {"a":1}'), `result should render nested as JSON, got: ${result}`);
});

test("stringifyFrontmatterItem object skips null/undefined values", () => {
  const result = stringifyFrontmatterItem({ id: "T01", title: "X", note: null, extra: undefined });
  assert.strictEqual(result, "id: T01, title: X");
});

test("stringifyFrontmatterItem empty object returns empty string", () => {
  assert.strictEqual(stringifyFrontmatterItem({}), "");
});

// ─── formatValue — Array / Object branches (regression: Iter 5 phase plans) ──

test("formatValue with array of objects returns { items: [...] } (regression: tasks frontmatter)", () => {
  // Regression: phase-plan frontmatter `tasks: [{id, title}, ...]` was rendered
  // as `[object Object],[object Object]` because formatValue used String() directly.
  const result = formatValue("tasks", [
    { id: "T01", title: "Scaffold" },
    { id: "T02", title: "Wire up" },
  ]);
  assert.deepStrictEqual(result.items, [
    "id: T01, title: Scaffold",
    "id: T02, title: Wire up",
  ]);
  assert.strictEqual(result.text, undefined);
});

test("formatValue with array of primitives returns { items: [...] }", () => {
  const result = formatValue("requirement_tags", ["FR-1", "FR-2"]);
  assert.deepStrictEqual(result.items, ["FR-1", "FR-2"]);
});

test("formatValue with empty array returns { items: [] }", () => {
  const result = formatValue("tasks", []);
  assert.deepStrictEqual(result.items, []);
});

test("formatValue with plain object returns { text } (key: value pairs)", () => {
  const result = formatValue("meta", { a: 1, b: "x" });
  assert.strictEqual(result.text, "a: 1, b: x");
  assert.strictEqual(result.items, undefined);
});

test("formatValue with primitive string returns { text }", () => {
  const result = formatValue("project", "ITER5-E2E-SMOKE");
  assert.strictEqual(result.text, "ITER5-E2E-SMOKE");
  assert.strictEqual(result.items, undefined);
});

test("formatValue status value carries className for color", () => {
  const result = formatValue("status", "failed");
  assert.strictEqual(result.text, "failed");
  assert.ok(result.className?.includes("red"), `expected red className, got ${result.className}`);
});

test("formatValue date key formats a valid ISO date", () => {
  const result = formatValue("created", "2026-04-19T00:00:00.000Z");
  assert.ok(result.text && result.text !== "2026-04-19T00:00:00.000Z", "date should be formatted");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
