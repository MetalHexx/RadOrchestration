import { describe, it, expect } from 'vitest';
import { resolveYouAreIn } from '../../../src/commands/session-context/resolve.js';

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
