import path from 'node:path';
import { PROJECTION_SCHEMA } from './types.js';
import { GraphIndex } from './store.js';
import { WorkGraph } from './graph.js';
import { listProjectNames, projectExists, deriveProject } from './derive/projects.js';
import { resolveWorktrees as deriveWorktrees } from './derive/worktrees.js';
import { groupId } from './ids.js';
import { validateNewEdge, validateNewGroupId } from './validate.js';
import { pruneEdges } from './reconcile.js';
/**
 * WorkGraphService
 *
 * The library keeps its own default (`<root>/worktrees`) for package independence,
 * but accepts the CLI's `userDataPaths().worktrees` as the authoritative override (NFR-7).
 * The `resolveWorktrees` legacy single-`worktree_path` branch stays as the bridge
 * for existing projects (AD-9).
 */
export class WorkGraphService {
    opts;
    index;
    constructor(opts) {
        this.opts = opts;
        this.index = new GraphIndex(opts.root);
    }
    projectsDir() { return path.join(this.opts.root, 'projects'); }
    worktreesDir() { return this.opts.worktreesDir ?? path.join(this.opts.root, 'worktrees'); }
    compose() {
        const stored = this.index.read();
        const deps = { projectsDir: this.projectsDir(), worktreesDir: this.worktreesDir(), exec: this.opts.exec };
        const projects = listProjectNames(this.projectsDir())
            .map((n) => deriveProject(n, deps)).filter((p) => !!p);
        const groups = Object.entries(stored.groups)
            .map(([id, g]) => ({ id, kind: 'group', name: g.name, description: g.description, status: 'unknown' }));
        return { graph: new WorkGraph([...groups, ...projects], stored.edges) };
    }
    getGraph(scope) {
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
    descendants(graph, rootId, depth) {
        const keep = new Set([rootId]);
        const walk = (id, d) => {
            if (d <= 0)
                return;
            for (const c of graph.children(id)) {
                keep.add(c.id);
                walk(c.id, d - 1);
            }
        };
        walk(rootId, depth);
        return keep;
    }
    getNode(id) { return this.compose().graph.node(id); }
    listProjects(filter) {
        const { graph } = this.compose();
        let projects = graph.allNodes().filter((n) => n.kind === 'project');
        if (filter?.status)
            projects = projects.filter((p) => p.status === filter.status);
        if (filter?.groupId) {
            const members = new Set(graph.children(filter.groupId).map((c) => c.id));
            projects = projects.filter((p) => members.has(p.id));
        }
        return projects;
    }
    listGroups() {
        return this.compose().graph.allNodes().filter((n) => n.kind === 'group');
    }
    resolveWorktrees(projectId) {
        return deriveWorktrees(projectId, { projectsDir: this.projectsDir(), worktreesDir: this.worktreesDir(), exec: this.opts.exec });
    }
    nodeExists(id) {
        return this.index.read().groups[id] !== undefined || projectExists(this.projectsDir(), id);
    }
    validationCtx(stored) {
        return { groups: stored.groups, edges: stored.edges, nodeExists: (id) => this.nodeExists(id) };
    }
    createGroup(input) {
        if (!input.description?.trim())
            return { ok: false, error: { code: 'validation', message: 'a non-empty description is required' } };
        const stored = this.index.read();
        const id = groupId(input.name);
        const idError = validateNewGroupId(this.validationCtx(stored), id);
        if (idError)
            return { ok: false, error: idError };
        stored.groups[id] = { name: input.name, description: input.description.trim() };
        if (input.parentId) {
            const edge = { type: 'contains', from: input.parentId, to: id };
            const edgeError = validateNewEdge({ groups: stored.groups, edges: stored.edges, nodeExists: (x) => x === id || this.nodeExists(x) }, edge);
            if (edgeError)
                return { ok: false, error: edgeError };
            stored.edges.push(edge);
        }
        const written = this.index.write(stored, stored.rev);
        if (!written.ok)
            return written;
        return { ok: true, data: { node: { id, kind: 'group', name: input.name, description: input.description.trim(), status: 'unknown' }, rev: written.data.rev } };
    }
    updateGroup(id, patch) {
        const stored = this.index.read();
        const g = stored.groups[id];
        if (!g)
            return { ok: false, error: { code: 'validation', message: `group '${id}' does not exist` } };
        if (patch.description !== undefined && !patch.description.trim())
            return { ok: false, error: { code: 'validation', message: 'a non-empty description is required' } };
        if (patch.name !== undefined)
            g.name = patch.name;
        if (patch.description !== undefined)
            g.description = patch.description.trim();
        const written = this.index.write(stored, stored.rev);
        if (!written.ok)
            return written;
        return { ok: true, data: { node: { id, kind: 'group', name: g.name, description: g.description, status: 'unknown' }, rev: written.data.rev } };
    }
    deleteGroup(id) {
        const stored = this.index.read();
        if (!stored.groups[id])
            return { ok: false, error: { code: 'validation', message: `group '${id}' does not exist` } };
        // Cascade the group's own contains edges (and any edge touching it); projects are never deleted.
        delete stored.groups[id];
        stored.edges = stored.edges.filter((e) => e.from !== id && e.to !== id);
        const written = this.index.write(stored, stored.rev);
        if (!written.ok)
            return written;
        return { ok: true, data: { rev: written.data.rev } };
    }
    addMember(groupId_, nodeId) {
        return this.addEdge({ type: 'contains', from: groupId_, to: nodeId });
    }
    removeMember(groupId_, nodeId) {
        return this.removeEdge({ type: 'contains', from: groupId_, to: nodeId });
    }
    addEdge(edge) {
        const stored = this.index.read();
        const error = validateNewEdge(this.validationCtx(stored), edge);
        if (error)
            return { ok: false, error };
        stored.edges.push(edge);
        const written = this.index.write(stored, stored.rev);
        if (!written.ok)
            return written;
        return { ok: true, data: { edge, rev: written.data.rev } };
    }
    removeEdge(edge) {
        const stored = this.index.read();
        stored.edges = stored.edges.filter((e) => !(e.type === edge.type && e.from === edge.from && e.to === edge.to));
        const written = this.index.write(stored, stored.rev);
        if (!written.ok)
            return written;
        return { ok: true, data: { rev: written.data.rev } };
    }
    link(from, to, type) {
        return this.addEdge({ type, from, to });
    }
    unlink(from, to, type) {
        return this.removeEdge({ type, from, to });
    }
    prune() {
        const stored = this.index.read();
        const { kept, removed } = pruneEdges(stored.edges, (id) => this.nodeExists(id));
        if (removed.length === 0)
            return { ok: true, data: { removed: [], rev: stored.rev } };
        stored.edges = kept;
        const written = this.index.write(stored, stored.rev);
        if (!written.ok)
            return written;
        return { ok: true, data: { removed, rev: written.data.rev } };
    }
}
//# sourceMappingURL=service.js.map