import type { NodeState, StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState, NodesRecord } from '@/types/state';

export function getCommitLinkData(commitHash: string | null): { href: string; label: string } | null {
  if (commitHash === null) return null;
  return {
    href: `#${commitHash}`,
    label: commitHash.slice(0, 7),
  };
}

export function filterCompatibleNodes(
  nodes: NodesRecord
): Array<[string, StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState]> {
  const all = Object.entries(nodes) as Array<[string, NodeState]>;
  const filtered = all.filter(([, node]) => node.kind !== 'for_each_phase' && node.kind !== 'for_each_task');
  return filtered as Array<[string, StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState]>;
}
