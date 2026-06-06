import { describe, it, expect, vi } from 'vitest';
import { gitCommit } from '../../../src/commands/git/commit.js';

function makeExecError(stderr: string, stdout = ''): Error & { stderr: string; stdout: string } {
  const e = new Error(stderr) as Error & { stderr: string; stdout: string };
  e.stderr = stderr; e.stdout = stdout;
  return e;
}

describe('gitCommit core', () => {
  it('commits and pushes cleanly, returning the short hash', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')                              // git add -A
      .mockImplementationOnce(() => '')                              // git commit -m
      .mockImplementationOnce(() => 'abc1234\n')                     // git rev-parse --short HEAD
      .mockImplementationOnce(() => 'git@github.com:org/repo.git\n') // git remote get-url origin
      .mockImplementationOnce(() => '');                             // git push
    const r = gitCommit({ worktreePath: '/wt', message: 'feat(X): hi', exec });
    expect(r).toEqual({ committed: true, pushed: true, commitHash: 'abc1234', upstreamConfigured: false, error: null, errorType: null });
  });
  it('classifies a no-op commit as nothing_to_commit, committed:false', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => { throw makeExecError('', 'nothing to commit, working tree clean'); });
    const r = gitCommit({ worktreePath: '/wt', message: 'x', exec });
    expect(r.committed).toBe(false);
    expect(r.errorType).toBe('nothing_to_commit');
  });
  it('retries push with --set-upstream when upstream is missing', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')                              // git add -A
      .mockImplementationOnce(() => '')                              // git commit -m
      .mockImplementationOnce(() => 'def5678\n')                     // git rev-parse --short HEAD
      .mockImplementationOnce(() => 'git@github.com:org/repo.git\n') // git remote get-url origin
      .mockImplementationOnce(() => { throw makeExecError('fatal: has no upstream branch'); }) // git push
      .mockImplementationOnce(() => 'feature/x\n')                   // git rev-parse --abbrev-ref HEAD
      .mockImplementationOnce(() => '');                             // git push --set-upstream origin branch
    const r = gitCommit({ worktreePath: '/wt', message: 'x', exec });
    expect(r.committed).toBe(true);
    expect(r.pushed).toBe(true);
    expect(r.upstreamConfigured).toBe(true);
  });
  it('returns committed:true pushed:false errorType:push_failed when retry also fails', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')                              // git add -A
      .mockImplementationOnce(() => '')                              // git commit -m
      .mockImplementationOnce(() => 'aaa1111\n')                     // git rev-parse --short HEAD
      .mockImplementationOnce(() => 'git@github.com:org/repo.git\n') // git remote get-url origin
      .mockImplementationOnce(() => { throw makeExecError('no upstream branch'); }) // git push
      .mockImplementationOnce(() => 'feature/x\n')                   // git rev-parse --abbrev-ref HEAD
      .mockImplementationOnce(() => { throw makeExecError('rejected'); }); // git push --set-upstream
    const r = gitCommit({ worktreePath: '/wt', message: 'x', exec });
    expect(r.committed).toBe(true);
    expect(r.pushed).toBe(false);
    expect(r.errorType).toBe('push_failed');
  });
  it('returns commit_failed when the commit itself fails for a non-nothing-to-commit reason', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => { throw makeExecError('hook rejected'); });
    const r = gitCommit({ worktreePath: '/wt', message: 'x', exec });
    expect(r.committed).toBe(false);
    expect(r.errorType).toBe('commit_failed');
  });
  it('skips push and returns pushed:false errorType:null when no origin remote exists', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')            // git add -A
      .mockImplementationOnce(() => '')            // git commit -m
      .mockImplementationOnce(() => 'cab1234\n')   // git rev-parse --short HEAD
      .mockImplementationOnce(() => { const e = new Error('error: No such remote') as Error & { stderr: string }; e.stderr = 'error: No such remote \'origin\''; throw e; }); // git remote get-url origin
    const r = gitCommit({ worktreePath: '/wt', message: 'feat(X): hi', exec });
    expect(r).toEqual({ committed: true, pushed: false, commitHash: 'cab1234', upstreamConfigured: false, error: null, errorType: null });
  });
  it('still pushes when origin exists (unchanged happy path)', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')                              // git add -A
      .mockImplementationOnce(() => '')                              // git commit -m
      .mockImplementationOnce(() => 'dad5678\n')                     // git rev-parse --short HEAD
      .mockImplementationOnce(() => 'git@github.com:org/repo.git\n') // git remote get-url origin
      .mockImplementationOnce(() => '');                             // git push
    const r = gitCommit({ worktreePath: '/wt', message: 'x', exec });
    expect(r.committed).toBe(true);
    expect(r.pushed).toBe(true);
    expect(r.errorType).toBeNull();
  });
});
