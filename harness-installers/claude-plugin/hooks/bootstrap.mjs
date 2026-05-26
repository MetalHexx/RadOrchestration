#!/usr/bin/env node
// bootstrap.mjs — UserPromptSubmit hook. Merged successor of legacy
// bootstrap-then-uninstall.mjs + the radorch plugin-bootstrap subcommand.
// Imports lib/install/* directly — esbuild inlines them at build time.
// On install success, atomically rewrites hooks.json to remove
// its own UserPromptSubmit entry; SessionStart drift-check stays in place.
//
// On every exit (success, no-op, error) writes ONE human-readable line to
// stdout that Claude Code surfaces in the chat. stderr keeps the verbose
// debug trail for the process log.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInstall, UiLockError } from '../lib/install/run-install.js';

function logErr(msg) { process.stderr.write(`[rad-orchestration:bootstrap] ${msg}\n`); }
function logOut(msg) { process.stdout.write(`rad-orchestration: ${msg}\n`); }

function isUnderClaudeCache(pluginRoot) {
  const cacheRoot = path.join(os.homedir(), '.claude', 'plugins', 'cache');
  const normalized = path.resolve(pluginRoot);
  const prefix = cacheRoot + path.sep;
  return process.platform === 'win32'
    ? normalized.toLowerCase().startsWith(prefix.toLowerCase())
    : normalized.startsWith(prefix);
}

function selfUninstall(pluginRoot) {
  if (!isUnderClaudeCache(pluginRoot) && process.env.RAD_BOOTSTRAP_SELFUNINSTALL_ALLOW_NONCACHE !== '1') {
    logErr(`selfUninstall skipped: pluginRoot=${pluginRoot} is not under Claude Code cache`);
    return;
  }
  const hooksJson = path.join(pluginRoot, 'hooks', 'hooks.json');
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
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) { logErr('CLAUDE_PLUGIN_ROOT unset'); return 0; }
  const radHome = process.env.RAD_HOME; // tests override; production uses ~/.radorc via default
  try {
    const result = await runInstall({ pluginRoot, radHome });
    logErr(`install action=${result.action}`);
    logOut(formatSuccessLine(result));
    selfUninstall(pluginRoot);
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
