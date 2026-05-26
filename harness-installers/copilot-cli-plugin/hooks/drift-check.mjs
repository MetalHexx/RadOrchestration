#!/usr/bin/env node
// drift-check.mjs — sessionStart hook. Compares plugin-delivered version
// against ~/.radorc/install.json's copilot-cli-plugin entry. Single
// stdout line on mismatch; silent on match. Never self-uninstalls.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readJsonSafe(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// Derive plugin root from script location; honor COPILOT_CLI_PLUGIN_ROOT
// override so the env-driven test scaffolding can redirect this hook at a fixture root.
const pluginRoot = process.env.COPILOT_CLI_PLUGIN_ROOT ?? path.resolve(scriptDir, '..');

function run() {
  const pj = readJsonSafe(path.join(pluginRoot, 'plugin.json'));
  const deliveringVersion = pj?.version;
  if (!deliveringVersion) return;
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorc');
  const installed = readJsonSafe(path.join(radHome, 'install.json'));
  const installedVersion = installed?.harnesses?.['copilot-cli-plugin']?.version;
  if (installedVersion && installedVersion !== deliveringVersion) {
    process.stdout.write(
      `[rad-orchestration drift] ~/.radorc/install.json is at version ${installedVersion}. ` +
      `The Copilot CLI plugin's bundled rad-orchestration is at version ${deliveringVersion}. ` +
      `Recommend running \`copilot plugin update rad-orc\` (or re-running the standard installer) to keep them in sync.\n`,
    );
  }
}

run();
process.exit(0);
