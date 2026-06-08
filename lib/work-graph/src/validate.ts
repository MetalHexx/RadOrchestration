import type { Edge, NodeId, StoredGroup } from './types.js';

export class GraphValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'GraphValidationError'; }
}

export interface ValidationContext {
  groups: Record<string, StoredGroup>;
  edges: Edge[];
  nodeExists: (id: NodeId) => boolean;
}

function wouldCreateCycle(edges: Edge[], edge: Edge): boolean {
  if (edge.from === edge.to) return true;
  const adj = new Map<NodeId, NodeId[]>();
  for (const e of edges) if (e.type === 'contains') {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const stack = [edge.to]; const seen = new Set<NodeId>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === edge.from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

export function validateNewEdge(ctx: ValidationContext, edge: Edge): void {
  if (!ctx.nodeExists(edge.from)) throw new GraphValidationError(`edge 'from' references a missing node: ${edge.from}`);
  if (!ctx.nodeExists(edge.to)) throw new GraphValidationError(`edge 'to' references a missing node: ${edge.to}`);
  if (ctx.edges.some((e) => e.type === edge.type && e.from === edge.from && e.to === edge.to)) {
    throw new GraphValidationError(`duplicate edge ${edge.type} ${edge.from}->${edge.to}`);
  }
  if (edge.type === 'contains') {
    if (ctx.edges.some((e) => e.type === 'contains' && e.to === edge.to)) {
      throw new GraphValidationError(`node '${edge.to}' already has a parent (single-parent containment)`);
    }
    if (wouldCreateCycle(ctx.edges, edge)) {
      throw new GraphValidationError(`containment edge ${edge.from}->${edge.to} would create a cycle`);
    }
  }
}

export function validateNewGroupId(ctx: ValidationContext, id: NodeId): void {
  if (ctx.groups[id]) throw new GraphValidationError(`group id '${id}' already exists`);
}
