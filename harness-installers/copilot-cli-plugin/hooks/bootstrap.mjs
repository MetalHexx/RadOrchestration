#!/usr/bin/env node
// bootstrap.mjs — userPromptSubmitted hook. Runs install then self-uninstalls
// this hook entry so it never fires again in the same install lifetime.
// The next `copilot plugin install` (upgrade) writes a fresh hooks.json with
// userPromptSubmitted restored, so upgrades still trigger bootstrap.
// Imports lib/install/* directly — esbuild inlines them at build time.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall } from '../lib/install/run-install.js';

function log(msg) { process.stderr.write(`[rad-orchestration:copilot-cli-bootstrap] ${msg}\n`); }

// Resolve own payload location from inside the script.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, '..');

// Honor an existing env var (tests override) but otherwise set from script path.
if (!process.env.COPILOT_CLI_PLUGIN_ROOT) {
  process.env.COPILOT_CLI_PLUGIN_ROOT = pluginRoot;
}

function selfUninstall(root) {
  const hooksJson = path.join(root, 'hooks', 'hooks.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
    if (manifest.hooks?.userPromptSubmitted) {
      delete manifest.hooks.userPromptSubmitted;
      const tmp = `${hooksJson}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, hooksJson);
    }
  } catch (err) {
    log(`hooks.json self-uninstall failed (non-fatal): ${err.message}`);
  }
}

async function main() {
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorch');
  try {
    const result = await runInstall({ pluginRoot: process.env.COPILOT_CLI_PLUGIN_ROOT, radHome });
    log(`install action=${result.action}`);
    selfUninstall(process.env.COPILOT_CLI_PLUGIN_ROOT);
    return 0;
  } catch (err) {
    log(`install failed (hooks.json left intact for retry): ${err.message}`);
    return 1;
  }
}

process.exit(await main());
