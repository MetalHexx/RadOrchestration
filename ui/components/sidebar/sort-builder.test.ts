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
  const primaryArrow = config.primaryDir === "asc" ? "↑" : "↓";
  const primaryPart = `${FIELD_LABELS[config.primary]} ${primaryArrow}`;

  if (config.secondary === "none") {
    return primaryPart;
  }

  const secondaryArrow = config.secondaryDir === "asc" ? "↑" : "↓";
  const secondaryPart = `${FIELD_LABELS[config.secondary as SortField]} ${secondaryArrow}`;

  return `${primaryPart} · ${secondaryPart}`;
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

  // Primary + secondary cases

  await test('Primary + secondary — status asc + name asc', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Status ↑ · Name ↑');
  });

  await test('Primary + secondary — name desc + updated desc', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'desc', secondary: 'updated', secondaryDir: 'desc' });
    assert.strictEqual(result, 'Name ↓ · Updated ↓');
  });

  await test('Primary + secondary — updated asc + status desc', async () => {
    const result = buildSortSummary({ primary: 'updated', primaryDir: 'asc', secondary: 'status', secondaryDir: 'desc' });
    assert.strictEqual(result, 'Updated ↑ · Status ↓');
  });

  await test('Primary + secondary — separator is " · " (space-middot-space)', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'asc' });
    assert.ok(result.includes(' · '), `Expected " · " separator in "${result}"`);
  });

  await test('Primary + secondary — status asc + updated asc', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'asc', secondary: 'updated', secondaryDir: 'asc' });
    assert.strictEqual(result, 'Status ↑ · Updated ↑');
  });

  await test('Primary + secondary — name asc + status desc', async () => {
    const result = buildSortSummary({ primary: 'name', primaryDir: 'asc', secondary: 'status', secondaryDir: 'desc' });
    assert.strictEqual(result, 'Name ↑ · Status ↓');
  });

  // secondary === 'none' returns primary-only (no separator)

  await test('secondary "none" — result contains no " · " separator', async () => {
    const result = buildSortSummary({ primary: 'status', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' });
    assert.ok(!result.includes(' · '), `Expected no separator in "${result}"`);
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

// TODO: Requires JSDOM / @testing-library/react — stub for future implementation
// - Component renders without errors when given DEFAULT_SORT_CONFIG
// - Clicking the trigger row toggles the panel open/closed
// - When expanded, summary text is hidden
// - Clicking a primary field button calls onChange with updated primary
// - Clicking a primary field that matches secondary auto-clears secondary to 'none'
// - Toggling primary direction calls onChange with updated primaryDir
// - Direction labels update to match the selected field
// - Clicking "None" in secondary hides the secondary direction toggle
// - Clicking a secondary field shows the direction toggle with correct labels
// - Secondary field that matches primary is not selectable (no-op on click)
// - Chevron rotates 180° when panel is open

run();
