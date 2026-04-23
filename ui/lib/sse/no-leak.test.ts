// ui/lib/sse/no-leak.test.ts
import assert from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SSEBroadcaster } from './broadcaster';

test('50 subscribe/unsubscribe cycles leave watcher count at exactly 2', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sse-noleak-'));
  const b = new SSEBroadcaster({ projectsDir: dir, debounceMs: 50, heartbeatMs: 60_000 });
  const baseline = b.watcherCount();
  assert.strictEqual(baseline, 2);

  for (let i = 0; i < 50; i++) {
    const h = b.subscribe({ enqueue: () => {}, onError: () => {} });
    b.unsubscribe(h);
    assert.strictEqual(b.watcherCount(), baseline, `cycle ${i} leaked a watcher`);
  }
  assert.strictEqual(b.subscriberCount(), 0);

  await b.shutdownForTest();
  await rm(dir, { recursive: true, force: true });
});
