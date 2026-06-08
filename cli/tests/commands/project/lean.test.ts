import { describe, it, expect } from 'vitest';
import { toLeanProject, renderProjectTable, renderProjectCard } from '../../../src/commands/project/lean.js';
import type { GraphDTO, Project } from '@rad-orchestration/work-graph';

const project: Project = {
  id: 'MR-3', kind: 'project', name: 'MR-3', status: 'done', tier: 'review',
  projectType: 'standard', sourceControlInitialized: true, dir: 'C:/p/MR-3',
  docs: { requirements: 'MR-3-REQUIREMENTS.md', others: [] },
  worktrees: [{ repo: 'rad-orc-source', path: 'C:/w/MR-3', branch: 'b', exists: true, resolvedVia: 'convention' }],
};
const graph: GraphDTO = { schema: 'work-graph/v1', nodes: [project],
  edges: [{ type: 'follows', from: 'MR-3', to: 'MR-2' }, { type: 'spawned-from', from: 'MR-3-SIDE', to: 'MR-3' }],
  danglingEdges: [] };

describe('lean project curation', () => {
  it('drops plumbing, keeps parity fields, and digests edges into group + related', () => {
    const lean = toLeanProject(project, graph);
    expect(lean).not.toHaveProperty('kind');
    expect(lean).not.toHaveProperty('id'); // id equals name → dropped
    expect(lean.name).toBe('MR-3');
    expect(lean.sourceControlInitialized).toBe(true);            // actionable parity field kept
    expect(lean.worktrees[0]).not.toHaveProperty('resolvedVia'); // plumbing dropped
    expect(lean.worktrees[0].exists).toBe(true);                 // actionable parity field kept
    expect(lean.related).toEqual({ follows: 'MR-2', spawned: ['MR-3-SIDE'] });
  });
  it('renders a human table and a human detail card', () => {
    expect(renderProjectTable([project])).toMatch(/MR-3\s+done\s+review/);
    expect(renderProjectCard(toLeanProject(project, graph))).toMatch(/MR-3/);
  });
});
