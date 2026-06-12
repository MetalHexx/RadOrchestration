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
  it('propagates in_place: true from RepoInput onto the repos[] entry (FR-10, NFR-1)', () => {
    const reposWithInPlace = [
      { name: 'rad-orc-source', branch: 'feature-x', base_branch: 'main', remote_url: null, compare_url: null, pr_url: null, in_place: true },
    ];
    const sc = buildSourceControlState({ worktreeName: 'P', autoCommit: 'always', autoPr: 'never', repos: reposWithInPlace });
    expect(sc.repos[0]?.in_place).toBe(true);
  });
  it('does not set in_place on a repo entry without the flag', () => {
    const sc = buildSourceControlState({ worktreeName: 'P', autoCommit: 'always', autoPr: 'never', repos });
    expect(sc.repos[0]?.in_place).toBeUndefined();
  });
});

describe('buildSourceControlState — compat shim removed (FR-20)', () => {
  it('emits no top-level worktree_path / branch / base_branch mirror fields', () => {
    const sc = buildSourceControlState({
      worktreeName: 'MR-5',
      autoCommit: 'always',
      autoPr: 'never',
      repos: [{ name: 'rad-orc-source', branch: 'radorch/p', base_branch: 'main', remote_url: null, compare_url: null, pr_url: null }],
    });
    expect(sc).not.toHaveProperty('worktree_path');
    expect(sc).not.toHaveProperty('branch');
    expect(sc).not.toHaveProperty('base_branch');
    expect(sc.worktree_name).toBe('MR-5');
    expect(sc.repos[0]).not.toHaveProperty('path');
    expect(sc.repos[0]).toMatchObject({ name: 'rad-orc-source', branch: 'radorch/p', base_branch: 'main' });
  });
});
