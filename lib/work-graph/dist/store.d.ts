import type { Result, StoredGraph } from './types.js';
export declare class GraphIndex {
    private readonly root;
    constructor(root: string);
    private get file();
    read(): StoredGraph;
    write(graph: StoredGraph, expectedRev: number): Result<StoredGraph>;
}
