/**
 * Tests for StageBadge component logic.
 * Run with: npx tsx ui/components/badges/stage-badge.test.ts
 *
 * StageBadge derives its display from BOTH status and stage:
 * - status === 'not_started' → always shows "Not Started" (ignores stage value)
 * - status === 'in_progress' | 'complete' | 'failed' | 'halted' → show stage label, or null for terminal stages
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
type TaskStage = "planning" | "coding" | "reporting" | "reviewing" | "complete" | "failed";
type PhaseStage = "planning" | "executing" | "reporting" | "reviewing" | "complete" | "failed";

// ─── Simulation (mirrors stage-badge.tsx logic) ──────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; cssVar: string }> = {
  planning:  { label: "Planning",  cssVar: "--tier-planning" },
  coding:    { label: "Coding",    cssVar: "--tier-execution" },
  executing: { label: "Executing", cssVar: "--tier-execution" },
  reporting: { label: "Reporting", cssVar: "--chart-2" },
  reviewing: { label: "Reviewing", cssVar: "--tier-review" },
  complete:  { label: "Complete",  cssVar: "--status-complete" },
  failed:    { label: "Failed",    cssVar: "--status-failed" },
};

const NOT_STARTED_CONFIG = { label: "Not Started", cssVar: "--status-not-started" };

type RenderResult =
  | { rendered: false }
  | { rendered: true; label: string; cssVar: string };

function simulateStageBadge(
  stage: TaskStage | PhaseStage,
  status: PhaseStatus | TaskStatus
): RenderResult {
  if (status === "not_started") {
    return { rendered: true, label: NOT_STARTED_CONFIG.label, cssVar: NOT_STARTED_CONFIG.cssVar };
  }
  if (stage === "complete" || stage === "failed") {
    return { rendered: false };
  }
  const config = STAGE_CONFIG[stage];
  return { rendered: true, label: config.label, cssVar: config.cssVar };
}

// ─── not_started: status always wins regardless of stage ────────────────────

console.log("\nnot_started status");

test("not_started + planning stage → shows 'Not Started', not 'Planning'", () => {
  const result = simulateStageBadge("planning", "not_started");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Not Started");
  assert.strictEqual(result.cssVar, "--status-not-started");
});

test("not_started + executing stage → shows 'Not Started'", () => {
  const result = simulateStageBadge("executing", "not_started");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Not Started");
});

test("not_started + reviewing stage → shows 'Not Started'", () => {
  const result = simulateStageBadge("reviewing", "not_started");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Not Started");
});

test("not_started + reporting stage → shows 'Not Started'", () => {
  const result = simulateStageBadge("reporting", "not_started");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Not Started");
});

test("not_started + complete stage → shows 'Not Started' (status check runs before terminal guard)", () => {
  const result = simulateStageBadge("complete", "not_started");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Not Started");
});

// ─── in_progress: stage is used ─────────────────────────────────────────────

console.log("\nin_progress status");

test("in_progress + planning → shows 'Planning' with --tier-planning", () => {
  const result = simulateStageBadge("planning", "in_progress");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Planning");
  assert.strictEqual(result.cssVar, "--tier-planning");
});

test("in_progress + executing → shows 'Executing'", () => {
  const result = simulateStageBadge("executing", "in_progress");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Executing");
  assert.strictEqual(result.cssVar, "--tier-execution");
});

test("in_progress + reviewing → shows 'Reviewing' with --tier-review", () => {
  const result = simulateStageBadge("reviewing", "in_progress");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Reviewing");
  assert.strictEqual(result.cssVar, "--tier-review");
});

test("in_progress + reporting → shows 'Reporting'", () => {
  const result = simulateStageBadge("reporting", "in_progress");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Reporting");
});

test("in_progress + coding → shows 'Coding'", () => {
  const result = simulateStageBadge("coding", "in_progress");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Coding");
});

// ─── Terminal stage suppression (stage = complete or failed) ─────────────────

console.log("\nterminal stage suppression");

test("complete status + complete stage → null (no badge)", () => {
  const result = simulateStageBadge("complete", "complete");
  assert.strictEqual(result.rendered, false);
});

test("in_progress status + failed stage → null (no badge)", () => {
  const result = simulateStageBadge("failed", "in_progress");
  assert.strictEqual(result.rendered, false);
});

test("halted status + complete stage → null (terminal guard still applies)", () => {
  const result = simulateStageBadge("complete", "halted");
  assert.strictEqual(result.rendered, false);
});

// ─── halted: stage badge shows to indicate where work stopped ────────────────

console.log("\nhalted status");

test("halted + planning → shows 'Planning' (StatusIcon communicates halted state)", () => {
  const result = simulateStageBadge("planning", "halted");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Planning");
});

test("halted + reviewing → shows 'Reviewing'", () => {
  const result = simulateStageBadge("reviewing", "halted");
  assert.ok(result.rendered);
  assert.strictEqual(result.label, "Reviewing");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("");
if (failed === 0) {
  console.log(`All ${passed} tests passed.`);
} else {
  console.log(`${passed} passed, ${failed} failed.`);
  process.exit(1);
}
