import path from 'node:path';

/** One repo's planned worktree placement under the project's worktree dir. */
export interface WorktreeConventionRepo {
  /** Repo name (registry key). */
  repo: string;
  /** Base branch the worktree is cut from (the repo's default branch). */
  base: string;
  /** Absolute worktree path: `<worktreesDir>/<worktreeName>/<repo>`. */
  worktreePath: string;
}

/** The planned worktree layout for a project, before anything is provisioned. */
export interface WorktreeConvention {
  /** Shared branch for every repo in the project: `radorch/<worktreeName>`. */
  branch: string;
  /** Parent directory an agent launches into: `<worktreesDir>/<worktreeName>`. */
  launchDir: string;
  repos: WorktreeConventionRepo[];
}

export interface DeriveWorktreeConventionOptions {
  /** Worktree folder name — the project name, or an explicit worktree-name override. */
  worktreeName: string;
  /** Repos to place (already scoped to the target set). */
  repos: string[];
  /** Worktrees root (e.g. `~/.radorc/worktrees`). */
  worktreesDir: string;
  /** Resolves a repo's base/default branch (injected; registry-backed at the call site). */
  defaultBranch: (repo: string) => string;
}

/**
 * Single source of truth for the *planned* worktree convention.
 *
 * Pure and injectable: `defaultBranch` is passed in rather than read from the
 * registry here, so the math is unit-testable and free of I/O. Consumed by both
 * `execute resolve` (pre-state, launch path — there is no `state.json` yet) and
 * `provisionWorktrees` (`worktree create`), keeping branch/path derivation in
 * exactly one place. Deliberately a CLI lib helper, not a work-graph method:
 * the work-graph's `resolveWorktrees` derives from an existing `state.json` and
 * cannot serve this pre-provision case.
 */
export function deriveWorktreeConvention(opts: DeriveWorktreeConventionOptions): WorktreeConvention {
  const { worktreeName, repos, worktreesDir, defaultBranch } = opts;
  return {
    branch: `radorch/${worktreeName}`,
    launchDir: path.join(worktreesDir, worktreeName),
    repos: repos.map((repo) => ({
      repo,
      base: defaultBranch(repo),
      worktreePath: path.join(worktreesDir, worktreeName, repo),
    })),
  };
}
