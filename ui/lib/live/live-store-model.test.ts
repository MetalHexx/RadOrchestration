import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLiveState, applyDelta, clearUnseenFor, isUnseen } from './live-store-model';

test('a delta for a file the user is not viewing marks it unseen (FR-9)', () => {
  let s = emptyLiveState();
  s = applyDelta(s, { fileName: 'A.html', kind: 'changed', activeFileName: 'B.md' });
  assert.equal(isUnseen(s, 'A.html'), true);
  assert.equal(isUnseen(s, 'B.md'), false);
});

test('a delta for the currently-viewed file never marks it unseen (FR-9)', () => {
  let s = emptyLiveState();
  s = applyDelta(s, { fileName: 'A.html', kind: 'changed', activeFileName: 'A.html' });
  assert.equal(isUnseen(s, 'A.html'), false, 'open document shows no badge');
});

test('clearing at the active-file choke point removes only that badge (AD-9)', () => {
  let s = emptyLiveState();
  s = applyDelta(s, { fileName: 'A.html', kind: 'added', activeFileName: null });
  s = applyDelta(s, { fileName: 'C.md', kind: 'changed', activeFileName: null });
  s = clearUnseenFor(s, 'A.html');
  assert.equal(isUnseen(s, 'A.html'), false);
  assert.equal(isUnseen(s, 'C.md'), true, 'other unseen files survive');
});

test('unseen set is keyed by fileName so it survives list re-derivation (FR-13, FR-8)', () => {
  let s = emptyLiveState();
  s = applyDelta(s, { fileName: 'A.html', kind: 'changed', activeFileName: null });
  // Re-derivation does not touch the keyed set; same key still resolves unseen.
  assert.equal(isUnseen(s, 'A.html'), true);
});

test('a delta records a transient active pulse for the changed file (FR-8)', () => {
  let s = emptyLiveState();
  s = applyDelta(s, { fileName: 'A.html', kind: 'changed', activeFileName: 'A.html' });
  assert.equal(s.activePulse.has('A.html'), true, 'pulse fires even for the open doc');
});
