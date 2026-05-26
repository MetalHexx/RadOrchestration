#!/usr/bin/env node
// bootstrap.mjs — UserPromptSubmit hook. Merged install orchestrator for the
// VS Code Copilot plugin. Imports lib/install/* directly — esbuild inlines
// them at build time. On install success, atomically rewrites hooks.json to
// remove its own UserPromptSubmit entry so the hook never fires again until
// the next plugin upgrade ships a fresh hooks.json with UserPromptSubmit
// restored. SessionStart drift-check stays in place. Idempotency lives in
// hooks.json itself (no marker file).
//
// On every exit (success, no-op, error) writes ONE human-readable line to
// stdout that the agent surfaces in the chat. stderr keeps the verbose
// debug trail for the Copilot/VS Code process log.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall, UiLockError } from '../lib/install/run-install.js';
import { bakeAbsolutePaths } from '../lib/install/bake-paths.js';

function logErr(msg) { process.stderr.write(`[rad-orchestration:copilot-vscode-bootstrap] ${msg}\n`); }
function logOut(msg) { process.stdout.write(`rad-orchestration: ${msg}\n`); }

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
    logErr(`hooks.json self-uninstall failed (non-fatal): ${err.message}`);
  }
}

function cleanupLegacyMarker(radHome) {
  // Best-effort: previous idempotency design wrote ~/.radorc/.copilot-vscode-plugin-bootstrap.json.
  // Upgraded installs from that design land here; clean up the orphan file.
  try { fs.unlinkSync(path.join(radHome, '.copilot-vscode-plugin-bootstrap.json')); } catch { /* absent or permission */ }
}

function formatSuccessLine(result) {
  const base = `${result.action} v${result.deliveringVersion}`;
  const fromClause = result.installedVersionBefore && result.installedVersionBefore !== result.deliveringVersion
    ? ` (from v${result.installedVersionBefore})`
    : '';
  const uiSuffix = result.uiStopped
    ? ' The dashboard UI was stopped to apply this update — restart it with /rad-ui-start.'
    : '';
  const upsertSuffix = result.installJsonUpserted && (result.action === 'noop' || result.action === 'downgrade-noop')
    ? ' (install.json entry refreshed)'
    : '';
  return `${base}${fromClause}${upsertSuffix}.${uiSuffix}`;
}

async function main() {
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorc');
  try {
    const result = await runInstall({ pluginRoot: process.env.COPILOT_VSCODE_PLUGIN_ROOT, radHome });
    logErr(`install action=${result.action}`);
    const bake = bakeAbsolutePaths(process.env.COPILOT_VSCODE_PLUGIN_ROOT);
    logErr(`bake baked=${bake.baked} scanned=${bake.scanned}`);
    logOut(formatSuccessLine(result));
    selfUninstall(process.env.COPILOT_VSCODE_PLUGIN_ROOT);
    cleanupLegacyMarker(radHome);
    return 0;
  } catch (err) {
    if (err instanceof UiLockError) {
      logErr(`install aborted: ${err.message}`);
      logOut(`install aborted — ${err.message}`);
    } else {
      logErr(`install failed (hooks.json left intact for retry): ${err.message}`);
      logOut(`install failed — ${err.message}. The hook will retry on your next prompt.`);
    }
    return 1;
  }
}

process.exit(await main());
