import { test, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Stub os.homedir() to redirect userDataPaths().actionEvents (AD-10).
const origHomedir: () => string = os.homedir;
function seedRoot(content: string | null): string {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-help-home-'));
  const root = path.join(fakeHome, '.radorc', 'action-events');
  fs.mkdirSync(root, { recursive: true });
  if (content !== null) fs.writeFileSync(path.join(root, 'README.md'), content);
  (os as unknown as { homedir: () => string }).homedir = () => fakeHome;
  return root;
}
afterEach(() => { (os as unknown as { homedir: () => string }).homedir = origHomedir; });

test('GET /api/action-events/help/readme returns installed README (FR-25, NFR-10)', async () => {
  seedRoot('# Hello README\n');
  const mod = await import('./route');
  const res = await mod.GET();
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.match(body.content, /# Hello README/);
});

test('GET returns 404 when README is missing (NFR-10)', async () => {
  seedRoot(null);
  const mod = await import('./route');
  const res = await mod.GET();
  assert.strictEqual(res.status, 404);
});
