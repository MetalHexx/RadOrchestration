// installer/lib/prompts/orch-root.js

import { select, input } from '@inquirer/prompts';
import { INQUIRER_THEME } from '../theme.js';
import { isValidFolderName, normalizePath } from '../path-utils.js';

/**
 * Per-harness canonical orchRoot defaults. Sourced from
 * frontmatter-research.md §2.A (VS Code) and §3.A (CLI) — both Copilot
 * variants share `.github/`. Claude Code uses `.claude/` per §1.
 *
 * Exported so the unattended-install path (wizard --yes) can pick the
 * harness-correct default without reaching into the prompt module.
 */
export const HARNESS_DEFAULTS = {
  'claude-code': '.claude',
  'copilot-vscode': '.github',
  'copilot-cli': '.github',
};

/**
 * Runs the "Orchestration Root" prompt section: root folder selection + optional custom entry.
 * @param {{ tool?: string }} [opts]
 * @returns {Promise<{ orchRoot: string }>}
 *   - orchRoot: Folder name (e.g., '.claude') or absolute path
 */
export async function promptOrchRoot(opts = {}) {
  const harnessDefault = HARNESS_DEFAULTS[opts.tool] ?? HARNESS_DEFAULTS['claude-code'];

  const selection = await select({
    message: 'Orchestration root folder',
    theme: INQUIRER_THEME,
    choices: [
      { name: '.claude', value: '.claude' },
      { name: '.agents', value: '.agents' },
      { name: '.github', value: '.github' },
      { name: 'Custom…', value: 'custom' },
    ],
    default: harnessDefault,
  });

  let orchRoot = selection;

  if (selection === 'custom') {
    orchRoot = await input({
      message: 'Enter custom folder name',
      theme: INQUIRER_THEME,
      validate: (value) => {
        const result = isValidFolderName(value);
        if (result === true) return true;
        return result;
      },
    });
    orchRoot = normalizePath(orchRoot);
  }

  return { orchRoot };
}
