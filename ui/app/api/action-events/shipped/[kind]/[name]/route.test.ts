import { test, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const origHomedir: () => string = os.homedir;
function setRoot(): string {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-shipped-home-'));
  const root = path.join(fakeHome, '.radorc', 'action-events');
  fs.mkdirSync(root, { recursive: true });
  (os as unknown as { homedir: () => string }).homedir = () => fakeHome;
  return root;
}
afterEach(() => { (os as unknown as { homedir: () => string }).homedir = origHomedir; });

test('GET returns shipped entry body and frontmatter (FR-27)', async () => {
  const root = setRoot();
  fs.writeFileSync(path.join(root, 'action.foo.md'),
    '---\nkind: action\nname: foo\ntitle: Foo\ndescription: d\ncategory: agent-spawn\ncompletion_event: done\n---\n\nBODY\n');
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'foo' } });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.title, 'Foo');
  assert.strictEqual(body.category, 'agent-spawn');
  assert.strictEqual(body.completion_event, 'done');
  assert.match(body.body, /BODY/);
});

test('GET returns 404 when entry not found (FR-27)', async () => {
  setRoot();
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'missing' } });
  assert.strictEqual(res.status, 404);
});

test('GET rejects invalid kind with 400 (NFR-6)', async () => {
  setRoot();
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'banana', name: 'foo' } });
  assert.strictEqual(res.status, 400);
});

test('GET rejects invalid name with 400 (NFR-6)', async () => {
  setRoot();
  const mod = await import('./route');
  const res = await mod.GET(new Request('http://x') as unknown as Parameters<typeof mod.GET>[0], { params: { kind: 'action', name: 'bad-NAME!' } });
  assert.strictEqual(res.status, 400);
});
