import { test } from 'node:test';
import assert from 'node:assert';
import { rowStatus, desiredSet } from './membership-diff';

test('detail mode classifies plain / pending-add / pending-remove against saved set (FR-13, DD-6)', () => {
  const saved = ['a', 'b'];
  const checked = new Set(['a', 'c']); // b removed, c added, a unchanged
  assert.strictEqual(rowStatus('a', saved, checked, 'detail'), 'plain');
  assert.strictEqual(rowStatus('c', saved, checked, 'detail'), 'pending-add');
  assert.strictEqual(rowStatus('b', saved, checked, 'detail'), 'pending-remove');
});

test('unchecked-and-never-saved row is plain in detail mode (DD-6)', () => {
  assert.strictEqual(rowStatus('z', ['a'], new Set(['a']), 'detail'), 'plain');
});

test('create mode never tags staging — checked or plain only (FR-13, DD-6)', () => {
  assert.strictEqual(rowStatus('c', [], new Set(['c']), 'create'), 'checked');
  assert.strictEqual(rowStatus('d', [], new Set(['c']), 'create'), 'plain');
});

test('desiredSet returns the complete checked set as a sorted array (FR-13)', () => {
  assert.deepStrictEqual(desiredSet(new Set(['b', 'a'])), ['a', 'b']);
});
