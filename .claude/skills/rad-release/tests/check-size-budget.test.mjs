import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { checkSizeBudget, SIZE_BUDGET_BYTES } from '../scripts/check-size-budget.mjs';

const repoRoot = path.join(os.tmpdir(), 'rad-release-fixture');

test('SIZE_BUDGET_BYTES is exactly 57671680', () => {
  assert.strictEqual(SIZE_BUDGET_BYTES, 57_671_680);
});

test('checkSizeBudget rejects when any plugin exceeds the budget', async () => {
  const result = await checkSizeBudget({
    repoRoot,
    spawn: (cmd, args, opts) => {
      const dir = opts.cwd;
      const oversized = dir.endsWith('claude-plugin' + path.sep + 'output') || dir.endsWith('claude-plugin/output');
      const size = oversized ? 60_000_000 : 1_000_000;
      return { status: 0, stdout: JSON.stringify([{ unpackedSize: size }]), stderr: '' };
    },
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /claude-plugin/);
  assert.match(result.error, /60000000/);
});

test('checkSizeBudget passes when all plugins are under the budget', async () => {
  const result = await checkSizeBudget({
    repoRoot,
    spawn: () => ({ status: 0, stdout: JSON.stringify([{ unpackedSize: 1_000_000 }]), stderr: '' }),
  });
  assert.strictEqual(result.ok, true);
});

test('checkSizeBudget builds a valid platform-native cwd path', async () => {
  const repoRoot = path.join(os.tmpdir(), 'rad-release-fixture');
  const observedCwds = [];
  await checkSizeBudget({
    repoRoot,
    spawn: (cmd, args, opts) => {
      observedCwds.push(opts.cwd);
      return { status: 0, stdout: JSON.stringify([{ unpackedSize: 1_000_000 }]), stderr: '' };
    },
  });
  for (const cwd of observedCwds) {
    assert.strictEqual(cwd, path.join(repoRoot, cwd.includes('claude-plugin')
      ? 'harness-installers/claude-plugin'
      : cwd.includes('copilot-cli-plugin')
        ? 'harness-installers/copilot-cli-plugin'
        : 'harness-installers/copilot-vscode-plugin', 'output'));
    assert.ok(!cwd.includes(repoRoot.replace(/[\\/]/g, '')),
      'cwd preserves separators from repoRoot');
  }
});
