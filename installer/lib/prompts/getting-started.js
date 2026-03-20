// installer/lib/prompts/getting-started.js

import { select, input } from '@inquirer/prompts';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Runs the "Getting Started" prompt section: AI tool selection and workspace directory.
 * @returns {Promise<{ tool: 'copilot', workspaceDir: string }>}
 *   - tool: The selected AI tool identifier (v1: always 'copilot')
 *   - workspaceDir: Absolute path to the target workspace directory
 */
export async function promptGettingStarted() {
  const tool = await select({
    message: 'Select your AI coding tool',
    choices: [
      { name: 'GitHub Copilot', value: 'copilot' },
      { name: 'Cursor (coming soon)', value: 'cursor', disabled: true },
      { name: 'Claude Code (coming soon)', value: 'claude-code', disabled: true },
    ],
  });

  const rawDir = await input({
    message: 'Target workspace directory',
    default: process.cwd(),
    validate: (value) => {
      const resolved = path.resolve(value);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return true;
      }
      return 'Directory does not exist. Please enter a valid path.';
    },
  });

  const workspaceDir = path.resolve(rawDir);
  return { tool, workspaceDir };
}
