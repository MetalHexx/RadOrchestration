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
    `  ${THEME.banner('rad-orchestration')} ${THEME.secondary(`v${version}`)}`,
    `  ${description}`,
    '',
    `  ${THEME.heading('USAGE')}`,
    `    rad-orchestration ${meta('[options]')}`,
    '',
    `  ${THEME.heading('OPTIONS')}`,
    `    ${flag('--harness')} ${meta('<name>')}      Single harness: ${meta('claude | copilot-vscode | copilot-cli')}`,
    `    ${flag('--yes')}, ${flag('-y')}            Skip confirmations (requires --harness)`,
    `    ${flag('--version')}, ${flag('-v')}        Show version number`,
    `    ${flag('--help')}, ${flag('-h')}           Show this help message`,
    '',
    `  ${THEME.heading('SUBCOMMANDS')}`,
    `    ${THEME.command('uninstall')}             Remove an installed harness. Interactive picker by default; pair with --harness <name> for a specific target.`,
    '',
    `  ${THEME.heading('EXAMPLES')}`,
    `    ${THEME.command('rad-orchestration')}`,
    `      Interactive mode — prompts for install vs uninstall, then which harness`,
    '',
    `    ${THEME.command('rad-orchestration --harness claude --yes')}`,
    `      One-shot install of Claude Code, skipping confirmations`,
    '',
    `    ${THEME.command('rad-orchestration uninstall')}`,
    `      Interactive uninstall — pick which currently-installed harness to remove`,
    '',
    `    ${THEME.command('rad-orchestration uninstall --harness copilot-cli --yes')}`,
    `      One-shot uninstall of Copilot CLI, skipping confirmation`,
    '',
  ];

  console.log(lines.join('\n'));
}
