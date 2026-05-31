import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTopicHub } from './topic-hub';

function manualClock() {
  let pending: Array<() => void> = [];
  return {
    schedule: (cb: () => void) => { pending.push(cb); return pending.length; },
    cancel: () => {},
    flush: () => { const p = pending; pending = []; p.forEach((c) => c()); },
  };
}

test('coalesces a burst on one topic into a single delivered event per window (NFR-4)', () => {
  const clock = manualClock();
  const hub = createTopicHub({ coalesceWindowMs: 50, maxQueuePerTopic: 1, scheduler: clock });
  const got: unknown[] = [];
  hub.subscribe(['artifacts:DEMO'], (e) => got.push(e));
  hub.publish({ topic: 'artifacts:DEMO', kind: 'changed', projectName: 'DEMO' });
  hub.publish({ topic: 'artifacts:DEMO', kind: 'changed', projectName: 'DEMO' });
  hub.publish({ topic: 'artifacts:DEMO', kind: 'changed', projectName: 'DEMO' });
  assert.equal(got.length, 0, 'nothing delivered before the window flushes');
  clock.flush();
  assert.equal(got.length, 1, 'three writes collapsed into one notification');
});

test('only delivers events for subscribed topics (NFR-1 topic filtering)', () => {
  const clock = manualClock();
  const hub = createTopicHub({ coalesceWindowMs: 50, maxQueuePerTopic: 1, scheduler: clock });
  const got: string[] = [];
  hub.subscribe(['artifacts:A'], (e) => got.push(e.projectName));
  hub.publish({ topic: 'artifacts:B', kind: 'changed', projectName: 'B' });
  clock.flush();
  assert.deepEqual(got, [], 'B events never reach an A-only subscriber');
});

test('bounded queue keeps only the latest per topic under backpressure (AD-14, NFR-5)', () => {
  const clock = manualClock();
  const hub = createTopicHub({ coalesceWindowMs: 50, maxQueuePerTopic: 1, scheduler: clock });
  const got: Array<{ kind: string }> = [];
  hub.subscribe(['artifacts:DEMO'], (e) => got.push({ kind: e.kind }));
  hub.publish({ topic: 'artifacts:DEMO', kind: 'added', projectName: 'DEMO' });
  hub.publish({ topic: 'artifacts:DEMO', kind: 'removed', projectName: 'DEMO' });
  clock.flush();
  assert.deepEqual(got, [{ kind: 'removed' }], 'latest event per topic wins; queue never grows past 1');
});

test('an all-topics subscriber receives events across multiple distinct topics (AD-4)', () => {
  const clock = manualClock();
  const hub = createTopicHub({ coalesceWindowMs: 50, maxQueuePerTopic: 1, scheduler: clock });
  const got: string[] = [];
  // subscribeAll registers a connection-level listener fed on every publish,
  // with no enumeration of topics — distinct from per-topic subscribe.
  hub.subscribeAll((e) => got.push(`${e.projectName}:${e.kind}`));
  hub.publish({ topic: 'artifacts:A', kind: 'changed', projectName: 'A' });
  hub.publish({ topic: 'artifacts:B', kind: 'added', projectName: 'B' });
  clock.flush();
  assert.deepEqual(got.sort(), ['A:changed', 'B:added'], 'every project topic fans in to the all-topics subscriber');
});

test('all-topics subscriber still coalesces and bounds per topic (AD-4, NFR-4, NFR-5)', () => {
  const clock = manualClock();
  const hub = createTopicHub({ coalesceWindowMs: 50, maxQueuePerTopic: 1, scheduler: clock });
  const got: Array<{ topic: string; kind: string }> = [];
  const off = hub.subscribeAll((e) => got.push({ topic: e.topic, kind: e.kind }));
  // Burst on one topic collapses to its latest; a second topic is independent.
  hub.publish({ topic: 'artifacts:A', kind: 'added', projectName: 'A' });
  hub.publish({ topic: 'artifacts:A', kind: 'changed', projectName: 'A' });
  hub.publish({ topic: 'artifacts:B', kind: 'changed', projectName: 'B' });
  clock.flush();
  assert.deepEqual(
    got.sort((x, y) => x.topic.localeCompare(y.topic)),
    [{ topic: 'artifacts:A', kind: 'changed' }, { topic: 'artifacts:B', kind: 'changed' }],
    'latest-per-topic coalescing and bounding apply to the all-topics subscriber too',
  );
  off();
});
