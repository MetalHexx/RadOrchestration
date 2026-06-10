import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import { readRegistry, resolveRepoPath } from '@rad-orchestration/repo-registry';
import { userDataPaths } from '../../lib/paths.js';
import { parseYaml } from '../../lib/yaml.js';

type Exec = (file: string, args: string[], opts: { cwd: string; encoding: 'utf8' }) => string;

export interface RemoveRepoResult {
  name: string;
  removed: boolean;
  error?: string;
}

export interface RemoveWorktreesResult {
  worktree_name: string;
  repos: RemoveRepoResult[];
  warnings: string[];
}

export interface RemoveWorktreesDeps {
  worktreesDir: string;
  readProjectRepos: (project: string) => { repos: string[]; projectType: 'standard' | 'side-project' };
  worktreeName: (project: string) => string;
  resolveClonePath: (repo: string) => string;
  /** Returns names of other projects that share the same worktree_name */
  dependents: (worktreeName: string, project: string) => string[];
  exec?: Exec;
}

export interface RemoveWorktreesOptions extends RemoveWorktreesDeps {
  project: string;
  /** Optional repo scope — when provided, only this repo is removed */
  repo?: string;
}

export function removeWorktrees(opts: RemoveWorktreesOptions): RemoveWorktreesResult {
  const exec = opts.exec ?? ((f, a, o) => execFileSync(f, a, { ...o, stdio: ['ignore', 'pipe', 'pipe'] }) as unknown as string);

  const { project, worktreesDir, readProjectRepos, worktreeName, resolveClonePath, dependents } = opts;

  const wtName = worktreeName(project);
  const { repos: allRepos } = readProjectRepos(project);
  const targetRepos = opts.repo ? allRepos.filter((r) => r === opts.repo) : allRepos;

  // AD-10: surface shared worktree_name risk as warnings before removal
  const warnings: string[] = [];
  const sharedWith = dependents(wtName, project);
  for (const dep of sharedWith) {
    warnings.push(`worktree_name "${wtName}" is also used by project "${dep}" — removing may affect it`);
  }

  const results: RemoveRepoResult[] = [];
  for (const repo of targetRepos) {
    const worktreePath = path.join(worktreesDir, wtName, repo);
    const clonePath = resolveClonePath(repo);
    try {
      exec('git', ['worktree', 'remove', '--force', worktreePath], { cwd: clonePath, encoding: 'utf8' });
      results.push({ name: repo, removed: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name: repo, removed: false, error: msg });
    }
  }

  return { worktree_name: wtName, repos: results, warnings };
}

// ── Default implementations ───────────────────────────────────────────────────

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

// ── Command ───────────────────────────────────────────────────────────────────

interface Args { project?: string; repo?: string }

export const worktreeRemoveCommand = defineCommand({
  name: 'worktree-remove',
  description: 'Remove worktrees for every repo in a project (or a single repo with --repo)',
  args: {
    project: { description: 'Project name whose worktrees should be removed', required: true },
    repo: { description: 'Scope removal to a single repo within the project set' },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    if (!args.project) throw new UserError('--project is required');

    return removeWorktrees({
      project: args.project,
      repo: args.repo,
      worktreesDir: userDataPaths().worktrees,
      readProjectRepos: readProjectReposDefault,
      worktreeName: (p) => p,
      resolveClonePath: (repo) => {
        const reg = readRegistry({ root: userDataPaths().root });
        const resolved = resolveRepoPath(reg, repo);
        if (!resolved.path) {
          throw new UserError(`Repo "${repo}" is not bound. ${resolved.hint ?? 'Run \`radorch repo bind\`.'}`);
        }
        return resolved.path;
      },
      dependents: () => [],
    });
  },
  mapResult: (r: RemoveWorktreesResult) => {
    const hasError = r.repos.some((rr) => rr.error != null);
    return { ok: true, data: r, exit_code: hasError ? 1 : 0 };
  },
});
