import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { withHomedir } from '../../../../../lib/test-helpers.js';
import { GET } from './route.js';

function req(name: string, p: string | null, chrome?: string): import('next/server').NextRequest {
  const url = new URL(`http://localhost/api/projects/${name}/raw`);
  if (p !== null) url.searchParams.set('path', p);
  if (chrome !== undefined) url.searchParams.set('chrome', chrome);
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

test('chrome=scroll injects styled webkit scrollbar before </head> (Part B)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'DEMO-PAGE.html'), '<html><head></head><body>hi</body></html>', 'utf-8');
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', 'DEMO-PAGE.html', 'scroll'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 200);
      const body = await res.text();
      // Sandboxed iframes ignore standard scrollbar-color, so the thin/dark look
      // is delivered via the ::-webkit-scrollbar pseudo-elements (Chromium harness).
      assert.ok(body.includes('::-webkit-scrollbar-thumb'), 'webkit thumb styled');
      assert.ok(body.includes('oklch(0.55 0 0 / 0.5)'), 'app thumb color injected');
      assert.ok(body.indexOf('<style>') < body.indexOf('</head>'), 'style injected before </head>');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('chrome=hide injects hidden scrollbar style before </head> (Part B)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'DEMO-PAGE.html'), '<html><head></head><body>hi</body></html>', 'utf-8');
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', 'DEMO-PAGE.html', 'hide'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.ok(body.includes('scrollbar-width:none'), 'hidden scrollbar injected');
      assert.ok(body.includes('display:none'), 'webkit scrollbar display:none injected');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('no chrome param returns original body without style injection (Part B)', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'raw-route-'));
  try {
    const projectDir = path.join(tmp, '.radorc', 'projects', 'DEMO');
    await mkdir(projectDir, { recursive: true });
    const original = '<html><head></head><body>hi</body></html>';
    await writeFile(path.join(projectDir, 'DEMO-PAGE.html'), original, 'utf-8');
    await withHomedir(tmp, async () => {
      const res = await GET(req('DEMO', 'DEMO-PAGE.html'), { params: { name: 'DEMO' } });
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.equal(body, original, 'body unchanged when no chrome param');
    });
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
