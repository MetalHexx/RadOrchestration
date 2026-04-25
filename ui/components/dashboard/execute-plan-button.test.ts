/**
 * Tests for ExecutePlanButton — exercises the pure-logic helpers exported
 * from execute-plan-button.tsx. Mirrors the .test.ts conventions used by
 * dag-node-row.test.ts (no DOM/JSX rendering).
 */
import assert from 'node:assert/strict';
import {
  computeExecutePlanLabel,
  computeExecutePlanDisabled,
} from './execute-plan-button';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`); failed++;
  }
}

console.log('\nExecutePlanButton tests\n');

test("idle state: label is 'Execute Plan' (DD-2, DD-3)", () => {
  assert.strictEqual(computeExecutePlanLabel(false), 'Execute Plan');
});

test("pending state: label is 'Launching…' (DD-4)", () => {
  assert.strictEqual(computeExecutePlanLabel(true), 'Launching…');
});

test("idle: disabled === false (FR-8)", () => {
  assert.strictEqual(computeExecutePlanDisabled(false), false);
});

test("pending: disabled === true (FR-8, DD-4)", () => {
  assert.strictEqual(computeExecutePlanDisabled(true), true);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
