import test from 'node:test';
import assert from 'node:assert/strict';
import { draftChangelog, commitRelease } from '../scripts/changelog-and-commit.mjs';

test('draftChangelog produces a section with the new version heading (AD-12)', async () => {
  const body = await draftChangelog({ version: '1.0.0-alpha.10', commits: ['feat: X', 'fix: Y'] });
  assert.match(body, /^## v1\.0\.0-alpha\.10/m);
  assert.match(body, /### What's New/);
  assert.match(body, /### What's Fixed/);
});

test('commitRelease stages every carrier and lands one commit with the AD-4 subject (AD-4)', async () => {
  const log = [];
  await commitRelease({
    repoRoot: '/repo',
    version: '1.0.0-alpha.10',
    approvedChangelog: '## v1.0.0-alpha.10 — 2026-...',
    spawn: (cmd, args) => { log.push(`${cmd} ${args.join(' ')}`); return { status: 0, stdout: '', stderr: '' }; },
    writeFile: async () => {},
  });
  assert.ok(log.some(l => l.startsWith('git add -A')));
  assert.ok(log.some(l => l === 'git commit -m chore: bump version to v1.0.0-alpha.10'));
  // Exactly one git commit invocation (AD-4 atomicity)
  assert.strictEqual(log.filter(l => l.startsWith('git commit')).length, 1);
});
