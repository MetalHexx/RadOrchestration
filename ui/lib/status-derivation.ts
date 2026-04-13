import { PLANNING_STEP_ORDER, NODE_ID_PHASE_LOOP, NODE_ID_FINAL_REVIEW } from '@/types/state';
import type { NodesRecord, GraphStatus, PlanningStatus, ExecutionStatus } from '@/types/state';

/**
 * Derive a v4-compatible PlanningStatus from v5 graph root nodes.
 */
export function derivePlanningStatus(nodes: NodesRecord): PlanningStatus {
  const statuses = PLANNING_STEP_ORDER.map((key) => nodes[key]?.status ?? 'not_started');

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
    (nodes[NODE_ID_PHASE_LOOP] && nodes[NODE_ID_PHASE_LOOP].status === 'in_progress') ||
    (nodes[NODE_ID_FINAL_REVIEW] && nodes[NODE_ID_FINAL_REVIEW].status === 'in_progress')
  ) {
    return 'in_progress';
  }
  return 'not_started';
}
