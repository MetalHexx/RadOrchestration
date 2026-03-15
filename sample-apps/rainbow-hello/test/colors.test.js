// sample-apps/rainbow-hello/test/colors.test.js

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createRainbowPalette, getColorForIndex } from '../src/colors.js';

describe('createRainbowPalette', () => {
  const palette = createRainbowPalette();

  it('returns an array of exactly 7 entries', () => {
    assert.equal(Array.isArray(palette), true);
    assert.equal(palette.length, 7);
  });

  it('each palette entry is a function', () => {
    for (const colorizer of palette) {
      assert.equal(typeof colorizer, 'function');
    }
  });

  it('calling a palette function with a string returns a string', () => {
    const result = palette[0]('X');
    assert.equal(typeof result, 'string');
  });

  it('returned string contains ANSI escape codes', () => {
    const result = palette[0]('X');
    assert.match(result, /\x1b\[/);
  });
});

describe('getColorForIndex', () => {
  const palette = createRainbowPalette();

  it('returns palette[0] for index 0', () => {
    assert.equal(getColorForIndex(palette, 0), palette[0]);
  });

  it('returns palette[6] for index 6', () => {
    assert.equal(getColorForIndex(palette, 6), palette[6]);
  });

  it('wraps to palette[0] for index 7', () => {
    assert.equal(getColorForIndex(palette, 7), palette[0]);
  });

  it('wraps to palette[2] for index 9', () => {
    assert.equal(getColorForIndex(palette, 9), palette[2]);
  });

  it('double-wraps to palette[0] for index 14', () => {
    assert.equal(getColorForIndex(palette, 14), palette[0]);
  });
});
