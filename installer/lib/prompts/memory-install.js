// installer/lib/prompts/memory-install.js

import { confirm, select } from '@inquirer/prompts';
import { INQUIRER_THEME, THEME } from '../theme.js';
import { execFile } from 'node:child_process';
import ora from 'ora';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} MemoryInstallResult
 * @property {boolean} installMemory - Whether memory was successfully installed
 * @property {'always'|'ask'|'never'} autoIngest - Selected auto-ingest policy
 */

/**
 * Detects whether total-recall binary is available on PATH.
 * @returns {Promise<boolean>}
 */
export async function isTotalRecallInstalled() {
  return new Promise((resolve) => {
    execFile('total-recall', ['--version'], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Installs total-recall globally via npm.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function installTotalRecall() {
  return new Promise((resolve) => {
    execFile('npm', ['install', '-g', '@strvmarv/total-recall'], (err) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
}

/**
 * Registers total-recall as an MCP server in .vscode/mcp.json.
 * Merges into existing file if present; creates new file if absent.
 *
 * @param {string} workspaceDir - Absolute path to workspace
 * @returns {{ success: boolean, merged: boolean, error?: string }}
 */
export function registerMcpServer(workspaceDir) {
  const mcpEntry = { servers: { 'total-recall': { command: 'total-recall' } } };
  const targetPath = path.join(workspaceDir, '.vscode', 'mcp.json');

  try {
    if (fs.existsSync(targetPath)) {
      let existing;
      const raw = fs.readFileSync(targetPath, 'utf8');
      try {
        existing = JSON.parse(raw);
      } catch {
        // JSON parse failed — back up and write fresh
        fs.copyFileSync(targetPath, targetPath + '.backup');
        console.log(THEME.warning('⚠ Existing .vscode/mcp.json was invalid JSON — backed up to mcp.json.backup'));
        fs.writeFileSync(targetPath, JSON.stringify(mcpEntry, null, 2) + '\n', 'utf8');
        return { success: true, merged: false };
      }

      // Merge into existing config
      if (!existing.servers) {
        existing.servers = {};
      }
      existing.servers['total-recall'] = { command: 'total-recall' };
      fs.writeFileSync(targetPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
      return { success: true, merged: true };
    } else {
      // File does not exist — create directory and write fresh
      fs.mkdirSync(path.join(workspaceDir, '.vscode'), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(mcpEntry, null, 2) + '\n', 'utf8');
      return { success: true, merged: false };
    }
  } catch (err) {
    return { success: false, merged: false, error: err.message };
  }
}

/**
 * Runs the "Memory System" prompt section.
 * Handles: confirm → detect binary → install → MCP registration → auto-ingest select.
 *
 * @param {string} workspaceDir - Absolute path to workspace (for .vscode/mcp.json)
 * @returns {Promise<MemoryInstallResult>}
 */
export async function promptMemoryInstall(workspaceDir) {
  // Step A — Confirm
  const wantInstall = await confirm({
    message: 'Install the memory system (total-recall)?',
    theme: INQUIRER_THEME,
    default: true,
  });

  if (!wantInstall) {
    return { installMemory: false, autoIngest: 'never' };
  }

  // Step B — Detect binary
  const alreadyInstalled = await isTotalRecallInstalled();
  if (alreadyInstalled) {
    console.log(THEME.success('✓ total-recall is already installed'));
  } else {
    // Step C — Install
    const spinner = ora({ text: 'Installing total-recall...', color: THEME.spinner }).start();
    const installResult = await installTotalRecall();

    if (installResult.success) {
      spinner.succeed(THEME.success('✓ total-recall installed'));
    } else {
      spinner.fail();
      console.log(THEME.errorDetail(installResult.error));
      console.log(THEME.body('To install manually:'));
      console.log(THEME.command('  npm install -g @strvmarv/total-recall'));

      const continueWithout = await confirm({
        message: 'Continue without memory?',
        theme: INQUIRER_THEME,
        default: true,
      });

      if (continueWithout) {
        return { installMemory: false, autoIngest: 'never' };
      }
      process.exit(1);
    }
  }

  // Step D — MCP Registration
  const mcpSpinner = ora({ text: 'Registering MCP server...', color: THEME.spinner }).start();
  const mcpResult = registerMcpServer(workspaceDir);

  if (mcpResult.success) {
    mcpSpinner.succeed(THEME.success('✓ MCP server registered (.vscode/mcp.json)'));
    if (mcpResult.merged) {
      console.log(THEME.hint('  Merged into existing .vscode/mcp.json'));
    }
  } else {
    mcpSpinner.fail();
    console.log(THEME.errorDetail(mcpResult.error));
    console.log(THEME.body('To configure manually, add to .vscode/mcp.json:'));
    console.log(THEME.command('  { "servers": { "total-recall": { "command": "total-recall" } } }'));

    const continueWithout = await confirm({
      message: 'Continue without memory?',
      theme: INQUIRER_THEME,
      default: true,
    });

    if (continueWithout) {
      return { installMemory: true, autoIngest: 'never' };
    }
    process.exit(1);
  }

  // Step E — Auto-ingest
  const autoIngest = await select({
    message: 'Auto-ingest completed projects?',
    theme: INQUIRER_THEME,
    default: 'ask',
    choices: [
      { name: 'always — Ingest automatically',          value: 'always' },
      { name: 'ask — Prompt before each ingestion',     value: 'ask' },
      { name: 'never — Never ingest automatically',     value: 'never' },
    ],
  });

  return { installMemory: true, autoIngest };
}
