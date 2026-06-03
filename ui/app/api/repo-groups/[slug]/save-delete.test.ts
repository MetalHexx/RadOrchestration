import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { withHomedir } from '../../../../lib/test-helpers.js';

async function seed(root: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  r1:\n    remote: r\n    default_branch: main\n    description: d\n  r2:\n    remote: r\n    default_branch: main\n    description: d\nrepo_groups:\n  checkout:\n    description: old\n    members:\n      - r1\n`, 'utf8');
}
function put(slug: string, body: unknown): Request {
  return new Request(`http://x/api/repo-groups/${slug}`, { method: 'PUT', body: JSON.stringify(body) });
}

test('PUT edits description and diffs members (FR-9, FR-11)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'gs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root);
    await withHomedir(tmp, async () => {
      const { PUT } = await import('./route.ts');
      const res = await PUT(put('checkout', { description: 'new', members: ['r2'] }),
        { params: { slug: 'checkout' } });
      assert.equal(res.status, 200);
      const reg = readRegistry({ root });
      assert.equal(reg.repoGroups['checkout'].description, 'new');
      assert.deepEqual(reg.repoGroups['checkout'].members, ['r2']);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('PUT with a slug in the body is rejected IMMUTABLE_SLUG (FR-12, F-20)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'gs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root);
    await withHomedir(tmp, async () => {
      const { PUT } = await import('./route.ts');
      const res = await PUT(put('checkout', { slug: 'renamed', description: 'd', members: [] }),
        { params: { slug: 'checkout' } });
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error.code, 'IMMUTABLE_SLUG');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('PUT with empty description is rejected REQUIRED (FR-9, FR-13)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'gs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root);
    await withHomedir(tmp, async () => {
      const { PUT } = await import('./route.ts');
      const res = await PUT(put('checkout', { description: '', members: [] }),
        { params: { slug: 'checkout' } });
      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.error.code, 'REQUIRED');
      assert.equal(body.error.field, 'description');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('DELETE removes the group; member repos remain (FR-10)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'gs-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root);
    await withHomedir(tmp, async () => {
      const { DELETE } = await import('./route.ts');
      const res = await DELETE(new Request('http://x'), { params: { slug: 'checkout' } });
      assert.equal(res.status, 200);
      const reg = readRegistry({ root });
      assert.equal('checkout' in reg.repoGroups, false);
      assert.equal('r1' in reg.repos, true);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
