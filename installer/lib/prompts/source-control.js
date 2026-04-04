// installer/lib/prompts/source-control.js

import { select } from '@inquirer/prompts';
import { INQUIRER_THEME } from '../theme.js';
import { execFileSync } from 'node:child_process';

/**
 * Runs the "Source Control" prompt section.
 * Checks git/gh availability (non-blocking warnings) and collects auto-commit/auto-PR preferences.
 * @returns {Promise<{ autoCommit: 'always'|'ask'|'never', autoPr: 'always'|'ask'|'never', provider: 'github' }>}
 */
export async function promptSourceControl() {
  // Check if git is available in PATH (non-blocking warning)
  try {
    execFileSync('git', ['--version']);
  } catch {
    console.warn(
      '⚠  git not found in PATH.\n' +
      '   Auto-commit requires git to be installed and available in your PATH.\n' +
      '   Install git before using auto_commit: always.'
    );
  }

  const autoCommit = await select({
    message: 'Auto-commit behavior',
    theme: INQUIRER_THEME,
    default: 'ask',
    choices: [
      { name: 'always — Commit and push after every approved task',   value: 'always' },
      { name: 'ask — Prompt before each project run',                  value: 'ask' },
      { name: 'never — Never commit automatically',                    value: 'never' },
    ],
  });

  const autoPr = await select({
    message: 'Auto-PR behavior',
    theme: INQUIRER_THEME,
    default: 'ask',
    choices: [
      { name: 'always — Create PR automatically on final approval',    value: 'always' },
      { name: 'ask — Prompt before each project run',                  value: 'ask' },
      { name: 'never — Never create PRs automatically',                value: 'never' },
    ],
  });

  // Check gh CLI authentication when auto-PR is set to always (non-blocking warning)
  if (autoPr === 'always') {
    try {
      execFileSync('gh', ['auth', 'status']);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(
          '⚠  gh CLI not found in PATH.\n' +
          '   Auto-PR requires the GitHub CLI (gh) to be installed and available.\n' +
          '   Install from: https://cli.github.com\n' +
          '   Installation will continue — install and authenticate gh before running projects.'
        );
      } else {
        console.warn(
          '⚠  gh CLI is not authenticated (gh auth status returned non-zero).\n' +
          '   Auto-PR requires an authenticated gh CLI. Run: gh auth login\n' +
          '   Installation will continue — configure gh authentication before running projects.'
        );
      }
    }
  }

  return { autoCommit, autoPr, provider: 'github' };
}
