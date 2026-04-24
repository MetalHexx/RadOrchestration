/**
 * Tests for useStartAction — exercised by directly invoking the exported
 * helper `postStartAction` (shared between the hook and its tests) so we
 * don't need a React renderer in Node. The hook's effect semantics are
 * simple: call helper → set pending → clear on response.
 */
import assert from 'node:assert/strict';
import { postStartAction } from './use-start-action';

const originalFetch = globalThis.fetch;

async function withFetch(
  impl: (url: string, init: RequestInit | undefined) => Promise<Response>,
  fn: () => Promise<void>,
) {
  globalThis.fetch = impl as unknown as typeof fetch;
  try { await fn(); } finally { globalThis.fetch = originalFetch; }
}

async function run() {
  // Success → returns { success: true, platform }
  await withFetch(
    async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      assert.equal(body.action, 'start-brainstorming');
      return new Response(JSON.stringify({ success: true, platform: 'linux' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
    async () => {
      const res = await postStartAction('DEMO', 'start-brainstorming');
      assert.deepEqual(res, { success: true, platform: 'linux' });
      console.log('✓ success → { success:true, platform }');
    },
  );

  // Failure → returns { success: false, error }
  await withFetch(
    async () =>
      new Response(JSON.stringify({ success: false, error: 'Launcher failed.' }), {
        status: 500, headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const res = await postStartAction('DEMO', 'start-planning');
      assert.equal(res.success, false);
      assert.equal(res.error, 'Launcher failed.');
      console.log('✓ failure → { success:false, error }');
    },
  );

  // Network error → returns { success: false, error: <message> }
  await withFetch(
    async () => { throw new Error('offline'); },
    async () => {
      const res = await postStartAction('DEMO', 'start-planning');
      assert.equal(res.success, false);
      assert.match(res.error ?? '', /offline|network/i);
      console.log('✓ network error → { success:false, error }');
    },
  );

  console.log('\nAll use-start-action tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
