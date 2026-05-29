import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('GET /api/action-events/catalog returns entries shaped by listCatalogEntries (FR-26, NFR-6)', async () => {
  // Stub os.homedir() to redirect userDataPaths().actionEvents at a
  // temp directory — same convention used by fs-reader-bootstrap.test.ts.
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-route-home-'));
  const root = path.join(fakeHome, '.radorc', 'action-events');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'event.lonely.md'),
    '---\nkind: event\nname: lonely\ntitle: Lonely\ndescription: d\nsignal_payload: {}\n---\n\nbody\n');
  const origHomedir = os.homedir;
  (os as unknown as { homedir: () => string }).homedir = () => fakeHome;
  try {
    const mod = await import('./route');
    const res = await mod.GET();
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(body.entries));
    assert.ok(body.entries.find((e: { name: string }) => e.name === 'lonely'));
  } finally {
    (os as unknown as { homedir: () => string }).homedir = origHomedir;
  }
});
