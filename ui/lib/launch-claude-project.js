'use strict';

/**
 * launch-claude-project.js
 *
 * Cross-platform launcher: opens a new terminal window at the given
 * workspace root and starts Claude Code with a slash-prefixed prompt.
 * Modeled on .claude/skills/rad-execute-parallel/scripts/launch-claude.js
 * but with a project-scoped arg surface: no worktree path, no
 * --add-dir, a single workspace root that becomes the cwd.
 *
 * Usage:
 *   node launch-claude-project.js --workspace-root <path> --prompt <string> [--permission-mode <mode>]
 *
 * Output: JSON to stdout { success: true, platform, permissionMode }
 *         or            { success: false, error }
 */

const { spawn } = require('child_process');

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] ?? null : null;
};

const workspaceRoot  = getArg('--workspace-root');
const prompt         = getArg('--prompt');
const permissionMode = getArg('--permission-mode') || 'auto';

const VALID_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'auto', 'dontAsk', 'plan'];
if (!VALID_MODES.includes(permissionMode)) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: `Invalid --permission-mode '${permissionMode}'. Must be one of: ${VALID_MODES.join(', ')}`,
  }) + '\n');
  process.exit(1);
}

if (!workspaceRoot || !prompt) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: 'Missing required args: --workspace-root and --prompt',
  }) + '\n');
  process.exit(1);
}

function buildClaudeCmd() {
  // Prompt is slash-prefixed at the caller; single-quoted here to match
  // rad-execute-parallel/scripts/launch-claude.js. See NFR-4.
  return `claude --permission-mode ${permissionMode} '${prompt}'`;
}

function launchWindows() {
  const innerCmd = `Set-Location '${workspaceRoot}'; ${buildClaudeCmd()}`;
  const encoded  = Buffer.from(innerCmd, 'utf16le').toString('base64');
  const child = spawn(
    'wt',
    ['--startingDirectory', workspaceRoot, 'powershell', '-NoExit', '-EncodedCommand', encoded],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

function launchMac() {
  const cmd     = `cd '${workspaceRoot}' && ${buildClaudeCmd()}`;
  const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const child = spawn(
    'osascript',
    ['-e', `tell application "Terminal" to do script "${escaped}"`],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

function launchLinux() {
  const cmd = `cd '${workspaceRoot}' && ${buildClaudeCmd()}; exec bash`;
  const child = spawn(
    'gnome-terminal',
    ['--', 'bash', '-c', cmd],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

try {
  const platform = process.platform;
  const dryRun = process.env.LAUNCH_CLAUDE_PROJECT_DRY_RUN === '1';

  if (!dryRun) {
    if (platform === 'win32')       launchWindows();
    else if (platform === 'darwin') launchMac();
    else                            launchLinux();
  }

  process.stdout.write(JSON.stringify({ success: true, platform, permissionMode }) + '\n');
} catch (err) {
  process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
  process.exit(1);
}
