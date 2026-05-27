import { test } from 'node:test';
import assert from 'node:assert';
import { computeAnyDirty, reduceDirty } from './use-dirty-cards';

test('reduceDirty marks a slot dirty when content diverges (FR-17 base, FR-22)', () => {
  const next = reduceDirty({}, { type: 'set', key: 'action.exec.pre', dirty: true });
  assert.strictEqual(next['action.exec.pre'], true);
});

test('reduceDirty clears a slot when saved or discarded (FR-22)', () => {
  const next = reduceDirty({ 'action.exec.pre': true }, { type: 'set', key: 'action.exec.pre', dirty: false });
  assert.strictEqual(next['action.exec.pre'], false);
});

test('computeAnyDirty returns true if any slot is dirty (FR-22)', () => {
  assert.strictEqual(computeAnyDirty({ a: false, b: true }), true);
  assert.strictEqual(computeAnyDirty({ a: false, b: false }), false);
});
