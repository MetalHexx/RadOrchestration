import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { executeResolve } from '../../../src/commands/execute/resolve.js';
import type { ExecuteResolveDeps } from '../../../src/commands/execute/resolve.js';
import type { Project, LocateResult, NodeStatus, Tier } from '@rad-orchestration/work-graph';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProject(
  name: string,
  opts: {
    masterPlan?: string | null;
    status?: NodeStatus;
    sourceControlInitialized?: boolean;
    projectType?: 'standard' | 'side-project';
    tier?: Tier | null;
  } = {},
): Project {
  const docs: Project['docs'] = { others: [] };
  if (opts.masterPlan !== null) docs.masterPlan = opts.masterPlan ?? `${name}-MASTER-PLAN.md`;
  return {
    id: name,
    kind: 'project',
    name,
    status: opts.status ?? 'in_progress',
    dir: `/projects/${name}`,
    tier: opts.tier ?? 'execution',
    projectType: opts.projectType ?? 'standard',
    sourceControlInitialized: opts.sourceControlInitialized ?? false,
    docs,
    worktrees: [],
  };
}

const loc = (over: Partial<LocateResult> & { kind: LocateResult['kind'] }): LocateResult => ({ ...over });

const deps = (over: Partial<ExecuteResolveDeps> = {}): ExecuteResolveDeps => ({
  cwd: '/somewhere',
  project: undefined,
  locate: () => loc({ kind: 'none' }),
  listProjects: () => [makeProject('P')],
  readProjectRepos: () => ({ repos: ['rad-orc-source'], projectType: 'standard' as const }),
  readConfig: () => ({ autoCommit: 'always', autoPr: 'never' }),
  defaultBranch: () => 'main',
  worktreeExists: () => true,
  planApproved: () => true,
  worktreesDir: '/wt',
  sideProjectsDir: '/sp',
  ...over,
});

// ── Run-mode matrix ─────────────────────────────────────────────────────────

describe('executeResolve — run mode from location + settled-ness', () => {
  it('main clone with an explicit project → launch', () => {
    const r = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'main-clone', repo: 'rad-orc-source' }) }));
    expect(r.runMode).toBe('launch');
    expect(r.project).toBe('P');
    expect(r.next[0]).toMatch(/^execute prepare --project P\b/);
    expect(r.next[1]).toMatch(/^worktree launch /);
  });

  it('nowhere (none) with an explicit project → launch', () => {
    const r = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'none' }) }));
    expect(r.runMode).toBe('launch');
  });

  it('settled worktree → resume (single drive step, asks nothing)', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'worktree', worktree_name: 'P', projects: ['P'], branch: 'radorch/P' }),
      listProjects: () => [makeProject('P', { sourceControlInitialized: true })],
    }));
    expect(r.runMode).toBe('resume');
    expect(r.projectDir).toBe('/projects/P');
    expect(r.ask).toEqual({});
    expect(r.next).toEqual([`pipeline signal --event start --project-dir "/projects/P"`]);
  });

  it('settled worktree with an UNAPPROVED plan → resume that approves before driving', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'worktree', worktree_name: 'P', projects: ['P'], branch: 'radorch/P' }),
      listProjects: () => [makeProject('P', { sourceControlInitialized: true })],
      planApproved: () => false,
    }));
    expect(r.runMode).toBe('resume');
    expect(r.next).toEqual([
      'gate approve plan --project-dir "/projects/P"',
      'pipeline signal --event start --project-dir "/projects/P"',
    ]);
  });

  it('unsettled worktree → in-place (prepare then drive)', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'worktree', worktree_name: 'P', projects: ['P'], branch: 'radorch/P' }),
      listProjects: () => [makeProject('P', { sourceControlInitialized: false })],
    }));
    expect(r.runMode).toBe('in-place');
    expect(r.next[0]).toMatch(/^execute prepare --project P\b/);
    expect(r.next[1]).toBe(`pipeline signal --event start --project-dir "/projects/P"`);
  });

  it('side-project (unsettled) → in-place, derived points under the side-projects dir on main', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'side-project', worktree_name: 'SP' }),
      listProjects: () => [makeProject('SP', { projectType: 'side-project', sourceControlInitialized: false })],
      readProjectRepos: () => ({ repos: ['SP'], projectType: 'side-project' as const }),
    }));
    expect(r.runMode).toBe('in-place');
    expect(r.derived?.branch).toBe('main');
    expect(r.derived?.launchDir).toBe(path.join('/sp', 'SP'));
    expect(r.derived?.repos[0]?.worktreePath).toBe(path.join('/sp', 'SP'));
  });
});

// ── Ask gating (raw config) ──────────────────────────────────────────────────

describe('executeResolve — asks are only genuine forks', () => {
  it('auto-commit/auto-pr asked ONLY when the raw config value is "ask"', () => {
    const r = executeResolve(deps({
      project: 'P',
      locate: () => loc({ kind: 'none' }),
      readConfig: () => ({ autoCommit: 'ask', autoPr: 'always' }),
    }));
    expect(r.ask.autoCommit).toBe(true);
    expect(r.ask.autoPr).toBeUndefined();
  });

  it('launchFlavor asked only on the launch path', () => {
    const launch = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'none' }) }));
    expect(launch.ask.launchFlavor).toBe(true);
    const resume = executeResolve(deps({
      locate: () => loc({ kind: 'worktree', worktree_name: 'P', projects: ['P'] }),
      listProjects: () => [makeProject('P', { sourceControlInitialized: true })],
    }));
    expect(resume.ask.launchFlavor).toBeUndefined();
  });
});

// ── Project resolution & candidates ─────────────────────────────────────────

describe('executeResolve — project resolution and eligibility', () => {
  it('no project + main clone → needsProject with eligible candidates only', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'main-clone', repo: 'rad-orc-source' }),
      listProjects: () => [
        makeProject('READY', { status: 'in_progress' }),
        makeProject('FINISHED', { status: 'done' }),       // excluded: done
        makeProject('NOPLAN', { masterPlan: null }),        // excluded: no master plan
      ],
    }));
    expect(r.needsProject).toBe(true);
    expect(r.projectDir).toBeNull();
    expect(r.candidates?.map((c) => c.name)).toEqual(['READY']);
  });

  it('eligibility ignores approval — a planned, not-done project is a candidate regardless', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'none' }),
      listProjects: () => [makeProject('UNAPPROVED', { status: 'not_started' })],
    }));
    expect(r.candidates?.map((c) => c.name)).toEqual(['UNAPPROVED']);
  });

  it('resolves the single cwd worktree project without --project', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'worktree', worktree_name: 'P', projects: ['P'] }),
      listProjects: () => [makeProject('P', { sourceControlInitialized: true })],
    }));
    expect(r.project).toBe('P');
    expect(r.runMode).toBe('resume');
  });

  it('a different project\'s worktree → in-place reuse (offer to reuse it), not unknown', () => {
    const r = executeResolve(deps({
      project: 'P',
      locate: () => loc({ kind: 'worktree', worktree_name: 'OTHER', projects: ['OTHER'], branch: 'radorch/OTHER' }),
      listProjects: () => [makeProject('P'), makeProject('OTHER')],
    }));
    expect(r.runMode).toBe('in-place');
    expect(r.ask.reuseWorktree).toBe(true);
    expect(r.derived?.worktreeName).toBe('OTHER');
    expect(r.next[0]).toMatch(/^execute prepare --project P --worktree-name OTHER\b/);
    expect(r.next[1]).toBe('pipeline signal --event start --project-dir "/projects/P"');
  });

  it('requested project not found → unknown', () => {
    const r = executeResolve(deps({ project: 'GHOST', locate: () => loc({ kind: 'none' }), listProjects: () => [makeProject('P')] }));
    expect(r.runMode).toBe('unknown');
    expect(r.reason).toMatch(/not found/i);
  });

  it('resolved project without a master plan → unknown (not eligible)', () => {
    const r = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'none' }), listProjects: () => [makeProject('P', { masterPlan: null })] }));
    expect(r.runMode).toBe('unknown');
    expect(r.reason).toMatch(/Master Plan/i);
  });

  it('orphan worktree directory (no matching project) → unknown', () => {
    const r = executeResolve(deps({ locate: () => loc({ kind: 'worktree', worktree_name: 'ORPHAN', projects: [] }), listProjects: () => [makeProject('P')] }));
    expect(r.runMode).toBe('unknown');
    expect(r.reason).toMatch(/does not correspond/i);
  });
});

// ── Derived convention ───────────────────────────────────────────────────────

describe('executeResolve — derived convention', () => {
  it('launchDir is the PARENT (not a repo dir); per-repo base from the injected defaultBranch', () => {
    const r = executeResolve(deps({
      project: 'P',
      locate: () => loc({ kind: 'none' }),
      readProjectRepos: () => ({ repos: ['fake-api', 'fake-ui'], projectType: 'standard' as const }),
      defaultBranch: (repo) => (repo === 'fake-api' ? 'master' : 'main'),
      worktreesDir: '/wt',
    }));
    expect(r.derived?.branch).toBe('radorch/P');
    expect(r.derived?.launchDir).toBe(path.join('/wt', 'P'));
    expect(r.derived?.repos).toEqual([
      { repo: 'fake-api', base: 'master', worktreePath: path.join('/wt', 'P', 'fake-api') },
      { repo: 'fake-ui', base: 'main', worktreePath: path.join('/wt', 'P', 'fake-ui') },
    ]);
  });
});

// ── Next ordering & auto-value pre-substitution ──────────────────────────────

describe('executeResolve — next ordering and pre-substitution', () => {
  it('bakes resolved always/never into the prepare command; leaves a placeholder for "ask"', () => {
    const baked = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'none' }), readConfig: () => ({ autoCommit: 'always', autoPr: 'never' }) }));
    expect(baked.next[0]).toBe('execute prepare --project P --auto-commit always --auto-pr never');

    const asked = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'none' }), readConfig: () => ({ autoCommit: 'ask', autoPr: 'ask' }) }));
    expect(asked.next[0]).toBe('execute prepare --project P --auto-commit {ac} --auto-pr {ap}');
  });

  it('launch emits prepare then a flavor/permission-mode-placeholder launch into the parent dir', () => {
    const r = executeResolve(deps({ project: 'P', locate: () => loc({ kind: 'none' }), worktreesDir: '/wt' }));
    expect(r.next).toHaveLength(2);
    expect(r.next[1]).toBe(`worktree launch --agent {flavor} --worktree-path "${path.join('/wt', 'P')}" --prompt "/rad-execute P" --permission-mode {pm}`);
  });
});

// ── Side-project is type-first (isolated, location-independent) ───────────────

describe('executeResolve — side-project short-circuits location', () => {
  it('side-project named from INSIDE another project\'s worktree → in-place at the side-projects dir, no asks (not unknown)', () => {
    const r = executeResolve(deps({
      project: 'SP',
      locate: () => loc({ kind: 'worktree', worktree_name: 'OTHER', projects: ['OTHER'], branch: 'radorch/OTHER' }),
      listProjects: () => [makeProject('OTHER'), makeProject('SP', { projectType: 'side-project', sourceControlInitialized: false })],
      readProjectRepos: () => ({ repos: ['SP'], projectType: 'side-project' as const }),
    }));
    expect(r.runMode).toBe('in-place');
    expect(r.derived?.launchDir).toBe(path.join('/sp', 'SP'));
    expect(r.ask).toEqual({});
    expect(r.next[0]).toBe('execute prepare --project SP');
    expect(r.next[1]).toBe('pipeline signal --event start --project-dir "/projects/SP"');
  });

  it('suppresses commit/PR asks even when config is "ask" (fixed side-project binding)', () => {
    const r = executeResolve(deps({
      project: 'SP',
      locate: () => loc({ kind: 'none' }),
      listProjects: () => [makeProject('SP', { projectType: 'side-project' })],
      readProjectRepos: () => ({ repos: ['SP'], projectType: 'side-project' as const }),
      readConfig: () => ({ autoCommit: 'ask', autoPr: 'ask' }),
    }));
    expect(r.ask.autoCommit).toBeUndefined();
    expect(r.ask.autoPr).toBeUndefined();
    expect(r.next[0]).toBe('execute prepare --project SP');
  });

  it('settled side-project → resume (drive only)', () => {
    const r = executeResolve(deps({
      project: 'SP',
      locate: () => loc({ kind: 'none' }),
      listProjects: () => [makeProject('SP', { projectType: 'side-project', sourceControlInitialized: true })],
      readProjectRepos: () => ({ repos: ['SP'], projectType: 'side-project' as const }),
    }));
    expect(r.runMode).toBe('resume');
    expect(r.next).toEqual(['pipeline signal --event start --project-dir "/projects/SP"']);
  });

  it('settled side-project with an UNAPPROVED plan → resume that approves before driving (the RE-TEST-1 gap)', () => {
    const r = executeResolve(deps({
      project: 'SP',
      locate: () => loc({ kind: 'none' }),
      listProjects: () => [makeProject('SP', { projectType: 'side-project', sourceControlInitialized: true })],
      readProjectRepos: () => ({ repos: ['SP'], projectType: 'side-project' as const }),
      planApproved: () => false,
    }));
    expect(r.runMode).toBe('resume');
    expect(r.next).toEqual([
      'gate approve plan --project-dir "/projects/SP"',
      'pipeline signal --event start --project-dir "/projects/SP"',
    ]);
  });
});

// ── Reuse a different project's worktree (follow-up / correction) ─────────────

describe('executeResolve — reuse a different project\'s worktree', () => {
  it('inherits the worktree name + branch and passes --worktree-name to prepare', () => {
    const r = executeResolve(deps({
      project: 'FOLLOWUP',
      locate: () => loc({ kind: 'worktree', worktree_name: 'PARENT', projects: ['PARENT'], branch: 'radorch/PARENT' }),
      listProjects: () => [makeProject('FOLLOWUP'), makeProject('PARENT')],
    }));
    expect(r.runMode).toBe('in-place');
    expect(r.ask.reuseWorktree).toBe(true);
    expect(r.derived?.worktreeName).toBe('PARENT');
    expect(r.derived?.branch).toBe('radorch/PARENT');
    expect(r.derived?.missingRepos).toEqual([]);
    expect(r.next[0]).toMatch(/^execute prepare --project FOLLOWUP --worktree-name PARENT\b/);
  });

  it('surfaces repos the reused worktree set is missing', () => {
    const r = executeResolve(deps({
      project: 'FOLLOWUP',
      locate: () => loc({ kind: 'worktree', worktree_name: 'PARENT', projects: ['PARENT'], branch: 'radorch/PARENT' }),
      listProjects: () => [makeProject('FOLLOWUP'), makeProject('PARENT')],
      readProjectRepos: () => ({ repos: ['fake-api', 'fake-ui'], projectType: 'standard' as const }),
      worktreeExists: (_wt, repo) => repo === 'fake-api', // fake-ui is missing under the reused set
    }));
    expect(r.derived?.missingRepos).toEqual(['fake-ui']);
  });
});

// ── Confirmations ────────────────────────────────────────────────────────────

describe('executeResolve — confirmations', () => {
  it('standard project in its OWN unsettled worktree → in-place + confirmHere (not reuseWorktree)', () => {
    const r = executeResolve(deps({
      locate: () => loc({ kind: 'worktree', worktree_name: 'P', projects: ['P'], branch: 'radorch/P' }),
      listProjects: () => [makeProject('P', { sourceControlInitialized: false })],
    }));
    expect(r.runMode).toBe('in-place');
    expect(r.ask.confirmHere).toBe(true);
    expect(r.ask.reuseWorktree).toBeUndefined();
  });

  it('an already-done project → confirmDone, still classifying a run mode', () => {
    const r = executeResolve(deps({
      project: 'P',
      locate: () => loc({ kind: 'none' }),
      listProjects: () => [makeProject('P', { status: 'done' })],
    }));
    expect(r.ask.confirmDone).toBe(true);
    expect(r.runMode).toBe('launch');
  });
});
