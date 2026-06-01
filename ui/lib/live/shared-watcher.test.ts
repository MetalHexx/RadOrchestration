import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { __resetSharedWatcherForTest, getSharedWatcher } from './shared-watcher';

function fakeFactory() {
  let created = 0;
  const emitter = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
  emitter.close = async () => {};
  return {
    calls: () => created,
    make: () => { created += 1; return emitter; },
    emitter,
  };
}

test('watcher is created lazily on first subscribe and reused (HMR-safe singleton)', () => {
  __resetSharedWatcherForTest();
  const f = fakeFactory();
  const w1 = getSharedWatcher({ projectsRoot: '/p', makeWatcher: f.make });
  assert.equal(f.calls(), 0, 'no watcher before first subscribe');
  const off1 = w1.subscribe(() => {});
  assert.equal(f.calls(), 1, 'created on first subscribe');
  const w2 = getSharedWatcher({ projectsRoot: '/p', makeWatcher: f.make });
  const off2 = w2.subscribe(() => {});
  assert.equal(f.calls(), 1, 'second getSharedWatcher reuses the singleton — no second watcher');
  off1(); off2();
});

test('normalizes chokidar add/change/unlink into typed listener events (FR-11, FR-3)', () => {
  __resetSharedWatcherForTest();
  const f = fakeFactory();
  const w = getSharedWatcher({ projectsRoot: '/p', makeWatcher: f.make });
  const seen: Array<{ type: string; filePath: string }> = [];
  w.subscribe((e) => seen.push(e));
  f.emitter.emit('add', '/p/DEMO/DEMO-BRAINSTORMING.md');
  f.emitter.emit('change', '/p/DEMO/DEMO-BRAINSTORM.html');
  f.emitter.emit('unlink', '/p/DEMO/old.html');
  assert.deepEqual(seen, [
    { type: 'add', filePath: '/p/DEMO/DEMO-BRAINSTORMING.md' },
    { type: 'change', filePath: '/p/DEMO/DEMO-BRAINSTORM.html' },
    { type: 'unlink', filePath: '/p/DEMO/old.html' },
  ]);
});
