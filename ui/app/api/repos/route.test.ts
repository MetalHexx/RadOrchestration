import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { withHomedir } from '../../../lib/test-helpers.js';

function post(body: unknown): Request {
  return new Request('http://x/api/repos', { method: 'POST', body: JSON.stringify(body) });
}

async function seedGroup(root: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos: {}\nrepo_groups:\n  checkout:\n    description: domain\n    members: []\n`, 'utf8');
}

test('POST /api/repos creates repo + group membership, born bound (FR-5, FR-11)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rc-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedGroup(root);
    await withHomedir(tmp, async () => {
      const { POST } = await import('./route.ts');
      const res = await POST(post({
        slug: 'checkout-api', remote: 'github.com/acme/checkout-api.git',
        defaultBranch: 'main', description: 'svc', localPath: root, groups: ['checkout'],
      }));
      assert.equal(res.status, 201);
      const reg = readRegistry({ root });
      assert.equal(reg.repos['checkout-api'].remote, 'https://github.com/acme/checkout-api');
      assert.equal(reg.localPaths['checkout-api'], root);
      assert.deepEqual(reg.repoGroups['checkout'].members, ['checkout-api']);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('POST /api/repos rejects a non-directory localPath with PATH_INVALID (FR-13, AD-4)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rc-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedGroup(root);
    await withHomedir(tmp, async () => {
      const { POST } = await import('./route.ts');
      const res = await POST(post({
        slug: 'x', remote: 'r', defaultBranch: 'main', description: 'd',
        localPath: path.join(root, 'nope'), groups: [],
      }));
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error.code, 'PATH_INVALID');
      assert.equal(body.error.field, 'localPath');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
