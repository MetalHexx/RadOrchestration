import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { withHomedir } from '../../../lib/test-helpers.js';

function post(body: unknown): Request {
  return new Request('http://x/api/repo-groups', { method: 'POST', body: JSON.stringify(body) });
}
async function seedRepo(root: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  checkout-api:\n    remote: r\n    default_branch: main\n    description: d\nrepo_groups: {}\n`, 'utf8');
}

test('POST /api/repo-groups creates a group with members in one call (FR-8, FR-11)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'gc-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedRepo(root);
    await withHomedir(tmp, async () => {
      const { POST } = await import('./route.ts');
      const res = await POST(post({ slug: 'checkout', description: 'domain', members: ['checkout-api'] }));
      assert.equal(res.status, 201);
      const reg = readRegistry({ root });
      assert.equal(reg.repoGroups['checkout'].description, 'domain');
      assert.deepEqual(reg.repoGroups['checkout'].members, ['checkout-api']);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('POST /api/repo-groups rejects a member that is not an existing repo (FR-11, FR-13)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'gc-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedRepo(root);
    await withHomedir(tmp, async () => {
      const { POST } = await import('./route.ts');
      const res = await POST(post({ slug: 'checkout', description: 'd', members: ['ghost'] }));
      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(body.error.field, 'members');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
