// sample-apps/rainbow-hello/test/letters.test.js

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { LETTER_ATLAS } from '../src/letters.js';
import { LETTER_HEIGHT, LETTER_WIDTH, WORD_GAP, BLOCK_CHAR } from '../src/tokens.js';

const REQUIRED_KEYS = ['H', 'E', 'L', 'O', 'W', 'R', 'D', ' '];

describe('LETTER_ATLAS', () => {

  describe('keys', () => {
    it('has exactly 8 keys', () => {
      assert.equal(Object.keys(LETTER_ATLAS).length, 8);
    });

    for (const key of REQUIRED_KEYS) {
      it(`contains key "${key === ' ' ? 'SPACE' : key}"`, () => {
        assert.ok(
          Object.prototype.hasOwnProperty.call(LETTER_ATLAS, key),
          `Missing key: "${key}"`
        );
      });
    }
  });

  describe('letter dimensions', () => {
    for (const key of REQUIRED_KEYS) {
      if (key === ' ') continue;
      describe(`letter "${key}"`, () => {
        it(`has exactly ${LETTER_HEIGHT} rows`, () => {
          assert.equal(LETTER_ATLAS[key].length, LETTER_HEIGHT);
        });
        it(`each row is exactly ${LETTER_WIDTH} characters wide`, () => {
          for (const row of LETTER_ATLAS[key]) {
            assert.equal(row.length, LETTER_WIDTH,
              `Row "${row}" has length ${row.length}, expected ${LETTER_WIDTH}`);
          }
        });
      });
    }
  });

  describe('space character', () => {
    it(`has exactly ${LETTER_HEIGHT} rows`, () => {
      assert.equal(LETTER_ATLAS[' '].length, LETTER_HEIGHT);
    });
    it(`each row is exactly ${WORD_GAP} characters wide`, () => {
      for (const row of LETTER_ATLAS[' ']) {
        assert.equal(row.length, WORD_GAP,
          `Space row "${row}" has length ${row.length}, expected ${WORD_GAP}`);
      }
    });
    it('contains only space characters', () => {
      for (const row of LETTER_ATLAS[' ']) {
        assert.ok(/^ +$/.test(row),
          `Space row should be all spaces, got: "${row}"`);
      }
    });
  });

  describe('character usage', () => {
    for (const key of REQUIRED_KEYS) {
      if (key === ' ') continue;
      it(`letter "${key}" uses only BLOCK_CHAR and space`, () => {
        for (const row of LETTER_ATLAS[key]) {
          for (const ch of row) {
            assert.ok(ch === BLOCK_CHAR || ch === ' ',
              `Unexpected character "${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase()}) in letter "${key}"`);
          }
        }
      });
    }
  });

  describe('row width consistency', () => {
    for (const key of REQUIRED_KEYS) {
      it(`letter "${key === ' ' ? 'SPACE' : key}" has uniform row widths`, () => {
        const widths = LETTER_ATLAS[key].map(r => r.length);
        const unique = new Set(widths);
        assert.equal(unique.size, 1,
          `Ragged rows in "${key}": widths are [${widths.join(', ')}]`);
      });
    }
  });

});
