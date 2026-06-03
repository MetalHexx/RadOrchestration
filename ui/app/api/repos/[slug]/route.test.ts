import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { withHomedir } from '../../../../lib/test-helpers.js';

async function seedRepo(root: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  checkout-api:\n    remote: github.com/acme/checkout-api\n    default_branch: main\n    description: Checkout svc\nrepo_groups: {}\n`, 'utf8');
}

test('GET /api/repos/{slug} returns the one computed repo (FR-2, FR-3)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'repo1-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedRepo(root);
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET(new Request('http://x'), { params: { slug: 'checkout-api' } });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.slug, 'checkout-api');
      assert.equal(body.defaultBranch, 'main');
      assert.equal(body.bind.state, 'unbound');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('GET /api/repos/{slug} returns NOT_FOUND 404 for unknown slug (FR-2, FR-13)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'repo1-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedRepo(root);
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET(new Request('http://x'), { params: { slug: 'ghost' } });
      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(body.error.field, 'slug');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('GET /api/repos/{slug} returns INTERNAL 500 when readRegistry throws (FR-13, AD-5)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'repo1-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, 'repo-registry.yml'), 'repos: [oops', 'utf8');
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET(new Request('http://x'), { params: { slug: 'any' } });
      const body = await res.json();
      assert.equal(res.status, 500);
      assert.equal(body.error.code, 'INTERNAL');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
