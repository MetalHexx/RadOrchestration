#!/usr/bin/env node
// bootstrap.mjs — UserPromptSubmit hook. Merged install orchestrator for the
// VS Code Copilot plugin. Imports lib/install/* directly — esbuild inlines
// them at build time. On install success, atomically rewrites hooks.json to
// remove its own UserPromptSubmit entry so the hook never fires again until
// the next plugin upgrade ships a fresh hooks.json with UserPromptSubmit
// restored. SessionStart drift-check stays in place. Idempotency lives in
// hooks.json itself (no marker file).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall } from '../lib/install/run-install.js';

function log(msg) { process.stderr.write(`[rad-orchestration:copilot-vscode-bootstrap] ${msg}\n`); }

// Resolve own payload location from inside the script.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, '..');

// Honor an existing env var (tests override) but otherwise set from script path.
if (!process.env.COPILOT_VSCODE_PLUGIN_ROOT) {
  process.env.COPILOT_VSCODE_PLUGIN_ROOT = pluginRoot;
}

function selfUninstall(root) {
  const hooksJson = path.join(root, 'hooks', 'hooks.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
    if (manifest.hooks?.UserPromptSubmit) {
      delete manifest.hooks.UserPromptSubmit;
      const tmp = `${hooksJson}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, hooksJson);
    }
  } catch (err) {
    log(`hooks.json self-uninstall failed (non-fatal): ${err.message}`);
  }
}

function cleanupLegacyMarker(radHome) {
  // Best-effort: previous idempotency design wrote ~/.radorch/.copilot-vscode-plugin-bootstrap.json.
  // Upgraded installs from that design land here; clean up the orphan file.
  try { fs.unlinkSync(path.join(radHome, '.copilot-vscode-plugin-bootstrap.json')); } catch { /* absent or permission */ }
}

async function main() {
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorch');
  try {
    const result = await runInstall({ pluginRoot: process.env.COPILOT_VSCODE_PLUGIN_ROOT, radHome });
    log(`install action=${result.action}`);
    selfUninstall(process.env.COPILOT_VSCODE_PLUGIN_ROOT);
    cleanupLegacyMarker(radHome);
    return 0;
  } catch (err) {
    log(`install failed (hooks.json left intact for retry): ${err.message}`);
    return 1;
  }
}

process.exit(await main());
