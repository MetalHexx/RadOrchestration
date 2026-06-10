import { describe, it, expect, vi } from 'vitest';
import { worktreeCreate, worktreeCreateCommand, provisionWorktrees, aggregateExitCode } from '../../../src/commands/worktree/create.js';
import { runCommand } from '../../../src/framework/command.js';

function makeExecErr(stderr: string): Error & { stderr: string } {
  const e = new Error(stderr) as Error & { stderr: string };
  e.stderr = stderr;
  return e;
}

describe('worktreeCreate core', () => {
  it('creates the worktree, pushes, returns compareUrl with SSH→HTTPS conversion', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '') // worktree add
      .mockImplementationOnce(() => '') // git push -u
      .mockImplementationOnce(() => 'git@github.com:org/repo.git\n'); // remote get-url
    const r = worktreeCreate({ repoRoot: '/r', branch: 'feat/x', worktreePath: '/r-wt/x', baseBranch: 'origin/main', exec });
    expect(r.created).toBe(true);
    expect(r.pushed).toBe(true);
    expect(r.remoteUrl).toBe('https://github.com/org/repo');
    expect(r.compareUrl).toBe('https://github.com/org/repo/compare/main...feat/x');
    expect(r.errorType).toBeNull();
  });

  it('classifies "already exists" path error and returns created:false', () => {
    const exec = vi.fn(() => { throw makeExecErr('fatal: \'/r-wt/x\' already exists'); });
    const r = worktreeCreate({ repoRoot: '/r', branch: 'feat/x', worktreePath: '/r-wt/x', baseBranch: 'main', exec });
    expect(r.created).toBe(false);
    expect(r.errorType).toBe('already_exists_path');
  });

  it('classifies branch-collision error', () => {
    const exec = vi.fn(() => { throw makeExecErr('fatal: a branch named \'feat/x\' already exists'); });
    const r = worktreeCreate({ repoRoot: '/r', branch: 'feat/x', worktreePath: '/r-wt/x', baseBranch: 'main', exec });
    expect(r.errorType).toBe('already_exists_branch');
  });

  it('classifies invalid_reference', () => {
    const exec = vi.fn(() => { throw makeExecErr('fatal: invalid reference: bogus-ref'); });
    const r = worktreeCreate({ repoRoot: '/r', branch: 'feat/x', worktreePath: '/r-wt/x', baseBranch: 'bogus-ref', exec });
    expect(r.errorType).toBe('invalid_reference');
  });

  it('returns pushed:false when push fails after creation', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '') // create
      .mockImplementationOnce(() => { throw makeExecErr('fatal: push failed'); })
      .mockImplementationOnce(() => 'https://github.com/o/r.git\n');
    const r = worktreeCreate({ repoRoot: '/r', branch: 'feat/x', worktreePath: '/r-wt/x', baseBranch: 'main', exec });
    expect(r.created).toBe(true);
    expect(r.pushed).toBe(false);
  });
});

describe('worktreeCreate CLI path (runCommand argv → handler args)', () => {
  // Locks the framework contract: --project and optional --worktree-name/--repo
  // must arrive at the handler under their hyphenated keys.
  it('passes --project, --worktree-name, --repo through runCommand', async () => {
    type CreateArgs = { project?: string; 'worktree-name'?: string; repo?: string };
    let received: CreateArgs = {};
    const probeDef = {
      ...worktreeCreateCommand,
      handler: async ({ args }: { args: CreateArgs; ctx: unknown }) => {
        received = args;
        return { repos: [] } as never;
      },
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: [
        '--project', 'MY-PROJECT',
        '--worktree-name', 'MY-WORKTREE',
        '--repo', 'my-repo',
      ],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: false,
      stderr: process.stderr,
    });
    expect(received.project).toBe('MY-PROJECT');
    expect(received['worktree-name']).toBe('MY-WORKTREE');
    expect(received.repo).toBe('my-repo');
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });

  it('returns a well-formed user_error envelope when --project is omitted in non-interactive mode', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(worktreeCreateCommand, {
      argv: ['--non-interactive'],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: true,
      stderr: process.stderr,
    });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(env.error.message).toMatch(/project/);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); exit.mockRestore();
  });
});

describe('worktreeCreateCommand.mapResult — provision result exit codes', () => {
  const mr = worktreeCreateCommand.mapResult!;
  it('exits 0 when all repos succeed without error', () => {
    const result = { repos: [
      { name: 'a', created: true, pushed: true, path: '/wt/P/a', branch: 'radorch/P', error: null, errorType: null },
      { name: 'b', created: true, pushed: true, path: '/wt/P/b', branch: 'radorch/P', error: null, errorType: null },
    ] };
    const env = mr(result as never);
    expect(env.ok).toBe(true);
    expect(env.exit_code).toBe(0);
  });
  it('exits 2 when at least one repo failed to create (has an error)', () => {
    const result = { repos: [
      { name: 'a', created: false, pushed: false, path: '/wt/P/a', branch: 'radorch/P', error: 'boom', errorType: 'unknown' },
      { name: 'b', created: true, pushed: true, path: '/wt/P/b', branch: 'radorch/P', error: null, errorType: null },
    ] };
    const env = mr(result as never);
    expect(env.ok).toBe(true);
    expect(env.exit_code).toBe(2);
  });
  it('exits 1 when a repo was created but its push failed', () => {
    const result = { repos: [
      { name: 'a', created: true, pushed: false, path: '/wt/P/a', branch: 'radorch/P', error: null, errorType: null },
    ] };
    const env = mr(result as never);
    expect(env.ok).toBe(true);
    expect(env.exit_code).toBe(1);
  });
  it('carries repos data in the ok:true envelope', () => {
    const result = { repos: [
      { name: 'a', created: false, pushed: true, path: '/wt/P/a', branch: 'radorch/P', error: null, errorType: null },
    ] };
    const env = mr(result as never) as { ok: boolean; data: unknown; exit_code: number };
    expect(env.ok).toBe(true);
    expect(env.data).toEqual(result);
  });
});

describe('worktree create aggregate exit code (AD-5)', () => {
  it('returns 0 when every repo is present/created and pushed', () => {
    expect(aggregateExitCode([{ created: true, pushed: true }, { created: false, pushed: true }] as never)).toBe(0);
  });
  it('returns 1 when a repo was created but its push failed', () => {
    expect(aggregateExitCode([{ created: true, pushed: false }] as never)).toBe(1);
  });
  it('returns 2 when any repo failed to create', () => {
    expect(aggregateExitCode([{ created: false, pushed: false, error: 'boom' }, { created: true, pushed: true }] as never)).toBe(2);
  });
});

describe('provisionWorktrees convention-bound (FR-3, FR-4, NFR-2, NFR-6)', () => {
  const deps = (over: Partial<Record<string, unknown>> = {}) => ({
    worktreesDir: '/wt',
    readProjectRepos: () => ({ repos: ['a', 'b'], projectType: 'standard' as const }),
    resolveClonePath: (r: string) => `/clones/${r}`,
    defaultBranch: () => 'main',
    exists: () => false,
    create: vi.fn(() => ({ created: true, worktreePath: '/x', branch: 'radorch/p', baseBranch: 'main', pushed: true, remoteUrl: 'u', compareUrl: 'c', error: null, errorType: null })),
    ...over,
  });
  it('provisions every repo in the set and returns a per-repo result array', () => {
    const d = deps();
    const r = provisionWorktrees({ project: 'P', ...d });
    expect(r.repos.map((x) => x.name)).toEqual(['a', 'b']);
    expect(r.repos.every((x) => x.created)).toBe(true);
    expect((d.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2);
  });
  it('is an idempotent no-op for an already-present worktree', () => {
    const create = vi.fn();
    const r = provisionWorktrees({ project: 'P', ...deps({ exists: () => true, create }) });
    expect(create).not.toHaveBeenCalled();
    expect(r.repos.every((x) => x.created === false && x.error == null)).toBe(true);
  });
  it('isolates a per-repo failure without blocking the others', () => {
    const create = vi.fn()
      .mockImplementationOnce(() => ({ created: false, error: 'boom', errorType: 'unknown', worktreePath: null, branch: null, baseBranch: null, pushed: false, remoteUrl: '', compareUrl: '' }))
      .mockImplementationOnce(() => ({ created: true, worktreePath: '/x', branch: 'b', baseBranch: 'main', pushed: true, remoteUrl: 'u', compareUrl: 'c', error: null, errorType: null }));
    const r = provisionWorktrees({ project: 'P', ...deps({ create }) });
    expect(r.repos[0]?.error).toBe('boom');
    expect(r.repos[1]?.created).toBe(true);
  });
});
