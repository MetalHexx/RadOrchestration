import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { withHomedir } from '../../../../lib/test-helpers.js';

async function seed(root: string, repoPath: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  checkout-api:\n    remote: r\n    default_branch: main\n    description: old\nrepo_groups:\n  a:\n    description: a\n    members:\n      - checkout-api\n  b:\n    description: b\n    members: []\n`, 'utf8');
  await writeFile(path.join(root, 'repo-registry.local.yml'),
    `paths:\n  checkout-api: ${repoPath.replace(/\\/g, '\\\\')}\n`, 'utf8');
}
function put(slug: string, body: unknown): Request {
  return new Request(`http://x/api/repos/${slug}`, { method: 'PUT', body: JSON.stringify(body) });
}

test('PUT diffs identity + membership into minimal mutations (FR-6, FR-11)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root, root);
    await withHomedir(tmp, async () => {
      const { PUT } = await import('./route.ts');
      const res = await PUT(put('checkout-api', {
        remote: 'r', defaultBranch: 'main', description: 'new', groups: ['b'],
      }), { params: { slug: 'checkout-api' } });
      assert.equal(res.status, 200);
      const reg = readRegistry({ root });
      assert.equal(reg.repos['checkout-api'].description, 'new');
      assert.deepEqual(reg.repoGroups['a'].members, []);
      assert.deepEqual(reg.repoGroups['b'].members, ['checkout-api']);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('PUT with a slug in the body is rejected IMMUTABLE_SLUG (FR-12)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root, root);
    await withHomedir(tmp, async () => {
      const { PUT } = await import('./route.ts');
      const res = await PUT(put('checkout-api', {
        slug: 'renamed', remote: 'r', defaultBranch: 'main', description: 'd', groups: [],
      }), { params: { slug: 'checkout-api' } });
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error.code, 'IMMUTABLE_SLUG');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('DELETE removes the repo and cascades out of every group (FR-7)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root, root);
    await withHomedir(tmp, async () => {
      const { DELETE } = await import('./route.ts');
      const res = await DELETE(new Request('http://x'), { params: { slug: 'checkout-api' } });
      assert.equal(res.status, 200);
      const reg = readRegistry({ root });
      assert.equal('checkout-api' in reg.repos, false);
      assert.deepEqual(reg.repoGroups['a'].members, []);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
