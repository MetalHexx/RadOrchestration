import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSizeBudget, SIZE_BUDGET_BYTES } from '../scripts/check-size-budget.mjs';

test('SIZE_BUDGET_BYTES is exactly 57671680 (NFR-3)', () => {
  assert.strictEqual(SIZE_BUDGET_BYTES, 57_671_680);
});

test('checkSizeBudget rejects when any plugin exceeds the budget (FR-14, NFR-3)', async () => {
  const result = await checkSizeBudget({
    repoRoot: '/repo',
    spawn: (cmd, args, opts) => {
      const dir = opts.cwd;
      const oversized = dir.endsWith('claude-plugin/output');
      const size = oversized ? 60_000_000 : 1_000_000;
      return { status: 0, stdout: JSON.stringify([{ unpackedSize: size }]), stderr: '' };
    },
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /claude-plugin/);
  assert.match(result.error, /60000000/);
});

test('checkSizeBudget passes when all plugins are under the budget (NFR-3)', async () => {
  const result = await checkSizeBudget({
    repoRoot: '/repo',
    spawn: () => ({ status: 0, stdout: JSON.stringify([{ unpackedSize: 1_000_000 }]), stderr: '' }),
  });
  assert.strictEqual(result.ok, true);
});
