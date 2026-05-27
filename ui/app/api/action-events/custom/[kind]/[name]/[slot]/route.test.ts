import { test, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Stub os.homedir() to redirect userDataPaths().actionEvents — matches
// the existing fs-reader-bootstrap.test.ts pattern. The catalog root is
// resolved per AD-10 through cli's userDataPaths(); no env-var override.
const origHomedir: () => string = os.homedir;
function setRoot(): string {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-custom-home-'));
  const root = path.join(fakeHome, '.radorc', 'action-events');
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  (os as unknown as { homedir: () => string }).homedir = () => fakeHome;
  return root;
}
afterEach(() => { (os as unknown as { homedir: () => string }).homedir = origHomedir; });

test('GET returns 404 when custom does not exist (FR-28)', async () => {
  setRoot();
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x'), { params: { kind: 'action', name: 'foo', slot: 'pre' } } as any);
  assert.strictEqual(res.status, 404);
});

test('GET returns raw bytes when custom exists (FR-28)', async () => {
  const root = setRoot();
  fs.writeFileSync(path.join(root, 'custom', 'action.foo.pre.md'), 'RAW\n');
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x'), { params: { kind: 'action', name: 'foo', slot: 'pre' } } as any);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.content, 'RAW\n');
});

test('PUT writes verbatim and rejects frontmatter fence (FR-29, AD-6)', async () => {
  const root = setRoot();
  const mod = await import('./route');
  const ok = await mod.PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ content: 'hello\n' }) }), { params: { kind: 'event', name: 'bar', slot: 'post' } } as any);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(fs.readFileSync(path.join(root, 'custom', 'event.bar.post.md'), 'utf8'), 'hello\n');
  const bad = await mod.PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ content: '---\nfoo: 1\n---\nbody\n' }) }), { params: { kind: 'event', name: 'bar', slot: 'post' } } as any);
  assert.strictEqual(bad.status, 400);
});

test('DELETE is idempotent (FR-30, AD-7)', async () => {
  const root = setRoot();
  const mod = await import('./route');
  // Delete on missing file → success
  const a = await mod.DELETE(new Request('http://x', { method: 'DELETE' }), { params: { kind: 'action', name: 'baz', slot: 'pre' } } as any);
  assert.strictEqual(a.status, 200);
  // Write then delete → success and file gone
  fs.writeFileSync(path.join(root, 'custom', 'action.baz.pre.md'), 'x');
  const b = await mod.DELETE(new Request('http://x', { method: 'DELETE' }), { params: { kind: 'action', name: 'baz', slot: 'pre' } } as any);
  assert.strictEqual(b.status, 200);
  assert.strictEqual(fs.existsSync(path.join(root, 'custom', 'action.baz.pre.md')), false);
});

test('rejects invalid kind, name, or slot (NFR-6)', async () => {
  setRoot();
  const mod = await import('./route');
  const r1 = await mod.GET(new Request('http://x'), { params: { kind: 'banana', name: 'foo', slot: 'pre' } } as any);
  assert.strictEqual(r1.status, 400);
  const r2 = await mod.GET(new Request('http://x'), { params: { kind: 'action', name: 'bad-NAME!', slot: 'pre' } } as any);
  assert.strictEqual(r2.status, 400);
  const r3 = await mod.GET(new Request('http://x'), { params: { kind: 'action', name: 'foo', slot: 'middle' } } as any);
  assert.strictEqual(r3.status, 400);
});
