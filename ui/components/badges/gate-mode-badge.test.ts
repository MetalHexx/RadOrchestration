/**
 * Tests for GateModeBadge component logic.
 * Run with: npx tsx ui/components/badges/gate-mode-badge.test.ts
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

// ─── Types (mirrored from @/types/state) ─────────────────────────────────────

type GateMode = "task" | "phase" | "autonomous";

// ─── Simulation (mirrors gate-mode-badge.tsx logic) ──────────────────────────

const MODE_CONFIG: Record<string, { label: string; cssVar: string }> = {
  task:       { label: "Task gate",      cssVar: "--gate-task" },
  phase:      { label: "Phase gate",     cssVar: "--gate-phase" },
  autonomous: { label: "Autonomous",     cssVar: "--gate-autonomous" },
  global:     { label: "Global default", cssVar: "--gate-global" },
};

function resolveConfig(mode: GateMode | null) {
  const key = mode ?? "global";
  return MODE_CONFIG[key];
}

function getLabel(mode: GateMode | null): string {
  return resolveConfig(mode).label;
}

function getCssVar(mode: GateMode | null): string {
  return resolveConfig(mode).cssVar;
}

function getAriaLabel(mode: GateMode | null): string {
  return `Gate mode: ${getLabel(mode)}`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nGateModeBadge logic tests\n");

test('renders label "Task gate" when mode="task"', () => {
  assert.strictEqual(getLabel("task"), "Task gate");
});

test('renders label "Phase gate" when mode="phase"', () => {
  assert.strictEqual(getLabel("phase"), "Phase gate");
});

test('renders label "Autonomous" when mode="autonomous"', () => {
  assert.strictEqual(getLabel("autonomous"), "Autonomous");
});

test('renders label "Global default" when mode=null', () => {
  assert.strictEqual(getLabel(null), "Global default");
});

test('has aria-label "Gate mode: Task gate" when mode="task"', () => {
  assert.strictEqual(getAriaLabel("task"), "Gate mode: Task gate");
});

test('has aria-label "Gate mode: Phase gate" when mode="phase"', () => {
  assert.strictEqual(getAriaLabel("phase"), "Gate mode: Phase gate");
});

test('has aria-label "Gate mode: Autonomous" when mode="autonomous"', () => {
  assert.strictEqual(getAriaLabel("autonomous"), "Gate mode: Autonomous");
});

test('has aria-label "Gate mode: Global default" when mode=null', () => {
  assert.strictEqual(getAriaLabel(null), "Gate mode: Global default");
});

test("task mode maps to --gate-task CSS variable", () => {
  assert.strictEqual(getCssVar("task"), "--gate-task");
});

test("phase mode maps to --gate-phase CSS variable", () => {
  assert.strictEqual(getCssVar("phase"), "--gate-phase");
});

test("autonomous mode maps to --gate-autonomous CSS variable", () => {
  assert.strictEqual(getCssVar("autonomous"), "--gate-autonomous");
});

test("null mode maps to --gate-global CSS variable", () => {
  assert.strictEqual(getCssVar(null), "--gate-global");
});

import { readFileSync as readFileSyncGM } from 'node:fs';
import { join as joinGM, dirname as dirnameGM } from 'node:path';
import { fileURLToPath as fileURLToPathGM } from 'node:url';
const __dirname_gm = dirnameGM(fileURLToPathGM(import.meta.url));
const GM_SOURCE = readFileSyncGM(joinGM(__dirname_gm, 'gate-mode-badge.tsx'), 'utf8');

console.log("\nFR-5 / DD-5 GateModeBadge dotless rendering");

test("DD-5 GateModeBadge source no longer renders a rounded-full inline dot", () => {
  assert.ok(!/rounded-full/.test(GM_SOURCE),
    "gate-mode-badge.tsx must no longer render a rounded-full dot span");
});

test("DD-5 GateModeBadge keeps Badge wrapper, color-mix fill, aria-label", () => {
  // Pill identity is carried by the colored fill; aria-label still names the gate mode.
  assert.ok(/<Badge/.test(GM_SOURCE), "Badge wrapper preserved");
  assert.ok(/color-mix\(in srgb, var\(\$\{config\.cssVar\}\) 15%, transparent\)/.test(GM_SOURCE),
    "15%-tint fill preserved (DD-5: same fill as SpinnerBadge family)");
  assert.ok(/aria-label=\{`Gate mode: \$\{config\.label\}`\}/.test(GM_SOURCE),
    "aria-label preserved (NFR-3 — label still announced)");
});

test("DD-5 GateModeBadge body contains no <span> with inline-block sizing utilities", () => {
  // The dot was the sole inline-block sizing span. After removal the body
  // should render only `{config.label}` text inside the Badge.
  assert.ok(!/inline-block\s+h-1\.5\s+w-1\.5/.test(GM_SOURCE),
    "no inline-block h-1.5 w-1.5 dot span should remain");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
