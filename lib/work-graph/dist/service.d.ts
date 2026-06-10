import type { Edge, EdgeType, GraphDTO, Group, Node, NodeId, NodeStatus, Project, Result, WorktreeRef } from './types.js';
import { type GitExec } from './derive/worktrees.js';
export interface ServiceOpts {
    root: string;
    exec?: GitExec;
    worktreesDir?: string;
}
/**
 * WorkGraphService
 *
 * The library keeps its own default (`<root>/worktrees`) for package independence,
 * but accepts the CLI's `userDataPaths().worktrees` as the authoritative override (NFR-7).
 * The `resolveWorktrees` legacy single-`worktree_path` branch stays as the bridge
 * for existing projects (AD-9).
 */
export declare class WorkGraphService {
    private readonly opts;
    private readonly index;
    constructor(opts: ServiceOpts);
    private projectsDir;
    private worktreesDir;
    private compose;
    getGraph(scope?: {
        rootId?: NodeId;
        depth?: number;
    }): GraphDTO;
    private descendants;
    getNode(id: NodeId): Node | null;
    listProjects(filter?: {
        groupId?: NodeId;
        status?: NodeStatus;
    }): Project[];
    listGroups(): Group[];
    resolveWorktrees(projectId: NodeId): WorktreeRef[];
    private nodeExists;
    private validationCtx;
    createGroup(input: {
        name: string;
        description: string;
        parentId?: NodeId;
    }): Result<{
        node: Group;
        rev: number;
    }>;
    updateGroup(id: NodeId, patch: {
        name?: string;
        description?: string;
    }): Result<{
        node: Group;
        rev: number;
    }>;
    deleteGroup(id: NodeId): Result<{
        rev: number;
    }>;
    addMember(groupId_: NodeId, nodeId: NodeId): Result<{
        edge: Edge;
        rev: number;
    }>;
    removeMember(groupId_: NodeId, nodeId: NodeId): Result<{
        rev: number;
    }>;
    private addEdge;
    private removeEdge;
    link(from: NodeId, to: NodeId, type: EdgeType): Result<{
        edge: Edge;
        rev: number;
    }>;
    unlink(from: NodeId, to: NodeId, type: EdgeType): Result<{
        rev: number;
    }>;
    prune(): Result<{
        removed: Edge[];
        rev: number;
    }>;
}
