'use strict';

const { execFileSync } = require('child_process');

function parseArgs(argv) {
  let worktreePath = null;
  let title = null;
  let bodyFile = null;
  let base = null;
  let head = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--worktree-path' && i + 1 < argv.length) {
      worktreePath = argv[++i];
    } else if (argv[i] === '--title' && i + 1 < argv.length) {
      title = argv[++i];
    } else if (argv[i] === '--body-file' && i + 1 < argv.length) {
      bodyFile = argv[++i];
    } else if (argv[i] === '--base' && i + 1 < argv.length) {
      base = argv[++i];
    } else if (argv[i] === '--head' && i + 1 < argv.length) {
      head = argv[++i];
    }
  }
  return { worktreePath, title, bodyFile, base, head };
}

function sanitize(text) {
  return text
    .replace(/ghp_[A-Za-z0-9_]+/g, '***')
    .replace(/gho_[A-Za-z0-9_]+/g, '***')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '***')
    .replace(/Authorization:\s*\S+/gi, 'Authorization: ***');
}

const { worktreePath, title, bodyFile, base, head } = parseArgs(process.argv);

if (!worktreePath || !title || !base || !head) {
  const result = {
    pr_created: false,
    pr_url: null,
    error: 'Missing required argument: --worktree-path, --title, --base, and --head are required',
    errorType: 'missing_args'
  };
  console.log(JSON.stringify(result));
  process.exit(2);
}

try {
  // Idempotency check — look for an existing PR with the same head/base
  const existing = execFileSync('gh', [
    'pr', 'list', '--head', head, '--base', base,
    '--json', 'url', '--jq', '.[0].url'
  ], { cwd: worktreePath, encoding: 'utf8' }).trim();

  if (existing) {
    const result = {
      pr_created: false,
      pr_url: existing,
      error: null,
      errorType: null
    };
    console.log(JSON.stringify(result));
    process.exit(0);
  }

  // Build PR creation arguments
  const args = ['pr', 'create', '--title', title, '--base', base, '--head', head];
  if (bodyFile) {
    args.push('--body-file', bodyFile);
  } else {
    args.push('--body', 'Pipeline delivery');
  }

  const prUrl = execFileSync('gh', args, { cwd: worktreePath, encoding: 'utf8' }).trim();

  const result = {
    pr_created: true,
    pr_url: prUrl,
    error: null,
    errorType: null
  };
  console.log(JSON.stringify(result));
  process.exit(0);
} catch (err) {
  const errText = sanitize((err.stderr || err.stdout || err.message || '').trim() || err.message.trim());
  const isAuth = /auth|credentials|login/i.test(errText);
  const result = {
    pr_created: false,
    pr_url: null,
    error: errText,
    errorType: isAuth ? 'auth_failed' : 'create_failed'
  };
  console.log(JSON.stringify(result));
  process.exit(2);
}
