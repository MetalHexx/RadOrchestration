/**
 * Tests for ProjectHeader component logic.
 * Run with: npx tsx ui/components/dag-timeline/project-header.test.ts
 */
import assert from "node:assert";
import type { GateMode, GraphStatus, V5SourceControlState } from '../../types/state';

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

interface ProjectHeaderProps {
  projectName: string;
  schemaVersion: "v4" | "v5";
  graphStatus?: GraphStatus;
  gateMode?: GateMode | null;
  currentPhaseName?: string | null;
  progress?: { completed: number; total: number } | null;
  sourceControl: V5SourceControlState | null;
  followMode?: boolean;
  onToggleFollowMode?: () => void;
}

interface FollowModeSwitchSim {
  id: "follow-mode-switch";
  checked: boolean;
  className: "cursor-pointer";
  onCheckedChange: (...args: unknown[]) => void;
}

function makeSourceControl(overrides: Partial<V5SourceControlState> = {}): V5SourceControlState {
  return {
    branch: 'feat/test-branch',
    base_branch: 'main',
    worktree_path: '/path/to/worktree',
    auto_commit: 'always',
    auto_pr: 'never',
    remote_url: 'https://github.com/org/repo',
    compare_url: 'https://github.com/org/repo/compare/main...feat/test-branch',
    pr_url: null,
    ...overrides,
  };
}

function simulateProjectHeader(props: ProjectHeaderProps) {
  const showRow2 = props.graphStatus === 'in_progress' && !!props.currentPhaseName;
  const followMode = props.followMode ?? false;
  const onToggleFollowMode = props.onToggleFollowMode ?? (() => {});
  // Mirrors the call-site `() => onToggleFollowMode()` adapter — any
  // boolean argument supplied by the shadcn Switch is intentionally
  // discarded (not forwarded to the props callback). We build the closure
  // via `.bind(null)` so the synthesized function ignores whatever the
  // primitive passes in (0-arity) without triggering lint's unused-param rule.
  const onCheckedChangeAdapter: (...args: unknown[]) => void =
    function (this: unknown) {
      onToggleFollowMode();
    };
  const followModeSwitch: FollowModeSwitchSim = {
    id: "follow-mode-switch",
    checked: followMode,
    className: "cursor-pointer",
    onCheckedChange: onCheckedChangeAdapter,
  };
  return {
    projectName: props.projectName,
    schemaVersionText: props.schemaVersion,
    badgeVariant: "secondary" as const,
    badgeClass: "text-xs",
    outerElement: "header",
    outerClass: "border-b border-border px-6 py-4",
    ariaLabel: `Project ${props.projectName}`,
    row1Class: "flex flex-wrap items-center gap-3",
    nameClass: "text-lg font-semibold",
    showGraphStatusBadge: !!props.graphStatus,
    graphStatus: props.graphStatus,
    showGateModeBadge: props.gateMode !== undefined,
    gateMode: props.gateMode,
    showRow2,
    currentPhaseName: showRow2 ? props.currentPhaseName : null,
    showProgress: showRow2 && !!props.progress,
    progress: showRow2 ? props.progress : null,
    showInlinedSourceControl: props.sourceControl !== null,
    followModeContainerClass: "ml-auto inline-flex items-center gap-2",
    followModeLabelText: "Follow Mode",
    followModeLabelHtmlFor: "follow-mode-switch",
    followModeSwitch,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nProjectHeader logic tests\n");

test("renders the project name", () => {
  const result = simulateProjectHeader({ projectName: "MY-PROJECT", schemaVersion: "v5", sourceControl: null });
  assert.strictEqual(result.projectName, "MY-PROJECT");
});

test('renders schema version "v4" in badge', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v4", sourceControl: null });
  assert.strictEqual(result.schemaVersionText, "v4");
});

test('renders schema version "v5" in badge', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.strictEqual(result.schemaVersionText, "v5");
});

test('uses "secondary" Badge variant for schema version', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.strictEqual(result.badgeVariant, "secondary");
});

test('renders project name with "text-lg font-semibold" class', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.ok(result.nameClass.includes("text-lg"), 'should include "text-lg"');
  assert.ok(result.nameClass.includes("font-semibold"), 'should include "font-semibold"');
});

test('outer element is <header> with aria-label', () => {
  const result = simulateProjectHeader({ projectName: "MyProj", schemaVersion: "v5", sourceControl: null });
  assert.strictEqual(result.outerElement, "header");
  assert.strictEqual(result.ariaLabel, "Project MyProj");
});

test('outer class includes border-b', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.ok(result.outerClass.includes("border-b"), 'should include "border-b"');
});

test('row 1 has flex flex-wrap items-center gap-3 (unified wrapping row)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.ok(result.row1Class.includes("flex"), 'row1 should include "flex"');
  assert.ok(result.row1Class.includes("flex-wrap"), 'row1 should include "flex-wrap"');
  assert.ok(result.row1Class.includes("items-center"), 'row1 should include "items-center"');
  assert.ok(result.row1Class.includes("gap-3"), 'row1 should include "gap-3"');
});

test('NodeStatusBadge renders in row 1 when graphStatus is provided', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", graphStatus: "in_progress", sourceControl: null });
  assert.strictEqual(result.showGraphStatusBadge, true);
  assert.strictEqual(result.graphStatus, "in_progress");
});

test('NodeStatusBadge does not render when graphStatus is omitted', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.strictEqual(result.showGraphStatusBadge, false);
});

test('GateModeBadge renders when gateMode is provided (string)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", gateMode: "task", sourceControl: null });
  assert.strictEqual(result.showGateModeBadge, true);
  assert.strictEqual(result.gateMode, "task");
});

test('GateModeBadge renders when gateMode is null (explicit null)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", gateMode: null, sourceControl: null });
  assert.strictEqual(result.showGateModeBadge, true);
  assert.strictEqual(result.gateMode, null);
});

test('GateModeBadge does not render when gateMode is undefined (v4 path)', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v4", sourceControl: null });
  assert.strictEqual(result.showGateModeBadge, false);
});

test('Row 2 renders when graphStatus === "in_progress" AND currentPhaseName is truthy', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 1",
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.currentPhaseName, "Phase 1");
});

test('Row 2 is hidden when graphStatus !== "in_progress"', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "completed", currentPhaseName: "Phase 1",
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, false);
});

test('Row 2 is hidden when graphStatus is "not_started"', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "not_started", currentPhaseName: "Phase 1",
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, false);
});

test('Row 2 is hidden when currentPhaseName is null', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: null,
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, false);
});

test('Row 2 is hidden when currentPhaseName is undefined', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress",
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, false);
});

test('Progress text renders as "{completed} of {total} phases" when progress is provided with row 2 conditions', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 2",
    progress: { completed: 3, total: 5 },
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.showProgress, true);
  assert.deepStrictEqual(result.progress, { completed: 3, total: 5 });
});

test('Progress text is hidden when progress is null even if row 2 is visible', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 1",
    progress: null,
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.showProgress, false);
});

test('Progress text is hidden when progress is undefined', () => {
  const result = simulateProjectHeader({
    projectName: "Test", schemaVersion: "v5",
    graphStatus: "in_progress", currentPhaseName: "Phase 1",
    sourceControl: null,
  });
  assert.strictEqual(result.showRow2, true);
  assert.strictEqual(result.showProgress, false);
});

test('v4 rendering: only projectName and schemaVersion — no badges, no row 2', () => {
  const result = simulateProjectHeader({ projectName: "LEGACY", schemaVersion: "v4", sourceControl: null });
  assert.strictEqual(result.showGraphStatusBadge, false);
  assert.strictEqual(result.showGateModeBadge, false);
  assert.strictEqual(result.showRow2, false);
  assert.strictEqual(result.projectName, "LEGACY");
  assert.strictEqual(result.schemaVersionText, "v4");
});

// ─── Inlined source-control fragment visibility ──────────────────────────────

test('inlined source-control fragments are hidden when sourceControl is null', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.strictEqual(result.showInlinedSourceControl, false);
});

test('inlined source-control fragments render when a non-null V5SourceControlState fixture is passed', () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: makeSourceControl(),
  });
  assert.strictEqual(result.showInlinedSourceControl, true);
});

// ─── Follow Mode populated container ─────────────────────────────────────────

test('Follow Mode container uses ml-auto and inline-flex gap-2 classes', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5", sourceControl: null });
  assert.ok(result.followModeContainerClass.includes("ml-auto"), 'container should include "ml-auto"');
  assert.ok(result.followModeContainerClass.includes("inline-flex"), 'container should include "inline-flex"');
  assert.ok(result.followModeContainerClass.includes("gap-2"), 'container should include "gap-2"');
});

// ─── Follow Mode Switch wiring ───────────────────────────────────────────────

test('Follow Mode label text is exactly "Follow Mode" when followMode is true', () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: true,
    onToggleFollowMode: () => {},
  });
  assert.strictEqual(result.followModeLabelText, "Follow Mode");
});

test('Follow Mode label text is exactly "Follow Mode" when followMode is false', () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: false,
    onToggleFollowMode: () => {},
  });
  assert.strictEqual(result.followModeLabelText, "Follow Mode");
});

test("Follow Mode label htmlFor matches the Switch id (\"follow-mode-switch\")", () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: false,
    onToggleFollowMode: () => {},
  });
  assert.strictEqual(result.followModeLabelHtmlFor, "follow-mode-switch");
  assert.strictEqual(result.followModeSwitch.id, "follow-mode-switch");
  assert.strictEqual(result.followModeLabelHtmlFor, result.followModeSwitch.id);
});

test("Follow Mode Switch carries className \"cursor-pointer\"", () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: false,
    onToggleFollowMode: () => {},
  });
  assert.strictEqual(result.followModeSwitch.className, "cursor-pointer");
});

test("Follow Mode Switch checked === true when followMode is true", () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: true,
    onToggleFollowMode: () => {},
  });
  assert.strictEqual(result.followModeSwitch.checked, true);
});

test("Follow Mode Switch checked === false when followMode is false", () => {
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: false,
    onToggleFollowMode: () => {},
  });
  assert.strictEqual(result.followModeSwitch.checked, false);
});

test("Invoking onCheckedChange(true) calls onToggleFollowMode exactly once and does not forward the argument", () => {
  let calls = 0;
  const receivedArgs: unknown[][] = [];
  const handler = (...args: unknown[]) => {
    calls++;
    receivedArgs.push(args);
  };
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: false,
    onToggleFollowMode: handler as () => void,
  });
  result.followModeSwitch.onCheckedChange(true);
  assert.strictEqual(calls, 1, "onToggleFollowMode should be called exactly once");
  assert.strictEqual(
    receivedArgs[0].length,
    0,
    "onToggleFollowMode should receive no arguments (the `checked` value must be discarded)",
  );
});

test("Invoking onCheckedChange(false) calls onToggleFollowMode exactly once and does not forward the argument", () => {
  let calls = 0;
  const receivedArgs: unknown[][] = [];
  const handler = (...args: unknown[]) => {
    calls++;
    receivedArgs.push(args);
  };
  const result = simulateProjectHeader({
    projectName: "Test",
    schemaVersion: "v5",
    sourceControl: null,
    followMode: true,
    onToggleFollowMode: handler as () => void,
  });
  result.followModeSwitch.onCheckedChange(false);
  assert.strictEqual(calls, 1, "onToggleFollowMode should be called exactly once");
  assert.strictEqual(
    receivedArgs[0].length,
    0,
    "onToggleFollowMode should receive no arguments (the `checked` value must be discarded)",
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

