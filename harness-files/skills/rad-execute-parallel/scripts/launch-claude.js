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

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] ?? null : null;
  };
  return {
    worktreePath:   get('--worktree-path'),
    projectsBase:   get('--projects-base-path'),
    prompt:         get('--prompt'),
    permissionMode: get('--permission-mode') || 'auto',
  };
}

/**
 * Git Bash on Windows (MSYS2) rewrites a leading `/` argument to the Git
 * installation root before native binaries see argv (e.g. `/rad-execute foo`
 * arrives as `C:/Program Files/Git/rad-execute foo`). Detect that pattern
 * and restore the original slash command.
 *
 * Contract: --prompt is a slash command. The heuristic only repairs when
 * the trailing token of the path-portion matches /^[A-Za-z][\w-]*$/, so
 * non-slash-command inputs are left alone.
 */
function repairMsysPrompt(prompt) {
  if (typeof prompt !== 'string' || prompt.length === 0) return prompt;
  if (prompt.startsWith('/')) return prompt;
  if (!/^[A-Za-z]:[\\/]/.test(prompt)) return prompt;

  // Scan from the right: find the rightmost path separator whose trailing
  // segment (up to the next whitespace or end-of-string) is a valid
  // slash-command identifier. The MSYS root itself may contain spaces
  // (e.g. `C:/Program Files/Git/`), which is why we can't split on the
  // first whitespace.
  for (let i = prompt.length - 1; i >= 0; i--) {
    const ch = prompt[i];
    if (ch !== '/' && ch !== '\\') continue;

    const tailStart = i + 1;
    let tailEnd = tailStart;
    while (tailEnd < prompt.length && !/\s/.test(prompt[tailEnd])) tailEnd++;

    const command = prompt.slice(tailStart, tailEnd);
    if (!/^[A-Za-z][\w-]*$/.test(command)) continue;

    const rest = prompt.slice(tailEnd);
    process.stderr.write(
      `launch-claude.js: detected MSYS-mangled prompt; restoring leading slash for /${command}\n`
    );
    return `/${command}${rest}`;
  }

  return prompt;
}

const VALID_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'auto', 'dontAsk', 'plan'];

// ---------------------------------------------------------------------------
// Platform launchers
// ---------------------------------------------------------------------------

function buildClaudeCmd({ permissionMode, prompt, projectsBase }) {
  const parts = [`claude --permission-mode ${permissionMode}`];
  // Prompt must come before --add-dir; --add-dir accepts multiple values and
  // would otherwise consume the prompt string as a second directory argument.
  parts.push(`'${prompt}'`);
  if (projectsBase) parts.push(`--add-dir '${projectsBase}'`);
  return parts.join(' ');
}

function launchWindows(opts) {
  // Build a PowerShell command string, then Base64-encode it so it survives
  // the wt → powershell argument boundary as a single token (no quoting issues).
  const innerCmd = `Set-Location '${opts.worktreePath}'; ${buildClaudeCmd(opts)}`;
  const encoded  = Buffer.from(innerCmd, 'utf16le').toString('base64');

  const child = spawn(
    'wt',
    ['--startingDirectory', opts.worktreePath, 'powershell', '-NoExit', '-EncodedCommand', encoded],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

function launchMac(opts) {
  const cmd    = `cd '${opts.worktreePath}' && ${buildClaudeCmd(opts)}`;
  // Escape backslashes and double-quotes inside the AppleScript string
  const escaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const child = spawn(
    'osascript',
    ['-e', `tell application "Terminal" to do script "${escaped}"`],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

function launchLinux(opts) {
  const cmd = `cd '${opts.worktreePath}' && ${buildClaudeCmd(opts)}; exec bash`;

  const child = spawn(
    'gnome-terminal',
    ['--', 'bash', '-c', cmd],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

// ---------------------------------------------------------------------------
// Exports (for testing)
// ---------------------------------------------------------------------------

module.exports = { parseArgs, repairMsysPrompt, VALID_MODES };

// ---------------------------------------------------------------------------
// Dispatch (CLI entry point)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const parsed = parseArgs(process.argv);
  parsed.prompt = repairMsysPrompt(parsed.prompt);

  if (!VALID_MODES.includes(parsed.permissionMode)) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: `Invalid --permission-mode '${parsed.permissionMode}'. Must be one of: ${VALID_MODES.join(', ')}`
    }) + '\n');
    process.exit(1);
  }

  if (!parsed.worktreePath || !parsed.prompt) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: 'Missing required args: --worktree-path and --prompt'
    }) + '\n');
    process.exit(1);
  }

  try {
    const platform = process.platform;

    if (platform === 'win32')       launchWindows(parsed);
    else if (platform === 'darwin') launchMac(parsed);
    else                            launchLinux(parsed);

    process.stdout.write(JSON.stringify({ success: true, platform, permissionMode: parsed.permissionMode }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
    process.exit(1);
  }
}
