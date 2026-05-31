import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { __resetLiveRuntimeForTest, getLiveRuntime } from './live-hub-runtime';

function fakeWatcher() {
  const e = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
  e.close = async () => {};
  return e;
}

function manualClock() {
  let pending: Array<() => void> = [];
  return {
    schedule: (cb: () => void) => { pending.push(cb); return pending.length; },
    cancel: () => {},
    flush: () => { const p = pending; pending = []; p.forEach((c) => c()); },
  };
}

test('a burst of changes coalesces to one artifact_change notification via the real all-topics subscribe (FR-12, NFR-4, AD-4)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({ projectsRoot: '/p', makeWatcher: () => w as never, coalesceWindowMs: 50, scheduler: clock });
  const got: Array<{ type: string; payload: { projectName: string; kind: string } }> = [];
  const off = rt.subscribeAllArtifactTopics((notif) => got.push(notif));
  w.emit('change', '/p/DEMO/DEMO-BRAINSTORMING.md');
  w.emit('change', '/p/DEMO/DEMO-BRAINSTORM.html');
  assert.equal(got.length, 0, 'nothing delivered before the coalesce window flushes');
  clock.flush();
  assert.equal(got.length, 1, 'two DEMO writes coalesced into one notification through subscribeAll');
  assert.equal(got[0].type, 'artifact_change');
  assert.equal(got[0].payload.projectName, 'DEMO');
  off();
});

test('the all-topics subscribe fans in changes from multiple projects (FR-11, AD-5, AD-4)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({ projectsRoot: '/p', makeWatcher: () => w as never, coalesceWindowMs: 50, scheduler: clock });
  const got: string[] = [];
  const off = rt.subscribeAllArtifactTopics((n) => got.push(n.payload.projectName));
  w.emit('change', '/p/ALPHA/ALPHA-BRAINSTORMING.md');
  w.emit('add', '/p/BETA/BETA-BRAINSTORM.html');
  clock.flush();
  assert.deepEqual(got.sort(), ['ALPHA', 'BETA'], 'one connection-level subscribe receives every project topic');
  off();
});

test('unsubscribe drops only the in-memory subscriber; the watcher stays warm (NFR-1, AD-5)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  let closed = false;
  w.close = async () => { closed = true; };
  const rt = getLiveRuntime({ projectsRoot: '/p', makeWatcher: () => w as never, coalesceWindowMs: 0 });
  const off = rt.subscribeAllArtifactTopics(() => {});
  off();
  assert.equal(closed, false, 'disconnect never tears down the shared watcher');
});

test('supervisor degradation surfaces a live_degraded notification (FR-17, AD-13)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const rt = getLiveRuntime({ projectsRoot: '/p', makeWatcher: () => w as never, coalesceWindowMs: 0, maxRestarts: 0 });
  const got: Array<{ type: string }> = [];
  rt.subscribeDegraded((n) => got.push(n));
  w.emit('error', new Error('dead'));
  assert.deepEqual(got, [{ type: 'live_degraded', payload: { degraded: true } }]);
});

test('the /api/events route pins the Node runtime and stays dynamic (AD-12)', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app', 'api', 'events', 'route.ts'),
    'utf-8',
  );
  assert.match(route, /export\s+const\s+runtime\s*=\s*['"]nodejs['"]/, 'SSE route declares the Node runtime');
  assert.match(route, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, 'SSE route stays dynamic / non-cached');
});
