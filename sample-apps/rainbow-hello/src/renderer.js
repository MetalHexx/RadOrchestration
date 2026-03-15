// sample-apps/rainbow-hello/src/renderer.js

import { LETTER_ATLAS } from './letters.js';
import { createRainbowPalette, getColorForIndex } from './colors.js';
import {
  MESSAGE,
  LETTER_HEIGHT,
  LETTER_GAP,
  WORD_GAP,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  LETTER_PADDING_RIGHT,
} from './tokens.js';

/**
 * Assembles one row of the full output by concatenating the Nth row of each letter,
 * applying the appropriate rainbow color to each letter's segment.
 *
 * @param {number} rowIndex - Zero-based row index (0 to LETTER_HEIGHT-1)
 * @param {string[]} characters - Array of single characters from MESSAGE
 * @param {import('./colors.js').Colorizer[]} palette - The rainbow palette
 * @returns {string} One complete terminal line with ANSI color codes
 */
export function renderLine(rowIndex, characters, palette) {
  let line = ' '; // left margin
  let colorIndex = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (char === ' ') {
      // Space character: use atlas space row (3 chars wide), no padding, no color increment
      line += LETTER_ATLAS[' '][rowIndex];
    } else {
      // Inter-letter gap: before each non-space char that follows another non-space char
      if (i > 0 && characters[i - 1] !== ' ') {
        line += ' '.repeat(LETTER_GAP);
      }

      // Look up the letter row and colorize it
      const row = LETTER_ATLAS[char][rowIndex];
      const colorizer = getColorForIndex(palette, colorIndex);
      line += colorizer(row);

      // Padding after the colorized letter segment
      line += ' '.repeat(LETTER_PADDING_RIGHT);

      colorIndex++;
    }
  }

  line += ' '; // right margin
  return line;
}

/**
 * Composes the full static "HELLO WORLD" output: top margin + 5 art rows + bottom margin.
 * Returns the complete multi-line string ready for stdout. Does NOT write to stdout.
 *
 * @returns {string} Complete colorized multi-line ASCII art output
 */
export function renderRainbowHello() {
  const palette = createRainbowPalette();
  const characters = [...MESSAGE];
  const lines = [];

  // Top margin — empty line(s)
  for (let i = 0; i < MARGIN_TOP; i++) {
    lines.push('');
  }

  // Art rows
  for (let row = 0; row < LETTER_HEIGHT; row++) {
    lines.push(renderLine(row, characters, palette));
  }

  // Bottom margin — empty line(s)
  for (let i = 0; i < MARGIN_BOTTOM; i++) {
    lines.push('');
  }

  return lines.join('\n');
}
