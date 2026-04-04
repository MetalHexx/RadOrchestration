/**
 * Tests for commitUrl logic in TaskCard.
 * Run with: npx tsx ui/components/execution/task-card.test.ts
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

// ─── Simulation (mirrors commitUrl logic in task-card.tsx) ───────────────────

function computeCommitUrl(
  remoteUrl: string | null | undefined,
  commitHash: string | null | undefined
): string | null {
  return remoteUrl && commitHash
    ? `${remoteUrl}/commit/${commitHash}`
    : null;
}

const REMOTE = "https://github.com/org/repo";

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\ncommitUrl logic\n");

test("commit_hash is null → commitUrl is null", () => {
  assert.strictEqual(computeCommitUrl(REMOTE, null), null);
});

test("commit_hash is undefined → commitUrl is null", () => {
  assert.strictEqual(computeCommitUrl(REMOTE, undefined), null);
});

test('commit_hash is a real hash → commitUrl is correct GitHub URL', () => {
  assert.strictEqual(
    computeCommitUrl(REMOTE, "abc1234"),
    `${REMOTE}/commit/abc1234`
  );
});

test('commit_hash is the string "none" → commitUrl is produced (no sentinel)', () => {
  // Pipeline never produces 'none' — no sentinel needed; treat as a valid hash
  assert.strictEqual(
    computeCommitUrl(REMOTE, "none"),
    `${REMOTE}/commit/none`
  );
});

test("remoteUrl is null with real hash → commitUrl is null", () => {
  assert.strictEqual(computeCommitUrl(null, "abc1234"), null);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
