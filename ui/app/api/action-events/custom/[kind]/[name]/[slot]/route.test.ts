import { test, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  const res = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'foo', slot: 'pre' } });
  assert.strictEqual(res.status, 404);
});

test('GET returns raw bytes when custom exists (FR-28)', async () => {
  const root = setRoot();
  fs.writeFileSync(path.join(root, 'custom', 'action.foo.pre.md'), 'RAW\n');
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'foo', slot: 'pre' } });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.content, 'RAW\n');
});

test('PUT writes verbatim and rejects frontmatter fence (FR-29, AD-6)', async () => {
  const root = setRoot();
  const mod = await import('./route');
  const ok = await mod.PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ content: 'hello\n' }) }) as unknown as Parameters<typeof mod.PUT>[0], { params: { kind: 'event', name: 'bar', slot: 'post' } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(fs.readFileSync(path.join(root, 'custom', 'event.bar.post.md'), 'utf8'), 'hello\n');
  const bad = await mod.PUT(new Request('http://x', { method: 'PUT', body: JSON.stringify({ content: '---\nfoo: 1\n---\nbody\n' }) }) as unknown as Parameters<typeof mod.PUT>[0], { params: { kind: 'event', name: 'bar', slot: 'post' } });
  assert.strictEqual(bad.status, 400);
});

test('DELETE is idempotent (FR-30, AD-7)', async () => {
  const root = setRoot();
  const mod = await import('./route');
  const a = await mod.DELETE(new Request('http://x', { method: 'DELETE' }) as unknown as Parameters<typeof mod.DELETE>[0], { params: { kind: 'action', name: 'baz', slot: 'pre' } });
  assert.strictEqual(a.status, 200);
  fs.writeFileSync(path.join(root, 'custom', 'action.baz.pre.md'), 'x');
  const b = await mod.DELETE(new Request('http://x', { method: 'DELETE' }) as unknown as Parameters<typeof mod.DELETE>[0], { params: { kind: 'action', name: 'baz', slot: 'pre' } });
  assert.strictEqual(b.status, 200);
  assert.strictEqual(fs.existsSync(path.join(root, 'custom', 'action.baz.pre.md')), false);
});

test('rejects invalid kind, name, or slot (NFR-6)', async () => {
  setRoot();
  const mod = await import('./route');
  const r1 = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'banana', name: 'foo', slot: 'pre' } });
  assert.strictEqual(r1.status, 400);
  const r2 = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'bad-NAME!', slot: 'pre' } });
  assert.strictEqual(r2.status, 400);
  const r3 = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'foo', slot: 'middle' } });
  assert.strictEqual(r3.status, 400);
  const r4 = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'foo', slot: 'post' } });
  assert.strictEqual(r4.status, 400, 'action+post is invalid');
});
