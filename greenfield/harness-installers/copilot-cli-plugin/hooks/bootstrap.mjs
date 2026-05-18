#!/usr/bin/env node
// bootstrap.mjs — userPromptSubmitted hook. Merged install orchestrator
// for the Copilot CLI plugin. Imports lib/install/* directly — esbuild
// inlines them at build time. Idempotent via marker file at
// ~/.radorch/.copilot-cli-plugin-bootstrap.json; hooks.json is never
// rewritten because Copilot CLI's cache-and-read semantics make
// mid-session hooks.json mutations unreliable.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall } from '../lib/install/run-install.js';
import { userDataPaths } from '../lib/install/user-data-paths.js';

function log(msg) { process.stderr.write(`[rad-orchestration:copilot-cli-bootstrap] ${msg}\n`); }

// FR-8: resolve own payload location from inside the script.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, '..');

// FR-28: publish COPILOT_CLI_PLUGIN_ROOT before importing any downstream module
// that may read it. Honor an existing env var (tests override) but otherwise
// set from the script-derived path.
if (!process.env.COPILOT_CLI_PLUGIN_ROOT) {
  process.env.COPILOT_CLI_PLUGIN_ROOT = pluginRoot;
}

function readMarker(markerPath) {
  if (!fs.existsSync(markerPath)) return null;
  try { return JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch { return null; }
}

function writeMarker(markerPath, marker) {
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  const tmp = `${markerPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(marker, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, markerPath);
}

function readDeliveringVersion(root) {
  const pluginJson = path.join(root, 'plugin.json');
  if (fs.existsSync(pluginJson)) {
    const pj = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
    if (pj.version) return pj.version;
  }
  const pkgJson = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
  return pkg.version;
}

async function main() {
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorch');
  const paths = userDataPaths({ radHome });
  const deliveringVersion = readDeliveringVersion(process.env.COPILOT_CLI_PLUGIN_ROOT);

  // FR-7 idempotency: marker fast-path covers (a) success + version match.
  // Error marker (b) and version-mismatch (c) fall through to runInstall.
  const marker = readMarker(paths.bootstrapMarker);
  if (marker && marker.status === 'success' && marker.version === deliveringVersion) {
    // DD-9 silent noop — no log line, no marker rewrite.
    return 0;
  }

  try {
    const result = await runInstall({ pluginRoot: process.env.COPILOT_CLI_PLUGIN_ROOT, radHome });
    log(`install action=${result.action}`);
    // DD-14: marker is the LAST write so its state always reflects the most recent outcome.
    writeMarker(paths.bootstrapMarker, {
      version: deliveringVersion,
      status: 'success',
      at: new Date().toISOString(),
    });
    return 0;
  } catch (err) {
    log(`install failed (marker set to error for next-prompt retry): ${err.message}`);
    try {
      writeMarker(paths.bootstrapMarker, {
        version: deliveringVersion,
        status: 'error',
        at: new Date().toISOString(),
      });
    } catch { /* best-effort */ }
    return 1; // NFR-12: Copilot's fail-open posture for userPromptSubmitted carries the prompt.
  }
}

process.exit(await main());
