/**
 * Production-module integration test for use-sort-config.
 * Imports `compareSortConfig` from the production export so a regression
 * in the production sort logic surfaces here, even when the inline tests
 * in use-sort-config.test.ts continue to pass against their inline replica.
 *
 * Run with: npx tsx ui/hooks/use-sort-config.integration.test.ts
 */
import assert from 'node:assert';
import { compareSortConfig, DEFAULT_SORT_CONFIG, type SortConfig } from './use-sort-config';
import type { ProjectSummary } from '../types/components';

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

function fx(overrides: Partial<ProjectSummary>): ProjectSummary {
  return {
    name: 'p',
    tier: 'not_initialized',
    hasState: false,
    hasMalformedState: false,
    planningStatus: undefined,
    executionStatus: undefined,
    lastUpdated: undefined,
    ...overrides,
  } as ProjectSummary;
}

const URGENT_FIRST: SortConfig = { primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'asc' };

console.log('\nuse-sort-config — production-module smoke test\n');

// FR-14 — full Urgent-first order against the production compareSortConfig.
// Slots: 0 halted, 1 malformed, 2 executing, 3 approved, 4 finalReview,
// 5 planning, 6 planned, 7 notStarted, 8 complete, 9 notInitialized.
test('FR-14 — full Urgent-first order against production compareSortConfig', () => {
  const fxHalted = fx({ name: 'h', tier: 'halted' });
  const fxMalformed = fx({ name: 'm', tier: 'execution', executionStatus: 'in_progress', hasMalformedState: true });
  const fxExecuting = fx({ name: 'x', tier: 'execution', executionStatus: 'in_progress' });
  const fxApproved = fx({ name: 'a', tier: 'execution', executionStatus: 'not_started' });
  const fxFinalReview = fx({ name: 'r', tier: 'review' });
  const fxPlanning = fx({ name: 'p1', tier: 'planning', planningStatus: 'in_progress' });
  const fxPlanned = fx({ name: 'p2', tier: 'planning', planningStatus: 'complete' });
  const fxNotStarted = fx({ name: 'p3', tier: 'planning', planningStatus: 'not_started' });
  const fxComplete = fx({ name: 'c', tier: 'complete' });
  const fxNotInit = fx({ name: 'z', tier: 'not_initialized' });

  const shuffled = [fxComplete, fxNotInit, fxApproved, fxPlanning, fxHalted, fxFinalReview, fxNotStarted, fxMalformed, fxPlanned, fxExecuting];
  const sorted = [...shuffled].sort((a, b) => compareSortConfig(a, b, URGENT_FIRST));
  assert.deepStrictEqual(
    sorted.map(p => p.name),
    ['h', 'm', 'x', 'a', 'r', 'p1', 'p2', 'p3', 'c', 'z'],
  );
});

// AD-5 — Final Review (slot 4) sits between Approved (slot 3) and Planning (slot 5).
test('AD-5 — Final Review sits between Approved and Planning in production sort', () => {
  const a = fx({ name: 'a', tier: 'execution', executionStatus: 'not_started' });
  const r = fx({ name: 'r', tier: 'review' });
  const p = fx({ name: 'p', tier: 'planning', planningStatus: 'in_progress' });
  const sorted = [p, a, r].sort((x, y) => compareSortConfig(x, y, URGENT_FIRST));
  assert.deepStrictEqual(sorted.map(x => x.name), ['a', 'r', 'p']);
});

// FR-14 — every slot is reachable; not_initialized always pinned to the bottom.
test('FR-14 — Not Initialized pins to bottom of production Urgent-first sort', () => {
  const x = fx({ name: 'x', tier: 'execution', executionStatus: 'in_progress' });
  const z = fx({ name: 'z', tier: 'not_initialized' });
  const sorted = [z, x].sort((a, b) => compareSortConfig(a, b, URGENT_FIRST));
  assert.deepStrictEqual(sorted.map(p => p.name), ['x', 'z']);
});

// DEFAULT_SORT_CONFIG export integrity — secondary defaults still load through the production export.
test('DEFAULT_SORT_CONFIG exports the expected secondary defaults', () => {
  assert.ok(DEFAULT_SORT_CONFIG, 'DEFAULT_SORT_CONFIG must be exported');
  assert.strictEqual(typeof DEFAULT_SORT_CONFIG.primary, 'string');
  assert.strictEqual(typeof DEFAULT_SORT_CONFIG.secondary, 'string');
});

// FR-14 — backward-compat alignment: undefined planningStatus sorts as Planning, not Not Started.
test('FR-14 — undefined planningStatus sorts as Planning (slot 5) against production compareSortConfig', () => {
  const fxPlanningUndef = fx({ name: 'p_undef', tier: 'planning', planningStatus: undefined });
  const fxNotStarted = fx({ name: 'p_ns', tier: 'planning', planningStatus: 'not_started' });
  const fxPlanning = fx({ name: 'p_planning', tier: 'planning', planningStatus: 'in_progress' });
  const sorted = [fxNotStarted, fxPlanning, fxPlanningUndef].sort(
    (a, b) => compareSortConfig(a, b, { primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'asc' })
  );
  // p_planning (slot 5) and p_undef (slot 5 after fix) tie on status; alphabetical secondary breaks → p_planning before p_undef.
  // Both then sort before p_ns (slot 7).
  assert.deepStrictEqual(sorted.map(p => p.name), ['p_planning', 'p_undef', 'p_ns']);
});

if (failed === 0) {
  console.log(`\nAll ${passed} tests passed.`);
} else {
  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exit(1);
}
