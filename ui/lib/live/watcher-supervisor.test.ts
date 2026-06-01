import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWatcherSupervisor } from './watcher-supervisor';

test('restarts on error up to the cap, then flips to degraded (NFR-6, AD-13)', () => {
  let starts = 0;
  const degraded: boolean[] = [];
  const sup = createWatcherSupervisor({
    maxRestarts: 2,
    start: () => { starts += 1; },
    onDegraded: () => degraded.push(true),
  });
  sup.start();
  assert.equal(starts, 1);
  sup.reportError(new Error('boom'));
  assert.equal(starts, 2, 'first error restarts');
  sup.reportError(new Error('boom'));
  assert.equal(starts, 3, 'second error restarts');
  assert.equal(sup.isDegraded(), false);
  sup.reportError(new Error('boom'));
  assert.equal(starts, 3, 'no restart past the cap');
  assert.equal(sup.isDegraded(), true, 'flips to degraded after exhausting restarts');
  assert.deepEqual(degraded, [true], 'degraded callback fired exactly once');
});

test('a healthy restart resets the restart budget (FR-17)', () => {
  const sup = createWatcherSupervisor({ maxRestarts: 1, start: () => {}, onDegraded: () => {} });
  sup.start();
  sup.reportError(new Error('x'));
  sup.reportHealthy();
  sup.reportError(new Error('y'));
  assert.equal(sup.isDegraded(), false, 'budget reset by a healthy signal');
});
