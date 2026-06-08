import { combineStatuses } from './derive/status.js';
export class WorkGraph {
    nodes = new Map();
    edges = [];
    danglingEdges = [];
    constructor(nodes, edges) {
        for (const n of nodes)
            this.nodes.set(n.id, n);
        for (const e of edges) {
            if (this.nodes.has(e.from) && this.nodes.has(e.to))
                this.edges.push(e);
            else
                this.danglingEdges.push(e);
        }
        for (const n of this.nodes.values())
            if (n.kind === 'group')
                n.status = this.rollupStatus(n.id);
    }
    allNodes() { return [...this.nodes.values()]; }
    node(id) { return this.nodes.get(id) ?? null; }
    children(id) {
        return this.edges.filter((e) => e.type === 'contains' && e.from === id)
            .map((e) => this.nodes.get(e.to)).filter((n) => !!n);
    }
    parents(id) {
        return this.edges.filter((e) => e.type === 'contains' && e.to === id)
            .map((e) => this.nodes.get(e.from)).filter((n) => !!n);
    }
    related(id, type) {
        return this.edges.filter((e) => e.type !== 'contains'
            && (e.from === id || e.to === id) && (!type || e.type === type));
    }
    rollupStatus(id) {
        const n = this.nodes.get(id);
        if (!n)
            return 'unknown';
        if (n.kind === 'project')
            return n.status;
        return combineStatuses(this.children(id).map((c) => this.rollupStatus(c.id)));
    }
}
//# sourceMappingURL=graph.js.map