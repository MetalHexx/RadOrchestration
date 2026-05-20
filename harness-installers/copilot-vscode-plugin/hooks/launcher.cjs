'use strict';
// launcher.cjs — cross-platform hook dispatcher for VS Code Copilot plugins.
//
// VS Code spawns hook commands directly via node (not via cmd.exe or /bin/sh),
// so shell env-var expansions (%VAR% / $VAR) are never applied to the command
// string. The docs are silent on whether COPILOT_PLUGIN_ROOT is injected for
// Copilot-format plugins (docs/research/copilot-vscode-plugin-system.md §5),
// so the implementation does not depend on it: read the env var if set, fall
// back to __dirname otherwise. The launcher is the single path-resolution
// point — downstream bootstrap.mjs / drift-check.mjs derive the plugin root
// from their own import.meta.url.
//
// Usage (hooks.json):
//   "command": "node hooks/launcher.cjs bootstrap.mjs"
//   "command": "node hooks/launcher.cjs drift-check.mjs"

const path = require('path');
const { spawnSync } = require('child_process');

const script = process.argv[2];
if (!script) {
  process.stderr.write('[rad-orchestration] launcher.cjs: no script specified\n');
  process.exit(1);
}

// COPILOT_PLUGIN_ROOT may or may not be injected by VS Code for Copilot-format
// plugins (the docs are silent). Use it for a cwd-independent absolute path
// when present; fall back to __dirname (= hooks/ dir) otherwise.
const hooksDir = process.env.COPILOT_PLUGIN_ROOT
  ? path.join(process.env.COPILOT_PLUGIN_ROOT, 'hooks')
  : __dirname;

const result = spawnSync(process.execPath, [path.join(hooksDir, script)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
