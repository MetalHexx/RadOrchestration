// sample-apps/rainbow-hello/src/tokens.js

/** @type {number} Height of each ASCII art letter in rows */
export const LETTER_HEIGHT = 5;

/** @type {number} Width of each letter's stroke area in columns */
export const LETTER_WIDTH = 5;

/** @type {number} Padding to the right of each letter tile (columns) */
export const LETTER_PADDING_RIGHT = 1;

/** @type {number} Space between adjacent letters within a word (columns) */
export const LETTER_GAP = 1;

/** @type {number} Space between "HELLO" and "WORLD" (columns) */
export const WORD_GAP = 3;

/** @type {number} Empty lines above the ASCII art block */
export const MARGIN_TOP = 1;

/** @type {number} Empty lines below the ASCII art block */
export const MARGIN_BOTTOM = 1;

/** @type {string} Primary stroke character for letter forms (U+2588) */
export const BLOCK_CHAR = '█';

/** @type {string} The hardcoded message to render */
export const MESSAGE = 'HELLO WORLD';

/**
 * Rainbow palette as 7 RGB tuples.
 * Order: Red, Orange, Yellow, Green, Cyan, Blue, Purple.
 * Used by colors.js to create chalk colorizer functions.
 * @type {ReadonlyArray<[number, number, number]>}
 */
export const RAINBOW_PALETTE = Object.freeze([
  [255, 0, 0],       // Red
  [255, 127, 0],     // Orange
  [255, 255, 0],     // Yellow
  [0, 255, 0],       // Green
  [0, 255, 255],     // Cyan
  [0, 0, 255],       // Blue
  [148, 0, 211],     // Purple
]);

/** @type {number} Delay in ms between revealing each letter (Phase 2) */
export const ANIM_LETTER_DELAY = 150;

/** @type {number} Delay in ms for the word gap during animation (Phase 2) */
export const ANIM_SPACE_DELAY = 75;
