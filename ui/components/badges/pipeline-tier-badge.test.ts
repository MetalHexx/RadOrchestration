/**
 * Tests for PipelineTierBadge component logic.
 * Run with: npx tsx ui/components/badges/pipeline-tier-badge.test.ts
 *
 * Tests the 8-state decision table that maps tier × sub-status to
 * label, ariaLabel, and isSpinning values.
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

type PipelineTier = "planning" | "execution" | "review" | "complete" | "halted";
type PlanningStatus = "not_started" | "in_progress" | "complete";
type ExecutionStatus = "not_started" | "in_progress" | "complete" | "halted";

// ─── Simulation (mirrors pipeline-tier-badge.tsx logic) ──────────────────────

const TIER_CONFIG = {
  planning: { label: "Planning", cssVar: "--tier-planning" },
  // label is never used directly for execution — resolveBadgeState() sets it explicitly per sub-status
  execution: { label: "Approved", cssVar: "--tier-execution" },
  review: { label: "Final Review", cssVar: "--tier-review" },
  complete: { label: "Complete", cssVar: "--tier-complete" },
  halted: { label: "Halted", cssVar: "--tier-halted" },
  not_initialized: { label: "Not Started", cssVar: "--tier-not-initialized" },
} satisfies Record<PipelineTier | "not_initialized", { label: string; cssVar: string }>;

function resolveBadgeState(
  tier: PipelineTier | "not_initialized",
  planningStatus: PlanningStatus | undefined,
  executionStatus: ExecutionStatus | undefined,
): { label: string; ariaLabel: string; isSpinning: boolean; cssVar: string } {
  const base = TIER_CONFIG[tier];
  let cssVar = base.cssVar;

  let label: string;
  let isSpinning: boolean;

  if (tier === "planning") {
    if (planningStatus === "in_progress") {
      label = "Planning";
      isSpinning = true;
    } else if (planningStatus === "complete") {
      label = "Planned";
      isSpinning = false;
    } else {
      label = "Planning";
      isSpinning = false;
    }
  } else if (tier === "execution") {
    if (executionStatus === "halted") {
      label = "Halted";
      cssVar = "--tier-halted";
      isSpinning = false;
    } else if (executionStatus === "in_progress") {
      label = "Executing";
      isSpinning = true;
    } else {
      // not_started, complete, or undefined → queued/approved state
      label = "Approved";
      isSpinning = false;
    }
  } else {
    label = base.label;
    isSpinning = false;
  }

  const ariaLabel = isSpinning
    ? `Pipeline status: ${label}, active`
    : `Pipeline status: ${label}`;

  return { label, ariaLabel, isSpinning, cssVar };
}

// ─── Decision Table Tests ─────────────────────────────────────────────────────

console.log("\nPipelineTierBadge — 8-state decision table\n");

// Row 1: not_initialized
console.log("Row 1: not_initialized");

test('not_initialized → label "Not Started"', () => {
  const result = resolveBadgeState("not_initialized", undefined, undefined);
  assert.strictEqual(result.label, "Not Started");
});

test("not_initialized → no spinner", () => {
  const result = resolveBadgeState("not_initialized", undefined, undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('not_initialized → ariaLabel "Pipeline status: Not Started"', () => {
  const result = resolveBadgeState("not_initialized", undefined, undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Not Started");
});

test("not_initialized → cssVar --tier-not-initialized", () => {
  const result = resolveBadgeState("not_initialized", undefined, undefined);
  assert.strictEqual(result.cssVar, "--tier-not-initialized");
});

// Row 2: planning + in_progress → spinner
console.log("\nRow 2: planning + planningStatus=in_progress (spinner)");

test('planning + in_progress → label "Planning"', () => {
  const result = resolveBadgeState("planning", "in_progress", undefined);
  assert.strictEqual(result.label, "Planning");
});

test("planning + in_progress → spinner active", () => {
  const result = resolveBadgeState("planning", "in_progress", undefined);
  assert.strictEqual(result.isSpinning, true);
});

test('planning + in_progress → ariaLabel "Pipeline status: Planning, active"', () => {
  const result = resolveBadgeState("planning", "in_progress", undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Planning, active");
});

// Row 3: planning + complete → "Planned"
console.log('\nRow 3: planning + planningStatus=complete → "Planned"');

test('planning + complete → label "Planned"', () => {
  const result = resolveBadgeState("planning", "complete", undefined);
  assert.strictEqual(result.label, "Planned");
});

test("planning + complete → no spinner", () => {
  const result = resolveBadgeState("planning", "complete", undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('planning + complete → ariaLabel "Pipeline status: Planned"', () => {
  const result = resolveBadgeState("planning", "complete", undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Planned");
});

// Row 4: planning + absent planningStatus → fallback "Planning"
console.log("\nRow 4: planning + no planningStatus (backward compat fallback)");

test('planning + undefined planningStatus → label "Planning"', () => {
  const result = resolveBadgeState("planning", undefined, undefined);
  assert.strictEqual(result.label, "Planning");
});

test("planning + undefined planningStatus → no spinner", () => {
  const result = resolveBadgeState("planning", undefined, undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('planning + undefined planningStatus → ariaLabel "Pipeline status: Planning"', () => {
  const result = resolveBadgeState("planning", undefined, undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Planning");
});

test('planning + not_started planningStatus → label "Planning" (other fallback)', () => {
  const result = resolveBadgeState("planning", "not_started", undefined);
  assert.strictEqual(result.label, "Planning");
  assert.strictEqual(result.isSpinning, false);
});

// Row 5: execution + in_progress → "Executing" spinner
console.log('\nRow 5: execution + executionStatus=in_progress → "Executing" (spinner)');

test('execution + in_progress → label "Executing"', () => {
  const result = resolveBadgeState("execution", undefined, "in_progress");
  assert.strictEqual(result.label, "Executing");
});

test("execution + in_progress → spinner active", () => {
  const result = resolveBadgeState("execution", undefined, "in_progress");
  assert.strictEqual(result.isSpinning, true);
});

test('execution + in_progress → ariaLabel "Pipeline status: Executing, active"', () => {
  const result = resolveBadgeState("execution", undefined, "in_progress");
  assert.strictEqual(result.ariaLabel, "Pipeline status: Executing, active");
});

// Row 6: execution + absent/other executionStatus → "Approved"
console.log("\nRow 6: execution + no/other executionStatus (backward compat fallback)");

test('execution + undefined executionStatus → label "Approved"', () => {
  const result = resolveBadgeState("execution", undefined, undefined);
  assert.strictEqual(result.label, "Approved");
});

test("execution + undefined executionStatus → no spinner", () => {
  const result = resolveBadgeState("execution", undefined, undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('execution + undefined executionStatus → ariaLabel "Pipeline status: Approved"', () => {
  const result = resolveBadgeState("execution", undefined, undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Approved");
});

test('execution + complete executionStatus → label "Approved" (other fallback)', () => {
  const result = resolveBadgeState("execution", undefined, "complete");
  assert.strictEqual(result.label, "Approved");
  assert.strictEqual(result.isSpinning, false);
});

// Row 6a: execution + not_started → "Approved"
console.log('\nRow 6a: execution + executionStatus=not_started → "Approved"');

test('execution + not_started → label "Approved"', () => {
  const result = resolveBadgeState("execution", undefined, "not_started");
  assert.strictEqual(result.label, "Approved");
  assert.strictEqual(result.isSpinning, false);
  assert.strictEqual(result.cssVar, "--tier-execution");
});
test('execution + not_started → ariaLabel "Pipeline status: Approved"', () => {
  const result = resolveBadgeState("execution", undefined, "not_started");
  assert.strictEqual(result.ariaLabel, "Pipeline status: Approved");
});

// Row 6b: execution + halted → "Halted" with --tier-halted
console.log('\nRow 6b: execution + executionStatus=halted → "Halted"');

test('execution + halted → label "Halted"', () => {
  const result = resolveBadgeState("execution", undefined, "halted");
  assert.strictEqual(result.label, "Halted");
  assert.strictEqual(result.isSpinning, false);
});
test('execution + halted → cssVar "--tier-halted"', () => {
  const result = resolveBadgeState("execution", undefined, "halted");
  assert.strictEqual(result.cssVar, "--tier-halted");
});
test('execution + halted → ariaLabel "Pipeline status: Halted"', () => {
  const result = resolveBadgeState("execution", undefined, "halted");
  assert.strictEqual(result.ariaLabel, "Pipeline status: Halted");
});

// Row 7: review
console.log("\nRow 7: review");

test('review → label "Final Review"', () => {
  const result = resolveBadgeState("review", undefined, undefined);
  assert.strictEqual(result.label, "Final Review");
});

test("review → no spinner", () => {
  const result = resolveBadgeState("review", undefined, undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('review → ariaLabel "Pipeline status: Final Review"', () => {
  const result = resolveBadgeState("review", undefined, undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Final Review");
});

// Row 8: complete
console.log("\nRow 8: complete");

test('complete → label "Complete"', () => {
  const result = resolveBadgeState("complete", undefined, undefined);
  assert.strictEqual(result.label, "Complete");
});

test("complete → no spinner", () => {
  const result = resolveBadgeState("complete", undefined, undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('complete → ariaLabel "Pipeline status: Complete"', () => {
  const result = resolveBadgeState("complete", undefined, undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Complete");
});

// Row 9: halted
console.log("\nRow 9: halted");

test('halted → label "Halted"', () => {
  const result = resolveBadgeState("halted", undefined, undefined);
  assert.strictEqual(result.label, "Halted");
});

test("halted → no spinner", () => {
  const result = resolveBadgeState("halted", undefined, undefined);
  assert.strictEqual(result.isSpinning, false);
});

test('halted → ariaLabel "Pipeline status: Halted"', () => {
  const result = resolveBadgeState("halted", undefined, undefined);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Halted");
});

// ─── Backward Compatibility ───────────────────────────────────────────────────

console.log("\nBackward compatibility (callers passing only tier)");

test('planning tier only → same as before: "Planning", no spinner', () => {
  const result = resolveBadgeState("planning", undefined, undefined);
  assert.strictEqual(result.label, "Planning");
  assert.strictEqual(result.isSpinning, false);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Planning");
});

test('execution tier only → same as before: "Approved", no spinner', () => {
  const result = resolveBadgeState("execution", undefined, undefined);
  assert.strictEqual(result.label, "Approved");
  assert.strictEqual(result.isSpinning, false);
  assert.strictEqual(result.ariaLabel, "Pipeline status: Approved");
});

// ─── aria-label format: must use "Pipeline status:" not "Pipeline tier:" ──────

console.log("\naria-label format");

test('all tiers use "Pipeline status:" format (not "Pipeline tier:")', () => {
  const tiers: Array<PipelineTier | "not_initialized"> = [
    "planning", "execution", "review", "complete", "halted", "not_initialized",
  ];
  for (const tier of tiers) {
    const result = resolveBadgeState(tier, undefined, undefined);
    assert.ok(
      result.ariaLabel.startsWith("Pipeline status:"),
      `Expected ariaLabel to start with "Pipeline status:" but got: "${result.ariaLabel}" for tier="${tier}"`,
    );
    assert.ok(
      !result.ariaLabel.startsWith("Pipeline tier:"),
      `ariaLabel must not use old "Pipeline tier:" format for tier="${tier}"`,
    );
  }
});

test('only spinner states include ", active" suffix', () => {
  // Spinner states
  const spinning1 = resolveBadgeState("planning", "in_progress", undefined);
  const spinning2 = resolveBadgeState("execution", undefined, "in_progress");
  assert.ok(spinning1.ariaLabel.endsWith(", active"), "planning+in_progress should end with ', active'");
  assert.ok(spinning2.ariaLabel.endsWith(", active"), "execution+in_progress should end with ', active'");

  // Non-spinner states must NOT include ", active"
  const nonSpinners: Array<Parameters<typeof resolveBadgeState>> = [
    ["not_initialized", undefined, undefined],
    ["planning", "complete", undefined],
    ["planning", undefined, undefined],
    ["execution", undefined, undefined],
    ["review", undefined, undefined],
    ["complete", undefined, undefined],
    ["halted", undefined, undefined],
  ];
  for (const args of nonSpinners) {
    const result = resolveBadgeState(...args);
    assert.ok(
      !result.ariaLabel.includes(", active"),
      `Non-spinner state should not include ", active": tier="${args[0]}", got ariaLabel="${result.ariaLabel}"`,
    );
  }
});

// ─── CSS variable mapping ─────────────────────────────────────────────────────

console.log("\nCSS variable mapping");

test("planning tier → --tier-planning CSS variable", () => {
  const result = resolveBadgeState("planning", "in_progress", undefined);
  assert.strictEqual(result.cssVar, "--tier-planning");
});

test("execution tier → --tier-execution CSS variable", () => {
  const result = resolveBadgeState("execution", undefined, "in_progress");
  assert.strictEqual(result.cssVar, "--tier-execution");
});

test("review tier → --tier-review CSS variable", () => {
  assert.strictEqual(resolveBadgeState("review", undefined, undefined).cssVar, "--tier-review");
});

test("complete tier → --tier-complete CSS variable", () => {
  assert.strictEqual(resolveBadgeState("complete", undefined, undefined).cssVar, "--tier-complete");
});

test("halted tier → --tier-halted CSS variable", () => {
  assert.strictEqual(resolveBadgeState("halted", undefined, undefined).cssVar, "--tier-halted");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("");
if (failed === 0) {
  console.log(`All ${passed} tests passed.`);
} else {
  console.log(`${passed} passed, ${failed} failed.`);
  process.exit(1);
}
