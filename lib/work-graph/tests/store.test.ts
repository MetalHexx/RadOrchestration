import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GraphIndex } from '../src/store.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('GraphIndex overlay store', () => {
  it('reads empty defaults when the store file is absent', () => {
    const stored = new GraphIndex(root).read();
    expect(stored).toEqual({ version: 1, rev: 0, groups: {}, edges: [] });
  });
  it('persists atomically, bumps rev, and round-trips groups + edges', () => {
    const idx = new GraphIndex(root);
    const res = idx.write({ version: 1, rev: 0,
      groups: { 'group:multi-repo': { name: 'MULTI-REPO', description: 'the initiative' } },
      edges: [{ type: 'contains', from: 'group:multi-repo', to: 'MULTI-REPO-3' }] }, 0);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected a successful write');
    expect(res.data.rev).toBe(1);
    expect(fs.existsSync(path.join(root, 'work-graph.yml.tmp'))).toBe(false);
    const reread = idx.read();
    expect(reread.rev).toBe(1);
    expect(reread.groups['group:multi-repo'].name).toBe('MULTI-REPO');
    expect(reread.edges[0]).toEqual({ type: 'contains', from: 'group:multi-repo', to: 'MULTI-REPO-3' });
  });
  it('rejects a stale revision (compare-and-swap) without writing', () => {
    const idx = new GraphIndex(root);
    idx.write({ version: 1, rev: 0, groups: {}, edges: [] }, 0); // store now at rev 1
    const r = idx.write({ version: 1, rev: 0, groups: {}, edges: [] }, 0);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected a stale-revision failure');
    expect(r.error.code).toBe('stale_revision');
    expect(idx.read().rev).toBe(1); // unchanged — nothing was written
  });
});
