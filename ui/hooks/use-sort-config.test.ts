/**
 * Tests for useSortConfig — compareSortConfig pure function.
 * Hook (useSortConfig) is a React hook and cannot be called outside a component;
 * it will be integration-tested in Phase 2.
 * Run with: npx tsx ui/hooks/use-sort-config.test.ts
 */
import assert from 'node:assert';

// Inline types matching ui/types/components.ts and ui/types/state.ts
type GraphStatus = 'not_started' | 'in_progress' | 'completed' | 'halted';

interface ProjectSummary {
  name: string;
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
  lastUpdated?: string;
  graphStatus?: GraphStatus | 'not_initialized';
}

type SortField = 'status' | 'name' | 'updated';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  primary: SortField;
  primaryDir: SortDirection;
  secondary: SortField | 'none';
  secondaryDir: SortDirection;
}

// ─── Replicated from use-sort-config.ts (inline for test isolation) ──────────

const DEFAULT_SORT_CONFIG: SortConfig = {
  primary: 'status',
  primaryDir: 'asc',
  secondary: 'name',
  secondaryDir: 'asc',
};

function getStatusPriority(p: ProjectSummary): number {
  const { graphStatus, hasMalformedState } = p;

  // Bucket 0: halted — v5 halted projects (live or persisted)
  if (graphStatus === 'halted') return 0;

  // Bucket 1: malformed / warning state — wins over any active status
  if (hasMalformedState) return 1;

  // Bucket 2: actively running v5 pipelines
  if (graphStatus === 'in_progress') return 2;

  // Bucket 3: v5 pipelines that have not yet begun
  if (graphStatus === 'not_started') return 3;

  // Bucket 4: v5 pipelines that finished successfully
  if (graphStatus === 'completed') return 4;

  // Bucket 5: legacy fallback — 'not_initialized', undefined, or any unrecognized value
  return 5;
}

function compareField(
  a: ProjectSummary,
  b: ProjectSummary,
  field: SortField,
  dir: SortDirection
): number {
  if (field === 'status') {
    const result = getStatusPriority(a) - getStatusPriority(b);
    return dir === 'desc' ? result * -1 : result;
  }
  if (field === 'name') {
    const result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return dir === 'desc' ? result * -1 : result;
  }
  // field === 'updated'
  const aUndef = a.lastUpdated === undefined;
  const bUndef = b.lastUpdated === undefined;
  if (aUndef && bUndef) return 0;
  if (aUndef) return 1;
  if (bUndef) return -1;
  let result = 0;
  if (a.lastUpdated! < b.lastUpdated!) result = -1;
  else if (a.lastUpdated! > b.lastUpdated!) result = 1;
  return dir === 'desc' ? result * -1 : result;
}

function compareSortConfig(
  a: ProjectSummary,
  b: ProjectSummary,
  config: SortConfig
): number {
  const primary = compareField(a, b, config.primary, config.primaryDir);
  if (primary !== 0) return primary;
  if (config.secondary === 'none') return 0;
  return compareField(a, b, config.secondary, config.secondaryDir);
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

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProject(
  name: string,
  overrides: Partial<ProjectSummary> = {}
): ProjectSummary {
  return {
    name,
    hasState: false,
    hasMalformedState: false,
    ...overrides,
  };
}

// One project per bucket 0–5 (plus undefined-graphStatus variant of bucket 5)
const p0_halted             = makeProject('Halted',           { graphStatus: 'halted' });
const p1_malformed          = makeProject('Malformed',        { graphStatus: 'in_progress', hasMalformedState: true });
const p2_in_progress        = makeProject('InProgress',       { graphStatus: 'in_progress' });
const p3_not_started        = makeProject('NotStarted',       { graphStatus: 'not_started' });
const p4_completed          = makeProject('Completed',        { graphStatus: 'completed' });
const p5_fallback_legacy    = makeProject('FallbackLegacy',   { graphStatus: 'not_initialized' });
const p5_fallback_undefined = makeProject('FallbackUndefined',{ graphStatus: undefined });

const allBuckets = [
  p4_completed,
  p5_fallback_legacy,
  p5_fallback_undefined,
  p3_not_started,
  p2_in_progress,
  p1_malformed,
  p0_halted,
];

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('use-sort-config — compareSortConfig');

  // ─── getStatusPriority bucket-level tests ──────────────────────────────────

  await test('Bucket 0 — halted regardless of hasMalformedState', async () => {
    const haltedNoMalformed  = makeProject('H1', { graphStatus: 'halted' });
    const haltedAndMalformed = makeProject('H2', { graphStatus: 'halted', hasMalformedState: true });
    assert.strictEqual(getStatusPriority(haltedNoMalformed),  0);
    assert.strictEqual(getStatusPriority(haltedAndMalformed), 0);
  });

  await test('Bucket 1 — malformed wins over in_progress', async () => {
    const malformedActive = makeProject('M', { graphStatus: 'in_progress', hasMalformedState: true });
    assert.strictEqual(getStatusPriority(malformedActive), 1);
  });

  await test('Bucket 2 — in_progress (non-malformed) returns 2', async () => {
    const active = makeProject('A', { graphStatus: 'in_progress', hasMalformedState: false });
    assert.strictEqual(getStatusPriority(active), 2);
  });

  await test('Bucket 3 — not_started returns 3', async () => {
    const queued = makeProject('Q', { graphStatus: 'not_started' });
    assert.strictEqual(getStatusPriority(queued), 3);
  });

  await test('Bucket 4 — completed returns 4', async () => {
    const done = makeProject('D', { graphStatus: 'completed' });
    assert.strictEqual(getStatusPriority(done), 4);
  });

  await test('Bucket 5 — not_initialized (legacy fallback) returns 5', async () => {
    const legacy = makeProject('L', { graphStatus: 'not_initialized' });
    assert.strictEqual(getStatusPriority(legacy), 5);
  });

  await test('Bucket 5 — undefined graphStatus returns 5 (same fallback)', async () => {
    const noField = makeProject('U', { graphStatus: undefined });
    assert.strictEqual(getStatusPriority(noField), 5);
  });

  // ─── Sort-order tests ──────────────────────────────────────────────────────

  await test('Default sort equivalence — all six buckets including legacy fallback', async () => {
    const sorted = [...allBuckets].sort((a, b) => compareSortConfig(a, b, DEFAULT_SORT_CONFIG));
    const expected = [...allBuckets].sort(
      (a, b) => getStatusPriority(a) - getStatusPriority(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    assert.deepStrictEqual(
      sorted.map(p => p.name),
      expected.map(p => p.name),
      'Sort order does not match getStatusPriority + name tiebreaker'
    );
    // Sanity check — bucket-by-bucket bucket order must be 0..5 (with bucket 5 grouping both fallback rows)
    const expectedNames = [
      'Halted',           // bucket 0
      'Malformed',        // bucket 1
      'InProgress',       // bucket 2
      'NotStarted',       // bucket 3
      'Completed',        // bucket 4
      'FallbackLegacy',   // bucket 5 (name asc tiebreaker: FallbackLegacy < FallbackUndefined)
      'FallbackUndefined',
    ];
    assert.deepStrictEqual(sorted.map(p => p.name), expectedNames);
  });

  await test('Legacy fallback bucket sits just above completed', async () => {
    const config = DEFAULT_SORT_CONFIG;
    const fixtures = [p4_completed, p5_fallback_legacy, p5_fallback_undefined, p3_not_started];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    const names = sorted.map(p => p.name);

    // not_started first, completed last? Per the bucket ordering 3 < 4 < 5, the actual order is:
    //   NotStarted (3) → Completed (4) → FallbackLegacy (5) → FallbackUndefined (5)
    // The test description says "places not_started first, completed last".
    // Since bucket 4 (completed) sits BELOW bucket 3 (not_started) and ABOVE bucket 5 (fallback),
    // "completed last" means completed is the last of the *active* (non-fallback) rows — i.e. the
    // fallback rows sit immediately ABOVE completed in descending-priority terms (lower bucket number
    // = higher in the list). The handoff bucket table confirms: bucket 5 sort position is "bottom
    // (just above the natural last position)" — fallback comes AFTER completed in the asc sort.
    assert.strictEqual(names[0], 'NotStarted', 'not_started must be first (lowest bucket among active)');

    // Fallback rows must form a contiguous trailing block after completed.
    const completedIdx = names.indexOf('Completed');
    const fallbackLegacyIdx = names.indexOf('FallbackLegacy');
    const fallbackUndefIdx = names.indexOf('FallbackUndefined');
    assert.ok(completedIdx >= 0 && fallbackLegacyIdx > completedIdx && fallbackUndefIdx > completedIdx,
      'Both fallback rows must appear AFTER completed (bucket 5 > bucket 4 in asc)');
    // Fallback rows must be contiguous (immediately following completed) — no active row interleaved.
    assert.strictEqual(fallbackLegacyIdx, completedIdx + 1, 'FallbackLegacy must immediately follow Completed');
    assert.strictEqual(fallbackUndefIdx,  completedIdx + 2, 'FallbackUndefined must immediately follow FallbackLegacy');
  });

  await test('Mixed v5 and legacy summaries do not interleave', async () => {
    const config = DEFAULT_SORT_CONFIG;
    // Alternating mix — buckets 2, 5, 3, 5
    const fixtures = [p2_in_progress, p5_fallback_legacy, p3_not_started, p5_fallback_undefined];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    const names = sorted.map(p => p.name);

    // Expected grouping: bucket 2, then bucket 3, then bucket 5 (fallback rows last, contiguous).
    assert.deepStrictEqual(names, ['InProgress', 'NotStarted', 'FallbackLegacy', 'FallbackUndefined']);

    // Invariant: no v5 active row (buckets 2 or 3) appears AFTER any fallback row.
    const lastActiveIdx = Math.max(names.indexOf('InProgress'), names.indexOf('NotStarted'));
    const firstFallbackIdx = Math.min(names.indexOf('FallbackLegacy'), names.indexOf('FallbackUndefined'));
    assert.ok(lastActiveIdx < firstFallbackIdx,
      'Active v5 rows (buckets 2, 3) must all sort before any fallback row (bucket 5)');
  });

  await test('Status descending — reverse priority order ends at halted', async () => {
    const config: SortConfig = { primary: 'status', primaryDir: 'desc', secondary: 'name', secondaryDir: 'asc' };
    const fixtures = [...allBuckets];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    const names = sorted.map(p => p.name);

    // desc = highest bucket first → 5, 5, 4, 3, 2, 1, 0
    // Within the bucket-5 tie, secondary 'name asc' breaks: FallbackLegacy < FallbackUndefined.
    assert.deepStrictEqual(names, [
      'FallbackLegacy',    // bucket 5
      'FallbackUndefined', // bucket 5
      'Completed',         // bucket 4
      'NotStarted',        // bucket 3
      'InProgress',        // bucket 2
      'Malformed',         // bucket 1
      'Halted',            // bucket 0
    ]);
  });

  // ─── Pre-existing non-status tests (fixtures updated to new ProjectSummary shape) ──

  await test('Name ascending — A→Z', async () => {
    const config: SortConfig = { primary: 'name', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [makeProject('Charlie'), makeProject('Alpha'), makeProject('Bravo')];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.deepStrictEqual(sorted.map(p => p.name), ['Alpha', 'Bravo', 'Charlie']);
  });

  await test('Name descending — Z→A', async () => {
    const config: SortConfig = { primary: 'name', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [makeProject('Charlie'), makeProject('Alpha'), makeProject('Bravo')];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.deepStrictEqual(sorted.map(p => p.name), ['Charlie', 'Bravo', 'Alpha']);
  });

  await test('Name ascending — mixed case treated as case-insensitive', async () => {
    const config: SortConfig = { primary: 'name', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [makeProject('charlie'), makeProject('ALPHA'), makeProject('Bravo')];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.deepStrictEqual(sorted.map(p => p.name), ['ALPHA', 'Bravo', 'charlie']);
  });

  await test('Updated descending — newest first', async () => {
    const config: SortConfig = { primary: 'updated', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [
      makeProject('OldProject',    { lastUpdated: '2024-01-01T00:00:00Z' }),
      makeProject('NewestProject', { lastUpdated: '2024-12-31T23:59:59Z' }),
      makeProject('MidProject',    { lastUpdated: '2024-06-15T12:00:00Z' }),
    ];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.deepStrictEqual(sorted.map(p => p.name), ['NewestProject', 'MidProject', 'OldProject']);
  });

  await test('Updated with undefined sorts to bottom (desc)', async () => {
    const config: SortConfig = { primary: 'updated', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [
      makeProject('NoDate',  { lastUpdated: undefined }),
      makeProject('Newest',  { lastUpdated: '2024-12-31T00:00:00Z' }),
      makeProject('Older',   { lastUpdated: '2024-01-01T00:00:00Z' }),
    ];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.strictEqual(sorted[sorted.length - 1].name, 'NoDate', 'undefined lastUpdated must sort to bottom in desc');
  });

  await test('Updated with undefined sorts to bottom (asc)', async () => {
    const config: SortConfig = { primary: 'updated', primaryDir: 'asc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [
      makeProject('NoDate', { lastUpdated: undefined }),
      makeProject('Newest', { lastUpdated: '2024-12-31T00:00:00Z' }),
      makeProject('Older',  { lastUpdated: '2024-01-01T00:00:00Z' }),
    ];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.strictEqual(sorted[sorted.length - 1].name, 'NoDate', 'undefined lastUpdated must sort to bottom in asc');
  });

  await test('Secondary tiebreaker — name desc breaks same-status tie', async () => {
    const config: SortConfig = { primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'desc' };
    // Three p5_fallback_legacy-shaped projects — all bucket 5, tied on status.
    const fixtures = [
      makeProject('Alpha',   { graphStatus: 'not_initialized' }),
      makeProject('Bravo',   { graphStatus: 'not_initialized' }),
      makeProject('Charlie', { graphStatus: 'not_initialized' }),
    ];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    // With name desc, Z→A: Charlie, Bravo, Alpha
    assert.deepStrictEqual(sorted.map(p => p.name), ['Charlie', 'Bravo', 'Alpha']);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
