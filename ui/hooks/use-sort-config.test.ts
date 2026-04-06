/**
 * Tests for useSortConfig — compareSortConfig pure function.
 * Hook (useSortConfig) is a React hook and cannot be called outside a component;
 * it will be integration-tested in Phase 2.
 * Run with: npx tsx ui/hooks/use-sort-config.test.ts
 */
import assert from 'node:assert';

// Inline types matching ui/types/components.ts and ui/types/state.ts
type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted' | 'not_initialized';
type PlanningStatus = 'not_started' | 'in_progress' | 'complete';
type ExecutionStatus = 'not_started' | 'in_progress' | 'complete' | 'halted';

interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
  planningStatus?: PlanningStatus;
  executionStatus?: ExecutionStatus;
  lastUpdated?: string;
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
  const { tier, planningStatus, executionStatus, hasMalformedState } = p;
  if (tier === "halted" || (tier === "execution" && executionStatus === "halted")) return 0;
  if (hasMalformedState) return 1;
  if (tier === "review") return 2;
  if (tier === "execution" && executionStatus === "in_progress") return 3;
  if (tier === "planning" && planningStatus === "in_progress") return 4;
  if (tier === "execution" && (executionStatus === "not_started" || executionStatus === undefined)) return 5;
  if (tier === "planning" && planningStatus === "complete") return 6;
  if (tier === "planning" && (planningStatus === "not_started" || planningStatus === undefined)) return 7;
  if (tier === "not_initialized") return 8;
  return 9;
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
    const result = a.name.localeCompare(b.name);
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
    tier: 'not_initialized',
    hasState: false,
    hasMalformedState: false,
    ...overrides,
  };
}

// One project per priority 0–9
const p0_halted       = makeProject('Halted',          { tier: 'halted' });
const p0b_halted_exec = makeProject('HaltedExec',      { tier: 'execution', executionStatus: 'halted' });
const p1_malformed    = makeProject('Malformed',       { tier: 'planning', hasMalformedState: true });
const p2_review       = makeProject('Review',          { tier: 'review' });
const p3_exec_active  = makeProject('ExecActive',      { tier: 'execution', executionStatus: 'in_progress' });
const p4_plan_active  = makeProject('PlanActive',      { tier: 'planning', planningStatus: 'in_progress' });
const p5_exec_queued  = makeProject('ExecQueued',      { tier: 'execution', executionStatus: 'not_started' });
const p6_plan_done    = makeProject('PlanDone',        { tier: 'planning', planningStatus: 'complete' });
const p7_plan_new     = makeProject('PlanNew',         { tier: 'planning', planningStatus: 'not_started' });
const p8_uninit       = makeProject('Uninit',          { tier: 'not_initialized' });
const p9_complete     = makeProject('Complete',        { tier: 'complete' });

const allPriorities = [p9_complete, p8_uninit, p7_plan_new, p6_plan_done, p5_exec_queued,
                       p4_plan_active, p3_exec_active, p2_review, p1_malformed, p0_halted];

// ─── Tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('use-sort-config — compareSortConfig');

  await test('Default sort equivalence — all 10 priority levels', async () => {
    const sorted = [...allPriorities].sort((a, b) => compareSortConfig(a, b, DEFAULT_SORT_CONFIG));
    const expected = [...allPriorities].sort(
      (a, b) => getStatusPriority(a) - getStatusPriority(b) || a.name.localeCompare(b.name)
    );
    assert.deepStrictEqual(
      sorted.map(p => p.name),
      expected.map(p => p.name),
      'Sort order does not match getStatusPriority + name tiebreaker'
    );
  });

  await test('Default sort equivalence — also covers halted-execution (priority 0b)', async () => {
    const fixtures = [...allPriorities, p0b_halted_exec];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, DEFAULT_SORT_CONFIG));
    const expected = [...fixtures].sort(
      (a, b) => getStatusPriority(a) - getStatusPriority(b) || a.name.localeCompare(b.name)
    );
    assert.deepStrictEqual(sorted.map(p => p.name), expected.map(p => p.name));
  });

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
    // Both are 'not_initialized' — same priority (8)
    const fixtures = [
      makeProject('Alpha', { tier: 'not_initialized' }),
      makeProject('Bravo', { tier: 'not_initialized' }),
      makeProject('Charlie', { tier: 'not_initialized' }),
    ];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    // With name desc, Z→A: Charlie, Bravo, Alpha
    assert.deepStrictEqual(sorted.map(p => p.name), ['Charlie', 'Bravo', 'Alpha']);
  });

  await test('Status descending — reverse priority order (complete first, halted last)', async () => {
    const config: SortConfig = { primary: 'status', primaryDir: 'desc', secondary: 'none', secondaryDir: 'asc' };
    const fixtures = [p0_halted, p3_exec_active, p6_plan_done, p9_complete, p2_review];
    const sorted = [...fixtures].sort((a, b) => compareSortConfig(a, b, config));
    // desc = highest priority number first  → 9, 6, 3, 2, 0
    assert.deepStrictEqual(
      sorted.map(p => p.name),
      [p9_complete, p6_plan_done, p3_exec_active, p2_review, p0_halted].map(p => p.name)
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
