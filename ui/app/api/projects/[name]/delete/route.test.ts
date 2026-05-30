import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { withHomedir } from '../../../../../lib/test-helpers.js';
import { POST } from './route.js';

function req(name: string, p: string): import('next/server').NextRequest {
  const url = new URL(`http://localhost/api/projects/${name}/delete`);
  if (p !== null) url.searchParams.set('path', p);
  return { nextUrl: url } as unknown as import('next/server').NextRequest;
}

test('deletes an existing root file and returns 200 (FR-23, AD-4)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'del-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    const target = path.join(projectDir, 'DEMO-WIREFRAME-X.html');
    await writeFile(target, '<html></html>', 'utf-8');
    await withHomedir(tmp, async () => {
      const res = await POST(req('DEMO', 'DEMO-WIREFRAME-X.html'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 200);
      await assert.rejects(() => stat(target), 'file should be unlinked');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('rejects path containing .. with 400 (NFR-2)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'del-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await withHomedir(tmp, async () => {
      const res = await POST(req('DEMO', '../state.json'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 400);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('returns 404 when the target file does not exist (AD-4)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'del-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await withHomedir(tmp, async () => {
      const res = await POST(req('DEMO', 'GONE.html'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 404);
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
