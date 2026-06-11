import { describe, it, expect, vi } from 'vitest';
import { gitCommit, gitCommitFanOut } from '../../../src/commands/git/commit.js';

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

describe('gitCommitFanOut — stateless array fan-out (FR-5)', () => {
  function makeFakeExec(config: Record<string, { commitHash?: string; nothingToCommit?: boolean; pushOk?: boolean }>) {
    const callCounts: Record<string, number> = {};
    return (file: string, args: string[], opts: { cwd: string; encoding: 'utf8' }) => {
      const cwd = opts.cwd;
      const cfg = config[cwd];
      if (!cfg) throw new Error(`No config for cwd: ${cwd}`);
      callCounts[cwd] = (callCounts[cwd] ?? 0) + 1;
      const call = callCounts[cwd];
      // Call order: 1=git add, 2=git commit, 3=git rev-parse --short HEAD, 4=git remote get-url, 5=git push
      if (call === 1) return ''; // git add -A
      if (call === 2) {
        // git commit -m
        if (cfg.nothingToCommit) {
          const e = new Error('nothing to commit, working tree clean') as Error & { stderr: string; stdout: string };
          e.stderr = '';
          e.stdout = 'nothing to commit, working tree clean';
          throw e;
        }
        return '';
      }
      if (call === 3) return `${cfg.commitHash ?? 'abc0000'}\n`; // git rev-parse --short HEAD
      if (call === 4) return 'git@github.com:org/repo.git\n';    // git remote get-url origin
      if (call === 5) {
        // git push
        if (cfg.pushOk === false) {
          const e = new Error('push failed') as Error & { stderr: string };
          e.stderr = 'push failed';
          throw e;
        }
        return '';
      }
      return '';
    };
  }

  it('returns one structured result per repo, clean-skip is not an error', () => {
    const exec = makeFakeExec({
      '/wt/api': { commitHash: 'api1234', nothingToCommit: false, pushOk: true },
      '/wt/ui': { nothingToCommit: true }, // clean skip
    });
    const out = gitCommitFanOut({
      repos: [
        { name: 'fake-api', path: '/wt/api', message: 'feat(P01-T01): a' },
        { name: 'fake-ui', path: '/wt/ui', message: 'feat(P01-T01): b' },
      ],
      exec,
    });
    expect(out).toEqual([
      { name: 'fake-api', committed: true, commitHash: 'api1234', pushed: true },
      { name: 'fake-ui', committed: false, commitHash: null, pushed: false },
    ]);
  });
});
