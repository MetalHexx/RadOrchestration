// ui/lib/sse/singleton.test.ts
import assert from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('getBroadcaster returns same instance on re-import', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sse-s-'));
  process.env.__SSE_TEST_PROJECTS_DIR = dir;

  // Clear module cache to simulate HMR re-import.
  delete require.cache[require.resolve('./singleton')];
  const mod1 = await import('./singleton');
  delete require.cache[require.resolve('./singleton')];
  const mod2 = await import('./singleton');

  const b1 = mod1.getBroadcaster();
  const b2 = mod2.getBroadcaster();
  assert.strictEqual(b1, b2, 'broadcaster should be shared across re-imports');
  assert.strictEqual(b1.watcherCount(), 2);

  await b1.shutdownForTest();
  const g = globalThis as { __sseBroadcaster?: unknown };
  delete g.__sseBroadcaster;
  delete process.env.__SSE_TEST_PROJECTS_DIR;
  await rm(dir, { recursive: true, force: true });
});
