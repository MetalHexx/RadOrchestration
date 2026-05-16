'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

// ─── Helpers ────────────────────────────────────────────────────────────────

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

function parseArgs(argv) {
  let repoRoot = null;
  let branch = null;
  let worktreePath = null;
  let baseBranch = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--repo-root' && i + 1 < argv.length) {
      repoRoot = argv[++i];
    } else if (argv[i] === '--branch' && i + 1 < argv.length) {
      branch = argv[++i];
    } else if (argv[i] === '--worktree-path' && i + 1 < argv.length) {
      worktreePath = argv[++i];
    } else if (argv[i] === '--base-branch' && i + 1 < argv.length) {
      baseBranch = argv[++i];
    }
  }
  return { repoRoot, branch, worktreePath, baseBranch };
}

function classifyError(stderr) {
  const msg = (stderr || '').toLowerCase();
  if (msg.includes('already exists') && msg.includes('branch')) return 'already_exists_branch';
  if (msg.includes('already exists')) return 'already_exists_path';
  if (msg.includes('invalid reference') || msg.includes('not a valid')) return 'invalid_reference';
  return 'unknown';
}

/**
 * Convert SSH remote URL to HTTPS, or strip trailing .git from HTTPS URLs.
 * Returns empty string if format is unrecognized.
 */
function deriveRemoteUrl(rawUrl) {
  if (!rawUrl) return '';
  const sshMatch = rawUrl.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return 'https://github.com/' + sshMatch[1];
  if (rawUrl.startsWith('https://')) return rawUrl.replace(/\.git$/, '');
  return '';
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseArgs, classifyError, deriveRemoteUrl };

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main !== module) return;

const { repoRoot, branch, worktreePath, baseBranch } = parseArgs(process.argv);

if (!repoRoot || !branch || !worktreePath || !baseBranch) {
  outputAndExit({
    created: false,
    worktreePath: null,
    branch: null,
    baseBranch: null,
    pushed: false,
    remoteUrl: '',
    compareUrl: '',
    error: 'Missing required arguments: --repo-root, --branch, --worktree-path, --base-branch',
    errorType: 'missing_args'
  }, 2);
}

// ─── Create worktree ────────────────────────────────────────────────────────

try {
  execFileSync('git', ['worktree', 'add', '-b', branch, worktreePath, baseBranch], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
} catch (err) {
  const stderr = (err.stderr || err.message || '').trim();
  outputAndExit({
    created: false,
    worktreePath,
    branch,
    baseBranch,
    pushed: false,
    remoteUrl: '',
    compareUrl: '',
    error: stderr,
    errorType: classifyError(stderr)
  }, 2);
}

// ─── Push branch (non-blocking) ─────────────────────────────────────────────

let pushed = false;
try {
  execFileSync('git', ['push', '-u', 'origin', branch], {
    cwd: worktreePath,
    encoding: 'utf8'
  });
  pushed = true;
} catch {
  // Push failure is non-blocking
}

// ─── Detect remote URL ─────────────────────────────────────────────────────

let rawRemoteUrl = '';
try {
  rawRemoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: worktreePath,
    encoding: 'utf8'
  }).trim();
} catch {
  // No remote — leave empty
}

const remoteUrl = deriveRemoteUrl(rawRemoteUrl);

// Strip leading 'origin/' from baseBranch for compare URL
const baseBranchShort = baseBranch.replace(/^origin\//, '');
const compareUrl = remoteUrl
  ? remoteUrl + '/compare/' + baseBranchShort + '...' + branch
  : '';

outputAndExit({
  created: true,
  worktreePath: path.resolve(worktreePath),
  branch,
  baseBranch,
  pushed,
  remoteUrl,
  compareUrl,
  error: null,
  errorType: null
}, pushed ? 0 : 1);
