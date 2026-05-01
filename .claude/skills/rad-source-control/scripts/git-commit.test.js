'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { gitCommit, parseArgs } = require('./git-commit.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock exec function from an ordered queue of return values / errors.
 * Each queued entry is consumed in call order.
 * - A string → returned as-is (simulates stdout output)
 * - An Error → thrown (simulates exec failure)
 * Throws if the queue is exhausted unexpectedly.
 */
function makeExec(calls) {
  const queue = [...calls];
  return function mockExec(cmd, args) {
    if (queue.length === 0) {
      throw new Error(`Unexpected exec call: ${[cmd, ...args].join(' ')}`);
    }
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}

/**
 * Build a mock exec that also records every call's args for later inspection.
 */
function makeCapturingExec(calls) {
  const capturedArgs = [];
  const baseExec = makeExec(calls);
  function exec(cmd, args, opts) {
    capturedArgs.push(args.slice());
    return baseExec(cmd, args, opts);
  }
  exec.capturedArgs = capturedArgs;
  return exec;
}

/** Create a git-style Error with a stderr property. */
function gitError(stderr, message) {
  const err = new Error(message || stderr);
  err.stderr = stderr;
  return err;
}

// ── parseArgs ─────────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('extracts --worktree-path and --message', () => {
    const result = parseArgs([
      'node', 'script.js',
      '--worktree-path', '/some/path',
      '--message', 'my commit'
    ]);
    assert.equal(result.worktreePath, '/some/path');
    assert.equal(result.message, 'my commit');
  });

  test('returns null for both when no args are given', () => {
    const result = parseArgs(['node', 'script.js']);
    assert.equal(result.worktreePath, null);
    assert.equal(result.message, null);
  });

  test('returns null for --message when only --worktree-path is present', () => {
    const result = parseArgs(['node', 'script.js', '--worktree-path', '/some/path']);
    assert.equal(result.worktreePath, '/some/path');
    assert.equal(result.message, null);
  });

  test('returns null for --worktree-path when only --message is present', () => {
    const result = parseArgs(['node', 'script.js', '--message', 'my commit']);
    assert.equal(result.worktreePath, null);
    assert.equal(result.message, 'my commit');
  });

  test('ignores unknown flags', () => {
    const result = parseArgs([
      'node', 'script.js',
      '--unknown', 'value',
      '--worktree-path', '/p',
      '--message', 'msg'
    ]);
    assert.equal(result.worktreePath, '/p');
    assert.equal(result.message, 'msg');
  });
});

// ── gitCommit: full success ───────────────────────────────────────────────────

describe('gitCommit — full success', () => {
  test('returns committed=true, pushed=true with commit hash on full success', () => {
    const exec = makeExec([
      '',           // git add -A
      '',           // git commit -m
      'abc1234\n',  // git rev-parse --short HEAD
      '',           // git push
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, true);
    assert.equal(result.pushed, true);
    assert.equal(result.commitHash, 'abc1234');
    assert.equal(result.error, null);
    assert.equal(result.errorType, null);
    assert.equal(result.exitCode, 0);
  });

  test('trims whitespace from commit hash', () => {
    const exec = makeExec(['', '', '  def5678  \n', '']);
    const result = gitCommit({ worktreePath: '/repo', message: 'chore: trim', exec });
    assert.equal(result.commitHash, 'def5678');
  });

  test('full success result has all expected fields', () => {
    const exec = makeExec(['', '', 'abc1234\n', '']);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.ok('committed' in result, 'missing committed');
    assert.ok('pushed' in result, 'missing pushed');
    assert.ok('commitHash' in result, 'missing commitHash');
    assert.ok('upstreamConfigured' in result, 'missing upstreamConfigured');
    assert.ok('error' in result, 'missing error');
    assert.ok('errorType' in result, 'missing errorType');
    assert.ok('exitCode' in result, 'missing exitCode');
  });

  test('upstreamConfigured is false on normal push success', () => {
    const exec = makeExec(['', '', 'abc1234\n', '']);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.equal(result.upstreamConfigured, false);
  });
});

// ── gitCommit: upstream fallback ──────────────────────────────────────────────

describe('gitCommit — upstream fallback', () => {
  test('retries with --set-upstream when push fails with "has no upstream branch"', () => {
    const exec = makeExec([
      '',                   // git add -A
      '',                   // git commit -m
      'abc1234\n',          // git rev-parse --short HEAD
      gitError('fatal: The current branch main has no upstream branch'),  // git push fails
      'main\n',             // git rev-parse --abbrev-ref HEAD
      '',                   // git push --set-upstream origin main
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, true);
    assert.equal(result.pushed, true);
    assert.equal(result.commitHash, 'abc1234');
    assert.equal(result.upstreamConfigured, true);
    assert.equal(result.error, null);
    assert.equal(result.errorType, null);
    assert.equal(result.exitCode, 0);
  });

  test('retries with --set-upstream when push fails with "no upstream branch" variant', () => {
    const exec = makeExec([
      '',
      '',
      'abc1234\n',
      gitError('error: no upstream branch configured'),
      'main\n',
      '',
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.pushed, true);
    assert.equal(result.exitCode, 0);
  });

  test('uses the actual branch name in the --set-upstream retry command', () => {
    const exec = makeCapturingExec([
      '',
      '',
      'abc1234\n',
      gitError('fatal: The current branch feature/my-feature has no upstream branch'),
      'feature/my-feature\n',
      '',
    ]);
    gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    const retryArgs = exec.capturedArgs[5]; // 6th call: push --set-upstream
    assert.deepEqual(retryArgs, ['push', '--set-upstream', 'origin', 'feature/my-feature']);
  });

  test('branch name is trimmed before use in --set-upstream command', () => {
    const exec = makeCapturingExec([
      '',
      '',
      'abc1234\n',
      gitError('fatal: The current branch  topic/whitespace  has no upstream branch'),
      '  topic/whitespace  \n',
      '',
    ]);
    gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    const retryArgs = exec.capturedArgs[5];
    assert.deepEqual(retryArgs, ['push', '--set-upstream', 'origin', 'topic/whitespace']);
  });

  test('returns partial failure when --set-upstream retry also fails', () => {
    const exec = makeExec([
      '',
      '',
      'abc1234\n',
      gitError('fatal: The current branch main has no upstream branch'),
      'main\n',
      gitError('fatal: unable to access remote'),  // retry also fails
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, true);
    assert.equal(result.pushed, false);
    assert.equal(result.commitHash, 'abc1234');
    assert.equal(result.upstreamConfigured, false);
    assert.equal(result.errorType, 'push_failed');
    assert.equal(result.exitCode, 1);
    assert.ok(result.error.includes('unable to access remote'));
  });

  test('commit hash is preserved after upstream fallback failure', () => {
    const exec = makeExec([
      '',
      '',
      'deadbeef\n',
      gitError('fatal: The current branch main has no upstream branch'),
      'main\n',
      gitError('fatal: remote error'),
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'fix: thing', exec });
    assert.equal(result.commitHash, 'deadbeef');
    assert.equal(result.committed, true);
    assert.equal(result.pushed, false);
  });

  test('retry error prefers stderr over message', () => {
    const retryErr = new Error('generic message');
    retryErr.stderr = 'specific stderr content';
    const exec = makeExec([
      '',
      '',
      'abc1234\n',
      gitError('fatal: The current branch main has no upstream branch'),
      'main\n',
      retryErr,
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.ok(result.error.includes('specific stderr content'));
  });
});

// ── gitCommit: push failure (non-upstream) ────────────────────────────────────

describe('gitCommit — push failure (non-upstream)', () => {
  test('returns partial failure for network-level push errors', () => {
    const exec = makeExec([
      '',
      '',
      'abc1234\n',
      gitError("fatal: unable to access 'https://github.com/org/repo.git/': Could not resolve host"),
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, true);
    assert.equal(result.pushed, false);
    assert.equal(result.commitHash, 'abc1234');
    assert.equal(result.errorType, 'push_failed');
    assert.equal(result.exitCode, 1);
    assert.ok(result.error.includes('unable to access'));
  });

  test('returns partial failure for "repository not found" error', () => {
    const exec = makeExec([
      '',
      '',
      'abc1234\n',
      gitError('fatal: repository not found'),
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'fix: something', exec });
    assert.equal(result.errorType, 'push_failed');
    assert.equal(result.commitHash, 'abc1234');
    assert.equal(result.exitCode, 1);
  });

  test('returns partial failure for authentication error', () => {
    const exec = makeExec([
      '',
      '',
      'abc1234\n',
      gitError('fatal: Authentication failed for https://github.com/org/repo.git/'),
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, true);
    assert.equal(result.pushed, false);
    assert.equal(result.errorType, 'push_failed');
    assert.equal(result.exitCode, 1);
  });

  test('commit hash is preserved on non-upstream push failure', () => {
    const exec = makeExec([
      '',
      '',
      'deadbeef\n',
      gitError('fatal: repository not found'),
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'fix: something', exec });
    assert.equal(result.commitHash, 'deadbeef');
    assert.equal(result.committed, true);
    assert.equal(result.pushed, false);
  });

  test('push error uses stderr over error message when available', () => {
    const pushErr = new Error('generic message');
    pushErr.stderr = 'fatal: specific stderr';
    const exec = makeExec(['', '', 'abc1234\n', pushErr]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.ok(result.error.includes('specific stderr'));
  });

  test('push error falls back to error message when no stderr', () => {
    const pushErr = new Error('error via message only');
    const exec = makeExec(['', '', 'abc1234\n', pushErr]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.ok(result.error.includes('error via message only'));
  });

  test('partial failure result has all expected fields', () => {
    const exec = makeExec(['', '', 'abc1234\n', gitError('fatal: remote error', 'push failed')]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.ok('committed' in result, 'missing committed');
    assert.ok('pushed' in result, 'missing pushed');
    assert.ok('commitHash' in result, 'missing commitHash');
    assert.ok('upstreamConfigured' in result, 'missing upstreamConfigured');
    assert.ok('error' in result, 'missing error');
    assert.ok('errorType' in result, 'missing errorType');
    assert.ok('exitCode' in result, 'missing exitCode');
  });

  test('upstreamConfigured is false on non-upstream push failure', () => {
    const exec = makeExec(['', '', 'abc1234\n', gitError('fatal: repository not found')]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.equal(result.upstreamConfigured, false);
  });
});

// ── gitCommit: commit failure ─────────────────────────────────────────────────

describe('gitCommit — commit failure', () => {
  test('returns full failure when git commit fails with a real error', () => {
    const commitErr = gitError('error: gpg failed to sign the data');
    const exec = makeExec([
      '',          // git add -A succeeds
      commitErr,   // git commit fails
    ]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, false);
    assert.equal(result.pushed, false);
    assert.equal(result.commitHash, null);
    assert.equal(result.errorType, 'commit_failed');
    assert.equal(result.exitCode, 2);
    assert.ok(result.error.includes('gpg failed'));
  });

  test('returns full failure when git add fails', () => {
    const addErr = gitError('error: pathspec did not match any file(s)');
    const exec = makeExec([addErr]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.committed, false);
    assert.equal(result.pushed, false);
    assert.equal(result.commitHash, null);
    assert.equal(result.errorType, 'commit_failed');
    assert.equal(result.exitCode, 2);
  });

  test('detects nothing_to_commit from stderr', () => {
    const err = new Error('process exit');
    err.stderr = 'On branch main\nnothing to commit, working tree clean';
    const exec = makeExec(['', err]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.errorType, 'nothing_to_commit');
    assert.equal(result.error, 'nothing to commit');
    assert.equal(result.exitCode, 2);
  });

  test('detects nothing_to_commit from stdout field', () => {
    const err = new Error('process exit');
    err.stdout = 'On branch main\nnothing to commit, working tree clean';
    err.stderr = '';
    const exec = makeExec(['', err]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.errorType, 'nothing_to_commit');
    assert.equal(result.error, 'nothing to commit');
  });

  test('detects nothing_to_commit from error message field', () => {
    const err = new Error('nothing to commit');
    err.stderr = '';
    err.stdout = '';
    const exec = makeExec(['', err]);
    const result = gitCommit({ worktreePath: '/repo', message: 'feat: test', exec });
    assert.equal(result.errorType, 'nothing_to_commit');
    assert.equal(result.error, 'nothing to commit');
  });

  test('full failure result has all expected fields', () => {
    const exec = makeExec([gitError('error: failed', 'git add failed')]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.ok('committed' in result, 'missing committed');
    assert.ok('pushed' in result, 'missing pushed');
    assert.ok('commitHash' in result, 'missing commitHash');
    assert.ok('upstreamConfigured' in result, 'missing upstreamConfigured');
    assert.ok('error' in result, 'missing error');
    assert.ok('errorType' in result, 'missing errorType');
    assert.ok('exitCode' in result, 'missing exitCode');
  });

  test('upstreamConfigured is false on commit failure', () => {
    const exec = makeExec([gitError('error: gpg failed')]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.equal(result.upstreamConfigured, false);
  });

  test('commit error uses stderr before stdout and message', () => {
    const err = new Error('generic message');
    err.stderr = 'stderr content';
    err.stdout = 'stdout content';
    const exec = makeExec([err]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.ok(result.error.includes('stderr content'));
  });

  test('commit error falls back to stdout when stderr is empty', () => {
    const err = new Error('generic message');
    err.stderr = '';
    err.stdout = 'stdout content';
    const exec = makeExec([err]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.ok(result.error.includes('stdout content'));
  });

  test('commit error falls back to message when both stderr and stdout are empty', () => {
    const err = new Error('only message content');
    err.stderr = '';
    err.stdout = '';
    const exec = makeExec([err]);
    const result = gitCommit({ worktreePath: '/repo', message: 'test', exec });
    assert.ok(result.error.includes('only message content'));
  });
});

// ── gitCommit: exit code contract ─────────────────────────────────────────────

describe('gitCommit — exit code contract', () => {
  test('exit code 0 on full success', () => {
    const exec = makeExec(['', '', 'abc1234\n', '']);
    assert.equal(gitCommit({ worktreePath: '/repo', message: 'test', exec }).exitCode, 0);
  });

  test('exit code 1 on push failure', () => {
    const exec = makeExec(['', '', 'abc1234\n', gitError('fatal: remote error')]);
    assert.equal(gitCommit({ worktreePath: '/repo', message: 'test', exec }).exitCode, 1);
  });

  test('exit code 2 on commit failure', () => {
    const exec = makeExec([gitError('error: gpg failed')]);
    assert.equal(gitCommit({ worktreePath: '/repo', message: 'test', exec }).exitCode, 2);
  });

  test('exit code 2 on nothing_to_commit', () => {
    const err = new Error('nothing to commit');
    err.stderr = '';
    err.stdout = '';
    const exec = makeExec(['', err]);
    assert.equal(gitCommit({ worktreePath: '/repo', message: 'test', exec }).exitCode, 2);
  });

  test('exit code 0 when upstream fallback succeeds', () => {
    const exec = makeExec([
      '', '', 'abc1234\n',
      gitError('fatal: The current branch main has no upstream branch'),
      'main\n', '',
    ]);
    assert.equal(gitCommit({ worktreePath: '/repo', message: 'test', exec }).exitCode, 0);
  });

  test('exit code 1 when upstream fallback retry also fails', () => {
    const exec = makeExec([
      '', '', 'abc1234\n',
      gitError('fatal: The current branch main has no upstream branch'),
      'main\n',
      gitError('fatal: unable to access remote'),
    ]);
    assert.equal(gitCommit({ worktreePath: '/repo', message: 'test', exec }).exitCode, 1);
  });
});
