// installer/lib/ui-builder.js — UI build pipeline: copy source, npm install, npm run build

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import ora from 'ora';
import { THEME } from './theme.js';
import { generateEnvLocal } from './env-generator.js';
import { generateDockerCompose } from './docker-generator.js';

/** @import { UiBuildResult } from './types.js' */

/**
 * Returns the platform-appropriate npm executable name.
 * @returns {string} 'npm.cmd' on Windows, 'npm' elsewhere
 */
function getNpmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

/**
 * Checks that node and npm are available on the system.
 * @returns {{available: boolean, error?: string}}
 */
export function checkNodeNpm() {
  try {
    execFileSync('node', ['--version'], { stdio: 'pipe' });
    execFileSync(getNpmCmd(), ['--version'], { stdio: 'pipe' });
    return { available: true };
  } catch (err) {
    return { available: false, error: `Node.js or npm is not available: ${err.message}` };
  }
}

/**
 * Runs an npm command with an ora spinner showing elapsed time.
 * @param {string[]} args - npm arguments (e.g. ['install'] or ['run', 'build'])
 * @param {string} cwd - Working directory for the command
 * @param {string} label - Spinner label text
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function runNpmCommand(args, cwd, label) {
  return new Promise((resolve) => {
    const spinner = ora({ text: label, color: THEME.spinner }).start();
    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 1;
      spinner.text = `${label} (${seconds}s)`;
    }, 1000);

    const child = spawn(getNpmCmd(), args, { cwd, stdio: 'pipe' });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearInterval(interval);
      if (code === 0) {
        spinner.succeed(label);
        resolve({ success: true });
      } else {
        spinner.fail(label);
        resolve({ success: false, error: stderr });
      }
    });

    child.on('error', (err) => {
      clearInterval(interval);
      spinner.fail(label);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Runs the full UI installation: copy source, write .env.local,
 * npm install, npm run build, generate docker-compose.yml.
 * Shows ora spinners with elapsed time for long operations.
 * @param {Object} options
 * @param {string} options.repoRoot - Absolute path to repo root (contains ui/ source)
 * @param {string} options.uiDir - Absolute path to UI target directory
 * @param {string} options.workspaceDir - Absolute path to workspace root
 * @param {string} options.orchRoot - Orchestration root folder name
 * @returns {Promise<UiBuildResult>}
 */
export async function installUi({ repoRoot, uiDir, workspaceDir, orchRoot }) {
  /** @type {UiBuildResult} */
  const result = {
    copySuccess: false,
    installSuccess: false,
    buildSuccess: false,
    fileCount: 0,
  };

  // Step 1 — Copy UI source
  const excludedNames = new Set(['node_modules', '.next', '.env.local', '.env']);
  let fileCount = 0;
  try {
    fs.mkdirSync(uiDir, { recursive: true });
    fs.cpSync(path.join(repoRoot, 'ui'), uiDir, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        if (excludedNames.has(base)) return false;
        try {
          if (fs.statSync(src).isFile()) fileCount++;
        } catch {
          // ignore stat errors in filter
        }
        return true;
      },
    });
    result.copySuccess = true;
    result.fileCount = fileCount;
  } catch (err) {
    result.error = err.message;
    return result;
  }

  // Step 2 — Write .env.local
  const envContent = generateEnvLocal(workspaceDir, orchRoot);
  fs.writeFileSync(path.join(uiDir, '.env.local'), envContent);

  // Step 3 — npm install
  const installResult = await runNpmCommand(['install'], uiDir, 'Installing UI dependencies\u2026');
  if (!installResult.success) {
    result.installSuccess = false;
    result.error = `${installResult.error}\n\nTo retry manually: cd ${uiDir} && npm install`;
    return result;
  }

  // Step 4 — npm run build
  const buildResult = await runNpmCommand(['run', 'build'], uiDir, 'Building UI\u2026');
  if (!buildResult.success) {
    result.buildSuccess = false;
    result.installSuccess = true;
    result.error = `${buildResult.error}\n\nTo retry manually: cd ${uiDir} && npm run build`;
    return result;
  }

  // Step 5 — Generate docker-compose.yml
  const dockerContent = generateDockerCompose({ uiDir, workspaceDir, orchRoot });
  fs.writeFileSync(path.join(uiDir, 'docker-compose.yml'), dockerContent);

  result.installSuccess = true;
  result.buildSuccess = true;

  return result;
}
