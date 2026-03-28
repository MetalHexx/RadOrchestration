'use strict';

const { execSync } = require('child_process');

function parseArgs(argv) {
  let worktreePath = null;
  let message = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--worktree-path' && i + 1 < argv.length) {
      worktreePath = argv[++i];
    } else if (argv[i] === '--message' && i + 1 < argv.length) {
      message = argv[++i];
    }
  }
  return { worktreePath, message };
}

const { worktreePath, message } = parseArgs(process.argv);

if (!worktreePath || !message) {
  const result = {
    committed: false,
    pushed: false,
    commitHash: null,
    error: 'Missing required argument: --worktree-path and --message are both required',
    errorType: 'commit_failed'
  };
  console.log(JSON.stringify(result));
  process.exit(2);
}

let commitHash = null;

try {
  execSync('git add -A', { cwd: worktreePath, encoding: 'utf8' });
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: worktreePath, encoding: 'utf8' });
  commitHash = execSync('git rev-parse --short HEAD', { cwd: worktreePath, encoding: 'utf8' }).trim();
} catch (commitError) {
  const errText = (commitError.stderr || commitError.message || '');
  const isNothingToCommit = errText.includes('nothing to commit') || commitError.message.includes('nothing to commit');
  const result = {
    committed: false,
    pushed: false,
    commitHash: null,
    error: isNothingToCommit ? 'nothing to commit' : errText.trim() || commitError.message.trim(),
    errorType: isNothingToCommit ? 'nothing_to_commit' : 'commit_failed'
  };
  console.log(JSON.stringify(result));
  process.exit(2);
}

try {
  execSync('git push', { cwd: worktreePath, encoding: 'utf8' });
} catch (pushError) {
  const errText = (pushError.stderr || pushError.message || '');
  const result = {
    committed: true,
    pushed: false,
    commitHash: commitHash,
    error: errText.trim() || pushError.message.trim(),
    errorType: 'push_failed'
  };
  console.log(JSON.stringify(result));
  process.exit(1);
}

const result = {
  committed: true,
  pushed: true,
  commitHash: commitHash,
  error: null,
  errorType: null
};
console.log(JSON.stringify(result));
process.exit(0);
