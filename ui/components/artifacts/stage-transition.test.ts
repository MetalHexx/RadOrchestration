import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initStage, beginNavigate, markIncomingReady, applyLiveUpdate, isNavigation } from './stage-transition';

test('a navigation keeps the outgoing layer visible until the incoming is ready (FR-16, DD-7)', () => {
  let s = initStage('A.html');
  s = beginNavigate(s, 'B.html');
  assert.equal(s.front.fileName, 'A.html', 'outgoing stays on the visible front layer');
  assert.equal(s.back.fileName, 'B.html', 'incoming loads on the hidden back layer');
  assert.equal(s.crossfading, false, 'no crossfade until incoming reports ready');
  s = markIncomingReady(s);
  assert.equal(s.crossfading, true, 'crossfade begins only once incoming is ready (no white gap)');
  assert.equal(s.front.fileName, 'B.html', 'incoming promoted to front');
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
});
