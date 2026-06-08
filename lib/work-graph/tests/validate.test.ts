import { describe, it, expect } from 'vitest';
import { validateNewEdge, validateNewGroupId, GraphValidationError } from '../src/index.js';
import type { Edge } from '../src/index.js';

const ctx = (edges: Edge[], known: string[]) => ({
  groups: { 'group:a': { name: 'A', description: 'd' } },
  edges,
  nodeExists: (id: string) => known.includes(id),
});

describe('graph invariants', () => {
  const known = ['group:a', 'group:b', 'P1', 'P2'];
  it('rejects an edge whose endpoint does not resolve (referential integrity)', () => {
    expect(() => validateNewEdge(ctx([], known), { type: 'contains', from: 'group:a', to: 'GHOST' }))
      .toThrow(GraphValidationError);
  });
  it('rejects a duplicate edge and a second parent (single-parent containment)', () => {
    const edges: Edge[] = [{ type: 'contains', from: 'group:a', to: 'P1' }];
    expect(() => validateNewEdge(ctx(edges, known), { type: 'contains', from: 'group:a', to: 'P1' }))
      .toThrow(/duplicate/i);
    expect(() => validateNewEdge(ctx(edges, known), { type: 'contains', from: 'group:b', to: 'P1' }))
      .toThrow(/parent/i);
  });
  it('rejects a containment cycle but accepts unknown relationship edge types', () => {
    const edges: Edge[] = [{ type: 'contains', from: 'group:a', to: 'group:b' }];
    expect(() => validateNewEdge(ctx(edges, known), { type: 'contains', from: 'group:b', to: 'group:a' }))
      .toThrow(/cycle/i);
    expect(() => validateNewEdge(ctx(edges, known), { type: 'inspired-by', from: 'P1', to: 'P2' }))
      .not.toThrow();
  });
  it('rejects a colliding group id (unique group ids)', () => {
    expect(() => validateNewGroupId(ctx([], known), 'group:a')).toThrow(/exists/i);
    expect(() => validateNewGroupId(ctx([], known), 'group:c')).not.toThrow();
  });
});
