// sample-apps/rainbow-hello/test/renderer.test.js

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderLine, renderRainbowHello } from '../src/renderer.js';
import { createRainbowPalette } from '../src/colors.js';
import { MESSAGE, LETTER_HEIGHT, MARGIN_TOP, MARGIN_BOTTOM, BLOCK_CHAR } from '../src/tokens.js';

/** Strips ANSI escape sequences from a string */
const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

describe('renderRainbowHello', () => {
  const output = renderRainbowHello();
  const lines = output.split('\n');
  const artLines = lines.slice(MARGIN_TOP, MARGIN_TOP + LETTER_HEIGHT);

  it('produces exactly MARGIN_TOP + LETTER_HEIGHT + MARGIN_BOTTOM lines', () => {
    const expected = MARGIN_TOP + LETTER_HEIGHT + MARGIN_BOTTOM;
    assert.equal(lines.length, expected, `Expected ${expected} lines, got ${lines.length}`);
  });

  it('has 5 art lines in the middle', () => {
    assert.equal(artLines.length, LETTER_HEIGHT, `Expected ${LETTER_HEIGHT} art lines`);
  });

  it('top margin is an empty string', () => {
    assert.equal(lines[0], '', 'First line should be empty (top margin)');
  });

  it('bottom margin is an empty string', () => {
    assert.equal(lines[lines.length - 1], '', 'Last line should be empty (bottom margin)');
  });

  it('ANSI-stripped art lines contain BLOCK_CHAR', () => {
    for (const line of artLines) {
      const stripped = stripAnsi(line);
      assert.ok(stripped.includes(BLOCK_CHAR), `Art line should contain ${BLOCK_CHAR}`);
    }
  });

  it('ANSI-stripped art lines are non-empty', () => {
    for (const line of artLines) {
      const stripped = stripAnsi(line);
      assert.ok(stripped.length > 0, 'Stripped art line should be non-empty');
    }
  });

  it('art lines contain ANSI escape sequences', () => {
    const hasAnsi = artLines.some((line) => /\x1b\[/.test(line));
    assert.ok(hasAnsi, 'At least one art line should contain ANSI escape sequences');
  });

  it('no ANSI-stripped art line exceeds 80 columns', () => {
    for (const line of artLines) {
      const stripped = stripAnsi(line);
      assert.ok(stripped.length <= 80, `Line width ${stripped.length} exceeds 80 columns`);
    }
  });

  it('each ANSI-stripped art line starts with a space (left margin)', () => {
    for (const line of artLines) {
      const stripped = stripAnsi(line);
      assert.equal(stripped[0], ' ', 'Art line should start with a space (left margin)');
    }
  });
});

describe('renderLine', () => {
  const palette = createRainbowPalette();
  const characters = [...MESSAGE];

  it('returns a string', () => {
    const result = renderLine(0, characters, palette);
    assert.equal(typeof result, 'string', 'renderLine should return a string');
  });

  it('result contains ANSI color codes', () => {
    const result = renderLine(0, characters, palette);
    assert.ok(/\x1b\[/.test(result), 'renderLine result should contain ANSI escape sequences');
  });

  it('stripped result contains BLOCK_CHAR', () => {
    const result = renderLine(0, characters, palette);
    const stripped = stripAnsi(result);
    assert.ok(stripped.includes(BLOCK_CHAR), `Stripped result should contain ${BLOCK_CHAR}`);
  });
});
