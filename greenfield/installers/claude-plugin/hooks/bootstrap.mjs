#!/usr/bin/env node
// bootstrap.mjs — UserPromptSubmit hook. Merged successor of legacy
// bootstrap-then-uninstall.mjs + the radorch plugin-bootstrap subcommand.
// Imports lib/install/* directly — esbuild inlines them at build time
// (FR-13). On install success, atomically rewrites hooks.json to remove
// its own UserPromptSubmit entry; SessionStart drift-check stays in place.

import fs from 'node:fs';
import path from 'node:path';
import { runInstall } from '../lib/install/run-install.js';

function log(msg) { process.stderr.write(`[rad-orchestration:bootstrap] ${msg}\n`); }

function selfUninstall(pluginRoot) {
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
    log(`hooks.json self-uninstall failed (non-fatal): ${err.message}`);
  }
}

async function main() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) { log('CLAUDE_PLUGIN_ROOT unset'); return 0; }
  const radHome = process.env.RAD_HOME; // tests override; production uses ~/.radorch via default
  try {
    const result = await runInstall({ pluginRoot, radHome });
    log(`install action=${result.action}`);
    selfUninstall(pluginRoot);
    return 0;
  } catch (err) {
    log(`install failed (hooks.json left intact for retry): ${err.message}`);
    return 1;
  }
}

process.exit(await main());
