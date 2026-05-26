#!/usr/bin/env node
// drift-check.mjs — SessionStart hook. Compares plugin-delivered version
// against ~/.radorc/install.json's claude-plugin entry. Single stdout
// line on mismatch (Claude injects as conversation context per the
// SessionStart hook contract). Silent on match. Never self-uninstalls.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function readJsonSafe(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

function run() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) return;
  const pkg = readJsonSafe(path.join(pluginRoot, 'package.json'));
  const deliveringVersion = pkg?.version;
  if (!deliveringVersion) return;
  const radHome = process.env.RAD_HOME ?? path.join(os.homedir(), '.radorc');
  const installed = readJsonSafe(path.join(radHome, 'install.json'));
  const pluginEntry = installed?.harnesses?.['claude-plugin'];
  const installedVersion = pluginEntry?.version ?? installed?.package_version;
  if (!installedVersion || installedVersion === deliveringVersion) return;
  process.stdout.write(
    `[rad-orchestration drift] ~/.radorc/install.json is at version ${installedVersion}. ` +
    `The Claude Code plugin's bundled radorch is at version ${deliveringVersion}. ` +
    `Recommend running \`/plugin update rad-orc\` to keep them in sync.\n`,
  );
}

run();
process.exit(0);
