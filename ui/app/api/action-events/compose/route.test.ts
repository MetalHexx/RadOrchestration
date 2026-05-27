import { test, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Stub os.homedir() to redirect userDataPaths().actionEvents (AD-10).
const origHomedir: () => string = os.homedir;
function seedRoot(): string {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-compose-home-'));
  const root = path.join(fakeHome, '.radorc', 'action-events');
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  fs.writeFileSync(path.join(root, 'action.exec.md'),
    '---\nkind: action\nname: exec\ntitle: Exec\ndescription: d\ncategory: agent-spawn\ncompletion_event: done\n---\n\nA body.\n');
  fs.writeFileSync(path.join(root, 'event.done.md'),
    '---\nkind: event\nname: done\ntitle: Done\ndescription: d\nsignal_payload: {}\n---\n\nE body.\n');
  fs.writeFileSync(path.join(root, 'event.lonely.md'),
    '---\nkind: event\nname: lonely\ntitle: Lonely\ndescription: d\nsignal_payload: {}\n---\n\nL body.\n');
  (os as unknown as { homedir: () => string }).homedir = () => fakeHome;
  return root;
}
afterEach(() => { (os as unknown as { homedir: () => string }).homedir = origHomedir; });

test('action compose with overlay returns prompt (FR-31, NFR-3)', async () => {
  seedRoot();
  const mod = await import('./route');
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({
    kind: 'action', name: 'exec', completion_event: 'done',
    overlay: { 'action.exec.pre': 'LIVE PRE' },
  }) });
  const res = await mod.POST(req as any);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.match(body.prompt, /LIVE PRE/);
  assert.match(body.prompt, /A body\./);
});

test('orphan event compose returns three-section prompt (FR-31, AD-3)', async () => {
  seedRoot();
  const mod = await import('./route');
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({
    kind: 'event', name: 'lonely',
    overlay: { 'event.lonely.post': 'LIVE POST' },
  }) });
  const res = await mod.POST(req as any);
  const body = await res.json();
  assert.match(body.prompt, /L body\./);
  assert.match(body.prompt, /LIVE POST/);
  assert.doesNotMatch(body.prompt, /A body\./);
});

test('rejects invalid kind (NFR-6)', async () => {
  seedRoot();
  const mod = await import('./route');
  const res = await mod.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ kind: 'banana', name: 'x' }) }) as any);
  assert.strictEqual(res.status, 400);
});
