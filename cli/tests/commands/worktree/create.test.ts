import { describe, it, expect, vi } from 'vitest';
import { worktreeCreate, worktreeCreateCommand } from '../../../src/commands/worktree/create.js';

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
});
