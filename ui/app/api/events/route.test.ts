import test from 'node:test';
import assert from 'node:assert/strict';
import * as eventsRoute from './route';

test('SSE events route pins the Node runtime and stays dynamic (AD-12)', () => {
  assert.equal(eventsRoute.runtime, 'nodejs');
  assert.equal(eventsRoute.dynamic, 'force-dynamic');
});
