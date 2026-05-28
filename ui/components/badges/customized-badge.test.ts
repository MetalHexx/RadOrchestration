import assert from "node:assert";
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__here, 'customized-badge.tsx'), 'utf8');
const CSS = readFileSync(join(__here, '..', '..', 'app', 'globals.css'), 'utf8');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${(e as Error).message}`); failed++; }
}

console.log("\nCustomizedBadge source assertions\n");

test("renders Badge variant=outline with label 'Customized'", () => {
  assert.ok(/variant="outline"/.test(SRC));
  assert.ok(/>Customized</.test(SRC) || /Customized/.test(SRC));
});

test("uses --badge-customized token via color-mix 15% tint", () => {
  assert.ok(/color-mix\(in srgb, var\(--badge-customized\) 15%, transparent\)/.test(SRC));
  assert.ok(/color:\s*["']var\(--badge-customized\)["']/.test(SRC) || /var\(--badge-customized\)/.test(SRC));
});

test("renders a transparent border (matches GateModeBadge convention)", () => {
  assert.ok(/border-transparent/.test(SRC) || /borderColor:\s*["']transparent["']/.test(SRC));
});

test("globals.css declares --badge-customized for :root (light theme)", () => {
  // 142, 71%, 33% is the light-theme green hue matching verdict-approved/connection-ok/gate-autonomous
  assert.ok(/--badge-customized:\s*hsl\(142,\s*71%,\s*33%\)/.test(CSS),
    '--badge-customized must be declared as hsl(142, 71%, 33%) under :root');
});

test("globals.css declares --badge-customized under .dark (dark theme)", () => {
  assert.ok(/--badge-customized:\s*hsl\(142,\s*71%,\s*45%\)/.test(CSS),
    '--badge-customized must be declared as hsl(142, 71%, 45%) under .dark');
});

test("takes no props (CustomizedBadge() signature is parameterless)", () => {
  // Component signature is `function CustomizedBadge()` or similar with no props.
  assert.ok(/export function CustomizedBadge\s*\(\s*\)/.test(SRC)
    || /CustomizedBadge\s*=\s*\(\s*\)\s*=>/.test(SRC));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
