import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { deleteArtifact } from './use-project-artifacts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('posts to the delete route with encoded project and path (FR-20, AD-6)', async () => {
  let captured = '';
  let method = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = (async (url: string, init?: any) => {
    captured = url; method = init?.method ?? 'GET';
    return { ok: true, json: async () => ({ success: true }) } as Response;
  }) as typeof fetch;
  const ok = await deleteArtifact('DEMO', 'DEMO-WIREFRAME-X.html');
  assert.equal(ok, true);
  assert.equal(method, 'POST');
  assert.ok(captured.includes('/api/projects/DEMO/delete?path=DEMO-WIREFRAME-X.html'), 'targets delete route');
});

test('returns false when the delete request fails (NFR-3)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({ error: 'nope' }) } as Response)) as typeof fetch;
  const ok = await deleteArtifact('DEMO', 'GONE.html');
  assert.equal(ok, false);
});
