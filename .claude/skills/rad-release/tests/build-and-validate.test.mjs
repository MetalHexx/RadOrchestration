import test from 'node:test';
import assert from 'node:assert/strict';
import { runBuildAndValidate } from '../scripts/build-and-validate.mjs';

test('runBuildAndValidate invokes harness-dogfood/build.js --all then each plugin build (AD-7, AD-6)', async () => {
  const calls = [];
  const result = await runBuildAndValidate({
    repoRoot: process.cwd(),
    spawn: (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts?.cwd });
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  // First call: dogfood orchestrator with --all (AD-7)
  assert.deepStrictEqual(calls[0].args, ['harness-dogfood/build.js', '--all']);
  // Subsequent calls: per-plugin builders (AD-6 — validator invoked inside each)
  const pluginBuildCwds = calls.slice(1).map(c => c.cwd);
  assert.ok(pluginBuildCwds.some(c => c.endsWith('claude-plugin')));
  assert.ok(pluginBuildCwds.some(c => c.endsWith('copilot-cli-plugin')));
  assert.ok(pluginBuildCwds.some(c => c.endsWith('copilot-vscode-plugin')));
  assert.strictEqual(result.ok, true);
});

test('runBuildAndValidate surfaces a non-zero exit as a halt (FR-10)', async () => {
  const result = await runBuildAndValidate({
    repoRoot: process.cwd(),
    spawn: () => ({ status: 1, stdout: '', stderr: 'validator gate failed' }),
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /validator gate failed/);
});
