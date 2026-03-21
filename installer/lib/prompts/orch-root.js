// installer/lib/prompts/orch-root.js

import { select, input } from '@inquirer/prompts';
import { isValidFolderName } from '../path-utils.js';

/**
 * Runs the "Orchestration Root" prompt section: root folder selection + optional custom entry.
 * @returns {Promise<{ orchRoot: string }>}
 *   - orchRoot: Folder name (e.g., '.github') or absolute path
 */
export async function promptOrchRoot() {
  const selection = await select({
    message: 'Orchestration root folder',
    choices: [
      { name: '.agent', value: '.agent' },
      { name: '.github', value: '.github' },
      { name: 'Custom…', value: 'custom' },
    ],
    default: '.github',
  });

  let orchRoot = selection;

  if (selection === 'custom') {
    orchRoot = await input({
      message: 'Enter custom folder name',
      validate: (value) => {
        const result = isValidFolderName(value);
        if (result === true) return true;
        return result;
      },
    });
  }

  return { orchRoot };
}
