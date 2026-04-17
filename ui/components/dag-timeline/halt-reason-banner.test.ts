/**
 * Tests for HaltReasonBanner component logic.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/components/dag-timeline/halt-reason-banner.test.ts
 */
import assert from "node:assert";
import { shouldRenderHaltReason } from './halt-reason-banner';
import type { GraphStatus } from '@/types/state';

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

console.log("\nHaltReasonBanner visibility logic tests\n");

test("shouldRenderHaltReason('halted', 'Gate rejected by reviewer.') returns true", () => {
  assert.strictEqual(shouldRenderHaltReason('halted', 'Gate rejected by reviewer.'), true);
});

test("shouldRenderHaltReason('halted', null) returns false (halted-without-reason renders nothing)", () => {
  assert.strictEqual(shouldRenderHaltReason('halted', null), false);
});

test("shouldRenderHaltReason('halted', '') returns false (empty string treated as no reason)", () => {
  assert.strictEqual(shouldRenderHaltReason('halted', ''), false);
});

test("shouldRenderHaltReason('halted', '   ') returns false (whitespace-only string treated as no reason)", () => {
  assert.strictEqual(shouldRenderHaltReason('halted', '   '), false);
});

test("shouldRenderHaltReason('in_progress', 'Some old reason') returns false (hidden when not halted)", () => {
  assert.strictEqual(shouldRenderHaltReason('in_progress', 'Some old reason'), false);
});

test("shouldRenderHaltReason('not_started', 'x') returns false", () => {
  assert.strictEqual(shouldRenderHaltReason('not_started', 'x'), false);
});

test("shouldRenderHaltReason('completed', 'x') returns false", () => {
  assert.strictEqual(shouldRenderHaltReason('completed', 'x'), false);
});

test("shouldRenderHaltReason(undefined, 'x') returns false (graphStatus undefined before hydration)", () => {
  assert.strictEqual(shouldRenderHaltReason(undefined as unknown as GraphStatus | undefined, 'x'), false);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
