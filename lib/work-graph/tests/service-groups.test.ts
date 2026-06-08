import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkGraphService, GraphValidationError } from '../src/index.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
  const dir = path.join(root, 'projects', 'MR-1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ project: { name: 'MR-1' }, graph: { nodes: {} } }));
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('WorkGraphService structure writes', () => {
  const svc = () => new WorkGraphService({ root, exec: () => '' });
  it('creates a group with a derived id and bumps rev, rejecting an empty description', () => {
    const s = svc();
    const out = s.createGroup({ name: 'Multi Repo', description: 'the initiative' });
    expect(out.node.id).toBe('group:multi-repo');
    expect(out.rev).toBe(1);
    expect(() => s.createGroup({ name: 'X', description: '  ' })).toThrow(/description/i);
  });
  it('adds a member via a contains edge and rejects a member that is not a real node', () => {
    const s = svc();
    s.createGroup({ name: 'MR', description: 'd' });
    const out = s.addMember('group:mr', 'MR-1');
    expect(out.rev).toBe(2);
    expect(s.getNode('group:mr') && s.listProjects({ groupId: 'group:mr' }).map((p) => p.id)).toEqual(['MR-1']);
    expect(() => s.addMember('group:mr', 'GHOST')).toThrow(GraphValidationError);
  });
  it('deletes a group, cascading its contains edges and never deleting projects', () => {
    const s = svc();
    s.createGroup({ name: 'MR', description: 'd' });
    s.addMember('group:mr', 'MR-1');
    s.deleteGroup('group:mr');
    expect(s.getNode('group:mr')).toBeNull();
    expect(s.getNode('MR-1')?.kind).toBe('project'); // project survives
  });
});
