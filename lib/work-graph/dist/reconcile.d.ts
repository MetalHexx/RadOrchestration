import type { Edge, NodeId } from './types.js';
export interface PruneResult {
    kept: Edge[];
    removed: Edge[];
}
export declare function pruneEdges(edges: Edge[], nodeExists: (id: NodeId) => boolean): PruneResult;
