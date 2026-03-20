// installer/lib/banner.js — ASCII art banner module

import figlet from 'figlet';
import { THEME, FIGLET_FONT } from './theme.js';

/**
 * Renders the Figlet ASCII banner with box border to stdout.
 * Falls back to single-line text if terminal width < 60 columns.
 * @returns {void}
 */
export function renderBanner() {
  const cols = process.stdout.columns || 80;

  // Narrow fallback
  if (cols < 60) {
    console.log(THEME.banner('⚡ RadOrch Installer ⚡'));
    return;
  }

  // Normal rendering
  const figletText = figlet.textSync('RadOrch', { font: FIGLET_FONT, width: cols });
  const coloredFiglet = THEME.banner(figletText);

  // Build box border
  const boxWidth = cols - 2; // subtract 2 for ╔ and ╗
  const topBorder = THEME.bannerBorder('╔' + '═'.repeat(boxWidth) + '╗');
  const bottomBorder = THEME.bannerBorder('╚' + '═'.repeat(boxWidth) + '╝');

  // Wrap figlet lines in side borders
  const figletLines = coloredFiglet.split('\n').map(line => {
    // Pad or trim to fit inside box
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    const padNeeded = Math.max(0, boxWidth - stripped.length);
    return THEME.bannerBorder('║') + line + ' '.repeat(padNeeded) + THEME.bannerBorder('║');
  });

  // Tagline centered inside box
  const tagline = '⚡ Orchestration System Installer ⚡';
  const taglinePadTotal = Math.max(0, boxWidth - tagline.length);
  const taglinePadLeft = Math.floor(taglinePadTotal / 2);
  const taglinePadRight = taglinePadTotal - taglinePadLeft;
  const taglineLine =
    THEME.bannerBorder('║') +
    ' '.repeat(taglinePadLeft) +
    THEME.tagline(tagline) +
    ' '.repeat(taglinePadRight) +
    THEME.bannerBorder('║');

  console.log('');
  console.log(topBorder);
  for (const line of figletLines) {
    console.log(line);
  }
  console.log(taglineLine);
  console.log(bottomBorder);
  console.log('');
}
