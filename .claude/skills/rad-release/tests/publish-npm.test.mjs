import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { publishNpm } from '../scripts/publish-npm.mjs';

test('publishNpm runs npm publish --access public from the standard installer source dir (FR-6, NFR-4)', async () => {
  const calls = [];
  await publishNpm({
    repoRoot: '/repo',
    spawn: (cmd, args, opts) => {
      calls.push({ cmd, args, cwd: opts.cwd });
      return { status: 0, stdout: '+ rad-orc@1.0.0-alpha.10', stderr: '' };
    },
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].cmd, 'npm');
  assert.deepStrictEqual(calls[0].args, ['publish', '--access', 'public']);
  // npm pack/publish runs from harness-installers/standard/ (one level up from
  // output/) because the publish package.json lives at standard/package.json —
  // see harness-installers/standard/build-scripts/{build,validate}.js.
  const normalizedCwd = calls[0].cwd.replace(/\\/g, '/');
  assert.ok(normalizedCwd.endsWith('harness-installers/standard')
    && !normalizedCwd.endsWith('harness-installers/standard/output'));
  // No --provenance — NFR-4 accepts loss of OIDC attestation
  assert.ok(!calls[0].args.includes('--provenance'));
});

test('publishNpm halts the skill on non-zero exit (FR-10)', async () => {
  const result = await publishNpm({
    repoRoot: '/repo',
    spawn: () => ({ status: 1, stdout: '', stderr: 'EPUBLISHCONFLICT' }),
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /EPUBLISHCONFLICT/);
});
