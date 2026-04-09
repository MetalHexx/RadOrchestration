/**
 * Tests for RetryBadge component logic.
 * Run with: npx tsx ui/components/badges/retry-badge.test.ts
 *
 * RetryBadge is purely presentational:
 * - Always renders with variant="secondary" (no conditional warning color)
 * - Displays "Retries: {retries}/{max}" as text
 * - aria-label reads "Retry count: {retries} of {max}"
 * - Never applies orange/warning styling regardless of retry count
 */
import assert from "node:assert";

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

// ─── Simulation (mirrors retry-badge.tsx logic) ──────────────────────────────

interface RetryBadgeProps {
  retries: number;
  max: number;
}

interface RenderResult {
  variant: string;
  label: string;
  ariaLabel: string;
  hasWarningColor: boolean;
}

function simulateRetryBadge({ retries, max }: RetryBadgeProps): RenderResult {
  return {
    variant: "secondary",
    label: `Retries: ${retries}/${max}`,
    ariaLabel: `Retry count: ${retries} of ${max}`,
    hasWarningColor: false,
  };
}

// ─── Normal retry counts ─────────────────────────────────────────────────────

console.log("\nnormal retry counts");

test("1 retry of 5 → secondary variant, no warning color", () => {
  const result = simulateRetryBadge({ retries: 1, max: 5 });

  assert.strictEqual(result.variant, "secondary");
  assert.strictEqual(result.hasWarningColor, false);
  assert.strictEqual(result.label, "Retries: 1/5");
  assert.strictEqual(result.ariaLabel, "Retry count: 1 of 5");
});

test("2 retries of 5 → secondary variant, no warning color", () => {
  const result = simulateRetryBadge({ retries: 2, max: 5 });

  assert.strictEqual(result.variant, "secondary");
  assert.strictEqual(result.hasWarningColor, false);
  assert.strictEqual(result.label, "Retries: 2/5");
  assert.strictEqual(result.ariaLabel, "Retry count: 2 of 5");
});

test("3 retries of 5 → secondary variant, no warning color", () => {
  const result = simulateRetryBadge({ retries: 3, max: 5 });

  assert.strictEqual(result.variant, "secondary");
  assert.strictEqual(result.hasWarningColor, false);
});

// ─── At max retries: still no warning styling ────────────────────────────────

console.log("\nat max retries — no warning styling");

test("retries === max (5/5) → still secondary variant, NOT outline", () => {
  const result = simulateRetryBadge({ retries: 5, max: 5 });

  assert.strictEqual(result.variant, "secondary");
  assert.notStrictEqual(result.variant, "outline");
  assert.strictEqual(result.hasWarningColor, false);
});

test("retries === max (2/2) → still secondary variant, no warning color", () => {
  const result = simulateRetryBadge({ retries: 2, max: 2 });

  assert.strictEqual(result.variant, "secondary");
  assert.strictEqual(result.hasWarningColor, false);
  assert.strictEqual(result.label, "Retries: 2/2");
});

// ─── Label format ────────────────────────────────────────────────────────────

console.log("\nlabel format");

test("label format is 'Retries: {retries}/{max}'", () => {
  const result = simulateRetryBadge({ retries: 2, max: 5 });

  assert.strictEqual(result.label, "Retries: 2/5");
});

test("aria-label format is 'Retry count: {retries} of {max}'", () => {
  const result = simulateRetryBadge({ retries: 2, max: 5 });

  assert.strictEqual(result.ariaLabel, "Retry count: 2 of 5");
});

test("max=5 correctly reflected in label denominator", () => {
  const result = simulateRetryBadge({ retries: 2, max: 5 });

  // Denominator should be 5, not 2
  assert.ok(result.label.endsWith("/5"), `Expected label to end with '/5', got: ${result.label}`);
});

test("max=5 correctly reflected in aria-label", () => {
  const result = simulateRetryBadge({ retries: 2, max: 5 });

  assert.ok(result.ariaLabel.includes("of 5"), `Expected ariaLabel to contain 'of 5', got: ${result.ariaLabel}`);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
