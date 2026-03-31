/**
 * Tests for SourceControlSection component logic.
 * Run with: npx tsx ui/components/dashboard/source-control-section.test.ts
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
  const autoCommitIsSpinner = input.auto_commit === 'always';
  const autoCommitLabel = `auto-commit: ${input.auto_commit === 'always' ? 'always' : 'never'}`;
  const autoPrIsSpinner = input.auto_pr === 'always';
  const autoPrLabel = `auto-pr: ${input.auto_pr === 'always' ? 'always' : 'never'}`;
  const showsPrPlaceholder = input.auto_pr === 'always';

  return {
    branchIsLink,
    branchText,
    branchHref,
    autoCommitIsSpinner,
    autoCommitLabel,
    autoPrIsSpinner,
    autoPrLabel,
    showsPrPlaceholder,
  };
}

// ==================== SourceControlSection Tests ====================

console.log("SourceControlSection");

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

test("SpinnerBadge for auto_commit 'always'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_commit: 'always' }));
  assert.strictEqual(result.autoCommitIsSpinner, true);
  assert.strictEqual(result.autoCommitLabel, 'auto-commit: always');
});

test("Outline Badge for auto_commit 'never'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_commit: 'never' }));
  assert.strictEqual(result.autoCommitIsSpinner, false);
  assert.strictEqual(result.autoCommitLabel, 'auto-commit: never');
});

test("SpinnerBadge for auto_pr 'always'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always' }));
  assert.strictEqual(result.autoPrIsSpinner, true);
  assert.strictEqual(result.autoPrLabel, 'auto-pr: always');
});

test("Outline Badge for auto_pr 'never'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'never' }));
  assert.strictEqual(result.autoPrIsSpinner, false);
  assert.strictEqual(result.autoPrLabel, 'auto-pr: never');
});

test("PR placeholder row visible when auto_pr is 'always'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'always' }));
  assert.strictEqual(result.showsPrPlaceholder, true);
});

test("PR placeholder row hidden when auto_pr is 'never'", () => {
  const result = simulateSourceControlSection(makeInput({ auto_pr: 'never' }));
  assert.strictEqual(result.showsPrPlaceholder, false);
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
