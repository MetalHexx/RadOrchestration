'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

/**
 * @typedef {Object} GitResult
 * @property {boolean} success
 * @property {string} [output]   - stdout on success
 * @property {string} [error]    - stderr on failure
 * @property {number} [exitCode] - process exit code on failure
 */

/**
 * Create a git worktree with a new branch.
 * @param {string} repoRoot     - absolute path to the main repo
 * @param {string} worktreePath - absolute path for the new worktree directory
 * @param {string} branchName   - new branch name (e.g., "project/my-project")
 * @param {string} startPoint   - branch to start from (e.g., "main")
 * @returns {GitResult}
 */
function createWorktree(repoRoot, worktreePath, branchName, startPoint) {
  try {
    const output = execFileSync('git', ['worktree', 'add', '-b', branchName, worktreePath, startPoint], {
      cwd: repoRoot, encoding: 'utf8',
    });
    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      error: err.stderr || err.message,
      exitCode: err.status || 1,
    };
  }
}

/**
 * Remove a git worktree and optionally delete the local branch.
 * @param {string} repoRoot     - absolute path to the main repo
 * @param {string} worktreePath - absolute path of the worktree to remove
 * @param {string} branchName   - branch name to delete after removal
 * @returns {GitResult}
 */
function removeWorktree(repoRoot, worktreePath, branchName) {
  let worktreeOutput;
  try {
    worktreeOutput = execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: repoRoot, encoding: 'utf8',
    });
  } catch (err) {
    return {
      success: false,
      error: err.stderr || err.message,
      exitCode: err.status || 1,
    };
  }

  // Attempt branch delete; if it fails, still return success
  try {
    execFileSync('git', ['branch', '-d', branchName], { cwd: repoRoot, encoding: 'utf8' });
  } catch (_err) {
    // Branch may already be merged/deleted — not a hard failure
  }

  return { success: true, output: worktreeOutput };
}

/**
 * Detect the repository's default branch name (main, master, etc.).
 * @param {string} repoRoot - absolute path to the repo
 * @returns {string} branch name
 */
function getDefaultBranch(repoRoot) {
  // Try remote HEAD first
  try {
    const output = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
      cwd: repoRoot, encoding: 'utf8',
    });
    const trimmed = output.trim();
    const prefix = 'refs/remotes/origin/';
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  } catch (_err) {
    // Fall through to local checks
  }

  // Check for local main or master
  for (const candidate of ['main', 'master']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', 'refs/heads/' + candidate], {
        cwd: repoRoot, encoding: 'utf8',
      });
      return candidate;
    } catch (_err) {
      // Try next candidate
    }
  }

  return 'main';
}

/**
 * Get the currently checked-out branch name.
 * @param {string} repoRoot - absolute path to the repo
 * @returns {string} branch name
 */
function getCurrentBranch(repoRoot) {
  try {
    const output = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoRoot, encoding: 'utf8',
    });
    return output.trim();
  } catch (_err) {
    return 'HEAD';
  }
}

/**
 * Check whether the working tree has uncommitted changes.
 * @param {string} workingDir - absolute path to the working directory
 * @returns {boolean} true if uncommitted changes exist
 */
function hasUncommittedChanges(workingDir) {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: workingDir, encoding: 'utf8',
    });
    return output.trim().length > 0;
  } catch (_err) {
    return false;
  }
}

/**
 * Make a git-safe branch name from prefix and project name.
 * @param {string} prefix      - e.g., "project/"
 * @param {string} projectName - e.g., "MY-PROJECT"
 * @returns {string} e.g., "project/my-project"
 */
function formatBranchName(prefix, projectName) {
  const sanitized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9\-/.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return prefix + sanitized;
}

module.exports = {
  createWorktree,
  removeWorktree,
  getDefaultBranch,
  getCurrentBranch,
  hasUncommittedChanges,
  formatBranchName,
};
