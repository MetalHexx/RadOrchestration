/**
 * Git Fixture Helper (Iter 12)
 *
 * Synthesizes a throwaway git repository with controllable commits for
 * fixture-driven review-mode tests. Each call to `createGitFixture` yields an
 * isolated temp directory with its own git history, independent of the host
 * worktree's branches, tags, or configuration. The returned `cleanup()` removes
 * the temp directory (best-effort on Windows, where locked file handles can
 * temporarily block removal).
 *
 * Design notes
 * ------------
 *  - Uses `execFileSync` (not `execSync`) to avoid shell-escaping pitfalls on
 *    Windows — commit messages and file contents frequently contain
 *    double-quotes, backticks, and newlines.
 *  - Configures a local `user.name` / `user.email` inside the temp repo so git
 *    commit succeeds even when the host has no global identity configured
 *    (e.g., in a minimal CI environment).
 *  - Seeds an initial empty commit so that `git diff <sha>~1..<sha>` works
 *    against the first caller-supplied commit.
 *  - The fixture creator may pass nested subdirectories in file paths; parent
 *    directories are created as needed.
 *
 * Usage
 * -----
 * ```ts
 * import { createGitFixture } from './helpers/git-fixture.js';
 *
 * const fixture = createGitFixture({
 *   commits: [
 *     { message: 'seed', files: { 'src/colors.ts': 'export const colors = ["red"];' } },
 *     { message: 'drift', files: { 'src/colors.ts': 'export const colors = ["red","orange","yellow"];' } },
 *   ],
 * });
 *
 * try {
 *   // fixture.repoPath — absolute path to the temp repo
 *   // fixture.commits[i].sha — resolved SHA after each commit step
 *   // fixture.commits[i].message — the commit message as authored
 * } finally {
 *   fixture.cleanup();
 * }
 * ```
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface GitFixtureCommit {
  /** Commit message. Single line recommended; newlines are preserved. */
  message: string;
  /**
   * Files to write before this commit. Keys are POSIX-style relative paths;
   * values are the new file contents. Existing files are overwritten; new
   * files create any missing parent directories. Pass an empty object for
   * an empty commit (use `allowEmpty` below).
   */
  files: Record<string, string>;
  /**
   * When true, pass `--allow-empty` to git commit. Useful for seeding a
   * known baseline without writing files.
   */
  allowEmpty?: boolean;
}

export interface GitFixtureOptions {
  /** Commits to create in order. Each produces an entry in the returned commits[]. */
  commits: GitFixtureCommit[];
  /**
   * Branch name for the fixture. Defaults to `fixture` (avoids colliding with
   * the host's `main` / `master` conventions).
   */
  branch?: string;
}

export interface GitFixtureCommitResult {
  sha: string;
  message: string;
}

export interface GitFixture {
  /** Absolute path to the temp repo root. */
  repoPath: string;
  /** Resolved SHA + message for each caller-supplied commit, in order. */
  commits: GitFixtureCommitResult[];
  /** Best-effort cleanup of the temp directory. Safe to call multiple times. */
  cleanup: () => void;
}

const FIXTURE_DIR_PREFIX = 'orch-git-fixture-';

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeFixtureFile(repoPath: string, relPath: string, content: string): void {
  const absolute = path.join(repoPath, ...relPath.split(/[\\/]/));
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

export function createGitFixture(options: GitFixtureOptions): GitFixture {
  const repoPath = mkdtempSync(path.join(os.tmpdir(), FIXTURE_DIR_PREFIX));
  const branch = options.branch ?? 'fixture';
  const commits: GitFixtureCommitResult[] = [];

  try {
    // 1. Initialise the repo on the target branch. `git init -b <branch>` is
    //    supported on git 2.28+. Fall back to `git init` + `git checkout -b`
    //    for older hosts.
    try {
      runGit(['init', '-b', branch, '.'], repoPath);
    } catch {
      runGit(['init', '.'], repoPath);
      runGit(['checkout', '-b', branch], repoPath);
    }

    // 2. Isolate this repo's identity from host global config so commits
    //    work even when no global user is set.
    runGit(['config', 'user.name', 'Orch Fixture'], repoPath);
    runGit(['config', 'user.email', 'fixture@orchestration.local'], repoPath);
    // Keep commit graph deterministic: no signing, no rebase surprises.
    runGit(['config', 'commit.gpgsign', 'false'], repoPath);

    // 3. Seed an initial empty commit so that `git diff <sha>~1..<sha>` works
    //    against the first caller-supplied commit (the diff helper requires
    //    every target commit to have at least one parent).
    runGit(['commit', '--allow-empty', '-m', 'fixture-seed'], repoPath);

    // 4. Apply each caller commit in order.
    for (const commitSpec of options.commits) {
      for (const [relPath, content] of Object.entries(commitSpec.files)) {
        writeFixtureFile(repoPath, relPath, content);
      }
      runGit(['add', '-A'], repoPath);
      const commitArgs = ['commit', '-m', commitSpec.message];
      if (commitSpec.allowEmpty) {
        commitArgs.push('--allow-empty');
      }
      runGit(commitArgs, repoPath);
      const sha = runGit(['rev-parse', 'HEAD'], repoPath);
      commits.push({ sha, message: commitSpec.message });
    }
  } catch (err) {
    // If anything goes wrong during setup, clean up before re-throwing so
    // we don't leak a partially-initialized temp dir.
    try {
      rmSync(repoPath, { recursive: true, force: true });
    } catch {
      // swallow cleanup errors on the failure path — the original error is
      // what matters.
    }
    throw err;
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      rmSync(repoPath, { recursive: true, force: true });
    } catch {
      // Best-effort — Windows can retain file handles briefly. The OS will
      // clean up stale tmp dirs eventually, and the test harness does not
      // need this to succeed for correctness.
    }
  };

  return { repoPath, commits, cleanup };
}
