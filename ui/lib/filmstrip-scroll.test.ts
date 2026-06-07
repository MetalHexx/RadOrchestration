import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centerScrollLeft, pageScrollDelta, shouldHijackWheel } from './filmstrip-scroll';

test('centers a cell within the viewport', () => {
  // container 480 wide, cell 96 wide at offset 600 → 600 - (480-96)/2 = 408
  assert.equal(centerScrollLeft(480, 600, 96), 408);
});
test('never returns a negative scroll position', () => {
  assert.equal(centerScrollLeft(480, 10, 96), 0);
});
test('pageScrollDelta pages roughly one viewport width', () => {
  assert.equal(pageScrollDelta(500), 400);
});

test('shouldHijackWheel only fires on overflow with vertical-only delta', () => {
  assert.equal(shouldHijackWheel(0, 40, 800, 400), true);   // overflow, vertical only
  assert.equal(shouldHijackWheel(0, 40, 400, 400), false);  // no overflow
  assert.equal(shouldHijackWheel(10, 40, 800, 400), false); // horizontal delta present
  assert.equal(shouldHijackWheel(0, 0, 800, 400), false);   // no vertical delta
});
