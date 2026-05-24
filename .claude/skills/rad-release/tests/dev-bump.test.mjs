import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestNextDev, runDevBump } from '../scripts/dev-bump.mjs';

test('suggestNextDev increments the alpha counter (FR-12)', () => {
  assert.strictEqual(suggestNextDev('1.0.0-alpha.10'), '1.0.0-alpha.11');
  assert.strictEqual(suggestNextDev('1.0.0-alpha.99'), '1.0.0-alpha.100');
});

test('runDevBump invokes bumpVersion, stages and commits with the post-release subject (FR-12, AD-3)', async () => {
  const log = [];
  await runDevBump({
    repoRoot: '/repo',
    from: '1.0.0-alpha.10',
    to: '1.0.0-alpha.11',
    bumpVersion: async (args) => log.push({ bump: args }),
    spawn: (cmd, args) => { log.push({ cmd, args }); return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.deepStrictEqual(log[0], { bump: { from: '1.0.0-alpha.10', to: '1.0.0-alpha.11', repoRoot: '/repo' } });
  assert.ok(log.some(e => e.cmd === 'git' && e.args[0] === 'add'));
  assert.ok(log.some(e => e.cmd === 'git' && e.args[0] === 'commit' && e.args.includes('chore: post-release dev bump to v1.0.0-alpha.11')));
  assert.ok(log.some(e => e.cmd === 'git' && e.args[0] === 'push'));
});
