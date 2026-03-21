// installer/lib/theme.js — Semantic color tokens and font constant

import chalk from 'chalk';

/**
 * @typedef {Object} Theme
 * @property {Function} banner - chalk.greenBright.bold — figlet banner text, neon green primary
 * @property {Function} heading - chalk.greenBright.bold — section header title text, neon green primary
 * @property {Function} rule - chalk.dim — rule line segments, dim structural
 * @property {Function} label - chalk.cyanBright.bold — field labels, electric blue accent
 * @property {Function} body - chalk.green — body/description text, muted green
 * @property {Function} secondary - chalk.dim — secondary/context text, dim
 * @property {Function} hint - chalk.dim — contextual hint text before prompts, dim
 * @property {Function} success - chalk.greenBright — success indicators, neon green
 * @property {Function} warning - chalk.yellowBright — warning messages, yellow bright
 * @property {Function} error - chalk.red — error messages, red
 * @property {Function} errorDetail - chalk.red.dim — error detail text, dim red
 * @property {Function} command - chalk.cyanBright — command text, electric blue
 * @property {Function} stepNumber - chalk.cyanBright.bold — step numbers, electric blue bold
 * @property {Function} disabled - chalk.gray — disabled items, gray
 * @property {string} spinner - 'green' (ora color option)
 */

/** @type {Theme} */
export const THEME = {
  banner:      chalk.greenBright.bold,
  heading:     chalk.greenBright.bold,
  rule:        chalk.dim,
  label:       chalk.cyanBright.bold,
  body:        chalk.green,
  secondary:   chalk.dim,
  hint:        chalk.dim,
  success:     chalk.greenBright,
  warning:     chalk.yellowBright,
  error:       chalk.red,
  errorDetail: chalk.red.dim,
  command:     chalk.cyanBright,
  stepNumber:  chalk.cyanBright.bold,
  disabled:    chalk.gray,
  spinner:     'green',
};

/** @type {string} */
export const FIGLET_FONT = 'Bloody';

/**
 * Prints a section header line to stdout.
 * Format: "  ── ::  {title} ──...──" filling terminal width.
 * The ── segments and fill are THEME.rule (dim).
 * The title is THEME.heading (greenBright bold).
 * Marker is always '::' (BBS-style, no emoji).
 *
 * @param {string} marker - BBS marker (always '::')
 * @param {string} title - Section title text (e.g., 'Getting Started')
 * @returns {void}
 */
export function sectionHeader(marker, title) {
  const cols = process.stdout.columns || 80;
  const prefixRaw = '  ── ';
  const midRaw = `${marker}  ${title} `;
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
