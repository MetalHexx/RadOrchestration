import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { withHomedir } from '../../../../../lib/test-helpers.js';
import { GET } from './route.js';

function req(name: string, p: string | null): import('next/server').NextRequest {
  const url = new URL(`http://localhost/api/projects/${name}/raw`);
  if (p !== null) url.searchParams.set('path', p);
  return { nextUrl: url } as unknown as import('next/server').NextRequest;
}

test('serves an existing root HTML file as text/html (FR-21, AD-2)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'DEMO-BRAINSTORM.html'), '<html><body>hi</body></html>', 'utf-8');
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', 'DEMO-BRAINSTORM.html'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.ok((await res.text()).includes('hi'));
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('rejects path containing .. with 400 (NFR-2)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', '../secret.html'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 400);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('returns 404 when the file is absent (AD-2)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', 'MISSING.html'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 404);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('missing path query param returns 400 (FR-21)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', null), { params: { name: 'DEMO' } });
      assert.equal(res.status, 400);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
