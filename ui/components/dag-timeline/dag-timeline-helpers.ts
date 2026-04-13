import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState, NodesRecord } from '@/types/state';

export type CompatibleNodeState = StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState;

export function getCommitLinkData(commitHash: string | null | undefined): { href: string; label: string } | null {
  if (commitHash == null) return null;
  // TODO(DAG-VIEW-3): Replace with real commit URL once repo base URL is available
  return {
    href: `#${commitHash}`,
    label: commitHash.slice(0, 7),
  };
}

export function filterCompatibleNodes(
  nodes: NodesRecord
): Array<[string, CompatibleNodeState]> {
  return Object.entries(nodes).filter(
    ([, node]) => node.kind !== 'for_each_phase' && node.kind !== 'for_each_task'
  ) as Array<[string, CompatibleNodeState]>;
}

/**
 * Converts a snake_case node ID to a human-readable display name.
 * "gate_mode_selection" → "Gate Mode Selection"
 */
export function formatNodeId(nodeId: string): string {
  return nodeId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extracts the leaf segment from a compound node ID and formats it
 * as a human-readable display name.
 *
 * "phase_loop.iter0.phase_planning" → "Phase Planning"
 * "phase_planning"                  → "Phase Planning"
 */
export function getDisplayName(nodeId: string): string {
  const lastDot = nodeId.lastIndexOf('.');
  const leaf = lastDot === -1 ? nodeId : nodeId.slice(lastDot + 1);
  return formatNodeId(leaf);
}
