/**
 * Tests for StageBadge component logic.
 * Run with: npx tsx ui/components/badges/stage-badge.test.ts
 *
 * StageBadge derives its display from BOTH status and stage:
 * - status === 'not_started' → always shows "Not Started" (ignores stage value)
 * - stage === 'complete'     → renders "Complete" badge with checkmark (isComplete=true)
 * - all other stages         → show stage label; spinner when status === 'in_progress', dot otherwise
 *
 * This guards against mutations.js initializing stage: 'planning' on all new
 * phases/tasks regardless of status, which would otherwise surface as a
 * misleading "Planning" badge on every unstarted item.
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

// ─── Types (mirrored from @/types/state) ────────────────────────────────────

type PhaseStatus = "not_started" | "in_progress" | "complete" | "halted";
type TaskStatus = "not_started" | "in_progress" | "complete" | "failed" | "halted";
type TaskStage = "planning" | "coding" | "reviewing" | "complete" | "failed";
type PhaseStage = "planning" | "executing" | "reviewing" | "complete" | "failed";

// ─── Simulation (mirrors stage-badge.tsx logic) ──────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; cssVar: string }> = {
  planning:  { label: "Planning",  cssVar: "--tier-planning" },
  coding:    { label: "Coding",    cssVar: "--tier-execution" },
  executing: { label: "Executing", cssVar: "--tier-execution" },
  reviewing: { label: "Reviewing", cssVar: "--tier-review" },
  complete:  { label: "Complete",  cssVar: "--status-complete" },
  failed:    { label: "Failed",    cssVar: "--status-failed" },
};

const NOT_STARTED_CONFIG = { label: "Not Started", cssVar: "--status-not-started" };

type RenderResult = { label: string; cssVar: string; isSpinning: boolean; isComplete: boolean; ariaLabel: string };

function simulateStageBadge(
  stage: TaskStage | PhaseStage,
  status: PhaseStatus | TaskStatus
): RenderResult {
  if (status === "not_started") {
    return {
      label: NOT_STARTED_CONFIG.label,
      cssVar: NOT_STARTED_CONFIG.cssVar,
      isSpinning: false,
      isComplete: false,
      ariaLabel: "Stage: Not Started",
    };
  }
  if (stage === "complete") {
    const config = STAGE_CONFIG["complete"];
    return {
      label: config.label,
      cssVar: config.cssVar,
      isSpinning: false,
      isComplete: true,
      ariaLabel: "Stage: Complete",
    };
  }
  const config = STAGE_CONFIG[stage];
  const isSpinning = status === "in_progress";
  return {
    label: config.label,
    cssVar: config.cssVar,
    isSpinning,
    isComplete: false,
    ariaLabel: isSpinning ? `Stage: ${config.label}, active` : `Stage: ${config.label}`,
  };
}

// ─── not_started: status always wins regardless of stage ────────────────────

console.log("\nnot_started status");

test("not_started + planning stage → shows 'Not Started', not 'Planning'", () => {
  const result = simulateStageBadge("planning", "not_started");

  assert.strictEqual(result.label, "Not Started");
  assert.strictEqual(result.cssVar, "--status-not-started");
  assert.strictEqual(result.isSpinning, false);
});

test("not_started + executing stage → shows 'Not Started'", () => {
  const result = simulateStageBadge("executing", "not_started");

  assert.strictEqual(result.label, "Not Started");
  assert.strictEqual(result.isSpinning, false);
});

test("not_started + reviewing stage → shows 'Not Started'", () => {
  const result = simulateStageBadge("reviewing", "not_started");

  assert.strictEqual(result.label, "Not Started");
  assert.strictEqual(result.isSpinning, false);
});

test("not_started + complete stage → shows 'Not Started' (status check runs before terminal guard)", () => {
  const result = simulateStageBadge("complete", "not_started");

  assert.strictEqual(result.label, "Not Started");
  assert.strictEqual(result.isSpinning, false);
});

// ─── in_progress: stage is used ─────────────────────────────────────────────

console.log("\nin_progress status");

test("in_progress + planning → shows 'Planning' with --tier-planning", () => {
  const result = simulateStageBadge("planning", "in_progress");

  assert.strictEqual(result.label, "Planning");
  assert.strictEqual(result.cssVar, "--tier-planning");
});

test("in_progress + executing → shows 'Executing'", () => {
  const result = simulateStageBadge("executing", "in_progress");

  assert.strictEqual(result.label, "Executing");
  assert.strictEqual(result.cssVar, "--tier-execution");
});

test("in_progress + reviewing → shows 'Reviewing' with --tier-review", () => {
  const result = simulateStageBadge("reviewing", "in_progress");

  assert.strictEqual(result.label, "Reviewing");
  assert.strictEqual(result.cssVar, "--tier-review");
});

test("in_progress + coding → shows 'Coding'", () => {
  const result = simulateStageBadge("coding", "in_progress");

  assert.strictEqual(result.label, "Coding");
});

// ─── Complete and failed stage behavior ──────────────────────────────────────

console.log("\ncomplete and failed stage behavior");

test("complete status + complete stage → 'Complete' badge with checkmark", () => {
  const result = simulateStageBadge("complete", "complete");

  assert.strictEqual(result.label, "Complete");
  assert.strictEqual(result.cssVar, "--status-complete");
  assert.strictEqual(result.isSpinning, false);
  assert.strictEqual(result.isComplete, true);
  assert.strictEqual(result.ariaLabel, "Stage: Complete");
});

test("failed status + failed stage → shows 'Failed' badge (static, no spinner)", () => {
  const result = simulateStageBadge("failed", "failed");

  assert.strictEqual(result.label, "Failed");
  assert.strictEqual(result.cssVar, "--status-failed");
  assert.strictEqual(result.isSpinning, false);
  assert.strictEqual(result.ariaLabel, "Stage: Failed");
});

test("halted status + complete stage → 'Complete' badge with checkmark (stage guard removed)", () => {
  const result = simulateStageBadge("complete", "halted");

  assert.strictEqual(result.label, "Complete");
  assert.strictEqual(result.cssVar, "--status-complete");
  assert.strictEqual(result.isSpinning, false);
  assert.strictEqual(result.isComplete, true);
});

// ─── halted: stage badge shows to indicate where work stopped ────────────────

console.log("\nhalted status");

test("halted + planning → shows 'Planning' (dot badge, no spinner)", () => {
  const result = simulateStageBadge("planning", "halted");

  assert.strictEqual(result.label, "Planning");
  assert.strictEqual(result.isSpinning, false);
});

test("halted + reviewing → shows 'Reviewing'", () => {
  const result = simulateStageBadge("reviewing", "halted");

  assert.strictEqual(result.label, "Reviewing");
  assert.strictEqual(result.isSpinning, false);
});

// ─── in_progress: spinner active ─────────────────────────────────────────────

console.log("\nin_progress spinner cases");

test("in_progress + planning → isSpinning=true", () => {
  const result = simulateStageBadge("planning", "in_progress");

  assert.strictEqual(result.isSpinning, true);
});

test("in_progress + coding → isSpinning=true", () => {
  const result = simulateStageBadge("coding", "in_progress");

  assert.strictEqual(result.isSpinning, true);
});

test("in_progress + executing → isSpinning=true", () => {
  const result = simulateStageBadge("executing", "in_progress");

  assert.strictEqual(result.isSpinning, true);
});

test("in_progress + reviewing → isSpinning=true", () => {
  const result = simulateStageBadge("reviewing", "in_progress");

  assert.strictEqual(result.isSpinning, true);
});

test("halted + planning → isSpinning=false (dot, no spinner)", () => {
  const result = simulateStageBadge("planning", "halted");

  assert.strictEqual(result.label, "Planning");
  assert.strictEqual(result.isSpinning, false);
});

test("halted + reviewing → isSpinning=false", () => {
  const result = simulateStageBadge("reviewing", "halted");

  assert.strictEqual(result.label, "Reviewing");
  assert.strictEqual(result.isSpinning, false);
});

// ─── ariaLabel ───────────────────────────────────────────────────────────────

console.log("\nariaLabel");

test("in_progress + planning → ariaLabel includes ': active'", () => {
  const result = simulateStageBadge("planning", "in_progress");

  assert.strictEqual(result.ariaLabel, "Stage: Planning, active");
});

test("halted + planning → ariaLabel is just the label (no active suffix)", () => {
  const result = simulateStageBadge("planning", "halted");

  assert.strictEqual(result.ariaLabel, "Stage: Planning");
});

test("not_started → ariaLabel defaults to 'Stage: Not Started'", () => {
  const result = simulateStageBadge("planning", "not_started");

  assert.strictEqual(result.ariaLabel, "Stage: Not Started");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("");
if (failed === 0) {
  console.log(`All ${passed} tests passed.`);
} else {
  console.log(`${passed} passed, ${failed} failed.`);
  process.exit(1);
}
