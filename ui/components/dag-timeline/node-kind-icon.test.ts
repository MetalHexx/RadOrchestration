/**
 * Tests for NodeKindIcon component logic.
 * Run with: npx tsx ui/components/dag-timeline/node-kind-icon.test.ts
 */
import assert from "node:assert";
import { KIND_ICON_MAP } from './node-kind-icon';
import type { NodeKind } from '@/types/state';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_CLASS = "h-4 w-4 text-muted-foreground shrink-0";

function resolveIcon(kind: NodeKind): string {
  const Icon = KIND_ICON_MAP[kind] as { displayName?: string; name: string };
  return Icon.displayName ?? Icon.name;
}

function resolveClassName(className?: string): string {
  return className ? `${DEFAULT_CLASS} ${className}` : DEFAULT_CLASS;
}

const ARIA_HIDDEN = true;

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nNodeKindIcon logic tests\n");

test('renders FileText icon for kind="step"', () => {
  assert.strictEqual(resolveIcon("step"), "FileText");
});

test('renders Lock icon for kind="gate"', () => {
  assert.strictEqual(resolveIcon("gate"), "Lock");
});

test('renders GitBranch icon for kind="conditional"', () => {
  assert.strictEqual(resolveIcon("conditional"), "GitBranch");
});

test('renders LayoutGrid icon for kind="parallel"', () => {
  assert.strictEqual(resolveIcon("parallel"), "LayoutGrid");
});

test('renders Layers icon for kind="for_each_phase"', () => {
  assert.strictEqual(resolveIcon("for_each_phase"), "Layers");
});

test('renders RefreshCcw icon for kind="for_each_task"', () => {
  assert.strictEqual(resolveIcon("for_each_task"), "RefreshCcw");
});

test('applies aria-hidden="true" to all rendered icons', () => {
  assert.strictEqual(ARIA_HIDDEN, true);
});

test("merges custom className with default classes", () => {
  const merged = resolveClassName("custom-class");
  assert.ok(merged.includes(DEFAULT_CLASS), "should include default class");
  assert.ok(merged.includes("custom-class"), "should include custom class");
});

test("uses default className when no className provided", () => {
  const result = resolveClassName();
  assert.strictEqual(result, DEFAULT_CLASS);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
