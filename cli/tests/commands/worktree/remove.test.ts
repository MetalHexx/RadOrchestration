import { describe, it, expect, vi } from 'vitest';
import { removeWorktrees } from '../../../src/commands/worktree/remove.js';

describe('removeWorktrees lifecycle (FR-5, AD-10)', () => {
  const base = (over = {}) => ({
    worktreesDir: '/wt',
    readProjectRepos: () => ({ repos: ['a', 'b'], projectType: 'standard' as const }),
    worktreeName: () => 'P',
    resolveClonePath: (r: string) => `/clones/${r}`,
    dependents: () => [],
    exec: vi.fn(() => ''),
    ...over,
  });
  it('removes every repo in the set by default', () => {
    const exec = vi.fn(() => '');
    const r = removeWorktrees({ project: 'P', ...base({ exec }) });
    expect(r.repos.map((x) => x.name)).toEqual(['a', 'b']);
    expect(exec).toHaveBeenCalledTimes(2);
  });
  it('scopes to a single repo with --repo', () => {
    const exec = vi.fn(() => '');
    const r = removeWorktrees({ project: 'P', repo: 'a', ...base({ exec }) });
    expect(r.repos.map((x) => x.name)).toEqual(['a']);
    expect(exec).toHaveBeenCalledTimes(1);
  });
  it('surfaces a shared-worktree_name dependent as a warning', () => {
    const r = removeWorktrees({ project: 'P', ...base({ dependents: () => ['FOLLOWUP'] }) });
    expect(r.warnings.some((w) => w.includes('FOLLOWUP'))).toBe(true);
  });
  it('throws naming the bad repo and listing the valid set when --repo is not in the project', () => {
    const exec = vi.fn(() => '');
    expect(() => removeWorktrees({ project: 'P', repo: 'nope', ...base({ exec }) }))
      .toThrow(/nope/);
    expect(() => removeWorktrees({ project: 'P', repo: 'nope', ...base({ exec }) }))
      .toThrow(/\ba\b.*\bb\b/);
    expect(exec).not.toHaveBeenCalled();
  });
});
