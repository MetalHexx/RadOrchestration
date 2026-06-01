import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initStage,
  beginNavigate,
  markIncomingReady,
  settleStage,
  applyLiveUpdate,
  isNavigation,
  frontFileName,
} from './stage-transition';

test('a navigation keeps the outgoing doc visible until the incoming is ready, then promotes (FR-16, DD-7, DD-8)', () => {
  let s = initStage('A.html');
  s = beginNavigate(s, 'B.html');
  assert.equal(frontFileName(s), 'A.html', 'outgoing stays the foreground while the incoming loads (no white gap)');
  assert.notEqual(s.incoming, null, 'incoming loads into the background slot');
  assert.equal(s.slots[s.incoming!]?.fileName, 'B.html', 'background slot holds the incoming file');
  assert.equal(s.crossfading, false, 'no crossfade until the incoming reports ready');

  s = markIncomingReady(s);
  assert.equal(s.crossfading, true, 'crossfade begins only once the incoming is ready');
  assert.equal(frontFileName(s), 'A.html', 'foreground is unchanged during the fade — incoming fades in on top of it');

  const incomingSlot = s.incoming!;
  s = settleStage(s);
  assert.equal(frontFileName(s), 'B.html', 'incoming is promoted to the foreground once the fade completes');
  assert.equal(s.front, incomingSlot, 'the promoted slot is the SAME physical slot the incoming loaded into (no remount)');
  assert.equal(s.incoming, null, 'no incoming after settle');
  assert.equal(s.crossfading, false, 'crossfade cleared after settle');
  assert.equal(s.slots[incomingSlot === 0 ? 1 : 0], null, 'the outgoing buffer is freed');
});

test('markIncomingReady is idempotent — a repeated ready signal cannot re-trigger promotion (no swap loop)', () => {
  let s = initStage('A.html');
  s = beginNavigate(s, 'B.html');
  const ready1 = markIncomingReady(s);
  const ready2 = markIncomingReady(ready1);
  assert.equal(ready2.front, ready1.front, 'front does not move on a repeated ready signal');
  assert.equal(ready2.incoming, ready1.incoming, 'incoming does not move on a repeated ready signal');
  assert.equal(ready2.crossfading, true, 'still cross-fading, not flipped back');
  // After settle, the incoming is cleared so a stray ready signal is a no-op.
  const settled = settleStage(ready2);
  assert.equal(markIncomingReady(settled), settled, 'a ready signal after settle is a no-op (loop is impossible)');
});

test('two consecutive navigations ping-pong between the two slots (DD-7)', () => {
  let s = initStage('A.html'); // A in slot 0
  s = settleStage(markIncomingReady(beginNavigate(s, 'B.html')));
  const bSlot = s.front;
  assert.notEqual(bSlot, 0, 'B promoted into the other slot, not A\'s slot');
  s = settleStage(markIncomingReady(beginNavigate(s, 'C.html')));
  assert.notEqual(s.front, bSlot, 'C promoted into the slot B vacated — slots alternate');
  assert.equal(frontFileName(s), 'C.html');
});

test('an in-place update of the same file is not a navigation and preserves scroll (DD-11, FR-2)', () => {
  const s = initStage('A.md');
  const update = applyLiveUpdate(s, 'A.md');
  assert.equal(isNavigation(s, 'A.md'), false, 'same file is an in-place update, not a navigation');
  assert.equal(update.preserveScroll, true, 'markdown in-place update preserves scroll');
  assert.equal(update.crossfade, false, 'no full cross-fade for an in-place update');
});

test('a live update to a different file is a navigation cross-fade (FR-16)', () => {
  const s = initStage('A.md');
  assert.equal(isNavigation(s, 'B.html'), true);
  assert.equal(applyLiveUpdate(s, 'B.html').crossfade, true, 'a different file cross-fades');
});

test('beginNavigate to the current file is a no-op', () => {
  const s = initStage('A.html');
  assert.equal(beginNavigate(s, 'A.html'), s, 'navigating to the already-foreground file changes nothing');
});
