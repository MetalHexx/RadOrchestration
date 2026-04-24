/**
 * Tests for SSEStatusBanner component logic.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/components/badges/sse-status-banner.test.ts
 */
import assert from "node:assert";
import { shouldRenderSSEStatus, SSEStatusBanner } from './sse-status-banner';

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

console.log("\nSSEStatusBanner visibility logic tests\n");

test("shouldRenderSSEStatus('connected') returns false", () => {
  assert.strictEqual(shouldRenderSSEStatus('connected'), false);
});

test("shouldRenderSSEStatus('reconnecting') returns true", () => {
  assert.strictEqual(shouldRenderSSEStatus('reconnecting'), true);
});

test("shouldRenderSSEStatus('disconnected') returns true", () => {
  assert.strictEqual(shouldRenderSSEStatus('disconnected'), true);
});

test("SSEStatusBanner returns null when status is 'connected'", () => {
  const result = SSEStatusBanner({ status: 'connected', onReconnect: () => {} });
  assert.strictEqual(result, null);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
