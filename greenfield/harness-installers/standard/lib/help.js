// lib/help.js — Professional --help screen renderer

import { THEME } from './theme.js';
import { createRequire } from 'node:module';

/**
 * Renders a professional, nicely formatted --help screen to stdout and exits.
 * @returns {void}
 */
export function renderHelp() {
  const require = createRequire(import.meta.url);
  const { version, description } = require('../package.json');

  const flag = (f) => THEME.label(f);
  const meta = (m) => THEME.secondary(m);

  // Help advertises only the flags this installer actually consumes (AD-18:
  // wizard collects harness selection only). Project-config knobs live in the
  // in-harness CLI; parseArgs() still accepts legacy flags silently for
  // back-compat with older user scripts, but they are not surfaced here.
  const lines = [
    '',
    `  ${THEME.banner('radorch')} ${THEME.secondary(`v${version}`)}`,
    `  ${description}`,
    '',
    `  ${THEME.heading('USAGE')}`,
    `    radorch ${meta('[options]')}`,
    '',
    `  ${THEME.heading('OPTIONS')}`,
    `    ${flag('--harness')} ${meta('<list>')}      Comma-separated harnesses ${meta('(claude, copilot-vscode, copilot-cli)')}`,
    `    ${flag('--yes')}, ${flag('-y')}             Accept defaults for unspecified options`,
    `    ${flag('--version')}, ${flag('-v')}         Show version number`,
    `    ${flag('--help')}, ${flag('-h')}            Show this help message`,
    '',
    `  ${THEME.heading('SUBCOMMANDS')}`,
    `    ${THEME.command('uninstall')}              Print a pointer to the in-harness uninstall command.`,
    '',
    `  ${THEME.heading('EXAMPLES')}`,
    `    ${THEME.command('radorch')}`,
    `      Interactive mode — prompts for harness selection`,
    '',
    `    ${THEME.command('radorch --yes')}`,
    `      Accept all defaults non-interactively`,
    '',
    `    ${THEME.command('radorch --yes --harness claude')}`,
    `      One-shot install for Claude Code only`,
    '',
    `    ${THEME.command('radorch uninstall')}`,
    `      Standard installer's 'uninstall' prints guidance only — it does not delete files. Run /rad-ui-stop, then run radorch uninstall from inside your harness for the actual cleanup.`,
    '',
  ];

  console.log(lines.join('\n'));
}
