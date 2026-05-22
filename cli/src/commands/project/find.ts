import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';

export interface ProjectSummary {
  name: string;
  masterPlanPath: string | null;
  currentTier: string | null;
  existingWorktreePath: string | null;
  existingBranch: string | null;
  worktreeExists: boolean;
}

export interface ProjectFindResult { projects: ProjectSummary[] }

type Exec = (file: string, args: string[], opts?: { cwd?: string; encoding: 'utf8' }) => string;

export interface ProjectFindOptions {
  projectsBasePath: string;
  repoRoot: string;
  projectName?: string;
  exec?: Exec;
}

function readState(projectDir: string): Record<string, unknown> | null {
  const statePath = path.join(projectDir, 'state.json');
  if (!fs.existsSync(statePath)) return null;
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')) as Record<string, unknown>; }
  catch { return null; }
}

function masterPlanPath(state: Record<string, unknown>): string | null {
  const planning = state['planning'] as { steps?: Array<{ name?: string; id?: string; doc_path?: string }> } | undefined;
  const step = planning?.steps?.find((s) => s.name === 'master_plan' || s.id === 'master_plan');
  return step?.doc_path ?? null;
}

function worktreeInfo(state: Record<string, unknown>): { worktreePath: string | null; branch: string | null } {
  const sc = (state['pipeline'] as { source_control?: { worktree_path?: string; branch?: string } } | undefined)?.source_control;
  return { worktreePath: sc?.worktree_path ?? null, branch: sc?.branch ?? null };
}

function activeWorktrees(repoRoot: string, exec: Exec): Set<string> {
  const out = new Set<string>();
  try {
    const text = String(exec('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }));
    for (const line of text.split('\n')) {
      if (line.startsWith('worktree ')) out.add(path.resolve(line.slice('worktree '.length).trim()));
    }
  } catch { /* empty */ }
  return out;
}

function summarize(name: string, state: Record<string, unknown>, active: Set<string>): ProjectSummary {
  const wt = worktreeInfo(state);
  const tier = (state['pipeline'] as { current_tier?: string } | undefined)?.current_tier ?? null;
  return {
    name,
    masterPlanPath: masterPlanPath(state),
    currentTier: tier,
    existingWorktreePath: wt.worktreePath,
    existingBranch: wt.branch,
    worktreeExists: wt.worktreePath ? active.has(path.resolve(wt.worktreePath)) : false,
  };
}

export function projectFind(opts: ProjectFindOptions): ProjectFindResult {
  const exec = opts.exec ?? ((f, a, o) => execFileSync(f, a, { ...o, encoding: 'utf8' }) as unknown as string);
  if (!fs.existsSync(opts.projectsBasePath)) return { projects: [] };
  const active = activeWorktrees(opts.repoRoot, exec);

  if (opts.projectName) {
    const dir = path.join(opts.projectsBasePath, opts.projectName);
    const state = readState(dir);
    if (!state) return { projects: [] };
    return { projects: [summarize(opts.projectName, state, active)] };
  }

  const entries = fs.readdirSync(opts.projectsBasePath, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const out: ProjectSummary[] = [];
  for (const d of entries) {
    const state = readState(path.join(opts.projectsBasePath, d.name));
    if (!state) continue;
    const tier = (state['pipeline'] as { current_tier?: string } | undefined)?.current_tier;
    if (tier !== 'execution') continue;
    out.push(summarize(d.name, state, active));
  }
  return { projects: out };
}

interface Args { 'projects-base-path'?: string; 'repo-root'?: string; 'project-name'?: string }

export const projectFindCommand = defineCommand({
  name: 'project-find',
  description: 'Find execution-tier projects under the projects base path',
  args: {
    'projects-base-path': { description: 'Absolute path to the projects base directory (typically ~/.radorch/projects)', required: true },
    'repo-root': { description: 'Absolute path to the repository root used to enumerate active git worktrees', required: true },
    'project-name': { description: 'Optional single-project lookup; when supplied the tier filter is bypassed' },
  },
  flags: {},
  handler: async ({ args }: { args: Args; ctx: CommandContext }) => {
    const base = args['projects-base-path'];
    const root = args['repo-root'];
    if (!base || !root) throw new UserError('--projects-base-path and --repo-root are both required');
    return projectFind({ projectsBasePath: base, repoRoot: root, projectName: args['project-name'] });
  },
});
