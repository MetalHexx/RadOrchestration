// installer/lib/theme.js — Semantic color tokens and font constant

import chalk from 'chalk';

/**
 * @typedef {Object} Theme
 * @property {Function} banner - chalk.cyan.bold
 * @property {Function} bannerBorder - chalk.dim
 * @property {Function} tagline - chalk.magentaBright
 * @property {Function} heading - chalk.white.bold
 * @property {Function} rule - chalk.dim
 * @property {Function} label - chalk.cyan.bold
 * @property {Function} body - chalk.white
 * @property {Function} secondary - chalk.dim
 * @property {Function} success - chalk.greenBright
 * @property {Function} warning - chalk.yellowBright
 * @property {Function} error - chalk.red
 * @property {Function} errorDetail - chalk.red.dim
 * @property {Function} command - chalk.magentaBright
 * @property {Function} stepNumber - chalk.cyan.bold
 * @property {Function} disabled - chalk.gray
 * @property {string} spinner - 'cyan' (ora color option)
 */

/** @type {Theme} */
export const THEME = {
  banner: chalk.cyan.bold,
  bannerBorder: chalk.dim,
  tagline: chalk.magentaBright,
  heading: chalk.white.bold,
  rule: chalk.dim,
  label: chalk.cyan.bold,
  body: chalk.white,
  secondary: chalk.dim,
  success: chalk.greenBright,
  warning: chalk.yellowBright,
  error: chalk.red,
  errorDetail: chalk.red.dim,
  command: chalk.magentaBright,
  stepNumber: chalk.cyan.bold,
  disabled: chalk.gray,
  spinner: 'cyan',
};

/** @type {string} */
export const FIGLET_FONT = 'ANSI Shadow';

/**
 * Prints a section header line to stdout.
 * Format: "  ── {emoji}  {title} ──...──" filling terminal width.
 * The ── segments and fill are THEME.rule (dim).
 * The title is THEME.heading (white bold).
 * @param {string} emoji - Section emoji (e.g., '🚀')
 * @param {string} title - Section title text (e.g., 'Getting Started')
 * @returns {void}
 */
export function sectionHeader(emoji, title) {
  const cols = process.stdout.columns || 80;
  const prefixRaw = '  ── ';
  const midRaw = `${emoji}  ${title} `;
  const fixedLen = prefixRaw.length + midRaw.length + 4;
  const fillCount = Math.max(2, cols - fixedLen);
  const fill = '──'.repeat(Math.ceil(fillCount / 2)).slice(0, fillCount) + '──';
  const line = THEME.rule(prefixRaw) + THEME.heading(midRaw) + THEME.rule(fill);
  console.log(line);
}

/**
 * Prints a full-width dim horizontal rule to stdout.
 * Uses '─' characters filling to process.stdout.columns || 80.
 * Styled with THEME.rule (dim).
 * @returns {void}
 */
export function divider() {
  const cols = process.stdout.columns || 80;
  const line = '─'.repeat(cols);
  console.log(THEME.rule(line));
}
