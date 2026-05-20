'use strict';
// launcher.cjs — cross-platform hook dispatcher for Copilot CLI.
//
// Copilot CLI spawns hook commands directly via node (not via cmd.exe or
// /bin/sh), so shell env-var expansions (%VAR% / $VAR) are never applied
// to the command string. Instead, COPILOT_PLUGIN_ROOT is available as a
// plain process.env entry, which we read here to build a fully-qualified,
// cwd-independent path to the target hook script.
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

// COPILOT_PLUGIN_ROOT is injected by Copilot CLI v1.0.48+ into the hook
// process environment. Use it for a cwd-independent absolute path.
// Fall back to __dirname (= hooks/ dir) when the env var is absent.
const hooksDir = process.env.COPILOT_PLUGIN_ROOT
  ? path.join(process.env.COPILOT_PLUGIN_ROOT, 'hooks')
  : __dirname;

const result = spawnSync(process.execPath, [path.join(hooksDir, script)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
