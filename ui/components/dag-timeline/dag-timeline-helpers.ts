import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState, NodesRecord } from '@/types/state';

export type CompatibleNodeState = StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState;

export function getCommitLinkData(commitHash: string | null): { href: string; label: string } | null {
  if (commitHash === null) return null;
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
