import type { Edge, NodeId } from './types.js';

export interface PruneResult { kept: Edge[]; removed: Edge[]; }

export function pruneEdges(edges: Edge[], nodeExists: (id: NodeId) => boolean): PruneResult {
  const kept: Edge[] = [];
  const removed: Edge[] = [];
  for (const e of edges) {
    if (nodeExists(e.from) && nodeExists(e.to)) kept.push(e);
    else removed.push(e);
  }
  return { kept, removed };
}
