#!/usr/bin/env node
// drift-check.mjs — sessionStart hook. Compares plugin-delivered version
// against ~/.radorch/install.json's copilot-cli-plugin entry. Single
// stdout line on mismatch; silent on match. Surfaces stale bootstrap-error
// marker on its own line. Never self-uninstalls.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJsonSafe(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// FR-8: derive plugin root from script location; honor COPILOT_CLI_PLUGIN_ROOT
// override so the env-driven test scaffolding (and bootstrap.mjs, which sets
// the same var) can redirect this hook at a fixture root.
const pluginRoot = process.env.COPILOT_CLI_PLUGIN_ROOT ?? path.resolve(scriptDir, '..');

function run() {
  const pj = readJsonSafe(path.join(pluginRoot, 'plugin.json'));
  const deliveringVersion = pj?.version;
  if (!deliveringVersion) return;
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorch');
  const installed = readJsonSafe(path.join(radHome, 'install.json'));
  const installedVersion = installed?.harnesses?.['copilot-cli-plugin']?.version;
  if (installedVersion && installedVersion !== deliveringVersion) {
    process.stdout.write(
      `[rad-orchestration drift] ~/.radorch/install.json is at version ${installedVersion}. ` +
      `The Copilot CLI plugin's bundled rad-orchestration is at version ${deliveringVersion}. ` +
      `Recommend running \`copilot plugin update rad-orchestration-copilot-cli\` (or re-running the standard installer) to keep them in sync.\n`,
    );
  }
  // DD-11: surface stale bootstrap-error marker on its own line.
  const marker = readJsonSafe(path.join(radHome, '.copilot-cli-plugin-bootstrap.json'));
  if (marker?.status === 'error') {
    process.stdout.write(
      `[rad-orchestration drift] Stale bootstrap error marker present (recorded at ${marker.at}). ` +
      `The most recent bootstrap attempt failed; the next user prompt will retry. ` +
      `If failures persist, inspect ~/.radorch/logs/install.log.\n`,
    );
  }
}

run();
process.exit(0);
