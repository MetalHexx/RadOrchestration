/**
 * source-control init command (FR-6, FR-7, FR-8, FR-9, FR-10, NFR-2, AD-1, AD-11, DD-4).
 *
 * Validates the target project's own `repos:` set against the worktrees on disk,
 * reads each present worktree's branch as the source of truth, fails loud on a
 * missing worktree pointing at `worktree create`, handles side-project and
 * in-place modes, mutates `state.json` directly, and is idempotent.
 */

import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import { buildSourceControlState } from './state-shape.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorktreeFacts {
  exists: boolean;
  branch?: string;
  baseBranch?: string;
  remoteUrl?: string;
  compareUrl?: string;
}

export interface SourceControlInitDeps {
  /** Reads project repos and type from the master plan or registry. */
  readProjectRepos: (project: string) => { repos: string[]; projectType: 'standard' | 'side-project' };
  /** Reads worktree facts (existence, branch, etc.) from disk. */
  readWorktreeFacts: (worktreePath: string) => WorktreeFacts;
  /** Returns the auto_commit setting for the project. */
  autoCommit: (project: string) => 'always' | 'never';
  /** Returns the auto_pr setting for the project. */
  autoPr: (project: string) => 'always' | 'never';
  /** Reads the current pipeline state from disk. */
  readState: (projectDir: string) => { pipeline: Record<string, unknown> };
  /** Writes the mutated pipeline state to disk. */
  writeState: (projectDir: string, state: { pipeline: Record<string, unknown> }) => void;
}

export interface SourceControlInitOptions extends SourceControlInitDeps {
  /** Project name — resolves the master plan + repos: list. */
  project: string;
  /** Worktree name override (defaults to project name). */
  worktreeName?: string;
  /** In-place mode: record a main-clone binding for a single-repo project. */
  inPlace?: boolean;
  /** Worktrees root dir override (defaults to runtime path). */
  worktreesDir?: string;
  /** Project data dir override (defaults to runtime path). */
  projectDir?: string;
}

export type SourceControlInitResult =
  | { ok: true; projectDir: string }
  | { ok: false; error: string };

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Validate & record source-control state for a project.
 *
 * - Standard mode: reads branch from each on-disk worktree (never invents).
 * - Side-project: records fixed binding (branch: 'main', no remote, auto_commit: always, auto_pr: never).
 * - In-place: records a single main-clone binding; rejects multi-repo projects as ambiguous.
 * - Idempotent: re-running re-derives identical state (NFR-2).
 */
export function sourceControlInit(opts: SourceControlInitOptions): SourceControlInitResult {
  const {
    project,
    worktreeName = project,
    inPlace = false,
    worktreesDir = '',
    projectDir = project,
  } = opts;

  const { repos, projectType } = opts.readProjectRepos(project);

  // FR-10: in-place with multi-repo is ambiguous
  if (inPlace && repos.length > 1) {
    return {
      ok: false,
      error: `--in-place is ambiguous for a project with ${repos.length} repos; it only applies to single-repo projects`,
    };
  }

  const autoCommit = opts.autoCommit(project);
  const autoPr = opts.autoPr(project);

  let repoEntries: Array<{
    name: string;
    branch: string;
    base_branch: string;
    remote_url: string | null;
    compare_url: string | null;
    pr_url: string | null;
  }>;

  if (projectType === 'side-project') {
    // FR-9: fixed side-project binding
    repoEntries = repos.map((name) => ({
      name,
      branch: 'main',
      base_branch: 'main',
      remote_url: null,
      compare_url: null,
      pr_url: null,
    }));
  } else if (inPlace) {
    // Single-repo in-place binding — read branch from the current worktree facts
    const repo = repos[0]!;
    const wtPath = worktreesDir ? `${worktreesDir}/${worktreeName}/${repo}` : `${worktreeName}/${repo}`;
    const facts = opts.readWorktreeFacts(wtPath);
    repoEntries = [{
      name: repo,
      branch: facts.branch ?? 'main',
      base_branch: facts.baseBranch ?? 'main',
      remote_url: facts.remoteUrl ?? null,
      compare_url: facts.compareUrl ?? null,
      pr_url: null,
    }];
  } else {
    // Standard mode: FR-7 — read branch from each on-disk worktree
    repoEntries = [];
    for (const repo of repos) {
      const wtPath = worktreesDir
        ? `${worktreesDir}/${worktreeName}/${repo}`
        : `${worktreeName}/${repo}`;
      const facts = opts.readWorktreeFacts(wtPath);

      // FR-8: fail loud naming the repo and pointing at recovery command (DD-4)
      if (!facts.exists) {
        return {
          ok: false,
          error: `Worktree for repo "${repo}" does not exist. Run: radorch worktree create --repo ${repo}`,
        };
      }

      repoEntries.push({
        name: repo,
        branch: facts.branch ?? '',
        base_branch: facts.baseBranch ?? 'main',
        remote_url: facts.remoteUrl ?? null,
        compare_url: facts.compareUrl ?? null,
        pr_url: null,
      });
    }
  }

  // Build v6 source-control state (AD-1)
  const sc = buildSourceControlState({
    worktreeName,
    autoCommit,
    autoPr,
    repos: repoEntries,
  });

  // AD-2: mutate state.json directly, no event round-trip
  const existingState = opts.readState(projectDir);
  const newState = {
    ...existingState,
    pipeline: {
      ...existingState.pipeline,
      source_control: sc,
    },
  };

  opts.writeState(projectDir, newState);

  return { ok: true, projectDir };
}

// ── Command definition ────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { userDataPaths } from '../../lib/paths.js';
import { parseYaml } from '../../lib/yaml.js';
import { readState, writeState as writeStateIO } from '../../lib/pipeline-engine/state-io.js';
import type { PipelineState } from '../../lib/pipeline-engine/types.js';

function readProjectReposDefault(project: string): { repos: string[]; projectType: 'standard' | 'side-project' } {
  const projectDir = path.join(userDataPaths().projects, project);
  let masterPlanPath: string | null = null;
  try {
    const entries = fs.readdirSync(projectDir);
    for (const e of entries) {
      if (e.toUpperCase().startsWith(project.toUpperCase() + '-MASTER-PLAN') && e.endsWith('.md')) {
        masterPlanPath = path.join(projectDir, e);
        break;
      }
    }
    if (!masterPlanPath) {
      for (const e of entries) {
        if (e.toUpperCase().includes('MASTER-PLAN') && e.endsWith('.md')) {
          masterPlanPath = path.join(projectDir, e);
          break;
        }
      }
    }
  } catch { /* ignore */ }

  if (!masterPlanPath) {
    throw new UserError(`No master plan found for project "${project}" in ${projectDir}`);
  }

  const raw = fs.readFileSync(masterPlanPath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new UserError(`Master plan at ${masterPlanPath} has no YAML frontmatter`);
  }
  const fm = parseYaml<Record<string, unknown>>(match[1] ?? '') ?? {};
  const projectType = fm['project-type'] === 'side-project' ? 'side-project' : 'standard';
  const repos = Array.isArray(fm['repos']) ? (fm['repos'] as unknown[]).map(String) : [];
  if (repos.length === 0) {
    throw new UserError(`Master plan for project "${project}" declares no repos.`);
  }
  return { repos, projectType };
}

function readWorktreeFactsDefault(worktreePath: string): WorktreeFacts {
  if (!fs.existsSync(worktreePath)) {
    return { exists: false };
  }
  let branch = '';
  let baseBranch = 'main';
  let remoteUrl: string | null = null;
  let compareUrl: string | null = null;

  const exec = (file: string, args: string[], cwd: string): string => {
    try {
      return String(execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
    } catch {
      return '';
    }
  };

  branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);
  const raw = exec('git', ['remote', 'get-url', 'origin'], worktreePath);
  if (raw) {
    const ssh = raw.match(/^git@github\.com:(.+?)(?:\.git)?$/);
    remoteUrl = ssh ? `https://github.com/${ssh[1]}` : (raw.startsWith('https://') ? raw.replace(/\.git$/, '') : null);
    if (remoteUrl && branch) {
      compareUrl = `${remoteUrl}/compare/${baseBranch}...${branch}`;
    }
  }

  return { exists: true, branch, baseBranch, remoteUrl: remoteUrl ?? undefined, compareUrl: compareUrl ?? undefined };
}

function autoCommitDefault(_project: string): 'always' | 'never' {
  return 'always';
}

function autoPrDefault(_project: string): 'always' | 'never' {
  return 'never';
}

interface Args {
  project?: string;
  'worktree-name'?: string;
}
interface Flags {
  'in-place'?: boolean;
}

export const sourceControlInitCommand = defineCommand({
  name: 'source-control-init',
  description: 'Validate worktrees and record source-control state for a project (idempotent)',
  args: {
    project: { description: 'Project name; selects the master plan whose repos: list is validated', required: true },
    'worktree-name': { description: 'Override the worktree folder name (defaults to the project name)' },
  },
  flags: {
    'in-place': { description: 'Record a single in-place (main clone) binding for a single-repo project' },
  },
  handler: async ({ args, flags }: { args: Args; flags: Flags; ctx: CommandContext }) => {
    if (!args.project) throw new UserError('--project is required');
    const project = args.project;
    const projectDir = path.join(userDataPaths().projects, project);
    const worktreesDir = userDataPaths().worktrees;

    return sourceControlInit({
      project,
      worktreeName: args['worktree-name'],
      inPlace: flags['in-place'] ?? false,
      worktreesDir,
      projectDir,
      readProjectRepos: readProjectReposDefault,
      readWorktreeFacts: readWorktreeFactsDefault,
      autoCommit: autoCommitDefault,
      autoPr: autoPrDefault,
      readState: (dir) => {
        const s = readState(dir);
        if (!s) throw new UserError(`No state.json found at ${dir}`);
        return s as unknown as { pipeline: Record<string, unknown> };
      },
      writeState: (dir, state) => {
        writeStateIO(dir, state as unknown as PipelineState);
      },
    });
  },
  mapResult: (r: SourceControlInitResult) => {
    if (!r.ok) {
      return { ok: false as const, error: { type: 'user_error' as const, message: r.error }, exit_code: 1 };
    }
    return { ok: true as const, data: r, exit_code: 0 };
  },
});
