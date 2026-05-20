#!/usr/bin/env node
// drift-check.mjs — SessionStart hook. Compares plugin-delivered version
// against ~/.radorch/install.json's copilot-vscode-plugin entry. Single
// stdout line on mismatch; silent on match. Surfaces stale bootstrap-error
// marker on its own line. Never self-uninstalls.

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
  const pj = readJsonSafe(path.join(process.env.COPILOT_VSCODE_PLUGIN_ROOT, 'plugin.json'));
  const deliveringVersion = pj?.version;
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
  // DD-11: surface stale bootstrap-error marker on its own line.
  const marker = readJsonSafe(path.join(radHome, '.copilot-vscode-plugin-bootstrap.json'));
  if (marker?.status === 'error') {
    process.stdout.write(
      `[rad-orchestration drift] The most recent bootstrap attempt recorded status=error at ${marker.at}. ` +
      `The next user prompt will retry; if failures persist, inspect ~/.radorch/logs/install.log.\n`,
    );
  }
}

run();
process.exit(0);
