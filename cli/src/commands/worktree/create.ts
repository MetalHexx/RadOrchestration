import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import { readRegistry, resolveRepoPath } from '@rad-orchestration/repo-registry';
import { userDataPaths } from '../../lib/paths.js';
import { readProjectReposDefault } from '../../lib/project-repos.js';

export type WorktreeCreateErrorType =
  | 'already_exists_path' | 'already_exists_branch' | 'invalid_reference' | 'missing_args' | 'unknown' | null;

export interface WorktreeCreateResult {
  created: boolean;
  worktreePath: string | null;
  branch: string | null;
  baseBranch: string | null;
  pushed: boolean;
  remoteUrl: string;
  compareUrl: string;
  error: string | null;
  errorType: WorktreeCreateErrorType;
}

type Exec = (file: string, args: string[], opts: { cwd: string; encoding: 'utf8' }) => string;

export interface WorktreeCreateOptions {
  repoRoot: string; branch: string; worktreePath: string; baseBranch: string; exec?: Exec;
}

function deriveRemoteUrl(raw: string): string {
  if (!raw) return '';
  const ssh = raw.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}`;
  if (raw.startsWith('https://')) return raw.replace(/\.git$/, '');
  return '';
}

function classify(stderr: string): WorktreeCreateErrorType {
  const m = (stderr || '').toLowerCase();
  if (m.includes('already exists') && m.includes('branch')) return 'already_exists_branch';
  if (m.includes('already exists')) return 'already_exists_path';
  if (m.includes('invalid reference') || m.includes('not a valid')) return 'invalid_reference';
  return 'unknown';
}

export function worktreeCreate(opts: WorktreeCreateOptions): WorktreeCreateResult {
  const exec = opts.exec ?? ((f, a, o) => execFileSync(f, a, { ...o, stdio: ['ignore', 'pipe', 'pipe'] }) as unknown as string);
  try {
    exec('git', ['worktree', 'add', '-b', opts.branch, opts.worktreePath, opts.baseBranch],
      { cwd: opts.repoRoot, encoding: 'utf8' });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    const stderr = (err.stderr || err.message || '').trim();
    return {
      created: false, worktreePath: opts.worktreePath, branch: opts.branch, baseBranch: opts.baseBranch,
      pushed: false, remoteUrl: '', compareUrl: '', error: stderr, errorType: classify(stderr),
    };
  }

  let pushed = false;
  try {
    exec('git', ['push', '-u', 'origin', opts.branch], { cwd: opts.worktreePath, encoding: 'utf8' });
    pushed = true;
  } catch { /* non-blocking */ }

  let raw = '';
  try { raw = String(exec('git', ['remote', 'get-url', 'origin'], { cwd: opts.worktreePath, encoding: 'utf8' })).trim(); }
  catch { /* none */ }
  const remoteUrl = deriveRemoteUrl(raw);
  const baseShort = opts.baseBranch.replace(/^origin\//, '');
  const compareUrl = remoteUrl ? `${remoteUrl}/compare/${baseShort}...${opts.branch}` : '';

  return {
    created: true, worktreePath: path.resolve(opts.worktreePath), branch: opts.branch, baseBranch: opts.baseBranch,
    pushed, remoteUrl, compareUrl, error: null, errorType: null,
  };
}

// ── provisionWorktrees ─────────────────────────────────────────────────────────

export interface ProvisionRepoResult {
  name: string;
  created: boolean;
  pushed: boolean;
  path: string | null;
  branch: string | null;
  error: string | null;
  errorType: WorktreeCreateErrorType;
}

export function aggregateExitCode(repos: ReadonlyArray<{ created: boolean; pushed: boolean; error?: string | null }>): 0 | 1 | 2 {
  if (repos.some(r => r.error != null)) return 2;
  if (repos.some(r => r.created === true && r.pushed === false)) return 1;
  return 0;
}

export interface ProvisionWorktreesResult {
  repos: ProvisionRepoResult[];
}

export interface ProvisionWorktreesDeps {
  worktreesDir: string;
  readProjectRepos: (project: string) => { repos: string[]; projectType: 'standard' | 'side-project' };
  resolveClonePath: (repo: string) => string;
  defaultBranch: (repo: string) => string;
  exists: (p: string) => boolean;
  create: (opts: WorktreeCreateOptions) => WorktreeCreateResult;
}

export interface ProvisionWorktreesOptions extends ProvisionWorktreesDeps {
  project: string;
  worktreeName?: string;
  /** Optional repo scope — when provided, only this repo is provisioned. */
  repo?: string;
}

// Wraps the shared master-plan reader with a worktree-create-specific guard:
// provisioning worktrees is a standard-project operation, so reject
// side-projects here (remove/init paths legitimately accept side-projects).
function readStandardProjectReposDefault(project: string): { repos: string[]; projectType: 'standard' | 'side-project' } {
  const result = readProjectReposDefault(project);
  if (result.projectType === 'side-project') {
    throw new UserError(
      `Project "${project}" is a side-project. Use \`side-project init\` to set it up.`,
    );
  }
  return result;
}

function resolveClonePathDefault(repo: string): string {
  const reg = readRegistry({ root: userDataPaths().root });
  const resolved = resolveRepoPath(reg, repo);
  if (!resolved.path) {
    throw new UserError(`Repo "${repo}" is not bound. ${resolved.hint ?? 'Run `radorch repo bind`.'}`);
  }
  return resolved.path;
}

function defaultBranchDefault(_repo: string): string {
  return 'main';
}

export function provisionWorktrees(opts: ProvisionWorktreesOptions): ProvisionWorktreesResult {
  const { project, worktreesDir, readProjectRepos, resolveClonePath, defaultBranch, exists, create } = opts;
  const worktreeName = opts.worktreeName ?? project;

  const { repos: allRepos } = readProjectRepos(project);
  // Fail fast on an unknown --repo: a scope outside the project set would
  // otherwise produce an empty target list and silently exit 0.
  if (opts.repo !== undefined && !allRepos.includes(opts.repo)) {
    throw new UserError(
      `Repo "${opts.repo}" is not in project "${project}" repo set: ${allRepos.join(', ')}`,
    );
  }
  const targetRepos = opts.repo ? allRepos.filter(r => r === opts.repo) : allRepos;

  // Branch is derived once per project (AD-4) — create() receives the same branch name for all repos.
  const branch = `radorch/${worktreeName}`;

  const results: ProvisionRepoResult[] = [];
  for (const repo of targetRepos) {
    const worktreePath = path.join(worktreesDir, worktreeName, repo);
    try {
      if (exists(worktreePath)) {
        results.push({ name: repo, created: false, pushed: true, path: worktreePath, branch, error: null, errorType: null });
        continue;
      }
      const r = create({
        repoRoot: resolveClonePath(repo),
        branch,
        worktreePath,
        baseBranch: defaultBranch(repo),
      });
      results.push({
        name: repo,
        created: r.created,
        pushed: r.pushed,
        path: r.worktreePath,
        branch: r.branch,
        error: r.error,
        errorType: r.errorType,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name: repo, created: false, pushed: false, path: worktreePath, branch, error: msg, errorType: 'unknown' });
    }
  }

  return { repos: results };
}

// ── Command ───────────────────────────────────────────────────────────────────

interface Args { project?: string; 'worktree-name'?: string; repo?: string }

export const worktreeCreateCommand = defineCommand({
  name: 'worktree-create',
  description: 'Provision worktrees for every repo in a project from the master-plan registry',
  args: {
    project: { description: 'Project name; selects the master plan whose repos: list is provisioned', required: true },
    'worktree-name': { description: 'Override the worktree folder name (defaults to the project name)' },
    repo: { description: 'Scope provisioning to a single repo within the project set' },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    if (!args.project) throw new UserError('--project is required');
    return provisionWorktrees({
      project: args.project,
      worktreeName: args['worktree-name'],
      repo: args.repo,
      worktreesDir: userDataPaths().worktrees,
      readProjectRepos: readStandardProjectReposDefault,
      resolveClonePath: resolveClonePathDefault,
      defaultBranch: defaultBranchDefault,
      exists: (p) => fs.existsSync(p),
      create: worktreeCreate,
    });
  },
  mapResult: (r: ProvisionWorktreesResult) => {
    return { ok: true, data: r, exit_code: aggregateExitCode(r.repos) };
  },
});
