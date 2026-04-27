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
  tier?: 'planning' | 'execution' | 'review' | 'complete' | 'halted' | 'not_initialized';
  planningStatus?: 'not_started' | 'in_progress' | 'complete';
  executionStatus?: 'not_started' | 'in_progress' | 'complete' | 'halted';
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

// FR-14 / AD-4 — Urgent-first priority map keyed off the same four fields
// the row badge reads (`tier`, `planningStatus`, `executionStatus`,
// `hasMalformedState`). Lower number = higher urgency = floats to top in
// `asc` ('Urgent first') direction. Slot 9 is the bottom (Not Initialized
// and any unrecognized combination — see AD-4 final clause).
const STATUS_PRIORITY_URGENT_FIRST = {
  halted: 0,
  malformed: 1,
  executing: 2,
  approved: 3,
  finalReview: 4,   // AD-5 — between Approved and Planning
  planning: 5,
  planned: 6,
  notStarted: 7,
  complete: 8,
  notInitialized: 9,
} as const;

// FR-15 / AD-4 — Done-first priority map. NOT a literal `priority * -1` of
// STATUS_PRIORITY_URGENT_FIRST: that would flip notInitialized to the top,
// contradicting the "pinned bottom in both directions" invariant. Built as
// an explicit lookup so the bottom-pin survives.
const STATUS_PRIORITY_DONE_FIRST = {
  complete: 0,
  notStarted: 1,
  planned: 2,
  planning: 3,
  finalReview: 4,
  approved: 5,
  executing: 6,
  malformed: 7,
  halted: 8,
  notInitialized: 9,   // FR-15 — still bottom
} as const;

type StatusBucket = keyof typeof STATUS_PRIORITY_URGENT_FIRST;

function classifyStatus(p: ProjectSummary): StatusBucket {
  const { tier, planningStatus, executionStatus, hasMalformedState } = p;

  // tier === 'execution' AND executionStatus === 'halted' renders as Halted
  // in the badge; same source-of-truth for sort.
  if (tier === 'halted' || executionStatus === 'halted') return 'halted';
  if (hasMalformedState) return 'malformed';

  if (tier === 'execution') {
    if (executionStatus === 'in_progress') return 'executing';
    // not_started | complete | undefined → Approved badge
    return 'approved';
  }

  if (tier === 'review') return 'finalReview';

  if (tier === 'planning') {
    if (planningStatus === 'in_progress') return 'planning';
    if (planningStatus === 'complete') return 'planned';
    if (planningStatus === undefined) return 'planning';  // FR-14 — v4 backward-compat: badge renders "Planning" for undefined planningStatus
    return 'notStarted';                                  // planningStatus === 'not_started' — badge renders "Not Started"
  }

  if (tier === 'complete') return 'complete';

  // tier === 'not_initialized' or any unrecognized combination — pin to bottom.
  return 'notInitialized';
}

function getStatusPriority(p: ProjectSummary): number {
  return STATUS_PRIORITY_URGENT_FIRST[classifyStatus(p)];
}

function compareField(
  a: ProjectSummary,
  b: ProjectSummary,
  field: SortField,
  dir: SortDirection
): number {
  if (field === 'status') {
    const aBucket = classifyStatus(a);
    const bBucket = classifyStatus(b);
    const map = dir === 'desc' ? STATUS_PRIORITY_DONE_FIRST : STATUS_PRIORITY_URGENT_FIRST;
    return map[aBucket] - map[bBucket];
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

// Fixtures migrated from graphStatus to tier/planningStatus/executionStatus equivalents
const p0_halted             = makeProject('Halted',           { tier: 'execution', executionStatus: 'halted' });
const p1_malformed          = makeProject('Malformed',        { tier: 'execution', executionStatus: 'in_progress', hasMalformedState: true });
const p2_in_progress        = makeProject('InProgress',       { tier: 'execution', executionStatus: 'in_progress' });
const p3_not_started        = makeProject('NotStarted',       { tier: 'planning', planningStatus: 'not_started' });
const p4_completed          = makeProject('Completed',        { tier: 'complete' });
const p5_fallback_legacy    = makeProject('FallbackLegacy',   { tier: 'not_initialized' });
const p5_fallback_undefined = makeProject('FallbackUndefined',{ tier: undefined });

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

  // ─── getStatusPriority slot-level tests ───────────────────────────────────

  await test('Slot 0 — halted regardless of hasMalformedState', async () => {
    const haltedNoMalformed  = makeProject('H1', { tier: 'execution', executionStatus: 'halted' });
    const haltedAndMalformed = makeProject('H2', { tier: 'execution', executionStatus: 'halted', hasMalformedState: true });
    assert.strictEqual(getStatusPriority(haltedNoMalformed),  0);
    assert.strictEqual(getStatusPriority(haltedAndMalformed), 0);
  });

  await test('Slot 1 — malformed wins over in_progress', async () => {
    const malformedActive = makeProject('M', { tier: 'execution', executionStatus: 'in_progress', hasMalformedState: true });
    assert.strictEqual(getStatusPriority(malformedActive), 1);
  });

  await test('Slot 2 — executing (non-malformed) returns 2', async () => {
    const active = makeProject('A', { tier: 'execution', executionStatus: 'in_progress', hasMalformedState: false });
    assert.strictEqual(getStatusPriority(active), 2);
  });

  await test('Slot 7 — not_started (planning tier) returns 7', async () => {
    const queued = makeProject('Q', { tier: 'planning', planningStatus: 'not_started' });
    assert.strictEqual(getStatusPriority(queued), 7);
  });

  await test('Slot 8 — complete returns 8', async () => {
    const done = makeProject('D', { tier: 'complete' });
    assert.strictEqual(getStatusPriority(done), 8);
  });

  await test('Slot 9 — not_initialized (legacy fallback) returns 9', async () => {
    const legacy = makeProject('L', { tier: 'not_initialized' });
    assert.strictEqual(getStatusPriority(legacy), 9);
  });

  await test('Slot 9 — undefined tier returns 9 (same fallback)', async () => {
    const noField = makeProject('U', { tier: undefined });
    assert.strictEqual(getStatusPriority(noField), 9);
  });

  // ─── Sort-order tests ──────────────────────────────────────────────────────

  await test('Default sort equivalence — all slots including legacy fallback', async () => {
    const sorted = [...allBuckets].sort((a, b) => compareSortConfig(a, b, DEFAULT_SORT_CONFIG));
    const expected = [...allBuckets].sort(
      (a, b) => getStatusPriority(a) - getStatusPriority(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    assert.deepStrictEqual(
      sorted.map(p => p.name),
      expected.map(p => p.name),
      'Sort order does not match getStatusPriority + name tiebreaker'
    );
    // Sanity check — slot order must be 0, 1, 2, 7, 8, 9, 9
    // (with slot 9 grouping both fallback rows)
    const expectedNames = [
      'Halted',           // slot 0
      'Malformed',        // slot 1
      'InProgress',       // slot 2
      'NotStarted',       // slot 7
      'Completed',        // slot 8
      'FallbackLegacy',   // slot 9 (name asc tiebreaker: FallbackLegacy < FallbackUndefined)
      'FallbackUndefined',
    ];
    assert.deepStrictEqual(sorted.map(p => p.name), expectedNames);
  });

  await test('Legacy fallback slot sits just above completed', async () => {
    const config = DEFAULT_SORT_CONFIG;
    const fixtures = [p4_completed, p5_fallback_legacy, p5_fallback_undefined, p3_not_started];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    const names = sorted.map(p => p.name);

    // Slot ordering: not_started (7) → completed (8) → fallback (9, 9)
    assert.strictEqual(names[0], 'NotStarted', 'not_started must be first (lowest slot among these)');

    // Fallback rows must form a contiguous trailing block after completed.
    const completedIdx = names.indexOf('Completed');
    const fallbackLegacyIdx = names.indexOf('FallbackLegacy');
    const fallbackUndefIdx = names.indexOf('FallbackUndefined');
    assert.ok(completedIdx >= 0 && fallbackLegacyIdx > completedIdx && fallbackUndefIdx > completedIdx,
      'Both fallback rows must appear AFTER completed (slot 9 > slot 8 in asc)');
    // Fallback rows must be contiguous (immediately following completed) — no active row interleaved.
    assert.strictEqual(fallbackLegacyIdx, completedIdx + 1, 'FallbackLegacy must immediately follow Completed');
    assert.strictEqual(fallbackUndefIdx,  completedIdx + 2, 'FallbackUndefined must immediately follow FallbackLegacy');
  });

  await test('Mixed v5 and legacy summaries do not interleave', async () => {
    const config = DEFAULT_SORT_CONFIG;
    // Alternating mix — slots 2, 9, 7, 9
    const fixtures = [p2_in_progress, p5_fallback_legacy, p3_not_started, p5_fallback_undefined];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    const names = sorted.map(p => p.name);

    // Expected grouping: slot 2, then slot 7, then slot 9 (fallback rows last, contiguous).
    assert.deepStrictEqual(names, ['InProgress', 'NotStarted', 'FallbackLegacy', 'FallbackUndefined']);

    // Invariant: no v5 active row (slots 2 or 7) appears AFTER any fallback row.
    const lastActiveIdx = Math.max(names.indexOf('InProgress'), names.indexOf('NotStarted'));
    const firstFallbackIdx = Math.min(names.indexOf('FallbackLegacy'), names.indexOf('FallbackUndefined'));
    assert.ok(lastActiveIdx < firstFallbackIdx,
      'Active v5 rows (slots 2, 7) must all sort before any fallback row (slot 9)');
  });

  await test('Status descending — Done first order, Not Initialized pinned bottom', async () => {
    const config: SortConfig = { primary: 'status', primaryDir: 'desc', secondary: 'name', secondaryDir: 'asc' };
    const fixtures = [...allBuckets];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    const names = sorted.map(p => p.name);

    // desc uses DONE_FIRST map: complete(0) → notStarted(1) → executing(6) → malformed(7) → halted(8) → notInitialized(9,9)
    // Within the slot-9 tie, secondary 'name asc' breaks: FallbackLegacy < FallbackUndefined.
    assert.deepStrictEqual(names, [
      'Completed',         // slot 0 (DONE_FIRST: complete=0)
      'NotStarted',        // slot 1 (DONE_FIRST: notStarted=1)
      'InProgress',        // slot 6 (DONE_FIRST: executing=6)
      'Malformed',         // slot 7 (DONE_FIRST: malformed=7)
      'Halted',            // slot 8 (DONE_FIRST: halted=8)
      'FallbackLegacy',    // slot 9 — FR-15 pinned bottom
      'FallbackUndefined', // slot 9 — FR-15 pinned bottom
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
    // Three not_initialized projects — all slot 9, tied on status.
    const fixtures = [
      makeProject('Alpha',   { tier: 'not_initialized' }),
      makeProject('Bravo',   { tier: 'not_initialized' }),
      makeProject('Charlie', { tier: 'not_initialized' }),
    ];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    // With name desc, Z→A: Charlie, Bravo, Alpha
    assert.deepStrictEqual(sorted.map(p => p.name), ['Charlie', 'Bravo', 'Alpha']);
  });

  // ─── FR-14 — 9-slot urgency map matches visible badges ───────────────────

  const fxHalted        = makeProject('Halted',        { tier: 'execution', executionStatus: 'halted' });
  const fxMalformed     = makeProject('Malformed',     { tier: 'execution', hasMalformedState: true, executionStatus: 'in_progress' });
  const fxExecuting     = makeProject('Executing',     { tier: 'execution', executionStatus: 'in_progress' });
  const fxApproved      = makeProject('Approved',      { tier: 'execution', executionStatus: 'not_started' });
  const fxFinalReview   = makeProject('FinalReview',   { tier: 'review' });
  const fxPlanning      = makeProject('Planning',      { tier: 'planning', planningStatus: 'in_progress' });
  const fxPlanned       = makeProject('Planned',       { tier: 'planning', planningStatus: 'complete' });
  const fxNotStarted    = makeProject('NotStarted',    { tier: 'planning', planningStatus: 'not_started' });
  const fxComplete      = makeProject('Complete',      { tier: 'complete' });
  const fxNotInitialized = makeProject('NotInitialized',{ tier: 'not_initialized' });

  await test('FR-14 — Urgent first order matches visible badges', async () => {
    const config: SortConfig = { primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'asc' };
    const fixtures = [fxComplete, fxNotStarted, fxPlanned, fxPlanning, fxFinalReview, fxApproved, fxExecuting, fxMalformed, fxHalted, fxNotInitialized];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.deepStrictEqual(sorted.map((p) => p.name), [
      'Halted', 'Malformed', 'Executing', 'Approved', 'FinalReview',
      'Planning', 'Planned', 'NotStarted', 'Complete', 'NotInitialized',
    ]);
  });

  await test('FR-14 — badge classification reads tier+planningStatus (Planning vs Planned)', async () => {
    // Two planning rows that differ only in planningStatus must sort distinctly.
    assert.notStrictEqual(getStatusPriority(fxPlanning), getStatusPriority(fxPlanned));
    // Planning (in_progress) is more urgent than Planned (complete planning, awaiting plan-approval gate)
    assert.ok(getStatusPriority(fxPlanning) < getStatusPriority(fxPlanned));
  });

  await test('AD-5 — Final Review sits between Approved and Planning', async () => {
    assert.ok(getStatusPriority(fxApproved) < getStatusPriority(fxFinalReview));
    assert.ok(getStatusPriority(fxFinalReview) < getStatusPriority(fxPlanning));
  });

  await test('FR-15 — Done first reverses through active states with Not Initialized pinned bottom', async () => {
    const config: SortConfig = { primary: 'status', primaryDir: 'desc', secondary: 'name', secondaryDir: 'asc' };
    const fixtures = [fxComplete, fxNotStarted, fxPlanned, fxPlanning, fxFinalReview, fxApproved, fxExecuting, fxMalformed, fxHalted, fxNotInitialized];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    assert.deepStrictEqual(sorted.map((p) => p.name), [
      'Complete', 'NotStarted', 'Planned', 'Planning', 'FinalReview',
      'Approved', 'Executing', 'Malformed', 'Halted',
      'NotInitialized',  // FR-15 — pinned bottom in desc direction too
    ]);
  });

  await test('FR-15 — Not Initialized pinned bottom in BOTH directions', async () => {
    const ascConfig:  SortConfig = { primary: 'status', primaryDir: 'asc',  secondary: 'name', secondaryDir: 'asc' };
    const descConfig: SortConfig = { primary: 'status', primaryDir: 'desc', secondary: 'name', secondaryDir: 'asc' };
    const fixtures = [fxNotInitialized, fxExecuting, fxComplete, fxHalted];
    const ascSorted  = [...fixtures].sort((a, b) => compareSortConfig(a, b, ascConfig));
    const descSorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, descConfig));
    assert.strictEqual(ascSorted[ascSorted.length - 1].name,   'NotInitialized', 'asc: NotInitialized must be last');
    assert.strictEqual(descSorted[descSorted.length - 1].name, 'NotInitialized', 'desc: NotInitialized must be last');
  });

  await test('FR-14 — tier=planning with undefined planningStatus aligns with badge "Planning" (slot 5, not slot 7)', async () => {
    const fxPlanningUndef = makeProject('p_undef', { name: 'p_undef', tier: 'planning', planningStatus: undefined, executionStatus: undefined, hasMalformedState: false });
    const fxNotStarted = makeProject('p_ns', { name: 'p_ns', tier: 'planning', planningStatus: 'not_started', executionStatus: undefined, hasMalformedState: false });
    const fxPlanned = makeProject('p_done', { name: 'p_done', tier: 'planning', planningStatus: 'complete', executionStatus: undefined, hasMalformedState: false });

    // The backward-compat undefined-planningStatus row must sort with the in_progress
    // 'Planning' badge cluster (slot 5), not the 'Not Started' cluster (slot 7).
    assert.strictEqual(getStatusPriority(fxPlanningUndef), 5);
    assert.strictEqual(getStatusPriority(fxNotStarted), 7);
    assert.strictEqual(getStatusPriority(fxPlanned), 6);

    // And that the row sorts in front of an explicit not_started row in Urgent-first.
    const sorted = [fxNotStarted, fxPlanned, fxPlanningUndef].sort(
      (a, b) => compareSortConfig(a, b, { primary: 'status', primaryDir: 'asc', secondary: 'name', secondaryDir: 'asc' })
    );
    assert.deepStrictEqual(sorted.map(p => p.name), ['p_undef', 'p_done', 'p_ns']);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
