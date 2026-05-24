import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReproducible } from '../scripts/assert-reproducible.mjs';

test('assertReproducible re-runs builds then checks git status --porcelain (NFR-2)', async () => {
  const log = [];
  const result = await assertReproducible({
    repoRoot: '/repo',
    runBuildAndValidate: async () => { log.push('build'); return { ok: true }; },
    spawn: (cmd, args) => {
      log.push(`${cmd} ${args.join(' ')}`);
      if (cmd === 'git' && args[0] === 'status') return { status: 0, stdout: '', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.deepStrictEqual(log, ['build', 'git status --porcelain']);
  assert.strictEqual(result.ok, true);
});

test('assertReproducible reports dirty paths and halts (FR-13)', async () => {
  const result = await assertReproducible({
    repoRoot: '/repo',
    runBuildAndValidate: async () => ({ ok: true }),
    spawn: () => ({ status: 0, stdout: ' M harness-installers/standard/output/build-stamp.json\n', stderr: '' }),
  });
  assert.strictEqual(result.ok, false);
  assert.match(result.error, /build-stamp\.json/);
});
