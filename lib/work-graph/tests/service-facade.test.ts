import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkGraphService, GraphIndex, GraphValidationError } from '../src/index.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-facade-'));
  // Seed one project so derived-project lookups work
  const dir = path.join(root, 'projects', 'MR-1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({ project: { name: 'MR-1' }, graph: { nodes: {} } }),
  );
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('WorkGraphService facade — deleteGroup guard (AD-4)', () => {
  it('throws GraphValidationError for a non-existent group and leaves rev unchanged', () => {
    const s = new WorkGraphService({ root, exec: () => '' });
    const revBefore = new GraphIndex(root).read().rev;
    expect(() => s.deleteGroup('group:does-not-exist')).toThrow(GraphValidationError);
    const revAfter = new GraphIndex(root).read().rev;
    expect(revAfter).toBe(revBefore);
  });
});

describe('WorkGraphService facade — coverage (FR-4, FR-6, NFR-5)', () => {
  it('updateGroup patches name and description and bumps rev', () => {
    const s = new WorkGraphService({ root, exec: () => '' });
    const { rev: revCreate } = s.createGroup({ name: 'Multi Repo', description: 'original desc' });
    const { node, rev: revUpdate } = s.updateGroup('group:multi-repo', {
      name: 'Multi Repo Updated',
      description: 'updated desc',
    });
    expect(node.name).toBe('Multi Repo Updated');
    expect(node.description).toBe('updated desc');
    expect(revUpdate).toBeGreaterThan(revCreate);
  });

  it('removeMember removes the contains edge and bumps rev', () => {
    const s = new WorkGraphService({ root, exec: () => '' });
    s.createGroup({ name: 'MR', description: 'the group' });
    s.addMember('group:mr', 'MR-1');
    const { rev } = s.removeMember('group:mr', 'MR-1');
    const stored = new GraphIndex(root).read();
    const containsEdge = stored.edges.find(
      (e) => e.type === 'contains' && e.from === 'group:mr' && e.to === 'MR-1',
    );
    expect(containsEdge).toBeUndefined();
    expect(rev).toBe(stored.rev);
  });

  it('listGroups returns the seeded groups by id', () => {
    const s = new WorkGraphService({ root, exec: () => '' });
    s.createGroup({ name: 'Alpha', description: 'first group' });
    s.createGroup({ name: 'Beta', description: 'second group' });
    const groups = s.listGroups();
    const ids = groups.map((g) => g.id).sort();
    expect(ids).toContain('group:alpha');
    expect(ids).toContain('group:beta');
  });

  it('resolveWorktrees returns an array (smoke test with exec stub)', () => {
    const s = new WorkGraphService({ root, exec: () => '' });
    const result = s.resolveWorktrees('MR-1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('getGraph({ rootId, depth }) returns only the root group and its depth-1 descendant', () => {
    const s = new WorkGraphService({ root, exec: () => '' });
    s.createGroup({ name: 'Scoped', description: 'scoped group' });
    s.addMember('group:scoped', 'MR-1');
    const dto = s.getGraph({ rootId: 'group:scoped', depth: 1 });
    const ids = dto.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['MR-1', 'group:scoped'].sort());
  });
});
