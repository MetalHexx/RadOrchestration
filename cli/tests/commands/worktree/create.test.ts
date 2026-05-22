import { describe, it, expect, vi } from 'vitest';
import { worktreeCreate, worktreeCreateCommand } from '../../../src/commands/worktree/create.js';
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
  // Locks the framework contract: --repo-root, --worktree-path, and
  // --base-branch must arrive at the handler under their hyphenated keys.
  // Before the framework fix the args branch read parsed[name] for the kebab
  // name (got undefined since Commander stored camelCase) and threw
  // "Missing required argument --repo-root" no matter what the user passed.
  it('passes --repo-root, --branch, --worktree-path, --base-branch through runCommand', async () => {
    type CreateArgs = { 'repo-root'?: string; branch?: string; 'worktree-path'?: string; 'base-branch'?: string };
    let received: CreateArgs = {};
    const probeDef = {
      ...worktreeCreateCommand,
      handler: async ({ args }: { args: CreateArgs; ctx: unknown }) => {
        received = args;
        return { probed: true } as never;
      },
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: [
        '--repo-root', '/r',
        '--branch', 'feat/x',
        '--worktree-path', '/r-wt/x',
        '--base-branch', 'origin/main',
      ],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: false,
      stderr: process.stderr,
    });
    expect(received['repo-root']).toBe('/r');
    expect(received.branch).toBe('feat/x');
    expect(received['worktree-path']).toBe('/r-wt/x');
    expect(received['base-branch']).toBe('origin/main');
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(true);
    expect(exit).toHaveBeenCalledWith(0);
    log.mockRestore(); exit.mockRestore();
  });

  it('returns a well-formed user_error envelope when --repo-root is omitted in non-interactive mode', async () => {
    // Probe handler so we don't invoke the real git-touching worktreeCreate.
    const probeDef = {
      ...worktreeCreateCommand,
      handler: async () => ({ probed: true } as never),
      mapResult: undefined,
    };
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);
    await runCommand(probeDef, {
      argv: [
        '--non-interactive',
        '--branch', 'feat/x',
        '--worktree-path', '/r-wt/x',
        '--base-branch', 'main',
      ],
      env: { RADORCH_NO_LOG: '1' },
      isTTY: true,
      stderr: process.stderr,
    });
    const arg = (log.mock.calls[0]?.[0] ?? '') as string;
    const env = JSON.parse(arg);
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(env.error.message).toMatch(/repo-root/);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore(); exit.mockRestore();
  });
});

describe('worktreeCreateCommand.mapResult — three-way exit code', () => {
  const mr = worktreeCreateCommand.mapResult!;
  it('exits 0 on create+push', () => {
    expect(mr({ created: true, pushed: true } as never).exit_code).toBe(0);
  });
  it('exits 1 on create+!push', () => {
    expect(mr({ created: true, pushed: false } as never).exit_code).toBe(1);
  });
  it('exits 2 on !create', () => {
    expect(mr({ created: false, pushed: false, errorType: 'already_exists_path' } as never).exit_code).toBe(2);
  });

  // Regression guard for SCRIPT-FOLD-2 smoke-test bug: the failure envelope used to
  // carry both `data` and `error`, which the framework validator rejects as
  // "failure envelope must not carry data". Callers got a generic system_error
  // instead of the classifier's `errorType`. The fix drops `data` and lifts
  // `errorType` (plus enough structured context to identify the worktree) onto
  // the `error` object so programmatic callers can still discriminate.
  describe('failure envelope shape (data XOR error)', () => {
    const baseFailure = {
      created: false,
      worktreePath: '/r-wt/x',
      branch: 'feat/x',
      baseBranch: 'origin/main',
      pushed: false,
      remoteUrl: '',
      compareUrl: '',
      error: 'fatal: \'/r-wt/x\' already exists',
    } as const;

    it('omits data on failure (passes framework data-XOR-error invariant)', () => {
      const env = mr({ ...baseFailure, errorType: 'already_exists_path' } as never) as Record<string, unknown>;
      expect(env.ok).toBe(false);
      expect('data' in env).toBe(false);
    });

    it('surfaces errorType=already_exists_path on the error object', () => {
      const env = mr({ ...baseFailure, errorType: 'already_exists_path' } as never);
      const err = env.error as Record<string, unknown> | undefined;
      expect(err).toBeDefined();
      expect(err!['type']).toBe('user_error');
      expect(err!['errorType']).toBe('already_exists_path');
      expect(err!['worktreePath']).toBe('/r-wt/x');
      expect(err!['branch']).toBe('feat/x');
    });

    it('surfaces errorType=already_exists_branch on the error object', () => {
      const env = mr({
        ...baseFailure,
        error: 'fatal: a branch named \'feat/x\' already exists',
        errorType: 'already_exists_branch',
      } as never);
      const err = env.error as Record<string, unknown> | undefined;
      expect(err!['errorType']).toBe('already_exists_branch');
    });

    it('surfaces errorType=invalid_reference on the error object', () => {
      const env = mr({
        ...baseFailure,
        error: 'fatal: invalid reference: bogus-ref',
        errorType: 'invalid_reference',
      } as never);
      const err = env.error as Record<string, unknown> | undefined;
      expect(err!['errorType']).toBe('invalid_reference');
    });
  });
});
