import test from 'node:test';
import assert from 'node:assert/strict';
import { runBuildAndValidate } from '../scripts/build-and-validate.mjs';

test('runBuildAndValidate invokes harness-dogfood/build.js --all then each plugin build', async () => {
  const calls = [];
  const result = await runBuildAndValidate({
    repoRoot: process.cwd(),
    spawn: (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts?.cwd });
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  // First call: dogfood orchestrator with --all
  assert.deepStrictEqual(calls[0].args, ['harness-dogfood/build.js', '--all']);
  // Subsequent calls: per-plugin builders (validator invoked inside each)
  const pluginBuildCwds = calls.slice(1).map(c => c.cwd);
  assert.ok(pluginBuildCwds.some(c => c.endsWith('claude-plugin')));
  assert.ok(pluginBuildCwds.some(c => c.endsWith('copilot-cli-plugin')));
  assert.ok(pluginBuildCwds.some(c => c.endsWith('copilot-vscode-plugin')));
  assert.strictEqual(result.ok, true);
});

test('runBuildAndValidate surfaces a non-zero exit as a halt', async () => {
  const result = await runBuildAndValidate({
    repoRoot: process.cwd(),
    spawn: () => ({ status: 1, stdout: '', stderr: 'validator gate failed' }),
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /validator gate failed/);
});
