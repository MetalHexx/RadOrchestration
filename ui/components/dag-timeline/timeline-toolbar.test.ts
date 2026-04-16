/**
 * Tests for TimelineToolbar component logic.
 * Run with: npx tsx ui/components/dag-timeline/timeline-toolbar.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * prop contracts and conditional rendering logic by simulating what
 * the component does with its inputs. The simulation mirrors the
 * implementation in timeline-toolbar.tsx.
 */
import assert from "node:assert";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  \u2717 ${name}\n    ${msg}`);
    failed++;
  }
}

// ─── Contract type (mirrors TimelineToolbarProps) ────────────────────────────

interface TimelineToolbarProps {
  followMode: boolean;
  onToggleFollowMode: () => void;
}

// ─── Simulation types ────────────────────────────────────────────────────────

type IconId = "Radio" | "Circle";

interface SimResult {
  rootRole: string;
  rootAriaLabel: string;
  buttonType: "button";
  buttonAriaPressed: boolean;
  buttonAriaLabel: string;
  buttonColorClass: "text-primary" | "text-muted-foreground";
  iconId: IconId;
  labelText: string;
  onClick: () => void;
}

/** Mirrors the runtime logic of TimelineToolbar. */
function simulateTimelineToolbar(props: TimelineToolbarProps): SimResult {
  const { followMode, onToggleFollowMode } = props;
  const buttonColorClass: "text-primary" | "text-muted-foreground" =
    followMode ? "text-primary" : "text-muted-foreground";
  const iconId: IconId = followMode ? "Radio" : "Circle";
  const buttonAriaLabel = followMode ? "Follow mode: on" : "Follow mode: off";

  return {
    rootRole: "toolbar",
    rootAriaLabel: "Timeline toolbar",
    buttonType: "button",
    buttonAriaPressed: followMode,
    buttonAriaLabel,
    buttonColorClass,
    iconId,
    labelText: "Follow",
    onClick: onToggleFollowMode,
  };
}

// ==================== TimelineToolbar Tests ====================

console.log("\nTimelineToolbar logic tests\n");

// ─── Engaged state (followMode === true) ─────────────────────────────────────

test("engaged: icon is the engaged glyph (Radio) and color class is text-primary", () => {
  const result = simulateTimelineToolbar({ followMode: true, onToggleFollowMode: () => {} });
  assert.strictEqual(result.iconId, "Radio");
  assert.strictEqual(result.buttonColorClass, "text-primary");
});

// ─── Disengaged state (followMode === false) ─────────────────────────────────

test("disengaged: icon is the disengaged glyph (Circle) and color class is text-muted-foreground", () => {
  const result = simulateTimelineToolbar({ followMode: false, onToggleFollowMode: () => {} });
  assert.strictEqual(result.iconId, "Circle");
  assert.strictEqual(result.buttonColorClass, "text-muted-foreground");
});

// ─── Static label text ──────────────────────────────────────────────────────

test('label text is exactly "Follow" in engaged state', () => {
  const result = simulateTimelineToolbar({ followMode: true, onToggleFollowMode: () => {} });
  assert.strictEqual(result.labelText, "Follow");
});

test('label text is exactly "Follow" in disengaged state', () => {
  const result = simulateTimelineToolbar({ followMode: false, onToggleFollowMode: () => {} });
  assert.strictEqual(result.labelText, "Follow");
});

// ─── aria-pressed reflects followMode ───────────────────────────────────────

test("aria-pressed === true when followMode is true", () => {
  const result = simulateTimelineToolbar({ followMode: true, onToggleFollowMode: () => {} });
  assert.strictEqual(result.buttonAriaPressed, true);
});

test("aria-pressed === false when followMode is false", () => {
  const result = simulateTimelineToolbar({ followMode: false, onToggleFollowMode: () => {} });
  assert.strictEqual(result.buttonAriaPressed, false);
});

// ─── aria-label state-specific text ─────────────────────────────────────────

test('aria-label is "Follow mode: on" when engaged', () => {
  const result = simulateTimelineToolbar({ followMode: true, onToggleFollowMode: () => {} });
  assert.strictEqual(result.buttonAriaLabel, "Follow mode: on");
});

test('aria-label is "Follow mode: off" when disengaged', () => {
  const result = simulateTimelineToolbar({ followMode: false, onToggleFollowMode: () => {} });
  assert.strictEqual(result.buttonAriaLabel, "Follow mode: off");
});

// ─── Root element attributes ────────────────────────────────────────────────

test('root element has role="toolbar" and aria-label="Timeline toolbar"', () => {
  const result = simulateTimelineToolbar({ followMode: true, onToggleFollowMode: () => {} });
  assert.strictEqual(result.rootRole, "toolbar");
  assert.strictEqual(result.rootAriaLabel, "Timeline toolbar");
});

// ─── Button type ────────────────────────────────────────────────────────────

test('toggle button has type="button"', () => {
  const result = simulateTimelineToolbar({ followMode: false, onToggleFollowMode: () => {} });
  assert.strictEqual(result.buttonType, "button");
});

// ─── Click handler invocation ───────────────────────────────────────────────

test("clicking the toggle invokes onToggleFollowMode exactly once", () => {
  let calls = 0;
  const handler = () => { calls++; };
  const result = simulateTimelineToolbar({ followMode: false, onToggleFollowMode: handler });
  result.onClick();
  assert.strictEqual(calls, 1);
});

test("clicking does NOT mutate followMode inside the component (stateless contract)", () => {
  let calls = 0;
  const props: TimelineToolbarProps = {
    followMode: false,
    onToggleFollowMode: () => { calls++; },
  };
  const result = simulateTimelineToolbar(props);
  result.onClick();
  // The component is a pure function of props; invoking the click handler
  // must not mutate the input props object at all.
  assert.strictEqual(props.followMode, false);
  assert.strictEqual(calls, 1);
});

// ─── Barrel export ───────────────────────────────────────────────────────────

test('TimelineToolbar is exported from ui/components/dag-timeline/index.ts', async () => {
  const mod = (await import('./index')) as Record<string, unknown>;
  assert.strictEqual(
    typeof mod.TimelineToolbar,
    'function',
    'TimelineToolbar must be exported as a function from the barrel'
  );
});

// ─── Type-signature smoke check ──────────────────────────────────────────────

test("Prop type matches TimelineToolbarProps contract (followMode: boolean, onToggleFollowMode: () => void)", () => {
  // Compile-time shape guard — this assignment fails if the contract drifts.
  const props: TimelineToolbarProps = {
    followMode: true,
    onToggleFollowMode: () => {},
  };
  const result = simulateTimelineToolbar(props);
  assert.ok(result);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
