// sample-apps/rainbow-hello/src/colors.js

import chalk from 'chalk';
import { RAINBOW_PALETTE } from './tokens.js';

/**
 * @typedef {(text: string) => string} Colorizer
 * A function that wraps text in ANSI color codes.
 */

/**
 * Creates the 7-color rainbow palette as an ordered array of chalk RGB colorizer functions.
 * Each function takes a string and returns it wrapped in the corresponding ANSI color codes.
 *
 * Order: Red, Orange, Yellow, Green, Cyan, Blue, Purple
 *
 * @returns {Colorizer[]} Array of 7 colorizer functions
 */
export function createRainbowPalette() {
  return RAINBOW_PALETTE.map(([r, g, b]) => chalk.rgb(r, g, b));
}

/**
 * Returns the colorizer for a given character position, cycling through the palette.
 *
 * @param {Colorizer[]} palette - The rainbow palette array
 * @param {number} colorIndex - Zero-based index of the visible (non-space) character
 * @returns {Colorizer} The colorizer function for this position
 */
export function getColorForIndex(palette, colorIndex) {
  return palette[colorIndex % palette.length];
}
