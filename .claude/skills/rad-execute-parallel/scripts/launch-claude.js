'use strict';

/**
 * launch-claude.js
 *
 * Cross-platform launcher: opens a new terminal window at the given worktree
 * path and starts Claude Code with an initial prompt.
 *
 * Permission mode is selectable via --permission-mode. Defaults to `auto`
 * (classifier-based per-call decisions — safer guard-rails).
 *
 * Usage:
 *   node launch-claude.js --worktree-path <path> --projects-base-path <path> --prompt <string> [--permission-mode <mode>]
 *
 * Output: JSON to stdout  { success: true, platform, permissionMode }  or  { success: false, error }
 */

const { spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] ?? null : null;
};

const worktreePath    = getArg('--worktree-path');
const projectsBase    = getArg('--projects-base-path');
const prompt          = getArg('--prompt');
const permissionMode  = getArg('--permission-mode') || 'auto';

const VALID_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'auto', 'dontAsk', 'plan'];
if (!VALID_MODES.includes(permissionMode)) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: `Invalid --permission-mode '${permissionMode}'. Must be one of: ${VALID_MODES.join(', ')}`
  }) + '\n');
  process.exit(1);
}

if (!worktreePath || !prompt) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: 'Missing required args: --worktree-path and --prompt'
  }) + '\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Platform launchers
// ---------------------------------------------------------------------------

function buildClaudeCmd() {
  const parts = [`claude --permission-mode ${permissionMode}`];
  // Prompt must come before --add-dir; --add-dir accepts multiple values and
  // would otherwise consume the prompt string as a second directory argument.
  parts.push(`'${prompt}'`);
  if (projectsBase) parts.push(`--add-dir '${projectsBase}'`);
  return parts.join(' ');
}

function launchWindows() {
  // Build a PowerShell command string, then Base64-encode it so it survives
  // the wt → powershell argument boundary as a single token (no quoting issues).
  const innerCmd = `Set-Location '${worktreePath}'; ${buildClaudeCmd()}`;
  const encoded  = Buffer.from(innerCmd, 'utf16le').toString('base64');

  const child = spawn(
    'wt',
    ['--startingDirectory', worktreePath, 'powershell', '-NoExit', '-EncodedCommand', encoded],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

function launchMac() {
  const cmd    = `cd '${worktreePath}' && ${buildClaudeCmd()}`;
  // Escape backslashes and double-quotes inside the AppleScript string
  const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const child = spawn(
    'osascript',
    ['-e', `tell application "Terminal" to do script "${escaped}"`],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

function launchLinux() {
  const cmd = `cd '${worktreePath}' && ${buildClaudeCmd()}; exec bash`;

  const child = spawn(
    'gnome-terminal',
    ['--', 'bash', '-c', cmd],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

try {
  const platform = process.platform;

  if (platform === 'win32')       launchWindows();
  else if (platform === 'darwin') launchMac();
  else                            launchLinux();

  process.stdout.write(JSON.stringify({ success: true, platform, permissionMode }) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
  process.exit(1);
}
