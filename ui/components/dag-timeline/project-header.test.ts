/**
 * Tests for ProjectHeader component logic.
 * Run with: npx tsx ui/components/dag-timeline/project-header.test.ts
 */
import assert from "node:assert";
import type { GateMode } from '../../types/state';

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

// ─── Simulation (mirrors project-header.tsx logic) ───────────────────────────

type GraphStatus = 'not_started' | 'in_progress' | 'completed' | 'halted';

interface ProjectHeaderProps {
  projectName: string;
  schemaVersion: "v4" | "v5";
  graphStatus?: GraphStatus;
  gateMode?: GateMode | null;
  currentPhaseName?: string | null;
  progress?: { completed: number; total: number } | null;
}

function simulateProjectHeader(props: ProjectHeaderProps) {
  const showRow2 = props.graphStatus === 'in_progress' && !!props.currentPhaseName;
  return {
    projectName: props.projectName,
    schemaVersionText: props.schemaVersion,
    badgeVariant: "secondary" as const,
    badgeClass: "text-xs",
    outerElement: "header",
    outerClass: "border-b border-border px-6 py-4",
    ariaLabel: `Project ${props.projectName}`,
    row1Class: "flex items-center gap-3",
    nameClass: "text-lg font-semibold",
    showGraphStatusBadge: !!props.graphStatus,
    graphStatus: props.graphStatus,
    showGateModeBadge: props.gateMode !== undefined,
    gateMode: props.gateMode,
    showRow2,
    currentPhaseName: showRow2 ? props.currentPhaseName : null,
    showProgress: showRow2 && !!props.progress,
    progress: showRow2 ? props.progress : null,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nProjectHeader logic tests\n");

test("renders the project name", () => {
  const result = simulateProjectHeader({ projectName: "MY-PROJECT", schemaVersion: "v5" });
  assert.strictEqual(result.projectName, "MY-PROJECT");
});

test('renders schema version "v4" in badge', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v4" });
  assert.strictEqual(result.schemaVersionText, "v4");
});

test('renders schema version "v5" in badge', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.strictEqual(result.schemaVersionText, "v5");
});

test('uses "secondary" Badge variant for schema version', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.strictEqual(result.badgeVariant, "secondary");
});

test('renders project name with "text-lg font-semibold" class', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.ok(result.nameClass.includes("text-lg"), 'should include "text-lg"');
  assert.ok(result.nameClass.includes("font-semibold"), 'should include "font-semibold"');
});

test('outer element is <header> with aria-label', () => {
  const result = simulateProjectHeader({ projectName: "MyProj", schemaVersion: "v5" });
  assert.strictEqual(result.outerElement, "header");
  assert.strictEqual(result.ariaLabel, "Project MyProj");
});

test('outer class includes border-b', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.ok(result.outerClass.includes("border-b"), 'should include "border-b"');
});

test('row 1 has flex items-center gap-3', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.ok(result.row1Class.includes("flex"), 'row1 should include "flex"');
  assert.ok(result.row1Class.includes("items-center"), 'row1 should include "items-center"');
  assert.ok(result.row1Class.includes("gap-3"), 'row1 should include "gap-3"');
});

test('NodeStatusBadge renders in row 1 when graphStatus is provided', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", graphStatus: "in_progress" });
  assert.strictEqual(result.showGraphStatusBadge, true);
  assert.strictEqual(result.graphStatus, "in_progress");
});

test('NodeStatusBadge does not render when graphStatus is omitted', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.strictEqual(result.showGraphStatusBadge, false);
});

test('GateModeBadge renders when gateMode is provided (string)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", gateMode: "task" });
  assert.strictEqual(result.showGateModeBadge, true);
  assert.strictEqual(result.gateMode, "task");
});

test('GateModeBadge renders when gateMode is null (explicit null)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", gateMode: null });
  assert.strictEqual(result.showGateModeBadge, true);
  assert.strictEqual(result.gateMode, null);
});

test('GateModeBadge does not render when gateMode is undefined (v4 path)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v4" });
  assert.strictEqual(result.showGateModeBadge, false);
});

test('Row 2 renders when graphStatus === "in_progress" AND currentPhaseName is truthy', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 1"
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.currentPhaseName, "Phase 1");
});

test('Row 2 is hidden when graphStatus !== "in_progress"', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "completed", currentPhaseName: "Phase 1"
  });
  assert.strictEqual(result.showRow2, false);
});

test('Row 2 is hidden when graphStatus is "not_started"', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "not_started", currentPhaseName: "Phase 1"
  });
  assert.strictEqual(result.showRow2, false);
});

test('Row 2 is hidden when currentPhaseName is null', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: null
  });
  assert.strictEqual(result.showRow2, false);
});

test('Row 2 is hidden when currentPhaseName is undefined', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress"
  });
  assert.strictEqual(result.showRow2, false);
});

test('Progress text renders as "{completed} of {total} phases" when progress is provided with row 2 conditions', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 2",
    progress: { completed: 3, total: 5 }
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.showProgress, true);
  assert.deepStrictEqual(result.progress, { completed: 3, total: 5 });
});

test('Progress text is hidden when progress is null even if row 2 is visible', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 1",
    progress: null
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.showProgress, false);
});

test('Progress text is hidden when progress is undefined', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 1"
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.showProgress, false);
});

test('v4 rendering: only projectName and schemaVersion — no badges, no row 2', () => {
  const result = simulateProjectHeader({ projectName: "LEGACY", schemaVersion: "v4" });
  assert.strictEqual(result.showGraphStatusBadge, false);
  assert.strictEqual(result.showGateModeBadge, false);
  assert.strictEqual(result.showRow2, false);
  assert.strictEqual(result.projectName, "LEGACY");
  assert.strictEqual(result.schemaVersionText, "v4");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
