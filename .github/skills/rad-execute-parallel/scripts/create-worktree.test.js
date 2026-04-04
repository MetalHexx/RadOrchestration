'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, classifyError, deriveRemoteUrl } = require('./create-worktree');

// ─── parseArgs ──────────────────────────────────────────────────────────────

describe('parseArgs', () => {

  it('parses all four flags', () => {
    const result = parseArgs(['node', 'script.js',
      '--repo-root', '/repo',
      '--branch', 'feat/PROJ',
      '--worktree-path', '/wt/PROJ',
      '--base-branch', 'main',
    ]);
    assert.equal(result.repoRoot, '/repo');
    assert.equal(result.branch, 'feat/PROJ');
    assert.equal(result.worktreePath, '/wt/PROJ');
    assert.equal(result.baseBranch, 'main');
  });

  it('returns nulls when no flags provided', () => {
    const result = parseArgs(['node', 'script.js']);
    assert.equal(result.repoRoot, null);
    assert.equal(result.branch, null);
    assert.equal(result.worktreePath, null);
    assert.equal(result.baseBranch, null);
  });

  it('handles flags in any order', () => {
    const result = parseArgs(['node', 'script.js',
      '--base-branch', 'develop',
      '--worktree-path', '/w',
      '--repo-root', '/r',
      '--branch', 'b',
    ]);
    assert.equal(result.baseBranch, 'develop');
    assert.equal(result.worktreePath, '/w');
    assert.equal(result.repoRoot, '/r');
    assert.equal(result.branch, 'b');
  });

  it('ignores unknown flags', () => {
    const result = parseArgs(['node', 'script.js', '--foo', 'bar', '--branch', 'x']);
    assert.equal(result.branch, 'x');
    assert.equal(result.repoRoot, null);
  });
});

// ─── classifyError ──────────────────────────────────────────────────────────

describe('classifyError', () => {

  it('detects already_exists_branch', () => {
    assert.equal(
      classifyError("fatal: a branch named 'feat/X' already exists"),
      'already_exists_branch'
    );
  });

  it('detects already_exists_path', () => {
    assert.equal(
      classifyError("fatal: '/wt/X' already exists"),
      'already_exists_path'
    );
  });

  it('detects invalid_reference from "invalid reference"', () => {
    assert.equal(
      classifyError("fatal: invalid reference: origin/nonexistent"),
      'invalid_reference'
    );
  });

  it('detects invalid_reference from "not a valid"', () => {
    assert.equal(
      classifyError("fatal: 'xyz' is not a valid commit"),
      'invalid_reference'
    );
  });

  it('returns unknown for unrecognized errors', () => {
    assert.equal(classifyError('something else went wrong'), 'unknown');
  });

  it('returns unknown for empty string', () => {
    assert.equal(classifyError(''), 'unknown');
  });

  it('returns unknown for null/undefined', () => {
    assert.equal(classifyError(null), 'unknown');
    assert.equal(classifyError(undefined), 'unknown');
  });
});

// ─── deriveRemoteUrl ────────────────────────────────────────────────────────

describe('deriveRemoteUrl', () => {

  it('converts SSH URL to HTTPS', () => {
    assert.equal(
      deriveRemoteUrl('git@github.com:owner/repo.git'),
      'https://github.com/owner/repo'
    );
  });

  it('converts SSH URL without .git suffix', () => {
    assert.equal(
      deriveRemoteUrl('git@github.com:owner/repo'),
      'https://github.com/owner/repo'
    );
  });

  it('strips .git from HTTPS URL', () => {
    assert.equal(
      deriveRemoteUrl('https://github.com/owner/repo.git'),
      'https://github.com/owner/repo'
    );
  });

  it('returns HTTPS URL unchanged when no .git suffix', () => {
    assert.equal(
      deriveRemoteUrl('https://github.com/owner/repo'),
      'https://github.com/owner/repo'
    );
  });

  it('returns empty string for unrecognized formats', () => {
    assert.equal(deriveRemoteUrl('file:///local/repo'), '');
  });

  it('returns empty string for empty input', () => {
    assert.equal(deriveRemoteUrl(''), '');
  });

  it('returns empty string for null/undefined', () => {
    assert.equal(deriveRemoteUrl(null), '');
    assert.equal(deriveRemoteUrl(undefined), '');
  });

  it('handles org/repo with dots in name', () => {
    assert.equal(
      deriveRemoteUrl('git@github.com:my-org/my.repo.name.git'),
      'https://github.com/my-org/my.repo.name'
    );
  });
});
