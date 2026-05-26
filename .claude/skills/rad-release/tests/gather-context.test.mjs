import test from 'node:test';
import assert from 'node:assert/strict';
import { gatherContext } from '../scripts/gather-context.mjs';

test('gatherContext returns version, branch, dirty flag, and last tag', async () => {
  const ctx = await gatherContext({ repoRoot: process.cwd() });
  assert.match(ctx.currentVersion, /^\d+\.\d+\.\d+(-[\w.]+)?$/);
  assert.strictEqual(typeof ctx.currentBranch, 'string');
  assert.strictEqual(typeof ctx.workingTreeDirty, 'boolean');
  assert.ok(ctx.lastReleaseTag === null || /^v/.test(ctx.lastReleaseTag));
});
