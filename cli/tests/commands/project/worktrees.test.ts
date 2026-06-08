import { describe, it, expect } from 'vitest';
import { buildWorktreesResult } from '../../../src/commands/project/worktrees.js';
import type { WorktreeRef } from '@rad-orchestration/work-graph';

describe('project worktrees result shaping', () => {
  it('returns the actionable per-worktree fields and drops resolvedVia plumbing', () => {
    const refs: WorktreeRef[] = [
      { repo: 'rad-orc-source', path: 'C:/w/MR-3/rad-orc-source', branch: 'feature/x', exists: true, resolvedVia: 'convention' },
    ];
    expect(buildWorktreesResult('MR-3', refs)).toEqual({
      name: 'MR-3',
      worktrees: [{ repo: 'rad-orc-source', path: 'C:/w/MR-3/rad-orc-source', branch: 'feature/x', exists: true }],
    });
  });
});
