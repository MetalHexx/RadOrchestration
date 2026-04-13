"use client";

import { cn } from '@/lib/utils';
import type { StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState } from '@/types/state';
import { NodeKindIcon } from './node-kind-icon';
import { NodeStatusBadge } from './node-status-badge';
import { DocumentLink } from '@/components/documents';

interface DAGNodeRowProps {
  nodeId: string;
  node: StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  depth?: number;  // default: 0
}

/**
 * Converts a snake_case nodeId to a human-readable display name.
 * e.g. "gate_mode_selection" → "Gate Mode Selection"
 * Exported for unit testing.
 */
export function formatNodeId(nodeId: string): string {
  return nodeId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function DAGNodeRow({ nodeId, node, currentNodePath, onDocClick, depth = 0 }: DAGNodeRowProps) {
  const isActive = nodeId === currentNodePath;

  return (
    <div
      className={cn(
        'py-2 pr-3 rounded-md gap-2 flex items-center hover:bg-accent/50',
        isActive && 'border-l-2 border-l-[var(--color-link)]'
      )}
      style={{ paddingLeft: 12 + depth * 16 }}
      aria-current={isActive ? 'step' : undefined}
    >
      <NodeKindIcon kind={node.kind} />
      <span className="text-sm font-medium truncate flex-1">{formatNodeId(nodeId)}</span>
      <NodeStatusBadge status={node.status} />
      {node.kind === 'step' && node.doc_path !== null && (
        <DocumentLink path={node.doc_path} label="Doc" onDocClick={onDocClick} />
      )}
    </div>
  );
}
