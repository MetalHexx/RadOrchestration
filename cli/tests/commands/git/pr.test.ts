import { describe, it, expect, vi } from 'vitest';
import { ghPr, ghPrFanOut } from '../../../src/commands/git/pr.js';

// Helper used by ghPrFanOut tests
function makeFakeGh(
  calls: string[],
  urlMap: Record<string, string>,
): (file: string, args: string[], opts: { cwd?: string; encoding: 'utf8' }) => string {
  return (file, args, opts) => {
    const cmd = [file, ...args].join(' ');
    calls.push(cmd);
    const cwd = opts.cwd ?? '';
    if (args[0] === 'auth') return ''; // gh auth status
    if (file === 'git' && args[0] === 'remote') return 'origin\n';
    if (args[1] === 'list') return '[]'; // gh pr list → no existing PR
    if (args[1] === 'create') {
      const url = urlMap[cwd];
      if (!url) throw new Error(`No URL mapped for cwd=${cwd}`);
      return url + '\n';
    }
    if (args[1] === 'edit') return ''; // gh pr edit (cross-link)
    return '';
  };
}

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

describe('ghPrFanOut — two-pass create-then-cross-link (FR-8)', () => {
  it('creates all PRs then cross-links each body to its siblings', () => {
    const calls: string[] = [];
    const exec = makeFakeGh(calls, {
      '/wt/api': 'https://x/api/1',
      '/wt/ui': 'https://x/ui/2',
    });
    const out = ghPrFanOut({
      repos: [
        { name: 'fake-api', path: '/wt/api', branch: 'b', baseBranch: 'main', title: 'P', description: 'a' },
        { name: 'fake-ui', path: '/wt/ui', branch: 'b', baseBranch: 'main', title: 'P', description: 'b' },
      ],
      exec,
    });
    expect(out).toEqual([
      { name: 'fake-api', pr_url: 'https://x/api/1' },
      { name: 'fake-ui', pr_url: 'https://x/ui/2' },
    ]);
    const createIdx = calls.filter(c => c.includes('pr create')).length;
    const editIdx = calls.findIndex(c => c.includes('pr edit'));
    const lastCreateIdx = calls.map(c => c.includes('pr create')).lastIndexOf(true);
    expect(createIdx).toBe(2);
    expect(editIdx).toBeGreaterThan(lastCreateIdx); // all creates precede the first cross-link edit
  });

  it('single repo produces one PR with no cross-link edit', () => {
    const calls: string[] = [];
    const exec = makeFakeGh(calls, { '/wt/api': 'https://x/api/1' });
    const out = ghPrFanOut({ repos: [{ name: 'fake-api', path: '/wt/api', branch: 'b', baseBranch: 'main', title: 'P', description: 'a' }], exec });
    expect(out).toEqual([{ name: 'fake-api', pr_url: 'https://x/api/1' }]);
    expect(calls.some(c => c.includes('pr edit'))).toBe(false);
  });
});
