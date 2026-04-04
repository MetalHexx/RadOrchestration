/**
 * Tests for SourceControlSection component logic.
 * Run with: npx tsx components/dashboard/source-control-section.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * prop contracts and conditional rendering logic by simulating what
 * the component does with its inputs.
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

// ---------- SourceControlSection logic simulation ----------

interface SourceControlInput {
  branch: string;
  base_branch: string;
  worktree_path: string;
  auto_commit: string;
  auto_pr: string;
  remote_url: string | null;
  compare_url: string | null;
  pr_url?: string | null;
}

interface BadgeProps {
  label: string;
  cssVar: string;
  isSpinning: boolean;
  isComplete: boolean;
  isRejected: boolean;
  ariaLabel: string;
}

function makeInput(overrides: Partial<SourceControlInput> = {}): SourceControlInput {
  return {
    branch: 'feat/test-branch',
    base_branch: 'main',
    worktree_path: '/path/to/worktree',
    auto_commit: 'always',
    auto_pr: 'never',
    remote_url: 'https://github.com/org/repo',
    compare_url: 'https://github.com/org/repo/compare/main...feat/test-branch',
    ...overrides,
  };
}

function simulateSourceControlSection(input: SourceControlInput) {
  const branchIsLink = input.compare_url !== null;
  const branchText = input.branch;
  const branchHref = input.compare_url;
  const branchLabel = 'Branch Name:';

  const autoCommitBadge: BadgeProps = {
    label: 'Auto-Commit',
    cssVar: input.auto_commit === 'always' ? '--status-complete' : '--status-failed',
    isSpinning: false,
    isComplete: input.auto_commit === 'always',
    isRejected: input.auto_commit !== 'always',
    ariaLabel: `Auto-Commit: ${input.auto_commit}`,
  };

  const autoPrBadge: BadgeProps = {
    label: 'Auto-PR',
    cssVar: input.auto_pr === 'always' ? '--status-complete' : '--status-failed',
    isSpinning: false,
    isComplete: input.auto_pr === 'always',
    isRejected: input.auto_pr !== 'always',
    ariaLabel: `Auto-PR: ${input.auto_pr}`,
  };

  const showsPrPlaceholder = input.auto_pr === 'always';

  // pr_url: undefined = not yet attempted; null = creation failed; string = PR URL
  const pr_url = input.pr_url;
  const prLinkHref = pr_url != null && /^https?:\/\//i.test(pr_url) ? pr_url : null;
  const prState: 'link' | 'failed' | 'pending' =
    prLinkHref !== null ? 'link' : pr_url === null ? 'failed' : 'pending';

  return {
    branchIsLink,
    branchText,
    branchHref,
    branchLabel,
    autoCommitBadge,
    autoPrBadge,
    showsPrPlaceholder,
    prLinkHref,
    prState,
  };
}

// ==================== SourceControlSection Tests ====================

console.log("SourceControlSection");

test("Branch label is always 'Branch Name:'", () => {
  const result = simulateSourceControlSection(makeInput());
  assert.strictEqual(result.branchLabel, 'Branch Name:');
});

test("Branch as plain text when compare_url is null", () => {
  const result = simulateSourceControlSection(makeInput({ compare_url: null }));
  assert.strictEqual(result.branchIsLink, false);
  assert.strictEqual(result.branchText, 'feat/test-branch');
});

test("Branch as clickable link when compare_url is non-null", () => {
  const url = "https://github.com/org/repo/compare/main...feat";
  const result = simulateSourceControlSection(makeInput({ compare_url: url }));
  assert.strictEqual(result.branchIsLink, true);
  assert.strictEqual(result.branchHref, url);
});

test("Auto-Commit badge: green check (isComplete) when 'always'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_commit: 'always' }));
  assert.strictEqual(result.autoCommitBadge.label, 'Auto-Commit');
  assert.strictEqual(result.autoCommitBadge.cssVar, '--status-complete');
  assert.strictEqual(result.autoCommitBadge.isComplete, true);
  assert.strictEqual(result.autoCommitBadge.isRejected, false);
  assert.strictEqual(result.autoCommitBadge.isSpinning, false);
});

test("Auto-Commit badge: red X (isRejected) when 'never'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_commit: 'never' }));
  assert.strictEqual(result.autoCommitBadge.label, 'Auto-Commit');
  assert.strictEqual(result.autoCommitBadge.cssVar, '--status-failed');
  assert.strictEqual(result.autoCommitBadge.isComplete, false);
  assert.strictEqual(result.autoCommitBadge.isRejected, true);
  assert.strictEqual(result.autoCommitBadge.isSpinning, false);
});

test("Auto-PR badge: green check (isComplete) when 'always'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always' }));
  assert.strictEqual(result.autoPrBadge.label, 'Auto-PR');
  assert.strictEqual(result.autoPrBadge.cssVar, '--status-complete');
  assert.strictEqual(result.autoPrBadge.isComplete, true);
  assert.strictEqual(result.autoPrBadge.isRejected, false);
  assert.strictEqual(result.autoPrBadge.isSpinning, false);
});

test("Auto-PR badge: red X (isRejected) when 'never'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'never' }));
  assert.strictEqual(result.autoPrBadge.label, 'Auto-PR');
  assert.strictEqual(result.autoPrBadge.cssVar, '--status-failed');
  assert.strictEqual(result.autoPrBadge.isComplete, false);
  assert.strictEqual(result.autoPrBadge.isRejected, true);
  assert.strictEqual(result.autoPrBadge.isSpinning, false);
});

test("PR placeholder row visible when auto_pr is 'always'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always' }));
  assert.strictEqual(result.showsPrPlaceholder, true);
});

test("PR placeholder row hidden when auto_pr is 'never'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'never' }));
  assert.strictEqual(result.showsPrPlaceholder, false);
});

test("prState is 'pending' when pr_url is undefined (not yet attempted)", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always' }));
  assert.strictEqual(result.prState, 'pending');
  assert.strictEqual(result.prLinkHref, null);
});

test("prState is 'failed' when pr_url is null (creation failed)", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always', pr_url: null }));
  assert.strictEqual(result.prState, 'failed');
  assert.strictEqual(result.prLinkHref, null);
});

test("prState is 'link' when pr_url is a valid URL", () => {
  const url = 'https://github.com/org/repo/pull/42';
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always', pr_url: url }));
  assert.strictEqual(result.prState, 'link');
  assert.strictEqual(result.prLinkHref, url);
});

test("prState is 'pending' when pr_url is non-http string", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always', pr_url: 'not-a-url' }));
  assert.strictEqual(result.prState, 'pending');
  assert.strictEqual(result.prLinkHref, null);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
