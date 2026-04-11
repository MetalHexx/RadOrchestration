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

/**
 * Core commit+push logic. Accepts an injectable exec function for testing.
 * Returns { committed, pushed, commitHash, error, errorType, exitCode }.
 */
function gitCommit({ worktreePath, message, exec = execFileSync }) {
  let commitHash = null;

  try {
    exec('git', ['add', '-A'], { cwd: worktreePath, encoding: 'utf8' });
    exec('git', ['commit', '-m', message], { cwd: worktreePath, encoding: 'utf8' });
    commitHash = exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: worktreePath, encoding: 'utf8' }).trim();
  } catch (commitError) {
    const errText = (commitError.stderr || commitError.stdout || commitError.message || '');
    const isNothingToCommit =
      errText.includes('nothing to commit') ||
      (commitError.stdout && commitError.stdout.includes('nothing to commit')) ||
      commitError.message.includes('nothing to commit');
    return {
      committed: false,
      pushed: false,
      commitHash: null,
      upstreamConfigured: false,
      error: isNothingToCommit ? 'nothing to commit' : errText.trim() || commitError.message.trim(),
      errorType: isNothingToCommit ? 'nothing_to_commit' : 'commit_failed',
      exitCode: 2
    };
  }

  try {
    exec('git', ['push'], { cwd: worktreePath, encoding: 'utf8' });
  } catch (pushError) {
    const errText = (pushError.stderr || pushError.message || '');

    if (errText.includes('has no upstream branch') || errText.includes('no upstream branch')) {
      process.stderr.write(
        'ℹ No upstream branch configured. Setting upstream and retrying push automatically.\n'
      );
      try {
        const branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: worktreePath, encoding: 'utf8' }).trim();
        exec('git', ['push', '--set-upstream', 'origin', branch], { cwd: worktreePath, encoding: 'utf8' });
        return {
          committed: true,
          pushed: true,
          commitHash,
          upstreamConfigured: true,
          error: null,
          errorType: null,
          exitCode: 0
        };
      } catch (retryError) {
        const retryErrText = (retryError.stderr || retryError.message || '');
        return {
          committed: true,
          pushed: false,
          commitHash,
          upstreamConfigured: false,
          error: retryErrText.trim() || retryError.message.trim(),
          errorType: 'push_failed',
          exitCode: 1
        };
      }
    }

    return {
      committed: true,
      pushed: false,
      commitHash,
      upstreamConfigured: false,
      error: errText.trim() || pushError.message.trim(),
      errorType: 'push_failed',
      exitCode: 1
    };
  }

  return {
    committed: true,
    pushed: true,
    commitHash,
    upstreamConfigured: false,
    error: null,
    errorType: null,
    exitCode: 0
  };
}

if (require.main === module) {
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

  const { exitCode, ...output } = gitCommit({ worktreePath, message });
  console.log(JSON.stringify(output));
  process.exit(exitCode);
}

module.exports = { gitCommit, parseArgs };
