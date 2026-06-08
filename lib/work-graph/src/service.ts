import path from 'node:path';
import type { Edge, GraphDTO, Group, Node, NodeId, NodeStatus, Project, StoredGraph, WorktreeRef } from './types.js';
import { PROJECTION_SCHEMA } from './types.js';
import { GraphIndex } from './store.js';
import { WorkGraph } from './graph.js';
import { listProjectNames, projectExists, deriveProject } from './derive/projects.js';
import { resolveWorktrees as deriveWorktrees, type GitExec } from './derive/worktrees.js';
import { groupId } from './ids.js';
import { validateNewEdge, validateNewGroupId, GraphValidationError } from './validate.js';

export interface ServiceOpts { root: string; exec?: GitExec; }

export class WorkGraphService {
  private readonly index: GraphIndex;
  constructor(private readonly opts: ServiceOpts) { this.index = new GraphIndex(opts.root); }
  private projectsDir(): string { return path.join(this.opts.root, 'projects'); }
  private worktreesDir(): string { return path.join(this.opts.root, 'worktrees'); }

  private compose(): { graph: WorkGraph } {
    const stored = this.index.read();
    const deps = { projectsDir: this.projectsDir(), worktreesDir: this.worktreesDir(), exec: this.opts.exec };
    const projects = listProjectNames(this.projectsDir())
      .map((n) => deriveProject(n, deps)).filter((p): p is Project => !!p);
    const groups: Group[] = Object.entries(stored.groups)
      .map(([id, g]) => ({ id, kind: 'group', name: g.name, description: g.description, status: 'unknown' }));
    return { graph: new WorkGraph([...groups, ...projects], stored.edges) };
  }

  getGraph(scope?: { rootId?: NodeId; depth?: number }): GraphDTO {
    const { graph } = this.compose();
    let nodes = graph.allNodes();
    let edges = graph.edges;
    if (scope?.rootId) {
      const keep = this.descendants(graph, scope.rootId, scope.depth ?? Infinity);
      nodes = nodes.filter((n) => keep.has(n.id));
      edges = edges.filter((e) => keep.has(e.from) && keep.has(e.to));
    }
    return { schema: PROJECTION_SCHEMA, nodes, edges, danglingEdges: graph.danglingEdges };
  }
  private descendants(graph: WorkGraph, rootId: NodeId, depth: number): Set<NodeId> {
    const keep = new Set<NodeId>([rootId]);
    const walk = (id: NodeId, d: number) => {
      if (d <= 0) return;
      for (const c of graph.children(id)) { keep.add(c.id); walk(c.id, d - 1); }
    };
    walk(rootId, depth);
    return keep;
  }
  getNode(id: NodeId): Node | null { return this.compose().graph.node(id); }
  listProjects(filter?: { groupId?: NodeId; status?: NodeStatus }): Project[] {
    const { graph } = this.compose();
    let projects = graph.allNodes().filter((n): n is Project => n.kind === 'project');
    if (filter?.status) projects = projects.filter((p) => p.status === filter.status);
    if (filter?.groupId) {
      const members = new Set(graph.children(filter.groupId).map((c) => c.id));
      projects = projects.filter((p) => members.has(p.id));
    }
    return projects;
  }
  listGroups(): Group[] {
    return this.compose().graph.allNodes().filter((n): n is Group => n.kind === 'group');
  }
  resolveWorktrees(projectId: NodeId): WorktreeRef[] {
    return deriveWorktrees(projectId, { projectsDir: this.projectsDir(), worktreesDir: this.worktreesDir(), exec: this.opts.exec });
  }
  protected nodeExists(id: NodeId): boolean {
    return this.index.read().groups[id] !== undefined || projectExists(this.projectsDir(), id);
  }

  private validationCtx(stored: StoredGraph) {
    return { groups: stored.groups, edges: stored.edges, nodeExists: (id: NodeId) => this.nodeExists(id) };
  }

  createGroup(input: { name: string; description: string; parentId?: NodeId }): { node: Group; rev: number } {
    if (!input.description?.trim()) throw new GraphValidationError('a non-empty description is required');
    const stored = this.index.read();
    const id = groupId(input.name);
    validateNewGroupId(this.validationCtx(stored), id);
    stored.groups[id] = { name: input.name, description: input.description.trim() };
    if (input.parentId) {
      const edge: Edge = { type: 'contains', from: input.parentId, to: id };
      validateNewEdge({ groups: stored.groups, edges: stored.edges, nodeExists: (x) => x === id || this.nodeExists(x) }, edge);
      stored.edges.push(edge);
    }
    const next = this.index.write(stored, stored.rev);
    return { node: { id, kind: 'group', name: input.name, description: input.description.trim(), status: 'unknown' }, rev: next.rev };
  }

  updateGroup(id: NodeId, patch: { name?: string; description?: string }): { node: Group; rev: number } {
    const stored = this.index.read();
    const g = stored.groups[id];
    if (!g) throw new GraphValidationError(`group '${id}' does not exist`);
    if (patch.name !== undefined) g.name = patch.name;
    if (patch.description !== undefined) g.description = patch.description.trim();
    const next = this.index.write(stored, stored.rev);
    return { node: { id, kind: 'group', name: g.name, description: g.description, status: 'unknown' }, rev: next.rev };
  }

  deleteGroup(id: NodeId): { rev: number } {
    // Cascade the group's own contains edges (and any edge touching it); projects are never deleted.
    const stored = this.index.read();
    delete stored.groups[id];
    stored.edges = stored.edges.filter((e) => e.from !== id && e.to !== id);
    const next = this.index.write(stored, stored.rev);
    return { rev: next.rev };
  }

  addMember(groupId_: NodeId, nodeId: NodeId): { edge: Edge; rev: number } {
    return this.addEdge({ type: 'contains', from: groupId_, to: nodeId });
  }

  removeMember(groupId_: NodeId, nodeId: NodeId): { rev: number } {
    return this.removeEdge({ type: 'contains', from: groupId_, to: nodeId });
  }

  private addEdge(edge: Edge): { edge: Edge; rev: number } {
    const stored = this.index.read();
    validateNewEdge(this.validationCtx(stored), edge);
    stored.edges.push(edge);
    const next = this.index.write(stored, stored.rev);
    return { edge, rev: next.rev };
  }

  private removeEdge(edge: Edge): { rev: number } {
    const stored = this.index.read();
    stored.edges = stored.edges.filter((e) => !(e.type === edge.type && e.from === edge.from && e.to === edge.to));
    const next = this.index.write(stored, stored.rev);
    return { rev: next.rev };
  }
}
