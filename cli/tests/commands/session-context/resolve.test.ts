import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveYouAreIn } from '../../../src/commands/session-context/resolve.js';
import { within } from '@rad-orchestration/work-graph';

describe('you-are-in resolver', () => {
  const active = [
    { name: 'MULTI-REPO-3', worktrees: [{ path: '/wt/MULTI-REPO-3/api' }, { path: '/wt/MULTI-REPO-3/ui' }] },
    { name: 'OTHER', worktrees: [{ path: '/wt/OTHER' }] },
  ];
  it('names the project when cwd sits inside one of its worktrees', () => {
    expect(resolveYouAreIn({ cwd: '/wt/MULTI-REPO-3/api/src', active })).toBe('MULTI-REPO-3');
  });
  it('returns undefined when cwd is outside every active worktree', () => {
    expect(resolveYouAreIn({ cwd: '/somewhere/else', active })).toBeUndefined();
  });
});

describe('resolveYouAreIn re-expressed on locate (FR-15)', () => {
  it('returns the active project whose worktree contains the cwd', () => {
    const wt = path.join('/wt', 'MY-PROJ', 'repo');
    const name = resolveYouAreIn({
      cwd: path.join(wt, 'src'),
      active: [{ name: 'MY-PROJ', worktrees: [{ path: wt }] }],
    });
    expect(name).toBe('MY-PROJ');
  });
  it('reuses the library within() helper for containment', () => {
    expect(within('/a/b', '/a/b/c')).toBe(true);
    expect(within('/a/b', '/a/x')).toBe(false);
  });
});
