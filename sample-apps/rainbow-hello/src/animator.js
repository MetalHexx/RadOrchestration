// sample-apps/rainbow-hello/src/animator.js

import { setTimeout } from 'node:timers/promises';
import { LETTER_ATLAS } from './letters.js';
import { createRainbowPalette, getColorForIndex } from './colors.js';
import {
  MESSAGE,
  LETTER_HEIGHT,
  LETTER_GAP,
  LETTER_PADDING_RIGHT,
  ANIM_LETTER_DELAY,
  ANIM_SPACE_DELAY,
  MARGIN_TOP,
  MARGIN_BOTTOM,
} from './tokens.js';

// ANSI escape constants
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const SAVE_CURSOR = '\x1b7';
const RESTORE_CURSOR = '\x1b8';

/**
 * Move cursor down by n rows.
 * @param {number} n - Number of rows to move down
 * @returns {string} ANSI escape sequence
 */
function cursorDown(n) {
  return `\x1b[${n}B`;
}

/**
 * Move cursor right by n columns.
 * @param {number} n - Number of columns to move right
 * @returns {string} ANSI escape sequence
 */
function cursorRight(n) {
  return `\x1b[${n}C`;
}

/**
 * Performs the animated character-by-character reveal of "HELLO WORLD".
 * Letters appear left to right. Each letter's all 5 rows appear simultaneously
 * via cursor positioning. Cursor is hidden during animation and restored on
 * completion or interruption (SIGINT).
 *
 * Writes directly to process.stdout. Uses setTimeout from node:timers/promises.
 *
 * @returns {Promise<void>} Resolves when animation is complete
 */
export async function animateReveal() {
  const palette = createRainbowPalette();
  const characters = [...MESSAGE];

  // Pre-compute column offsets dynamically from LETTER_ATLAS and token values
  const colOffsets = [];
  let col = 1; // 1-column left margin

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (char === ' ') {
      // Space character: record position, advance by space width (no padding)
      colOffsets.push(col);
      col += LETTER_ATLAS[' '][0].length;
    } else {
      // Inter-letter gap before non-space that follows another non-space
      if (i > 0 && characters[i - 1] !== ' ') {
        col += LETTER_GAP;
      }
      // Record position, advance by letter width + padding
      colOffsets.push(col);
      col += LETTER_ATLAS[char][0].length + LETTER_PADDING_RIGHT;
    }
  }

  // SIGINT cleanup handler — restores cursor visibility and exits
  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR);
    process.exit(0);
  };
  process.on('SIGINT', cleanup);

  // Hide cursor and reserve space
  process.stdout.write(HIDE_CURSOR);
  process.stdout.write('\n'.repeat(MARGIN_TOP));
  process.stdout.write(SAVE_CURSOR);
  process.stdout.write('\n'.repeat(LETTER_HEIGHT));

  // Animate character-by-character
  let colorIndex = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (char === ' ') {
      // Space: pause briefly, print nothing
      await setTimeout(ANIM_SPACE_DELAY);
      continue;
    }

    const colOffset = colOffsets[i];
    const colorizer = getColorForIndex(palette, colorIndex);

    // Write all 5 rows of this letter simultaneously via cursor positioning
    for (let row = 0; row < LETTER_HEIGHT; row++) {
      process.stdout.write(RESTORE_CURSOR);
      if (row > 0) {
        process.stdout.write(cursorDown(row));
      }
      if (colOffset > 0) {
        process.stdout.write(cursorRight(colOffset));
      }
      process.stdout.write(colorizer(LETTER_ATLAS[char][row]));
    }

    colorIndex++;
    await setTimeout(ANIM_LETTER_DELAY);
  }

  // Finalize output — move past the art area and add bottom margin
  process.stdout.write(RESTORE_CURSOR);
  process.stdout.write(cursorDown(LETTER_HEIGHT));
  process.stdout.write('\n'.repeat(MARGIN_BOTTOM) + '\n');
  process.stdout.write(SHOW_CURSOR);

  // Remove SIGINT handler to prevent listener leak
  process.removeListener('SIGINT', cleanup);
}
