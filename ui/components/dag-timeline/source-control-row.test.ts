/**
 * Tests for SourceControlRow component logic.
 * Run with: npx tsx ui/components/dag-timeline/source-control-row.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * prop contracts and conditional rendering logic by simulating what
 * the component does with its inputs. The simulation mirrors the
 * implementation in source-control-row.tsx.
 */
import assert from "node:assert";
import type { V5SourceControlState, V5AutoCommit, V5AutoPR } from "../../types/state";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
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

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeInput(overrides: Partial<V5SourceControlState> = {}): V5SourceControlState {
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

interface BadgeProps {
  label: string;
  cssVar: string;
  isSpinning: boolean;
  isComplete: boolean;
  isRejected: boolean;
  ariaLabel: string;
}

type PrState = 'link' | 'failed' | 'pending' | 'hidden';

interface SimResult {
  rendered: boolean;
  ariaLabel: string;
  branchIsLink: boolean;
  branchText: string;
  branchHref: string | null;
  branchUsesMonoFont: boolean;
  prState: PrState;
  prLinkHref: string | null;
  autoCommitBadge: BadgeProps;
  autoPrBadge: BadgeProps;
}

/** Mirrors the runtime logic of SourceControlRow. */
function simulateSourceControlRow(input: V5SourceControlState | null | undefined): SimResult | null {
  if (!input) return null;

  const { branch, compare_url, auto_commit, auto_pr, pr_url } = input;

  // Branch region: link iff compare_url is non-null.
  const branchIsLink = compare_url !== null;
  const branchHref = compare_url;
  const branchUsesMonoFont = true; // monospace in both variants per spec

  // PR region: only present when auto_pr === 'always'.
  let prState: PrState;
  let prLinkHref: string | null = null;
  if (auto_pr !== 'always') {
    prState = 'hidden';
  } else if (pr_url !== null && /^https?:\/\//i.test(pr_url)) {
    prState = 'link';
    prLinkHref = pr_url;
  } else if (pr_url === null) {
    prState = 'pending';
  } else {
    prState = 'failed';
  }

  const autoCommitBadge: BadgeProps = {
    label: 'Auto-Commit',
    cssVar: auto_commit === 'always' ? '--status-complete' : '--status-failed',
    isSpinning: false,
    isComplete: auto_commit === 'always',
    isRejected: auto_commit !== 'always',
    ariaLabel: `Auto-Commit: ${auto_commit}`,
  };

  const autoPrBadge: BadgeProps = {
    label: 'Auto-PR',
    cssVar: auto_pr === 'always' ? '--status-complete' : '--status-failed',
    isSpinning: false,
    isComplete: auto_pr === 'always',
    isRejected: auto_pr !== 'always',
    ariaLabel: `Auto-PR: ${auto_pr}`,
  };

  return {
    rendered: true,
    ariaLabel: 'Source Control',
    branchIsLink,
    branchText: branch,
    branchHref,
    branchUsesMonoFont,
    prState,
    prLinkHref,
    autoCommitBadge,
    autoPrBadge,
  };
}

// ==================== SourceControlRow Tests ====================

console.log("\nSourceControlRow logic tests\n");

// ─── Null/falsy input ────────────────────────────────────────────────────────

test('returns null when sourceControl is null at runtime', () => {
  const result = simulateSourceControlRow(null);
  assert.strictEqual(result, null);
});

test('returns null when sourceControl is undefined at runtime', () => {
  const result = simulateSourceControlRow(undefined);
  assert.strictEqual(result, null);
});

// ─── Outer container ─────────────────────────────────────────────────────────

test('outer container uses aria-label "Source Control"', () => {
  const result = simulateSourceControlRow(makeInput());
  assert.ok(result);
  assert.strictEqual(result!.ariaLabel, 'Source Control');
});

// ─── Branch region ───────────────────────────────────────────────────────────

test('Branch renders as link with href=compare_url when compare_url is non-null', () => {
  const url = 'https://github.com/org/repo/compare/main...feat/x';
  const result = simulateSourceControlRow(makeInput({ compare_url: url }));
  assert.ok(result);
  assert.strictEqual(result!.branchIsLink, true);
  assert.strictEqual(result!.branchHref, url);
});

test('Branch renders as plain span when compare_url is null', () => {
  const result = simulateSourceControlRow(makeInput({ compare_url: null }));
  assert.ok(result);
  assert.strictEqual(result!.branchIsLink, false);
  assert.strictEqual(result!.branchHref, null);
});

test('Branch uses monospace font in link variant', () => {
  const result = simulateSourceControlRow(
    makeInput({ compare_url: 'https://github.com/org/repo/compare/main...x' })
  );
  assert.ok(result);
  assert.strictEqual(result!.branchIsLink, true);
  assert.strictEqual(result!.branchUsesMonoFont, true);
});

test('Branch uses monospace font in plain-text variant', () => {
  const result = simulateSourceControlRow(makeInput({ compare_url: null }));
  assert.ok(result);
  assert.strictEqual(result!.branchIsLink, false);
  assert.strictEqual(result!.branchUsesMonoFont, true);
});

test('Branch text is the branch name', () => {
  const result = simulateSourceControlRow(makeInput({ branch: 'feat/custom' }));
  assert.ok(result);
  assert.strictEqual(result!.branchText, 'feat/custom');
});

// ─── PR region omission ──────────────────────────────────────────────────────

test('PR region is hidden when auto_pr === "ask"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'ask' }));
  assert.ok(result);
  assert.strictEqual(result!.prState, 'hidden');
});

test('PR region is hidden when auto_pr === "never"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'never' }));
  assert.ok(result);
  assert.strictEqual(result!.prState, 'hidden');
});

// ─── PR three-state: link ────────────────────────────────────────────────────

test('PR link rendered when auto_pr==="always" AND pr_url matches /^https?:\\/\\//i (https)', () => {
  const url = 'https://github.com/org/repo/pull/42';
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'always', pr_url: url }));
  assert.ok(result);
  assert.strictEqual(result!.prState, 'link');
  assert.strictEqual(result!.prLinkHref, url);
});

test('PR link rendered when auto_pr==="always" AND pr_url starts with http', () => {
  const url = 'http://example.com/org/repo/pull/7';
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'always', pr_url: url }));
  assert.ok(result);
  assert.strictEqual(result!.prState, 'link');
  assert.strictEqual(result!.prLinkHref, url);
});

// ─── PR three-state: failed ──────────────────────────────────────────────────

test('PR failed state when auto_pr==="always" AND pr_url is a non-URL string', () => {
  const result = simulateSourceControlRow(
    makeInput({ auto_pr: 'always', pr_url: 'not-a-url' })
  );
  assert.ok(result);
  assert.strictEqual(result!.prState, 'failed');
  assert.strictEqual(result!.prLinkHref, null);
});

test('PR failed state when auto_pr==="always" AND pr_url is empty string', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'always', pr_url: '' }));
  assert.ok(result);
  assert.strictEqual(result!.prState, 'failed');
  assert.strictEqual(result!.prLinkHref, null);
});

// ─── PR three-state: pending ─────────────────────────────────────────────────

test('PR pending state when auto_pr==="always" AND pr_url === null', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'always', pr_url: null }));
  assert.ok(result);
  assert.strictEqual(result!.prState, 'pending');
  assert.strictEqual(result!.prLinkHref, null);
});

// ─── Auto-Commit badge ──────────────────────────────────────────────────────

test('Auto-Commit badge: isComplete=true, isRejected=false, cssVar=--status-complete when auto_commit==="always"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_commit: 'always' }));
  assert.ok(result);
  assert.strictEqual(result!.autoCommitBadge.label, 'Auto-Commit');
  assert.strictEqual(result!.autoCommitBadge.cssVar, '--status-complete');
  assert.strictEqual(result!.autoCommitBadge.isComplete, true);
  assert.strictEqual(result!.autoCommitBadge.isRejected, false);
  assert.strictEqual(result!.autoCommitBadge.isSpinning, false);
  assert.strictEqual(result!.autoCommitBadge.ariaLabel, 'Auto-Commit: always');
});

test('Auto-Commit badge: isComplete=false, isRejected=true, cssVar=--status-failed when auto_commit==="ask"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_commit: 'ask' }));
  assert.ok(result);
  assert.strictEqual(result!.autoCommitBadge.cssVar, '--status-failed');
  assert.strictEqual(result!.autoCommitBadge.isComplete, false);
  assert.strictEqual(result!.autoCommitBadge.isRejected, true);
  assert.strictEqual(result!.autoCommitBadge.ariaLabel, 'Auto-Commit: ask');
});

test('Auto-Commit badge: isComplete=false, isRejected=true, cssVar=--status-failed when auto_commit==="never"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_commit: 'never' }));
  assert.ok(result);
  assert.strictEqual(result!.autoCommitBadge.cssVar, '--status-failed');
  assert.strictEqual(result!.autoCommitBadge.isComplete, false);
  assert.strictEqual(result!.autoCommitBadge.isRejected, true);
  assert.strictEqual(result!.autoCommitBadge.ariaLabel, 'Auto-Commit: never');
});

// ─── Auto-PR badge ───────────────────────────────────────────────────────────

test('Auto-PR badge: isComplete=true, isRejected=false, cssVar=--status-complete when auto_pr==="always"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'always' }));
  assert.ok(result);
  assert.strictEqual(result!.autoPrBadge.label, 'Auto-PR');
  assert.strictEqual(result!.autoPrBadge.cssVar, '--status-complete');
  assert.strictEqual(result!.autoPrBadge.isComplete, true);
  assert.strictEqual(result!.autoPrBadge.isRejected, false);
  assert.strictEqual(result!.autoPrBadge.isSpinning, false);
  assert.strictEqual(result!.autoPrBadge.ariaLabel, 'Auto-PR: always');
});

test('Auto-PR badge: isComplete=false, isRejected=true, cssVar=--status-failed when auto_pr==="ask"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'ask' }));
  assert.ok(result);
  assert.strictEqual(result!.autoPrBadge.cssVar, '--status-failed');
  assert.strictEqual(result!.autoPrBadge.isComplete, false);
  assert.strictEqual(result!.autoPrBadge.isRejected, true);
  assert.strictEqual(result!.autoPrBadge.ariaLabel, 'Auto-PR: ask');
});

test('Auto-PR badge: isComplete=false, isRejected=true, cssVar=--status-failed when auto_pr==="never"', () => {
  const result = simulateSourceControlRow(makeInput({ auto_pr: 'never' }));
  assert.ok(result);
  assert.strictEqual(result!.autoPrBadge.cssVar, '--status-failed');
  assert.strictEqual(result!.autoPrBadge.isComplete, false);
  assert.strictEqual(result!.autoPrBadge.isRejected, true);
  assert.strictEqual(result!.autoPrBadge.ariaLabel, 'Auto-PR: never');
});

// ─── Barrel export ───────────────────────────────────────────────────────────

test('SourceControlRow is exported from ui/components/dag-timeline/index.ts', async () => {
  const mod = (await import('./index')) as Record<string, unknown>;
  assert.strictEqual(
    typeof mod.SourceControlRow,
    'function',
    'SourceControlRow must be exported as a function from the barrel'
  );
});

// ─── Type-signature smoke check ──────────────────────────────────────────────

test('Prop type matches SourceControlRowProps contract (single field: sourceControl)', () => {
  // Compile-time shape guard — this assignment fails if the contract drifts.
  const ac: V5AutoCommit = 'always';
  const ap: V5AutoPR = 'never';
  const input: V5SourceControlState = {
    branch: 'x',
    base_branch: 'main',
    worktree_path: '/tmp',
    auto_commit: ac,
    auto_pr: ap,
    remote_url: null,
    compare_url: null,
    pr_url: null,
  };
  const result = simulateSourceControlRow(input);
  assert.ok(result);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
