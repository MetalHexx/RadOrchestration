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

// A fake watcher that records how many times close() was called, so a test can
// assert the runtime tears down the outgoing watcher on restart (Defect 1).
function spyWatcher() {
  const e = new EventEmitter() as EventEmitter & { close: () => Promise<void>; closeCount: number };
  e.closeCount = 0;
  e.close = async () => { e.closeCount += 1; };
  return e;
}

// Builds a makeWatcher factory that hands out a fixed sequence of fake watchers,
// one per (re)start, so a test can drive restarts across distinct instances.
function watcherSequence(watchers: Array<ReturnType<typeof spyWatcher>>) {
  let i = 0;
  return () => watchers[Math.min(i++, watchers.length - 1)] as never;
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

test('a restart closes the outgoing watcher so fs handles do not leak (Defect 1)', () => {
  __resetLiveRuntimeForTest();
  const first = spyWatcher();
  const second = spyWatcher();
  const rt = getLiveRuntime({
    projectsRoot: '/p',
    makeWatcher: watcherSequence([first, second]),
    coalesceWindowMs: 0,
    maxRestarts: 1,
  });
  // Keep the runtime referenced so it is not flagged unused; no subscription needed
  // for this lifecycle assertion.
  void rt;
  first.emit('error', new Error('transient')); // budget allows one restart
  assert.equal(first.closeCount, 1, 'the previous watcher is closed exactly once on restart');
});

test('a healthy ready signal resets the restart budget so transient errors do not degrade (Defect 2)', () => {
  __resetLiveRuntimeForTest();
  const first = spyWatcher();
  const second = spyWatcher();
  const third = spyWatcher();
  const rt = getLiveRuntime({
    projectsRoot: '/p',
    makeWatcher: watcherSequence([first, second, third]),
    coalesceWindowMs: 0,
    maxRestarts: 1,
  });
  const degraded: Array<{ type: string }> = [];
  rt.subscribeDegraded((n) => degraded.push(n));
  first.emit('error', new Error('transient')); // restart #1 consumes the budget
  second.emit('ready'); // a healthy (re)start should reset the budget
  second.emit('error', new Error('transient')); // would degrade if the budget had not reset
  assert.deepEqual(degraded, [], 'a healthy ready signal reset the budget, so no degrade fired');
});

test('the /api/events route pins the Node runtime and stays dynamic (AD-12)', () => {
  const route = readFileSync(
    path.join(process.cwd(), 'app', 'api', 'events', 'route.ts'),
    'utf-8',
  );
  assert.match(route, /export\s+const\s+runtime\s*=\s*['"]nodejs['"]/, 'SSE route declares the Node runtime');
  assert.match(route, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, 'SSE route stays dynamic / non-cached');
});

test('a state.json change delivers the full parsed state over the state topic, read once at the hub (FR-1, NFR-5, DD-1)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({
    projectsRoot: '/p',
    makeWatcher: () => w as never,
    coalesceWindowMs: 50,
    scheduler: clock,
    readStateFile: () => JSON.stringify({ project: { name: 'DEMO' }, graph: { nodes: {} } }),
  });
  const got: Array<{ type: string; payload: { projectName: string; state: unknown } }> = [];
  const off = rt.subscribeAllStateTopics((n) => got.push(n));
  w.emit('change', '/p/DEMO/state.json');
  clock.flush();
  assert.equal(got.length, 1, 'one state_change delivered for a DEMO state.json change');
  assert.equal(got[0].type, 'state_change');
  assert.equal(got[0].payload.projectName, 'DEMO');
  assert.deepEqual(got[0].payload.state, { project: { name: 'DEMO' }, graph: { nodes: {} } });
  off();
});

test('a burst of state.json writes coalesces to one state_change per project (NFR-4)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({
    projectsRoot: '/p',
    makeWatcher: () => w as never,
    coalesceWindowMs: 50,
    scheduler: clock,
    readStateFile: () => JSON.stringify({ graph: { nodes: {} } }),
  });
  const got: string[] = [];
  const off = rt.subscribeAllStateTopics((n) => got.push(n.payload.projectName));
  w.emit('change', '/p/DEMO/state.json');
  w.emit('change', '/p/DEMO/state.json');
  w.emit('change', '/p/DEMO/state.json');
  clock.flush();
  assert.deepEqual(got, ['DEMO'], 'three rapid DEMO writes coalesce to one delivery');
  off();
});

test('a project directory created without a state.json fires project_added (FR-3, FR-4, DD-3)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({ projectsRoot: '/p', makeWatcher: () => w as never, coalesceWindowMs: 50, scheduler: clock });
  const got: Array<{ type: string; payload: { projectName: string }; timestamp?: string }> = [];
  const off = rt.subscribeLifecycle((n) => got.push(n));
  w.emit('addDir', '/p/DOCONLY');
  clock.flush();
  assert.deepEqual(got, [{ type: 'project_added', payload: { projectName: 'DOCONLY' }, timestamp: got[0]?.timestamp }]);
  off();
});

test('a project directory removal fires project_removed (FR-3, DD-3)', () => {
  __resetLiveRuntimeForTest();
  const w = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({ projectsRoot: '/p', makeWatcher: () => w as never, coalesceWindowMs: 50, scheduler: clock });
  const got: Array<{ type: string; payload: { projectName: string }; timestamp?: string }> = [];
  const off = rt.subscribeLifecycle((n) => got.push(n));
  w.emit('unlinkDir', '/p/OLD');
  clock.flush();
  assert.deepEqual(got, [{ type: 'project_removed', payload: { projectName: 'OLD' }, timestamp: got[0]?.timestamp }]);
  off();
});

test('a repo-registry.yml change fires an empty registry nudge from the registry watch root (FR-2, AD-2, DD-2)', () => {
  __resetLiveRuntimeForTest();
  const projectsW = fakeWatcher();
  const registryW = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({
    projectsRoot: '/home/.radorc/projects',
    registryRoot: '/home/.radorc',
    makeWatcher: () => projectsW as never,
    makeRegistryWatcher: () => registryW as never,
    coalesceWindowMs: 50,
    scheduler: clock,
  });
  const got: Array<{ type: string; payload: Record<string, never> }> = [];
  const off = rt.subscribeRegistry((n) => got.push(n));
  registryW.emit('change', '/home/.radorc/repo-registry.yml');
  clock.flush();
  assert.equal(got.length, 1, 'one registry nudge delivered');
  assert.equal(got[0].type, 'registry_change');
  assert.deepEqual(got[0].payload, {});
  off();
});

test('the local registry override file also fires a nudge; a non-registry file does not (FR-2)', () => {
  __resetLiveRuntimeForTest();
  const projectsW = fakeWatcher();
  const registryW = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({
    projectsRoot: '/home/.radorc/projects',
    registryRoot: '/home/.radorc',
    makeWatcher: () => projectsW as never,
    makeRegistryWatcher: () => registryW as never,
    coalesceWindowMs: 50,
    scheduler: clock,
  });
  const got: string[] = [];
  const off = rt.subscribeRegistry((n) => got.push(n.type));
  registryW.emit('change', '/home/.radorc/repo-registry.local.yml');
  registryW.emit('change', '/home/.radorc/orchestration.yml');
  clock.flush();
  assert.deepEqual(got, ['registry_change'], 'only registry files nudge; orchestration.yml is ignored');
  off();
});

test('a registry change never reaches an artifact subscriber (AD-1 topic isolation)', () => {
  __resetLiveRuntimeForTest();
  const projectsW = fakeWatcher();
  const registryW = fakeWatcher();
  const clock = manualClock();
  const rt = getLiveRuntime({
    projectsRoot: '/home/.radorc/projects',
    registryRoot: '/home/.radorc',
    makeWatcher: () => projectsW as never,
    makeRegistryWatcher: () => registryW as never,
    coalesceWindowMs: 50,
    scheduler: clock,
  });
  const got: unknown[] = [];
  const off = rt.subscribeAllArtifactTopics((n) => got.push(n));
  registryW.emit('change', '/home/.radorc/repo-registry.yml');
  clock.flush();
  assert.equal(got.length, 0, 'a registry event must not be delivered to artifact subscribers');
  off();
});
