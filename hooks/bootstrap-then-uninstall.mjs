#!/usr/bin/env node
// hooks/bootstrap-then-uninstall.mjs — UserPromptSubmit hook wrapper.
//
// Why this exists (and why there is no SessionStart hook):
//   Claude Code does NOT fire SessionStart on `/plugin install` or
//   `/reload-plugins` — only on a true session startup / resume / clear /
//   compact. A SessionStart-only bootstrap leaves `~/.radorch/` un-hydrated
//   until the user fully quits and reopens the app.
//
//   UserPromptSubmit fires on the first prompt of any session, including
//   the one immediately after install. We use it as a one-shot bootstrap
//   trigger and then rewrite hooks.json to remove ourselves so the hook
//   never fires again until the next install or update.
//
// Self-healing across `/plugin update`:
//   `/plugin update` reinstalls the plugin payload fresh, which restores
//   the canonical hooks.json (with UserPromptSubmit re-registered). The
//   next prompt fires this wrapper, plugin-bootstrap detects the version
//   delta against ~/.radorch/install.json and runs the upgrade path, then
//   we self-uninstall again.
//
// Bootstrap-failure resilience:
//   plugin-bootstrap emits a JSON envelope `{"ok":true|false,"data":{...}}`
//   on stdout. We trust the envelope, not just the spawn exit code (which
//   has been observed to return 0 even when bootstrap errored out). On
//   `ok:false` (or unparseable stdout, or non-zero exit) we skip the
//   self-uninstall so the hook retries on the next prompt.
//
// Contributor doc: see hooks/AGENTS.md for the full design + lifecycle.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function log(msg) {
  // Hooks run with stderr surfaced into Claude Code logs only on non-zero
  // exit. Quiet on the happy path; emit on errors for recoverability.
  process.stderr.write(`[rad-orchestration:bootstrap-then-uninstall] ${msg}\n`);
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function parseBootstrapEnvelope(stdout) {
  // plugin-bootstrap's CLI framework prints the envelope as a single JSON
  // line. Defensive: scan stdout from the end for the last line that parses
  // as JSON, in case any preceding line slipped through (e.g., warn output
  // from informational logs in --quiet mode).
  if (!stdout) return null;
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      continue;
    }
  }
  return null;
}

function selfUninstallHook(pluginRoot) {
  try {
    const hooksJsonPath = path.join(pluginRoot, 'hooks', 'hooks.json');
    const manifest = readJsonSafe(hooksJsonPath);
    if (manifest?.hooks?.UserPromptSubmit) {
      delete manifest.hooks.UserPromptSubmit;
      const tmp = hooksJsonPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, hooksJsonPath);
    }
  } catch (err) {
    log(`hooks.json self-uninstall failed (non-fatal): ${err.message}`);
  }
}

function run() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) {
    log('CLAUDE_PLUGIN_ROOT unset — cannot resolve plugin payload, exiting 0');
    return 0;
  }

  const pluginPkg = readJsonSafe(path.join(pluginRoot, 'package.json'));
  const deliveringVersion = pluginPkg?.version;
  if (!deliveringVersion) {
    log(`plugin package.json missing or unreadable at ${pluginRoot}/package.json — exiting 0`);
    return 0;
  }

  const installJsonPath = path.join(os.homedir(), '.radorch', 'install.json');
  const installed = readJsonSafe(installJsonPath);
  const installedVersion = installed?.package_version;

  // Run plugin-bootstrap only on version mismatch (or fresh install).
  // Same-version re-fires within an install session (before the next session
  // reload picks up the rewritten hooks.json) skip the spawn — bootstrap
  // would just return `noop`, and spawn cost isn't free. The self-uninstall
  // below still runs so re-fires converge cleanly.
  if (!installedVersion || installedVersion !== deliveringVersion) {
    const radorch = path.join(
      pluginRoot, 'skills', 'rad-orchestration', 'scripts', 'radorch.mjs',
    );
    const result = spawnSync(process.execPath, [
      radorch,
      'plugin-bootstrap',
      '--quiet',
      '--harness', 'claude',
      '--plugin-root', pluginRoot,
    ], { stdio: 'pipe', encoding: 'utf8' });

    if (result.status !== 0) {
      log(`plugin-bootstrap exited ${result.status} (signal=${result.signal}, error=${result.error?.message ?? 'none'}) — leaving hooks.json intact for retry`);
      if (result.stderr) log(`stderr: ${result.stderr.slice(0, 500)}`);
      return result.status ?? 1;
    }

    const envelope = parseBootstrapEnvelope(result.stdout);
    if (!envelope || envelope.ok !== true) {
      const action = envelope?.data?.action ?? 'unknown';
      log(`plugin-bootstrap returned non-ok envelope (action=${action}) — leaving hooks.json intact for retry`);
      if (result.stderr) log(`stderr: ${result.stderr.slice(0, 500)}`);
      return 1;
    }
  }

  selfUninstallHook(pluginRoot);
  return 0;
}

process.exit(run());
