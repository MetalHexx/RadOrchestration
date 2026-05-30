import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, prevIndex, indexAfterDelete } from './use-artifact-modal';

test('nextIndex advances and loops past the end (FR-14)', () => {
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(nextIndex(2, 3), 0);
});

test('prevIndex retreats and loops past the start (FR-14)', () => {
  assert.equal(prevIndex(1, 3), 0);
  assert.equal(prevIndex(0, 3), 2);
});

test('indexAfterDelete keeps position when a middle item is removed (FR-19)', () => {
  // deleting index 1 of 3 → list length 2, stay at index 1 (now the old index 2)
  assert.equal(indexAfterDelete(1, 3), 1);
});

test('indexAfterDelete clamps when the last item in the list is removed (FR-19)', () => {
  // deleting index 2 of 3 → list length 2, clamp to index 1
  assert.equal(indexAfterDelete(2, 3), 1);
});

test('indexAfterDelete returns -1 when the only item is removed so the modal closes (FR-19)', () => {
  assert.equal(indexAfterDelete(0, 1), -1);
});
