import { describe, it, expect, vi } from 'vitest';
import { sourceControlInit } from '../../../src/commands/source-control/init.js';

const base = (over = {}) => ({
  readProjectRepos: () => ({ repos: ['rad-orc-source'], projectType: 'standard' as const }),
  readWorktreeFacts: () => ({ exists: true, branch: 'radorch/p', baseBranch: 'main', remoteUrl: 'https://github.com/o/r', compareUrl: 'https://github.com/o/r/compare/main...radorch/p' }),
  autoCommit: () => 'always' as const,
  autoPr: () => 'never' as const,
  readState: () => ({ pipeline: {} }),
  writeState: vi.fn(),
  ...over,
});

describe('sourceControlInit check + record (FR-7, FR-8, FR-9, FR-10, NFR-2)', () => {
  it('reads branch from the worktree as source of truth and records the v6 shape', () => {
    const writeState = vi.fn();
    const r = sourceControlInit({ project: 'P', ...base({ writeState }) });
    expect(r.ok).toBe(true);
    const written = (writeState.mock.calls[0]?.[1] as { pipeline: { source_control: { repos: { branch: string }[] } } });
    expect(written.pipeline.source_control.repos[0]?.branch).toBe('radorch/p');
  });
  it('fails loud naming the repo and the recovery command on a missing worktree', () => {
    const r = sourceControlInit({ project: 'P', ...base({ readWorktreeFacts: () => ({ exists: false }) }) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/rad-orc-source/);
    expect(r.error).toMatch(/worktree create --repo/);
  });
  it('re-derives identical state as an idempotent no-op', () => {
    const w1 = vi.fn(); sourceControlInit({ project: 'P', ...base({ writeState: w1 }) });
    const w2 = vi.fn(); sourceControlInit({ project: 'P', ...base({ writeState: w2 }) });
    expect(w1.mock.calls[0]?.[1]).toEqual(w2.mock.calls[0]?.[1]);
  });
  it('records the fixed side-project binding', () => {
    const writeState = vi.fn();
    sourceControlInit({ project: 'P', ...base({ readProjectRepos: () => ({ repos: ['P'], projectType: 'side-project' as const }), writeState }) });
    const sc = (writeState.mock.calls[0]?.[1] as { pipeline: { source_control: { auto_commit: string; auto_pr: string; repos: { branch: string; remote_url: string | null }[] } } }).pipeline.source_control;
    expect(sc.auto_commit).toBe('always');
    expect(sc.auto_pr).toBe('never');
    expect(sc.repos[0]?.branch).toBe('main');
    expect(sc.repos[0]?.remote_url).toBeNull();
  });
  it('rejects an in-place request against a multi-repo target as ambiguous', () => {
    const r = sourceControlInit({ project: 'P', inPlace: true, ...base({ readProjectRepos: () => ({ repos: ['a', 'b'], projectType: 'standard' as const }) }) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/in-place/i);
  });
});
