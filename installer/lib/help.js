// installer/lib/help.js — Professional --help screen renderer

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
    `    ${flag('--workspace')} ${meta('<path>')}           Target workspace directory ${meta('(default: cwd)')}`,
    `    ${flag('--tool')} ${meta('<tool>')}                AI coding tool ${meta('(claude-code | copilot)')}`,
    `    ${flag('--orch-root')} ${meta('<folder>')}         Orchestration root folder ${meta('(default: .claude)')}`,
    '',
    `  ${THEME.heading('PROJECT STORAGE')}`,
    `    ${flag('--projects-path')} ${meta('<path>')}       Project storage path ${meta('(default: orchestration-projects)')}`,
    `    ${flag('--naming')} ${meta('<convention>')}        Folder naming: SCREAMING_CASE, lowercase, numbered`,
    '',
    `  ${THEME.heading('PIPELINE LIMITS')}`,
    `    ${flag('--max-phases')} ${meta('<n>')}             Max phases per project ${meta('(default: 10)')}`,
    `    ${flag('--max-tasks')} ${meta('<n>')}              Max tasks per phase ${meta('(default: 8)')}`,
    `    ${flag('--max-retries')} ${meta('<n>')}            Max retries per task ${meta('(default: 2)')}`,
    `    ${flag('--max-rejections')} ${meta('<n>')}         Max consecutive review rejections ${meta('(default: 3)')}`,
    '',
    `  ${THEME.heading('EXECUTION')}`,
    `    ${flag('--execution-mode')} ${meta('<mode>')}      ask, phase, task, or autonomous ${meta('(default: ask)')}`,
    `    ${flag('--auto-commit')} ${meta('<mode>')}         always, ask, or never ${meta('(default: ask)')}`,
    `    ${flag('--auto-pr')} ${meta('<mode>')}             always, ask, or never ${meta('(default: ask)')}`,
    '',
    `  ${THEME.heading('DASHBOARD')}`,
    `    ${flag('--dashboard')}                    Install monitoring dashboard UI`,
    `    ${flag('--no-dashboard')}                 Skip dashboard installation`,
    `    ${flag('--dashboard-dir')} ${meta('<path>')}       Dashboard directory ${meta('(default: <workspace>/ui)')}`,
    '',
    `  ${THEME.heading('FLAGS')}`,
    `    ${flag('--overwrite')}, ${flag('--force')}            Overwrite existing orchestration files ${meta('(no longer skips modified-file checks)')}`,
    `    ${flag('--yes')}, ${flag('-y')}                       Accept defaults for unspecified options`,
    `    ${flag('--version')}, ${flag('-v')}                   Show version number`,
    `    ${flag('--help')}, ${flag('-h')}                      Show this help message`,
    '',
    `  ${THEME.heading('SUBCOMMANDS')}`,
    `    ${THEME.command('uninstall')}                       Remove a prior rad-orchestration install`,
    '',
    `  ${THEME.heading('EXAMPLES')}`,
    `    ${THEME.command('radorch')}`,
    `      Interactive mode — prompts for all configuration`,
    '',
    `    ${THEME.command('radorch --yes')}`,
    `      Accept all defaults non-interactively`,
    '',
    `    ${THEME.command('radorch --yes --orch-root .rad --workspace ./my-project')}`,
    `      One-shot install with custom orch root`,
    '',
    `    ${THEME.command('radorch --yes --overwrite --no-dashboard')}`,
    `      Re-install with defaults, overwrite existing files, skip dashboard`,
    '',
    `    ${THEME.command('radorch uninstall')}`,
    `      Remove every file the prior install's manifest lists, including orchestration.yml.`,
    '',
  ];

  console.log(lines.join('\n'));
}
