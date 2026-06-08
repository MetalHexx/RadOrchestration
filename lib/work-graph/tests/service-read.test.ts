import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkGraphService, GraphIndex } from '../src/index.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
  const mk = (name: string, tier: string, st: string) => {
    const dir = path.join(root, 'projects', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
      project: { name }, pipeline: { current_tier: tier, source_control: null },
      graph: { nodes: { a: { status: st } } } }));
  };
  mk('MR-1', 'review', 'completed');
  mk('MR-2', 'execution', 'in_progress');
  new GraphIndex(root).write({ version: 1, rev: 0,
    groups: { 'group:mr': { name: 'MR', description: 'the initiative' } },
    edges: [{ type: 'contains', from: 'group:mr', to: 'MR-1' }, { type: 'contains', from: 'group:mr', to: 'MR-2' }] }, 0);
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('WorkGraphService reads', () => {
  const svc = () => new WorkGraphService({ root, exec: () => '' });
  it('getGraph returns the versioned projection with nodes, edges, danglingEdges', () => {
    const g = svc().getGraph();
    expect(g.schema).toBe('work-graph/v1');
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['MR-1', 'MR-2', 'group:mr']);
    expect(g.danglingEdges).toEqual([]);
    expect(g.nodes.find((n) => n.id === 'group:mr')?.status).toBe('in_progress');
  });
  it('listProjects --status in_progress returns the active set', () => {
    expect(svc().listProjects({ status: 'in_progress' }).map((p) => p.id)).toEqual(['MR-2']);
  });
  it('getNode returns a group rollup and a derived project', () => {
    expect(svc().getNode('group:mr')?.kind).toBe('group');
    expect(svc().getNode('MR-1')?.kind).toBe('project');
    expect(svc().getNode('GHOST')).toBeNull();
  });
});
