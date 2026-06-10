import { describe, it, expect } from 'vitest';
import { projectLocate } from '../../../src/commands/project/locate.js';

describe('project locate verb projection (FR-14, DD-5)', () => {
  it('projects kind/worktree_name/repo/projects/branch from the classifier', () => {
    const r = projectLocate({
      cwd: '/wt/MY-PROJ/rad-orc-source',
      locator: () => ({ kind: 'worktree', worktree_name: 'MY-PROJ', repo: 'rad-orc-source', projects: ['MY-PROJ'], branch: 'radorch/my-proj' }),
    });
    expect(r).toEqual({ kind: 'worktree', worktree_name: 'MY-PROJ', repo: 'rad-orc-source', projects: ['MY-PROJ'], branch: 'radorch/my-proj' });
  });
  it('returns kind=none with no optional fields when the cwd matches nothing', () => {
    const r = projectLocate({ cwd: '/elsewhere', locator: () => ({ kind: 'none' }) });
    expect(r.kind).toBe('none');
    expect(r.worktree_name).toBeUndefined();
  });
});
