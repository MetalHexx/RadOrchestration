#!/usr/bin/env node
// drift-check.mjs — SessionStart hook. Compares plugin-delivered version
// against ~/.radorch/install.json's copilot-vscode-plugin entry. Single
// stdout line on mismatch; silent on match. Never self-uninstalls.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJsonSafe(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, '..');
if (!process.env.COPILOT_VSCODE_PLUGIN_ROOT) {
  process.env.COPILOT_VSCODE_PLUGIN_ROOT = pluginRoot;
}

function run() {
  // Read delivering version from the synthesized package.json — always at the
  // payload root regardless of where plugin.json itself lives (which is now
  // under .claude-plugin/ for Claude-format VS Code detection).
  const pkg = readJsonSafe(path.join(process.env.COPILOT_VSCODE_PLUGIN_ROOT, 'package.json'));
  const deliveringVersion = pkg?.version;
  if (!deliveringVersion) return;
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorch');
  const installed = readJsonSafe(path.join(radHome, 'install.json'));
  const installedVersion = installed?.harnesses?.['copilot-vscode-plugin']?.version;
  if (installedVersion && installedVersion !== deliveringVersion) {
    process.stdout.write(
      `[rad-orchestration drift] ~/.radorch/install.json is at version ${installedVersion}. ` +
      `The Copilot in VS Code plugin's bundled rad-orchestration is at version ${deliveringVersion}. ` +
      `Reinstall the plugin (or re-run the standard installer) to keep them in sync.\n`,
    );
  }
}

run();
process.exit(0);
