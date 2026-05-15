#!/usr/bin/env node
// hooks/drift-check.mjs — SessionStart hook that surfaces cross-channel
// version drift between the Claude Code plugin and ~/.radorch/install.json.
//
// Why this exists:
//   The user can upgrade rad-orchestration through two independent channels —
//   the Claude Code plugin (`/plugin update`) and the legacy installer
//   (`npx rad-orchestration`). When they update one but not the other, the
//   plugin's bundled agents/skills/CLI fall out of sync with the user-data
//   root at ~/.radorch/. The bundled CLI's `checkVersionSkew` HARD-HALTs when
//   orchestration is actually invoked against drifted state — that's the
//   safety net. This hook is the SOFT pre-warning: it fires on every
//   SessionStart, and on drift, injects a context line that Claude reads and
//   surfaces to the user organically.
//
// Per Anthropic hook docs: SessionStart with exit 0 + plain stdout injects
// the stdout as conversation context before the first prompt. We cap drift
// output well below the documented 10 KB limit.
//
// Always exits 0. Drift is informational, never blocking. Every edge case —
// missing CLAUDE_PLUGIN_ROOT, missing package.json, missing install.json,
// malformed JSON, no version fields — is treated as "no drift to report"
// and produces empty stdout.
//
// Contributor doc: see hooks/AGENTS.md for the broader hook story.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function run() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) return;

  const pluginPkg = readJsonSafe(path.join(pluginRoot, 'package.json'));
  const deliveringVersion = pluginPkg?.version;
  if (!deliveringVersion) return;

  const installJsonPath = path.join(os.homedir(), '.radorch', 'install.json');
  const installed = readJsonSafe(installJsonPath);
  if (!installed) return;

  const installedVersion = installed.package_version;
  const lastWriterVersion = installed.last_writer_version;
  if (!installedVersion) return;

  // Drift: the user-data root was last touched by a different version than
  // the plugin is currently shipping. We don't try to determine direction
  // (which side is newer) — we just report the mismatch and let Claude
  // recommend the resolution path.
  if (installedVersion === deliveringVersion) return;

  const writerNote = lastWriterVersion && lastWriterVersion !== installedVersion
    ? ` (last writer: ${lastWriterVersion})`
    : '';
  process.stdout.write(
    `[rad-orchestration drift] ~/.radorch/install.json is at version ${installedVersion}${writerNote}. `
    + `The Claude Code plugin's bundled radorch.mjs is at version ${deliveringVersion}. `
    + `Tell the user: their workspace state is on a different rad-orchestration version than the plugin. `
    + `Recommend running \`/plugin update rad-orchestration\` to keep them in sync. `
    + `Do not block the user's request — surface this as a short reminder, then continue.\n`,
  );
}

run();
process.exit(0);
