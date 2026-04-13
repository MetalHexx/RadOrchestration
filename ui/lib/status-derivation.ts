import type { NodesRecord, GraphStatus, PlanningStatus, ExecutionStatus } from '@/types/state';

const PLANNING_NODE_KEYS = ['research', 'prd', 'design', 'architecture', 'master_plan'] as const;

/**
 * Derive a v4-compatible PlanningStatus from v5 graph root nodes.
 */
export function derivePlanningStatus(nodes: NodesRecord): PlanningStatus {
  const statuses = PLANNING_NODE_KEYS.map((key) => nodes[key]?.status ?? 'not_started');

  if (statuses.every((s) => s === 'completed')) {
    return 'complete';
  }
  if (statuses.some((s) => s === 'in_progress')) {
    return 'in_progress';
  }
  // All other statuses (failed, halted, skipped, not_started) fall through to not_started.
  // This is intentional: the sidebar badge only distinguishes not-started / in-progress / complete.
  return 'not_started';
}

/**
 * Derive a v4-compatible ExecutionStatus from v5 graph state.
 */
export function deriveExecutionStatus(graphStatus: GraphStatus, nodes: NodesRecord): ExecutionStatus {
  if (graphStatus === 'completed') {
    return 'complete';
  }
  if (graphStatus === 'halted') {
    return 'halted';
  }
  if (
    (nodes['phase_loop'] && nodes['phase_loop'].status === 'in_progress') ||
    (nodes['final_review'] && nodes['final_review'].status === 'in_progress')
  ) {
    return 'in_progress';
  }
  return 'not_started';
}
