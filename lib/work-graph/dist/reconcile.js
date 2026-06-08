export function pruneEdges(edges, nodeExists) {
    const kept = [];
    const removed = [];
    for (const e of edges) {
        if (nodeExists(e.from) && nodeExists(e.to))
            kept.push(e);
        else
            removed.push(e);
    }
    return { kept, removed };
}
//# sourceMappingURL=reconcile.js.map