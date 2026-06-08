import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkGraphService } from '../src/index.js';
import { GraphIndex } from '../src/store.js';
import type { Result } from '../src/index.js';

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got error ${r.error.code}: ${r.error.message}`);
  return r.data;
}

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-'));
  for (const name of ['MR-1', 'MR-2']) {
    const dir = path.join(root, 'projects', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ project: { name }, graph: { nodes: {} } }));
  }
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('WorkGraphService relationships and prune', () => {
  const svc = () => new WorkGraphService({ root, exec: () => '' });
  it('links a typed relationship edge (including unknown types) and unlinks it', () => {
    const s = svc();
    expect(unwrap(s.link('MR-2', 'MR-1', 'follows')).rev).toBe(1);
    expect(unwrap(s.link('MR-2', 'MR-1', 'inspired-by')).rev).toBe(2); // unknown type accepted
    expect(s.getGraph().edges).toHaveLength(2);
    unwrap(s.unlink('MR-2', 'MR-1', 'follows'));
    expect(s.getGraph().edges.map((e) => e.type)).toEqual(['inspired-by']);
  });
  it('prune persists removal of edges whose endpoints no longer resolve', () => {
    new GraphIndex(root).write({ version: 1, rev: 0, groups: {},
      edges: [{ type: 'follows', from: 'MR-2', to: 'MR-1' }, { type: 'spawned-from', from: 'MR-X', to: 'MR-1' }] }, 0);
    const s = svc();
    expect(s.getGraph().danglingEdges).toHaveLength(1); // MR-X missing
    const out = unwrap(s.prune());
    expect(out.removed).toEqual([{ type: 'spawned-from', from: 'MR-X', to: 'MR-1' }]);
    expect(new GraphIndex(root).read().edges).toEqual([{ type: 'follows', from: 'MR-2', to: 'MR-1' }]);
  });
});
