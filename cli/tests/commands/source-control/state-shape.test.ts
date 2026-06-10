import { describe, it, expect } from 'vitest';
import { buildSourceControlState } from '../../../src/commands/source-control/state-shape.js';

describe('v6 source-control state shape + compat shim (FR-11, NFR-3, AD-3)', () => {
  const repos = [
    { name: 'rad-orc-source', branch: 'radorch/p', base_branch: 'main', remote_url: 'https://github.com/o/r', compare_url: 'https://github.com/o/r/compare/main...radorch/p', pr_url: null },
  ];
  it('keeps auto_commit/auto_pr/worktree_name top-level and per-repo facts in repos[]', () => {
    const sc = buildSourceControlState({ worktreeName: 'P', autoCommit: 'always', autoPr: 'never', repos });
    expect(sc.worktree_name).toBe('P');
    expect(sc.auto_commit).toBe('always');
    expect(sc.repos[0]).toMatchObject({ name: 'rad-orc-source', branch: 'radorch/p', base_branch: 'main' });
  });
  it('stores no repos[].path (state stays path-free)', () => {
    const sc = buildSourceControlState({ worktreeName: 'P', autoCommit: 'always', autoPr: 'never', repos });
    expect('path' in (sc.repos[0] as object)).toBe(false);
  });
  it('writes the three compat fields from repos[0] (worktree_path, branch, base_branch)', () => {
    const sc = buildSourceControlState({ worktreeName: 'P', autoCommit: 'always', autoPr: 'never', repos, worktreePath: '/wt/P/rad-orc-source' });
    expect(sc.worktree_path).toBe('/wt/P/rad-orc-source');
    expect(sc.branch).toBe('radorch/p');
    expect(sc.base_branch).toBe('main');
  });
});
