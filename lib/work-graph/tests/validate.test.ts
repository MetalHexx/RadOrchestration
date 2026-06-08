import { describe, it, expect } from 'vitest';
import { validateNewEdge, validateNewGroupId } from '../src/validate.js';
import type { Edge } from '../src/index.js';

const ctx = (edges: Edge[], known: string[]) => ({
  groups: { 'group:a': { name: 'A', description: 'd' } },
  edges,
  nodeExists: (id: string) => known.includes(id),
});

describe('graph invariants', () => {
  const known = ['group:a', 'group:b', 'P1', 'P2'];
  it('rejects an edge whose endpoint does not resolve (referential integrity)', () => {
    const err = validateNewEdge(ctx([], known), { type: 'contains', from: 'group:a', to: 'GHOST' });
    expect(err?.code).toBe('validation');
    expect(err?.message).toMatch(/missing node/i);
  });
  it('rejects a duplicate edge and a second parent (single-parent containment)', () => {
    const edges: Edge[] = [{ type: 'contains', from: 'group:a', to: 'P1' }];
    const dup = validateNewEdge(ctx(edges, known), { type: 'contains', from: 'group:a', to: 'P1' });
    expect(dup?.code).toBe('validation');
    expect(dup?.message).toMatch(/duplicate/i);
    const secondParent = validateNewEdge(ctx(edges, known), { type: 'contains', from: 'group:b', to: 'P1' });
    expect(secondParent?.code).toBe('validation');
    expect(secondParent?.message).toMatch(/parent/i);
  });
  it('rejects a containment cycle but accepts unknown relationship edge types', () => {
    const edges: Edge[] = [{ type: 'contains', from: 'group:a', to: 'group:b' }];
    const cycle = validateNewEdge(ctx(edges, known), { type: 'contains', from: 'group:b', to: 'group:a' });
    expect(cycle?.code).toBe('validation');
    expect(cycle?.message).toMatch(/cycle/i);
    expect(validateNewEdge(ctx(edges, known), { type: 'inspired-by', from: 'P1', to: 'P2' })).toBeNull();
  });
  it('rejects a colliding group id (unique group ids)', () => {
    const collision = validateNewGroupId(ctx([], known), 'group:a');
    expect(collision?.code).toBe('validation');
    expect(collision?.message).toMatch(/exists/i);
    expect(validateNewGroupId(ctx([], known), 'group:c')).toBeNull();
  });
});
