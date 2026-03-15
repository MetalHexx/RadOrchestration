// sample-apps/rainbow-hello/src/letters.js

import { BLOCK_CHAR, LETTER_HEIGHT, LETTER_WIDTH, WORD_GAP } from './tokens.js';

// Internal helpers for readability when composing letter rows
const B = BLOCK_CHAR;
const S = ' ';

/**
 * ASCII art letter definitions using block characters.
 * Each letter is a 5-row array of strings. Each string is exactly
 * LETTER_WIDTH (5) characters wide (strokes + spaces).
 * The space character is WORD_GAP (3) characters wide.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
export const LETTER_ATLAS = Object.freeze({
  H: Object.freeze([
    B+S+S+S+B,
    B+S+S+S+B,
    B+B+B+B+B,
    B+S+S+S+B,
    B+S+S+S+B,
  ]),
  E: Object.freeze([
    B+B+B+B+B,
    B+S+S+S+S,
    B+B+B+B+S,
    B+S+S+S+S,
    B+B+B+B+B,
  ]),
  L: Object.freeze([
    B+S+S+S+S,
    B+S+S+S+S,
    B+S+S+S+S,
    B+S+S+S+S,
    B+B+B+B+B,
  ]),
  O: Object.freeze([
    B+B+B+B+B,
    B+S+S+S+B,
    B+S+S+S+B,
    B+S+S+S+B,
    B+B+B+B+B,
  ]),
  W: Object.freeze([
    B+S+S+S+B,
    B+S+S+S+B,
    B+S+B+S+B,
    B+B+B+B+B,
    S+B+S+B+S,
  ]),
  R: Object.freeze([
    B+B+B+B+S,
    B+S+S+S+B,
    B+B+B+B+S,
    B+S+B+S+S,
    B+S+S+B+S,
  ]),
  D: Object.freeze([
    B+B+B+B+S,
    B+S+S+S+B,
    B+S+S+S+B,
    B+S+S+S+B,
    B+B+B+B+S,
  ]),
  ' ': Object.freeze([
    S+S+S,
    S+S+S,
    S+S+S,
    S+S+S,
    S+S+S,
  ]),
});
