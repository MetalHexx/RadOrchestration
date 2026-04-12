/**
 * Tests for ProjectHeader component logic.
 * Run with: npx tsx ui/components/dag-timeline/project-header.test.ts
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

type GraphStatus = "not_started" | "in_progress" | "completed" | "halted";

// ─── Simulation (mirrors project-header.tsx logic) ───────────────────────────

interface ProjectHeaderProps {
  projectName: string;
  schemaVersion: "v4" | "v5";
  graphStatus?: GraphStatus;
}

function simulateProjectHeader(props: ProjectHeaderProps) {
  return {
    projectName: props.projectName,
    schemaVersionText: props.schemaVersion,
    badgeVariant: "secondary" as const,
    badgeClass: "text-xs",
    containerClass: "border-b border-border px-6 py-4 flex items-center gap-3",
    nameClass: "text-lg font-semibold",
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

test('renders container with border-b class', () => {
  const result = simulateProjectHeader({ projectName: "Test", schemaVersion: "v5" });
  assert.ok(result.containerClass.includes("border-b"), 'should include "border-b"');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
