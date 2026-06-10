/**
 * v6 source-control state shape builder (FR-11, NFR-1, NFR-3, AD-2, AD-3).
 *
 * Produces the v6 `repos[]` + `worktree_name` shape with top-level
 * `auto_commit` / `auto_pr` / `worktree_name`, no stored `repos[].path`,
 * and the derived top-level `worktree_path` + `branch` + `base_branch`
 * compat fields (all from `repos[0]`) that single-repo enrichment readers
 * depend on.
 */

// ── Helpers salvaged from mutations.ts (AD-2) ────────────────────────────────

/**
 * Coerce a raw URL-like value to a trimmed string or null.
 * Omitted or empty values are stored as null — matching the contract in
 * action-event-reference.md.
 */
export function normalizeOptionalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Normalize an auto_commit / auto_pr input value to the canonical
 * `"always" | "never"` form stored on `pipeline.source_control`.
 *
 * Accepts (case-insensitive) `"always"` or `"yes"` → `"always"`, and
 * `"never"` or `"no"` → `"never"`. Any other value throws a descriptive
 * error naming the field and the rejected raw value.
 */
export function normalizeAutoSetting(field: 'auto_commit' | 'auto_pr', raw: unknown): 'always' | 'never' {
  if (typeof raw !== 'string') {
    throw new Error(
      `source-control init: ${field} must be one of "always" | "yes" | "never" | "no", got ${raw === undefined ? 'undefined' : JSON.stringify(raw)}`,
    );
  }
  const v = raw.trim().toLowerCase();
  if (v === 'always' || v === 'yes') return 'always';
  if (v === 'never' || v === 'no') return 'never';
  throw new Error(
    `source-control init: ${field} must be one of "always" | "yes" | "never" | "no", got ${JSON.stringify(raw)}`,
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RepoInput {
  name: string;
  branch: string;
  base_branch: string;
  remote_url: string | null;
  compare_url: string | null;
  pr_url: string | null;
  in_place?: boolean;
}

export interface BuildSourceControlStateOptions {
  worktreeName: string;
  autoCommit: string;
  autoPr: string;
  repos: RepoInput[];
  /** Optional explicit worktree path; used as the compat `worktree_path`. */
  worktreePath?: string;
}

export interface RepoEntry {
  name: string;
  branch: string;
  base_branch: string;
  remote_url: string | null;
  compare_url: string | null;
  pr_url: string | null;
  in_place?: boolean;
}

export interface SourceControlState {
  /** Top-level settings (AD-2) */
  worktree_name: string;
  auto_commit: 'always' | 'never';
  auto_pr: 'always' | 'never';
  /** Per-repo facts — no `path` stored (NFR-1) */
  repos: RepoEntry[];
  /**
   * Compat shim fields (NFR-3, AD-3): mirrors `repos[0]` values so that
   * single-repo commit/PR/planner enrichment readers continue to work.
   */
  worktree_path: string;
  branch: string;
  base_branch: string;
}

// ── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build a v6 source-control state object.
 *
 * - Per-repo facts live inside `repos[]` with no `path` field (NFR-1).
 * - `auto_commit`, `auto_pr`, and `worktree_name` are top-level (AD-2).
 * - The three compat fields `worktree_path`, `branch`, and `base_branch` are
 *   derived from `repos[0]` (or the supplied `worktreePath`) and written
 *   unconditionally so single-repo enrichment keeps resolving (NFR-3, AD-3).
 */
export function buildSourceControlState(opts: BuildSourceControlStateOptions): SourceControlState {
  const { worktreeName, autoCommit, autoPr, repos, worktreePath } = opts;

  const auto_commit = normalizeAutoSetting('auto_commit', autoCommit);
  const auto_pr = normalizeAutoSetting('auto_pr', autoPr);

  const repoEntries: RepoEntry[] = repos.map((r) => ({
    name: r.name,
    branch: r.branch,
    base_branch: r.base_branch,
    remote_url: normalizeOptionalUrl(r.remote_url),
    compare_url: normalizeOptionalUrl(r.compare_url),
    pr_url: normalizeOptionalUrl(r.pr_url),
    ...(r.in_place ? { in_place: true } : {}),
  }));

  const first = repoEntries[0];

  return {
    worktree_name: worktreeName,
    auto_commit,
    auto_pr,
    repos: repoEntries,
    // Compat shim: mirrors repos[0] so single-repo readers keep resolving
    worktree_path: worktreePath ?? '',
    branch: first?.branch ?? '',
    base_branch: first?.base_branch ?? '',
  };
}
