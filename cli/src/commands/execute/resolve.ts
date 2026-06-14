/**
 * execute resolve — read-only run-mode classifier and advisor.
 *
 * Classifies where the operator is standing (main clone, worktree, side-project,
 * nowhere), resolves the target project, and emits a DATA envelope the thin
 * `/rad-execute` skill relays: the run mode, which questions are genuine forks,
 * the derived worktree convention, and the ordered `next` commands to run. It
 * never writes state and never invokes another command.
 *
 * Decision order mirrors `rad-source-control`'s five-case model:
 *   1. project TYPE first — a side-project is isolated (`~/.radorc/side-projects/<name>`),
 *      so it runs the same way from anywhere and short-circuits any location check.
 *   2. then LOCATION — main clone / nowhere launches a fresh worktree session;
 *      the project's own worktree runs in place; a DIFFERENT project's worktree
 *      offers to reuse it (the follow-up / correction path).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineCommand } from '../../framework/command.js';
import type { CommandContext } from '../../framework/context.js';
import { userDataPaths } from '../../lib/paths.js';
import { readConfig } from '../config/index.js';
import { readProjectReposDefault } from '../../lib/project-repos.js';
import { resolveAutoCommit, resolveAutoPr } from '../source-control/index.js';
import { deriveWorktreeConvention } from '../../lib/worktree-convention.js';
import { WorkGraphService } from '@rad-orchestration/work-graph';
import { readRegistry } from '@rad-orchestration/repo-registry';
import type { Project, Tier, NodeStatus, LocateResult } from '@rad-orchestration/work-graph';

// ── Types ───────────────────────────────────────────────────────────────────

export type RunMode = 'launch' | 'in-place' | 'resume' | 'unknown';

export interface ResolveCandidate {
  name: string;
  tier: Tier | null;
  status: NodeStatus;
}
export interface ResolveDerivedRepo {
  repo: string;
  base: string;
  worktreePath: string;
}
export interface ResolveDerived {
  branch: string;
  /** Parent dir an agent launches into (above the per-repo worktrees). */
  launchDir: string;
  repos: ResolveDerivedRepo[];
  /** Reuse path only: the worktree set name being reused (a DIFFERENT project's). */
  worktreeName?: string;
  /** Reuse path only: repos the project needs that the reused set lacks. */
  missingRepos?: string[];
}
/** A question is asked ONLY when its key is present — i.e. a genuine fork. */
export interface ResolveAsk {
  launchFlavor?: boolean;
  autoCommit?: boolean;
  autoPr?: boolean;
  /** "you're in <other>'s worktree — reuse it for <this>?" (cross-project reuse). */
  reuseWorktree?: boolean;
  /** "you're in <this>'s worktree — run here?" (standard, own worktree, unsettled). */
  confirmHere?: boolean;
  /** "<project> is already marked done — run again?" */
  confirmDone?: boolean;
}
export interface ExecuteResolveResult {
  runMode: RunMode;
  project: string | null;
  /** Project data dir (`~/.radorc/projects/<project>`); null when no project is resolved. */
  projectDir: string | null;
  /** Set on `unknown` — a human-readable explanation the skill relays verbatim. */
  reason?: string;
  /** Set when no project could be resolved — the skill picks one and re-resolves. */
  needsProject?: boolean;
  candidates?: ResolveCandidate[];
  ask: ResolveAsk;
  derived: ResolveDerived | null;
  /** Ordered bare radorch subcommands; the skill prepends the call-form. */
  next: string[];
}

export interface ExecuteResolveDeps {
  cwd: string;
  project?: string;
  locate: (cwd: string) => LocateResult;
  listProjects: () => Project[];
  readProjectRepos: (project: string) => { repos: string[]; projectType: 'standard' | 'side-project' };
  readConfig: () => { autoCommit: string; autoPr: string };
  defaultBranch: (repo: string) => string;
  /** Read-only check: does `<worktreesDir>/<worktreeName>/<repo>` exist on disk? */
  worktreeExists: (worktreeName: string, repo: string) => boolean;
  /** Read-only check: is the project's plan_approval_gate already completed? */
  planApproved: (projectDir: string) => boolean;
  worktreesDir: string;
  sideProjectsDir: string;
}

// ── Core logic ────────────────────────────────────────────────────────────────

function unknown(project: string | null, reason: string): ExecuteResolveResult {
  return { runMode: 'unknown', project, projectDir: null, reason, ask: {}, derived: null, next: [] };
}

export function executeResolve(deps: ExecuteResolveDeps): ExecuteResolveResult {
  const locate = deps.locate(deps.cwd);
  const allProjects = deps.listProjects();

  // Eligibility = has a Master Plan AND not done. Approval is deliberately
  // ignored here — running this skill CONFERS approval (prepare on launch/in-place,
  // a `gate approve plan` step on resume), so an unapproved plan is still eligible.
  const candidates: ResolveCandidate[] = allProjects
    .filter((p) => p.docs.masterPlan != null && p.status !== 'done')
    .map((p) => ({ name: p.name, tier: p.tier, status: p.status }));

  const inWorktree = locate.kind === 'worktree';
  const inSideProject = locate.kind === 'side-project';
  const cwdProjects: string[] = inWorktree
    ? (locate.projects ?? [])
    : (inSideProject && locate.worktree_name ? [locate.worktree_name] : []);

  // 1. Resolve the target project: --project → single cwd match → unresolved.
  let projectName: string | null = null;
  if (deps.project) {
    projectName = deps.project;
  } else if (cwdProjects.length === 1) {
    projectName = cwdProjects[0] ?? null;
  }

  // 2. No project resolved.
  if (!projectName) {
    if (inWorktree && cwdProjects.length === 0) {
      return unknown(null, 'This worktree directory does not correspond to any known project under ~/.radorc/projects.');
    }
    const runMode: RunMode = locate.kind === 'main-clone' || locate.kind === 'none' ? 'launch' : 'in-place';
    return { runMode, project: null, projectDir: null, needsProject: true, candidates, ask: {}, derived: null, next: [] };
  }

  // 3. The resolved project must exist on disk.
  const node = allProjects.find((p) => p.name === projectName) ?? null;
  if (!node) {
    return unknown(
      projectName,
      `Project "${projectName}" was not found under ~/.radorc/projects. Run /rad-brainstorm or /rad-plan ${projectName} to create it.`,
    );
  }

  // 4. Eligibility gate: a Master Plan is required to execute.
  if (node.docs.masterPlan == null) {
    return unknown(projectName, `Project "${projectName}" has no Master Plan yet. Run /rad-plan ${projectName} before executing.`);
  }

  // 5. Read repos + project type (drive the derived layout and the type-first fork).
  let repos: string[];
  let projectType: 'standard' | 'side-project';
  try {
    const r = deps.readProjectRepos(projectName);
    repos = r.repos;
    projectType = r.projectType;
  } catch (e) {
    return unknown(projectName, e instanceof Error ? e.message : String(e));
  }

  const config = deps.readConfig();
  const isSettled = node.sourceControlInitialized;
  const projectDir = node.dir;
  const ask: ResolveAsk = {};

  // A re-run of an already-completed project is usually a slip — warn once.
  if (node.status === 'done') ask.confirmDone = true;

  // 6. TYPE FIRST — a side-project is isolated under the side-projects dir on a
  //    fixed 'main' branch, never provisioned as a worktree, and runs the same
  //    way from anywhere (no reuse/flavor/commit-PR questions — fixed binding).
  if (projectType === 'side-project') {
    const launchDir = path.join(deps.sideProjectsDir, projectName);
    const derived: ResolveDerived = {
      branch: 'main',
      launchDir,
      repos: [{ repo: repos[0] ?? projectName, base: 'main', worktreePath: launchDir }],
    };
    const runMode: RunMode = isSettled ? 'resume' : 'in-place';
    const next: string[] = [];
    if (runMode === 'in-place') next.push(`execute prepare --project ${projectName}`);
    // Resume skips prepare (already settled), so it must carry approval itself —
    // but only when the gate isn't already completed (re-firing would regress tier).
    else if (!deps.planApproved(projectDir)) next.push(`gate approve plan --project-dir "${projectDir}"`);
    next.push(`pipeline signal --event start --project-dir "${projectDir}"`);
    return { runMode, project: projectName, projectDir, ask, derived, next };
  }

  // 7. STANDARD — classify by location. Commit/PR are genuine forks only when
  //    the on-disk config value is 'ask'.
  if (config.autoCommit === 'ask') ask.autoCommit = true;
  if (config.autoPr === 'ask') ask.autoPr = true;
  const ac = config.autoCommit === 'ask' ? '{ac}' : resolveAutoCommit(config.autoCommit);
  const ap = config.autoPr === 'ask' ? '{ap}' : resolveAutoPr(config.autoPr);

  // 7a. Not in a real worktree (main clone / nowhere / standing in some
  //     side-project dir) → launch a fresh worktree + session.
  if (!inWorktree) {
    ask.launchFlavor = true;
    const derived = deriveWorktreeConvention({ worktreeName: projectName, repos, worktreesDir: deps.worktreesDir, defaultBranch: deps.defaultBranch });
    const next = [
      `execute prepare --project ${projectName} --auto-commit ${ac} --auto-pr ${ap}`,
      `worktree launch --agent {flavor} --worktree-path "${derived.launchDir}" --prompt "/rad-execute ${projectName}" --permission-mode {pm}`,
    ];
    return { runMode: 'launch', project: projectName, projectDir, ask, derived, next };
  }

  // 7b. In a DIFFERENT project's worktree → offer to reuse it for this project
  //     (the follow-up / correction path). Inherit the worktree's name + branch;
  //     surface any repos this project needs that the reused set lacks.
  const sameProject = (locate.projects ?? []).includes(projectName);
  if (!sameProject) {
    const reusedName = locate.worktree_name ?? projectName;
    const base = deriveWorktreeConvention({ worktreeName: reusedName, repos, worktreesDir: deps.worktreesDir, defaultBranch: deps.defaultBranch });
    const missingRepos = repos.filter((r) => !deps.worktreeExists(reusedName, r));
    const derived: ResolveDerived = {
      ...base,
      branch: locate.branch ?? base.branch,
      worktreeName: reusedName,
      missingRepos,
    };
    ask.reuseWorktree = true;
    const next = [
      `execute prepare --project ${projectName} --worktree-name ${reusedName} --auto-commit ${ac} --auto-pr ${ap}`,
      `pipeline signal --event start --project-dir "${projectDir}"`,
    ];
    return { runMode: 'in-place', project: projectName, projectDir, ask, derived, next };
  }

  // 7c. In this project's OWN worktree → run in place (silent resume if already
  //     settled; one "run here?" confirm if not).
  const wtName = locate.worktree_name ?? projectName;
  const base = deriveWorktreeConvention({ worktreeName: wtName, repos, worktreesDir: deps.worktreesDir, defaultBranch: deps.defaultBranch });
  const derived: ResolveDerived = { ...base, branch: locate.branch ?? base.branch };
  const runMode: RunMode = isSettled ? 'resume' : 'in-place';
  const next: string[] = [];
  if (runMode === 'in-place') {
    ask.confirmHere = true;
    next.push(`execute prepare --project ${projectName} --auto-commit ${ac} --auto-pr ${ap}`);
  } else if (!deps.planApproved(projectDir)) {
    // Resume carries approval itself (no prepare here), unless already approved.
    next.push(`gate approve plan --project-dir "${projectDir}"`);
  }
  next.push(`pipeline signal --event start --project-dir "${projectDir}"`);
  return { runMode, project: projectName, projectDir, ask, derived, next };
}

// ── Command definition ──────────────────────────────────────────────────────

interface ResolveArgs { project?: string }

export const executeResolveCommand = defineCommand({
  name: 'execute-resolve',
  description: 'Classify the run mode for executing a project and advise the next steps (read-only)',
  args: {
    project: { description: 'Project to execute; omit to resolve from the current directory or list eligible projects' },
  },
  flags: {},
  handler: async ({ args }: { args: ResolveArgs; ctx: CommandContext }) => {
    const paths = userDataPaths();
    // A REAL git exec — locate() needs `git worktree list` to read the branch and
    // confirm existence (unlike session-context's no-op exec).
    const exec = (file: string, execArgs: string[], opts: { cwd?: string }): string =>
      execFileSync(file, execArgs, { cwd: opts.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) as unknown as string;
    const svc = new WorkGraphService({ root: paths.root, worktreesDir: paths.worktrees, sideProjectsDir: paths.sideProjects, exec });
    const registry = readRegistry({ root: paths.root });
    return executeResolve({
      cwd: process.cwd(),
      project: args.project,
      locate: (cwd) => svc.locate(cwd),
      listProjects: () => svc.listProjects(),
      readProjectRepos: readProjectReposDefault,
      // RAW config strings — preserves 'ask' so the skill knows to ask.
      readConfig: () => readConfig({ root: paths.root }),
      defaultBranch: (repo) => registry.repos[repo]?.default_branch ?? 'main',
      worktreeExists: (worktreeName, repo) => fs.existsSync(path.join(paths.worktrees, worktreeName, repo)),
      planApproved: (projectDir) => {
        try {
          const s = JSON.parse(fs.readFileSync(path.join(projectDir, 'state.json'), 'utf8')) as { graph?: { nodes?: { plan_approval_gate?: { status?: string } } } };
          return s.graph?.nodes?.plan_approval_gate?.status === 'completed';
        } catch { return false; }
      },
      worktreesDir: paths.worktrees,
      sideProjectsDir: paths.sideProjects,
    });
  },
  mapResult: (r: ExecuteResolveResult) => ({ ok: true as const, data: r }),
});
