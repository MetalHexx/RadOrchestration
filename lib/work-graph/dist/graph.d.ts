import type { Node, NodeId, Edge, EdgeType, NodeStatus } from './types.js';
export declare class WorkGraph {
    private nodes;
    readonly edges: Edge[];
    readonly danglingEdges: Edge[];
    constructor(nodes: Node[], edges: Edge[]);
    allNodes(): Node[];
    node(id: NodeId): Node | null;
    children(id: NodeId): Node[];
    parents(id: NodeId): Node[];
    related(id: NodeId, type?: EdgeType): Edge[];
    rollupStatus(id: NodeId): NodeStatus;
}
