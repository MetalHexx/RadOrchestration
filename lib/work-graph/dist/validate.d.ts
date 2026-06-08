import type { Edge, NodeId, StoredGroup, WorkGraphError } from './types.js';
export interface ValidationContext {
    groups: Record<string, StoredGroup>;
    edges: Edge[];
    nodeExists: (id: NodeId) => boolean;
}
/** Returns a validation error describing the rejection, or `null` when the edge is acceptable. */
export declare function validateNewEdge(ctx: ValidationContext, edge: Edge): WorkGraphError | null;
/** Returns a validation error when the group id already exists, or `null` when it is free. */
export declare function validateNewGroupId(ctx: ValidationContext, id: NodeId): WorkGraphError | null;
