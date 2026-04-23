// ui/lib/sse/broadcaster.test.ts
import assert from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SSEBroadcaster } from './broadcaster';

test('broadcaster instantiates exactly two watchers', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sse-b-'));
  const b = new SSEBroadcaster({ projectsDir: dir, debounceMs: 50, heartbeatMs: 60_000 });
  assert.strictEqual(b.watcherCount(), 2);
  await b.shutdownForTest();
  await rm(dir, { recursive: true, force: true });
});

test('subscribe / unsubscribe leave watcher count constant', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sse-b-'));
  const b = new SSEBroadcaster({ projectsDir: dir, debounceMs: 50, heartbeatMs: 60_000 });
  const before = b.watcherCount();
  const handles = Array.from({ length: 25 }, () =>
    b.subscribe({ enqueue: () => {}, onError: () => {} })
  );
  assert.strictEqual(b.watcherCount(), before);
  assert.strictEqual(b.subscriberCount(), 25);
  handles.forEach((h) => b.unsubscribe(h));
  assert.strictEqual(b.watcherCount(), before);
  assert.strictEqual(b.subscriberCount(), 0);
  await b.shutdownForTest();
  await rm(dir, { recursive: true, force: true });
});
