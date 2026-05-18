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

  const lines = [
    '',
    `  ${THEME.banner('radorch')} ${THEME.secondary(`v${version}`)}`,
    `  ${description}`,
    '',
    `  ${THEME.heading('USAGE')}`,
    `    radorch ${meta('[options]')}`,
    '',
    `  ${THEME.heading('SETUP')}`,
    `    ${flag('--harness')} ${meta('<list>')}             Comma-separated harnesses ${meta('(claude, copilot-vscode, copilot-cli)')}`,
    `    ${flag('--default-template')} ${meta('<name>')}    Default project template ${meta('(extra-high | high | medium | low | ask)')}`,
    '',
    `  ${THEME.heading('PIPELINE LIMITS')}`,
    `    ${flag('--max-phases')} ${meta('<n>')}             Max phases per project ${meta('(default: 10)')}`,
    `    ${flag('--max-tasks')} ${meta('<n>')}              Max tasks per phase ${meta('(default: 8)')}`,
    `    ${flag('--max-retries')} ${meta('<n>')}            Max retries per task ${meta('(default: 2)')}`,
    `    ${flag('--max-rejections')} ${meta('<n>')}         Max consecutive review rejections ${meta('(default: 3)')}`,
    '',
    `  ${THEME.heading('EXECUTION')}`,
    `    ${flag('--execution-mode')} ${meta('<mode>')}      ask, phase, task, or autonomous ${meta('(default: ask)')}`,
    `    ${flag('--after-planning')} ${meta('<bool>')}      Pause after planning ${meta('(true | false)')}`,
    `    ${flag('--after-final-review')} ${meta('<bool>')}  Pause after final review ${meta('(true | false)')}`,
    `    ${flag('--auto-commit')} ${meta('<mode>')}         always, ask, or never ${meta('(default: ask)')}`,
    `    ${flag('--auto-pr')} ${meta('<mode>')}             always, ask, or never ${meta('(default: ask)')}`,
    '',
    `  ${THEME.heading('FLAGS')}`,
    `    ${flag('--overwrite')}, ${flag('--force')}            Overwrite existing orchestration files`,
    `    ${flag('--yes')}, ${flag('-y')}                       Accept defaults for unspecified options`,
    `    ${flag('--version')}, ${flag('-v')}                   Show version number`,
    `    ${flag('--help')}, ${flag('-h')}                      Show this help message`,
    '',
    `  ${THEME.heading('SUBCOMMANDS')}`,
    `    ${THEME.command('uninstall')}                       Print a pointer to the in-harness uninstall command.`,
    '',
    `  ${THEME.heading('EXAMPLES')}`,
    `    ${THEME.command('radorch')}`,
    `      Interactive mode — prompts for harness selection and configuration`,
    '',
    `    ${THEME.command('radorch --yes')}`,
    `      Accept all defaults non-interactively`,
    '',
    `    ${THEME.command('radorch --yes --harness claude')}`,
    `      One-shot install for Claude Code only`,
    '',
    `    ${THEME.command('radorch --yes --overwrite')}`,
    `      Re-install with defaults, overwrite existing files`,
    '',
    `    ${THEME.command('radorch uninstall')}`,
    `      Standard installer's 'uninstall' prints guidance only — it does not delete files. Run /rad-ui-stop, then run radorch uninstall from inside your harness for the actual cleanup.`,
    '',
  ];

  console.log(lines.join('\n'));
}
