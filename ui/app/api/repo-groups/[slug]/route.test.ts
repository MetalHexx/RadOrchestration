import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { withHomedir } from '../../../../lib/test-helpers.js';

async function seedRegistry(root: string) {
  await writeFile(path.join(root, 'repo-registry.yml'),
    `repos:\n  checkout-api:\n    remote: github.com/acme/checkout-api\n    default_branch: main\n    description: Checkout svc\nrepo_groups:\n  acme-group:\n    description: Acme team repos\n    members:\n      - checkout-api\n`, 'utf8');
}

test('GET /api/repo-groups/{slug} returns the found repo-group (FR-2, FR-3)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rg1-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedRegistry(root);
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET(new Request('http://x'), { params: { slug: 'acme-group' } });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.slug, 'acme-group');
      assert.equal(body.description, 'Acme team repos');
      assert.deepEqual(body.members, ['checkout-api']);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('GET /api/repo-groups/{slug} returns NOT_FOUND 404 for unknown slug (FR-2, FR-13)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rg1-'));
  try {
    const root = path.join(tmp, '.radorc');
    await mkdir(root, { recursive: true });
    await seedRegistry(root);
    await withHomedir(tmp, async () => {
      const { GET } = await import('./route.ts');
      const res = await GET(new Request('http://x'), { params: { slug: 'ghost-group' } });
      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(body.error.field, 'slug');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('GET /api/repo-groups/{slug} returns INTERNAL 500 when readRegistry throws (FR-13, AD-5)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'rg1-'));
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
