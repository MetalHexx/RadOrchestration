import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readRegistry } from '@rad-orchestration/repo-registry';
import { stringify as yamlStringify } from 'yaml';
import { withHomedir } from '../../../../lib/test-helpers.js';

async function seed(root: string, repoPath: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  checkout-api:\n    remote: r\n    default_branch: main\n    description: d\nrepo_groups: {}\n`, 'utf8');
  await writeFile(path.join(root, 'repo-registry.local.yml'),
    yamlStringify({ paths: { 'checkout-api': repoPath } }), 'utf8');
}
function put(slug: string, body: unknown): Request {
  return new Request(`http://x/api/repos/${slug}`, { method: 'PUT', body: JSON.stringify(body) });
}

test('PUT re-points bind to a new directory; read reflects new path (FR-4, FR-6, DD-2)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bl-'));
  try {
    const root = path.join(tmp, '.radorc');
    const newDir = path.join(tmp, 'newdir');
    await mkdir(root, { recursive: true });
    await mkdir(newDir, { recursive: true });
    await seed(root, root);
    await withHomedir(tmp, async () => {
      const { PUT, GET } = await import('./route.ts');
      await PUT(put('checkout-api', {
        remote: 'r', defaultBranch: 'main', description: 'd', localPath: newDir, groups: [],
      }), { params: { slug: 'checkout-api' } });
      assert.equal(readRegistry({ root }).localPaths['checkout-api'], newDir);
      const res = await GET(new Request('http://x'), { params: { slug: 'checkout-api' } });
      const repo = await res.json();
      assert.deepEqual(repo.bind, { state: 'bound', path: newDir });
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('PUT omitting localPath leaves the existing bind unchanged (DD-2)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bl-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seed(root, root);
    await withHomedir(tmp, async () => {
      const { PUT } = await import('./route.ts');
      await PUT(put('checkout-api', {
        remote: 'r', defaultBranch: 'main', description: 'changed', groups: [],
      }), { params: { slug: 'checkout-api' } });
      assert.equal(readRegistry({ root }).localPaths['checkout-api'], root);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('GET reports missing when the bound directory is gone (FR-4, DD-3)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'bl-'));
  try {
    const root = path.join(tmp, '.radorc');
    const goneDir = path.join(tmp, 'gone');
    await mkdir(root, { recursive: true });
    await mkdir(goneDir, { recursive: true });
    await seed(root, goneDir);
    await rm(goneDir, { recursive: true, force: true });
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET(new Request('http://x'), { params: { slug: 'checkout-api' } });
      const repo = await res.json();
      assert.deepEqual(repo.bind, { state: 'missing', path: goneDir });
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
