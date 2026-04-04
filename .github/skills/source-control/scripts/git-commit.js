'use strict';

const { execFileSync } = require('child_process');

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
  execFileSync('git', ['add', '-A'], { cwd: worktreePath, encoding: 'utf8' });
  execFileSync('git', ['commit', '-m', message], { cwd: worktreePath, encoding: 'utf8' });
  commitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: worktreePath, encoding: 'utf8' }).trim();
} catch (commitError) {
  const errText = (commitError.stderr || commitError.stdout || commitError.message || '');
  const isNothingToCommit =
    errText.includes('nothing to commit') ||
    (commitError.stdout && commitError.stdout.includes('nothing to commit')) ||
    commitError.message.includes('nothing to commit');
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
  execFileSync('git', ['push'], { cwd: worktreePath, encoding: 'utf8' });
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
