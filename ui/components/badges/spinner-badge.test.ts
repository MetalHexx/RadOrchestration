/**
 * Tests for SpinnerBadge component logic.
 * Run with: npx tsx ui/components/badges/spinner-badge.test.ts
 *
 * SpinnerBadge is purely presentational — 4-way icon slot:
 * - isSpinning=true                                      → renders Loader2 with animate-spin
 * - isSpinning=false, isComplete=true                     → renders Check icon (static checkmark)
 * - isSpinning=false, isComplete=false, isRejected=true   → renders X icon (static cross)
 * - isSpinning=false, isComplete=false, isRejected=false  → renders 6×6px dot span
 * - ariaLabel defaults to label when omitted
 * - ariaLabel overrides label when provided
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

// ─── Simulation (mirrors spinner-badge.tsx logic) ────────────────────────────

interface SpinnerBadgeProps {
  label: string;
  cssVar: string;
  isSpinning: boolean;
  isComplete?: boolean;
  isRejected?: boolean;
  ariaLabel?: string;
  hideLabel?: boolean;
}

interface RenderResult {
  ariaLabel: string;
  showsSpinner: boolean;
  showsCheckmark: boolean;
  showsX: boolean;
  showsDot: boolean;
  label: string;
  backgroundColor: string;
  color: string;
  iconColor: string | null;
  dotBackgroundColor: string | null;
  showsLabel: boolean;
}

function simulateSpinnerBadge(props: SpinnerBadgeProps): RenderResult {
  const resolvedAriaLabel = props.ariaLabel ?? props.label;
  const backgroundColor = `color-mix(in srgb, var(${props.cssVar}) 15%, transparent)`;
  const color = `var(${props.cssVar})`;
  const showsCheckmark = !props.isSpinning && (props.isComplete === true);
  const showsX = !props.isSpinning && !showsCheckmark && (props.isRejected === true);

  return {
    ariaLabel: resolvedAriaLabel,
    showsSpinner: props.isSpinning,
    showsCheckmark,
    showsX,
    showsDot: !props.isSpinning && !showsCheckmark && !showsX,
    label: props.label,
    backgroundColor,
    color,
    iconColor: (props.isSpinning || showsCheckmark || showsX) ? `var(${props.cssVar})` : null,
    dotBackgroundColor: (!props.isSpinning && !showsCheckmark && !showsX) ? `var(${props.cssVar})` : null,
    showsLabel: !props.hideLabel,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\nisSpinning=true (spinner)");

test("isSpinning=true renders spinner, not dot", () => {
  const result = simulateSpinnerBadge({
    label: "Planning",
    cssVar: "--tier-planning",
    isSpinning: true,
  });
  assert.strictEqual(result.showsSpinner, true);
  assert.strictEqual(result.showsDot, false);
});

test("isSpinning=true sets spinner icon color to var(cssVar)", () => {
  const result = simulateSpinnerBadge({
    label: "Planning",
    cssVar: "--tier-planning",
    isSpinning: true,
  });
  assert.strictEqual(result.iconColor, "var(--tier-planning)");
  assert.strictEqual(result.dotBackgroundColor, null);
});

test("isSpinning=true still renders the label text", () => {
  const result = simulateSpinnerBadge({
    label: "Executing",
    cssVar: "--tier-execution",
    isSpinning: true,
  });
  assert.strictEqual(result.label, "Executing");
});

console.log("\nisSpinning=false (dot)");

test("isSpinning=false renders dot, not spinner", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--tier-complete",
    isSpinning: false,
  });
  assert.strictEqual(result.showsDot, true);
  assert.strictEqual(result.showsSpinner, false);
});

test("isSpinning=false sets dot background color to var(cssVar)", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--tier-complete",
    isSpinning: false,
  });
  assert.strictEqual(result.dotBackgroundColor, "var(--tier-complete)");
  assert.strictEqual(result.iconColor, null);
});

test("isSpinning=false still renders the label text", () => {
  const result = simulateSpinnerBadge({
    label: "Not Started",
    cssVar: "--status-not-started",
    isSpinning: false,
  });
  assert.strictEqual(result.label, "Not Started");
});

console.log("\nariaLabel default behavior");

test("ariaLabel defaults to label when ariaLabel prop is omitted", () => {
  const result = simulateSpinnerBadge({
    label: "Planning",
    cssVar: "--tier-planning",
    isSpinning: true,
  });
  assert.strictEqual(result.ariaLabel, "Planning");
});

test("ariaLabel defaults to label for non-spinning badge", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--tier-complete",
    isSpinning: false,
  });
  assert.strictEqual(result.ariaLabel, "Complete");
});

console.log("\nariaLabel override behavior");

test("ariaLabel uses provided value when ariaLabel prop is set", () => {
  const result = simulateSpinnerBadge({
    label: "Planning",
    cssVar: "--tier-planning",
    isSpinning: true,
    ariaLabel: "Pipeline status: Planning, active",
  });
  assert.strictEqual(result.ariaLabel, "Pipeline status: Planning, active");
});

test("ariaLabel override works for non-spinning badge", () => {
  const result = simulateSpinnerBadge({
    label: "Not Started",
    cssVar: "--status-not-started",
    isSpinning: false,
    ariaLabel: "Stage: Not Started",
  });
  assert.strictEqual(result.ariaLabel, "Stage: Not Started");
});

console.log("\nbadge styling");

test("backgroundColor uses color-mix formula with cssVar", () => {
  const result = simulateSpinnerBadge({
    label: "Planning",
    cssVar: "--tier-planning",
    isSpinning: true,
  });
  assert.strictEqual(
    result.backgroundColor,
    "color-mix(in srgb, var(--tier-planning) 15%, transparent)"
  );
});

test("text color uses var(cssVar)", () => {
  const result = simulateSpinnerBadge({
    label: "Review",
    cssVar: "--tier-review",
    isSpinning: false,
  });
  assert.strictEqual(result.color, "var(--tier-review)");
});

console.log("\nisComplete=true (checkmark)");

test("isComplete=true, isSpinning=false → renders checkmark, not dot, not spinner", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
  });
  assert.strictEqual(result.showsCheckmark, true);
  assert.strictEqual(result.showsDot, false);
  assert.strictEqual(result.showsSpinner, false);
});

test("isComplete=true sets icon color to var(cssVar)", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
  });
  assert.strictEqual(result.iconColor, "var(--status-complete)");
  assert.strictEqual(result.dotBackgroundColor, null);
});

test("isComplete=true still renders the label text", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
  });
  assert.strictEqual(result.label, "Complete");
});

test("isComplete=true is ignored when isSpinning=true (spinner wins)", () => {
  const result = simulateSpinnerBadge({
    label: "In Progress",
    cssVar: "--status-in-progress",
    isSpinning: true,
    isComplete: true,
  });
  assert.strictEqual(result.showsSpinner, true);
  assert.strictEqual(result.showsCheckmark, false);
  assert.strictEqual(result.showsDot, false);
});

test("isComplete=false (explicit) falls through to dot", () => {
  const result = simulateSpinnerBadge({
    label: "Not Started",
    cssVar: "--status-not-started",
    isSpinning: false,
    isComplete: false,
  });
  assert.strictEqual(result.showsDot, true);
  assert.strictEqual(result.showsCheckmark, false);
});

test("isComplete omitted (undefined) falls through to dot", () => {
  const result = simulateSpinnerBadge({
    label: "Not Started",
    cssVar: "--status-not-started",
    isSpinning: false,
  });
  assert.strictEqual(result.showsDot, true);
  assert.strictEqual(result.showsCheckmark, false);
});

console.log("\nhideLabel prop behavior");

test("hideLabel=true suppresses visible label", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
    hideLabel: true,
  });
  assert.strictEqual(result.showsLabel, false);
});

test("hideLabel=true does not affect ariaLabel", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
    hideLabel: true,
  });
  assert.strictEqual(result.ariaLabel, "Complete");
});

test("hideLabel=false renders visible label (default behavior)", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
    hideLabel: false,
  });
  assert.strictEqual(result.showsLabel, true);
});

test("hideLabel omitted renders visible label (default behavior)", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
  });
  assert.strictEqual(result.showsLabel, true);
});

console.log("\nisRejected=true (X icon)");

test("isRejected=true, isSpinning=false, isComplete=false → renders X, not dot, not spinner, not checkmark", () => {
  const result = simulateSpinnerBadge({
    label: "Rejected",
    cssVar: "--status-rejected",
    isSpinning: false,
    isRejected: true,
  });
  assert.strictEqual(result.showsX, true);
  assert.strictEqual(result.showsDot, false);
  assert.strictEqual(result.showsSpinner, false);
  assert.strictEqual(result.showsCheckmark, false);
});

test("isRejected=true sets icon color to var(cssVar)", () => {
  const result = simulateSpinnerBadge({
    label: "Rejected",
    cssVar: "--status-rejected",
    isSpinning: false,
    isRejected: true,
  });
  assert.strictEqual(result.iconColor, "var(--status-rejected)");
  assert.strictEqual(result.dotBackgroundColor, null);
});

console.log("\nisRejected precedence (isSpinning → isComplete → isRejected → dot)");

test("isRejected=true is ignored when isSpinning=true (spinner wins)", () => {
  const result = simulateSpinnerBadge({
    label: "In Progress",
    cssVar: "--status-in-progress",
    isSpinning: true,
    isRejected: true,
  });
  assert.strictEqual(result.showsSpinner, true);
  assert.strictEqual(result.showsX, false);
  assert.strictEqual(result.showsCheckmark, false);
  assert.strictEqual(result.showsDot, false);
});

test("isRejected=true is ignored when isComplete=true (checkmark wins)", () => {
  const result = simulateSpinnerBadge({
    label: "Complete",
    cssVar: "--status-complete",
    isSpinning: false,
    isComplete: true,
    isRejected: true,
  });
  assert.strictEqual(result.showsCheckmark, true);
  assert.strictEqual(result.showsX, false);
  assert.strictEqual(result.showsDot, false);
  assert.strictEqual(result.showsSpinner, false);
});

test("isRejected=true + hideLabel=true → X icon shown, label hidden", () => {
  const result = simulateSpinnerBadge({
    label: "Rejected",
    cssVar: "--status-rejected",
    isSpinning: false,
    isRejected: true,
    hideLabel: true,
  });
  assert.strictEqual(result.showsX, true);
  assert.strictEqual(result.showsLabel, false);
  assert.strictEqual(result.ariaLabel, "Rejected");
});

test("isRejected=false (explicit) falls through to dot", () => {
  const result = simulateSpinnerBadge({
    label: "Not Started",
    cssVar: "--status-not-started",
    isSpinning: false,
    isRejected: false,
  });
  assert.strictEqual(result.showsDot, true);
  assert.strictEqual(result.showsX, false);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("");
if (failed === 0) {
  console.log(`All ${passed} tests passed.`);
} else {
  console.log(`${passed} passed, ${failed} failed.`);
  process.exit(1);
}
