export function mapStatus(raw) {
    switch (raw) {
        case 'completed': return 'done';
        case 'failed':
        case 'halted': return 'blocked';
        case 'skipped': return 'skipped';
        case 'in_progress': return 'in_progress';
        case 'not_started': return 'not_started';
        default: return 'unknown';
    }
}
export function combineStatuses(statuses) {
    const resolvable = statuses.filter((s) => s !== 'unknown');
    if (resolvable.length === 0)
        return 'unknown';
    if (resolvable.some((s) => s === 'blocked'))
        return 'blocked';
    const hasInProgress = resolvable.some((s) => s === 'in_progress');
    const effective = resolvable.map((s) => (s === 'skipped' ? 'done' : s));
    const hasDone = effective.some((s) => s === 'done');
    const hasNotStarted = effective.some((s) => s === 'not_started');
    if (hasInProgress || (hasDone && hasNotStarted))
        return 'in_progress';
    if (effective.every((s) => s === 'done'))
        return 'done';
    if (effective.every((s) => s === 'not_started'))
        return 'not_started';
    return 'unknown';
}
export function rollupProjectStatus(state) {
    const nodes = state?.graph?.nodes;
    if (!nodes || typeof nodes !== 'object')
        return 'unknown';
    return combineStatuses(Object.values(nodes).map((n) => mapStatus(n?.status)));
}
//# sourceMappingURL=status.js.map