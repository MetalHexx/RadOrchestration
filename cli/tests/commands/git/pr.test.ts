import { describe, it, expect, vi } from 'vitest';
import { ghPr } from '../../../src/commands/git/pr.js';

function execError(stderr: string, stdout = ''): Error & { stderr: string; stdout: string } {
  const e = new Error(stderr) as Error & { stderr: string; stdout: string };
  e.stderr = stderr; e.stdout = stdout;
  return e;
}

describe('ghPr core', () => {
  it('returns precondition_failure when any required arg is empty (no exec calls)', () => {
    const exec = vi.fn();
    const r = ghPr({ worktreePath: '', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.error).toBe('precondition_failure');
    expect(r.pr_created).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });
  it('returns gh_not_found when gh binary is missing', () => {
    const exec = vi.fn().mockImplementationOnce(() => { throw execError('ENOENT'); });
    const r = ghPr({ worktreePath: '/wt', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.error).toBe('gh_not_found');
    expect(r.pr_created).toBe(false);
  });
  it('returns auth_failed when gh auth status reports unauthenticated', () => {
    const exec = vi.fn().mockImplementationOnce(() => { throw execError('You are not logged into any GitHub hosts'); });
    const r = ghPr({ worktreePath: '/wt', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.error).toBe('auth_failed');
  });
  it('returns no_remote when git remote is empty', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '') // gh auth status
      .mockImplementationOnce(() => '\n'); // git remote
    const r = ghPr({ worktreePath: '/wt', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.error).toBe('no_remote');
  });
  it('returns pr_existed:true when gh pr list finds an existing PR', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => 'origin\n')
      .mockImplementationOnce(() => JSON.stringify([{ url: 'https://gh/x/1', number: 1 }]));
    const r = ghPr({ worktreePath: '/wt', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.pr_existed).toBe(true);
    expect(r.pr_url).toBe('https://gh/x/1');
    expect(r.pr_number).toBe(1);
  });
  it('creates a new PR when none exists and reports pr_created:true', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => 'origin\n')
      .mockImplementationOnce(() => '[]')
      .mockImplementationOnce(() => 'https://gh/x/42\n');
    const r = ghPr({ worktreePath: '/wt', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.pr_created).toBe(true);
    expect(r.pr_number).toBe(42);
    expect(r.error).toBeNull();
  });
  it('returns creation_failed when gh pr create itself errors', () => {
    const exec = vi.fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => 'origin\n')
      .mockImplementationOnce(() => '[]')
      .mockImplementationOnce(() => { throw execError('pull request create failed'); });
    const r = ghPr({ worktreePath: '/wt', branch: 'b', baseBranch: 'main', title: 't', exec });
    expect(r.error).toBe('creation_failed');
  });
});
