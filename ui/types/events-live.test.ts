import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SSEEvent, SSEPayloadMap } from './events';

test('artifact_change is a file-content-free notification (projectName + kind) (FR-12)', () => {
  const ev: SSEEvent<'artifact_change'> = {
    type: 'artifact_change',
    timestamp: '2026-05-31T00:00:00.000Z',
    payload: { projectName: 'DEMO', kind: 'changed' },
  };
  assert.equal(ev.payload.projectName, 'DEMO');
  assert.ok(!('content' in ev.payload), 'no file bytes ride the stream');
  const keys = Object.keys(ev.payload).sort();
  assert.deepEqual(keys, ['kind', 'projectName']);
});

test('live_degraded signals the watcher health flag (FR-17)', () => {
  const ev: SSEEvent<'live_degraded'> = {
    type: 'live_degraded',
    timestamp: '2026-05-31T00:00:00.000Z',
    payload: { degraded: true },
  };
  assert.equal(ev.payload.degraded, true);
});

test('the new types are part of SSEPayloadMap', () => {
  const map: Pick<SSEPayloadMap, 'artifact_change' | 'live_degraded'> = {
    artifact_change: { projectName: 'X', kind: 'added' },
    live_degraded: { degraded: false },
  };
  assert.ok(map.artifact_change && map.live_degraded);
});
