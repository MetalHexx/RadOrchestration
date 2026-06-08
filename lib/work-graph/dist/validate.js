function wouldCreateCycle(edges, edge) {
    if (edge.from === edge.to)
        return true;
    const adj = new Map();
    for (const e of edges)
        if (e.type === 'contains') {
            if (!adj.has(e.from))
                adj.set(e.from, []);
            adj.get(e.from).push(e.to);
        }
    const stack = [edge.to];
    const seen = new Set();
    while (stack.length) {
        const cur = stack.pop();
        if (cur === edge.from)
            return true;
        if (seen.has(cur))
            continue;
        seen.add(cur);
        for (const next of adj.get(cur) ?? [])
            stack.push(next);
    }
    return false;
}
/** Returns a validation error describing the rejection, or `null` when the edge is acceptable. */
export function validateNewEdge(ctx, edge) {
    if (!ctx.nodeExists(edge.from))
        return { code: 'validation', message: `edge 'from' references a missing node: ${edge.from}` };
    if (!ctx.nodeExists(edge.to))
        return { code: 'validation', message: `edge 'to' references a missing node: ${edge.to}` };
    if (ctx.edges.some((e) => e.type === edge.type && e.from === edge.from && e.to === edge.to)) {
        return { code: 'validation', message: `duplicate edge ${edge.type} ${edge.from}->${edge.to}` };
    }
    if (edge.type === 'contains') {
        if (ctx.edges.some((e) => e.type === 'contains' && e.to === edge.to)) {
            return { code: 'validation', message: `node '${edge.to}' already has a parent (single-parent containment)` };
        }
        if (wouldCreateCycle(ctx.edges, edge)) {
            return { code: 'validation', message: `containment edge ${edge.from}->${edge.to} would create a cycle` };
        }
    }
    return null;
}
/** Returns a validation error when the group id already exists, or `null` when it is free. */
export function validateNewGroupId(ctx, id) {
    if (ctx.groups[id])
        return { code: 'validation', message: `group id '${id}' already exists` };
    return null;
}
//# sourceMappingURL=validate.js.map