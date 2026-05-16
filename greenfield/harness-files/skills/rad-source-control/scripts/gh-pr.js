'use strict';

const { execFileSync } = require('child_process');

function parseArgs(argv) {
  let worktreePath = null;
  let branch = null;
  let baseBranch = null;
  let title = null;
  let bodyFile = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--worktree-path' && i + 1 < argv.length) {
      worktreePath = argv[++i];
    } else if (argv[i] === '--branch' && i + 1 < argv.length) {
      branch = argv[++i];
    } else if (argv[i] === '--base-branch' && i + 1 < argv.length) {
      baseBranch = argv[++i];
    } else if (argv[i] === '--title' && i + 1 < argv.length) {
      title = argv[++i];
    } else if (argv[i] === '--body-file' && i + 1 < argv.length) {
      bodyFile = argv[++i];
    }
  }
  return { worktreePath, branch, baseBranch, title, bodyFile };
}

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

const { worktreePath, branch, baseBranch, title, bodyFile } = parseArgs(process.argv);

// Validate required arguments
if (!worktreePath || !branch || !baseBranch || !title) {
  outputAndExit({
    pr_created: false,
    pr_url: null,
    pr_number: null,
    pr_existed: false,
    error: 'precondition_failure',
    message: 'Missing required argument: --worktree-path, --branch, --base-branch, and --title are all required'
  }, 2);
}

// Verify gh CLI is available and authenticated
try {
  execFileSync('gh', ['auth', 'status'], { encoding: 'utf8' });
} catch (authError) {
  const errText = (authError.stderr || authError.stdout || authError.message || '');
  const isNotFound = errText.includes('ENOENT') || errText.includes('not found') || errText.includes('not recognized');
  outputAndExit({
    pr_created: false,
    pr_url: null,
    pr_number: null,
    pr_existed: false,
    error: isNotFound ? 'gh_not_found' : 'auth_failed',
    message: errText.trim() || authError.message.trim()
  }, 2);
}

// Detect the remote
let remote;
try {
  remote = execFileSync('git', ['remote'], { cwd: worktreePath, encoding: 'utf8' }).trim();
} catch (remoteError) {
  const errText = (remoteError.stderr || remoteError.message || '');
  outputAndExit({
    pr_created: false,
    pr_url: null,
    pr_number: null,
    pr_existed: false,
    error: 'no_remote',
    message: errText.trim() || 'Failed to detect git remote'
  }, 2);
}

if (!remote) {
  outputAndExit({
    pr_created: false,
    pr_url: null,
    pr_number: null,
    pr_existed: false,
    error: 'no_remote',
    message: 'No git remote configured'
  }, 2);
}

// Check for existing PR (idempotent detection)
try {
  const listOutput = execFileSync('gh', [
    'pr', 'list',
    '--head', branch,
    '--base', baseBranch,
    '--json', 'url,number',
    '--limit', '1'
  ], { cwd: worktreePath, encoding: 'utf8' }).trim();

  const existing = JSON.parse(listOutput);
  if (Array.isArray(existing) && existing.length > 0) {
    outputAndExit({
      pr_created: false,
      pr_url: existing[0].url,
      pr_number: existing[0].number,
      pr_existed: true,
      error: null,
      message: 'Existing PR found'
    }, 0);
  }
} catch (listError) {
  // If pr list fails, proceed to create — the create step will surface any real errors
  process.stderr.write('Warning: gh pr list failed, proceeding to create: ' + (listError.stderr || listError.message) + '\n');
}

// Create the PR
try {
  const createArgs = [
    'pr', 'create',
    '--head', branch,
    '--base', baseBranch,
    '--title', title
  ];
  if (bodyFile) {
    createArgs.push('--body-file', bodyFile);
  }

  const prUrl = execFileSync('gh', createArgs, { cwd: worktreePath, encoding: 'utf8' }).trim();

  // Extract PR number from URL (last path segment)
  const urlParts = prUrl.split('/');
  const prNumber = parseInt(urlParts[urlParts.length - 1], 10);

  outputAndExit({
    pr_created: true,
    pr_url: prUrl,
    pr_number: isNaN(prNumber) ? null : prNumber,
    pr_existed: false,
    error: null,
    message: 'PR created successfully'
  }, 0);
} catch (createError) {
  const errText = (createError.stderr || createError.stdout || createError.message || '');
  outputAndExit({
    pr_created: false,
    pr_url: null,
    pr_number: null,
    pr_existed: false,
    error: 'creation_failed',
    message: errText.trim() || createError.message.trim()
  }, 1);
}
