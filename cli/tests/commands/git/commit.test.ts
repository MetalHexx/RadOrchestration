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
      .mockImplementationOnce(() => '') // git add -A
      .mockImplementationOnce(() => '') // git commit -m
      .mockImplementationOnce(() => 'abc1234\n') // git rev-parse --short HEAD
      .mockImplementationOnce(() => ''); // git push
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
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => 'def5678\n')
      .mockImplementationOnce(() => { throw makeExecError('fatal: has no upstream branch'); })
      .mockImplementationOnce(() => 'feature/x\n')
      .mockImplementationOnce(() => '');
    const r = gitCommit({ worktreePath: '/wt', message: 'x', exec });
    expect(r.committed).toBe(true);
    expect(r.pushed).toBe(true);
    expect(r.upstreamConfigured).toBe(true);
  });
  it('returns committed:true pushed:false errorType:push_failed when retry also fails', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => 'aaa1111\n')
      .mockImplementationOnce(() => { throw makeExecError('no upstream branch'); })
      .mockImplementationOnce(() => 'feature/x\n')
      .mockImplementationOnce(() => { throw makeExecError('rejected'); });
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
});
