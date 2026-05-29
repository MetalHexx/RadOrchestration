import assert from "node:assert";
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__here, 'pending-changes-badge.tsx'), 'utf8');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${(e as Error).message}`); failed++; }
}

console.log("\nPendingChangesBadge source assertions\n");
test("renders Badge variant=outline with label 'Pending Changes'", () => {
  assert.ok(/variant="outline"/.test(SRC));
  assert.ok(/Pending Changes/.test(SRC));
});
test("uses --color-warning token via color-mix 15% tint", () => {
  assert.ok(/color-mix\(in srgb, var\(--color-warning\) 15%, transparent\)/.test(SRC));
  assert.ok(/var\(--color-warning\)/.test(SRC));
});
test("renders a transparent border", () => {
  assert.ok(/border-transparent/.test(SRC) || /borderColor:\s*["']transparent["']/.test(SRC));
});
test("includes a lucide icon (CircleDot or AlertCircle) with gap-1", () => {
  assert.ok(/CircleDot|AlertCircle/.test(SRC));
  assert.ok(/gap-1/.test(SRC));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
