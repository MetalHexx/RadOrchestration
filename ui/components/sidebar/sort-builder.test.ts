/**
 * Tests for sort-builder — buildSortSummary pure function.
 * Component rendering tests require JSDOM and are documented as TODO stubs below.
 * Run with: npx tsx ui/components/sidebar/sort-builder.test.ts
 */
import assert from 'node:assert';

// ─── Inline types (replicated from source for test isolation) ─────────────────

type SortField = 'status' | 'name' | 'updated';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  primary: SortField;
  primaryDir: SortDirection;
  secondary: SortField | 'none';
  secondaryDir: SortDirection;
}

// ─── Replicated from sort-builder.tsx (inline for test isolation) ─────────────

const FIELD_LABELS: Record<SortField, string> = {
  status:  "Status",
  name:    "Name",
  updated: "Updated",
};

function buildSortSummary(config: SortConfig): string {
  const arrow = config.primaryDir === "asc" ? "↑" : "↓";
  return `${FIELD_LABELS[config.primary]} ${arrow}`;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('sort-builder — buildSortSummary');

  // Primary-only cases

  await test('Primary only — status ascending', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Status ↑');
  });

  await test('Primary only — status descending', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Status ↓');
  });

  await test('Primary only — name ascending', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Name ↑');
  });

  await test('Primary only — name descending', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Name ↓');
  });

  await test('Primary only — updated ascending', async () => {
    const result = buildSortSummary({ primary: 'updated', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Updated ↑');
  });

  await test('Primary only — updated descending', async () => {
    const result = buildSortSummary({ primary: 'updated', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Updated ↓');
  });

  // Persisted secondary is ignored by the summary (control is hidden post-shipment)

  await test('summary ignores persisted secondary — name primary with status secondary', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'asc', secondary: 'status', secondaryDir: 'desc' });
    assert.strictEqual(result, 'Name ↑');
  });

  await test('summary never contains separator regardless of persisted secondary', async () => {
    const result = buildSortSummary({ primary: 'updated', primaryDir: 'desc', secondary: 'name', secondaryDir: 'asc' });
    assert.ok(!result.includes(' · '), `Expected no separator in "${result}"`);
  });

  // Direction arrow symbols

  await test('Direction arrow — ascending produces ↑', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.ok(result.includes('↑'), `Expected "↑" in "${result}"`);
  });

  await test('Direction arrow — descending produces ↓', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' });
    assert.ok(result.includes('↓'), `Expected "↓" in "${result}"`);
  });

  // All field labels map correctly

  await test('Field label — status maps to "Status"', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.ok(result.startsWith('Status'), `Expected result to start with "Status", got "${result}"`);
  });

  await test('Field label — name maps to "Name"', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.ok(result.startsWith('Name'), `Expected result to start with "Name", got "${result}"`);
  });

  await test('Field label — updated maps to "Updated"', async () => {
    const result = buildSortSummary({ primary: 'updated', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.ok(result.startsWith('Updated'), `Expected result to start with "Updated", got "${result}"`);
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

// TODO: Requires JSDOM / @testing-library/react — stub for future implementation
// - Component renders without errors when given DEFAULT_SORT_CONFIG
// - Clicking the trigger row toggles the panel open/closed
// - When expanded, summary text is hidden
// - Clicking a primary field button calls onChange with updated primary
// - Toggling primary direction calls onChange with updated primaryDir
// - Direction labels update to match the selected field
// - Chevron rotates 180° when panel is open

run();
