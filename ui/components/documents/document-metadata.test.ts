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
import { stringifyFrontmatterItem } from "./document-metadata";

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

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
