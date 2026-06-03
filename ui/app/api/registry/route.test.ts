import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { withHomedir } from '../../../lib/test-helpers.js';

async function seed(root: string, repoPath: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  checkout-api:\n    remote: github.com/acme/checkout-api\n    default_branch: main\n    description: Checkout svc\nrepo_groups:\n  checkout:\n    description: Payments domain\n    members:\n      - checkout-api\n`, 'utf8');
  await writeFile(path.join(root, 'repo-registry.local.yml'),
    `paths:\n  checkout-api: ${repoPath.replace(/\\/g, '\\\\')}\n`, 'utf8');
}

test('GET /api/registry returns computed snapshot with bind + groups + members (FR-1, FR-3, FR-4)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'reg-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root, root);
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET();
      const body = await res.json();
      assert.equal(res.status, 200);
      const repo = body.repos.find((r: { slug: string }) => r.slug === 'checkout-api');
      assert.equal(repo.defaultBranch, 'main');
      assert.deepEqual(repo.groups, ['checkout']);
      assert.equal(repo.bind.state, 'bound');
      const grp = body.repoGroups.find((g: { slug: string }) => g.slug === 'checkout');
      assert.deepEqual(grp.members, ['checkout-api']);
      assert.equal('bind' in grp, false);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
