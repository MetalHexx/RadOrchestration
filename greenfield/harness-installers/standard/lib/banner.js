// lib/banner.js — ASCII art banner module

import figlet from 'figlet';
import { THEME, FIGLET_FONT } from './theme.js';

/**
 * Renders the Rad Orc figlet banner centered in the terminal.
 * No box border. No subtitle. Narrow fallback at < 60 cols.
 *
 * Rendering logic:
 *   1. If terminal width < 60: print centered plain text "Rad Orc" styled with THEME.banner
 *   2. Else: render figlet.textSync('Rad Orc', { font: FIGLET_FONT }) →
 *      for each line: strip ANSI → measure visible width →
 *      pad left with Math.floor((cols - visibleWidth) / 2) spaces →
 *      apply THEME.banner → print
 *   3. One blank line above, one blank line below
 *
 * @returns {void}
 */
export function renderBanner() {
  const cols = process.stdout.columns || (process.env.COLUMNS ? parseInt(process.env.COLUMNS, 10) : 80);

  console.log('');

  // Narrow fallback
  if (cols < 60) {
    const padding = ' '.repeat(Math.max(0, Math.floor((cols - 7) / 2)));
    console.log(padding + THEME.banner('Rad Orc'));
    console.log('');
    return;
  }

  // Normal rendering
  const figletText = figlet.textSync('Rad Orc', { font: FIGLET_FONT });
  const lines = figletText.split('\n');

  for (const line of lines) {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const visibleWidth = stripped.length;
    const padding = ' '.repeat(Math.max(0, Math.floor((cols - visibleWidth) / 2)));
    console.log(padding + THEME.banner(line));
  }

  console.log('');
}
