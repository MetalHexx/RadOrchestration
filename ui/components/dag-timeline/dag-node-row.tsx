"use client";

import { cn } from '@/lib/utils';
import { NodeKindIcon } from './node-kind-icon';
import { NodeStatusBadge } from './node-status-badge';
import { DocumentLink } from '@/components/documents';
import { getDisplayName } from './dag-timeline-helpers';
import type { CompatibleNodeState } from './dag-timeline-helpers';

interface DAGNodeRowProps {
  nodeId: string;
  node: CompatibleNodeState;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  depth?: number;  // default: 0
}

// Re-export formatNodeId to preserve barrel export contract
export { formatNodeId } from './dag-timeline-helpers';

export function DAGNodeRow({ nodeId, node, currentNodePath, onDocClick, depth = 0 }: DAGNodeRowProps) {
  const isActive = nodeId === currentNodePath;
  const branchTaken = node.kind === 'conditional' ? node.branch_taken : null;
  const branchLabel = branchTaken != null ? (branchTaken === 'true' ? 'Yes' : 'No') : null;
  const branchBadgeStatus = branchTaken != null ? (branchTaken === 'true' ? 'completed' : 'skipped') : null;

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
      <span className="text-sm font-medium min-w-0 shrink truncate max-w-[55%]">{getDisplayName(nodeId)}</span>
      <NodeStatusBadge status={node.status} />
      {branchLabel !== null && branchBadgeStatus !== null && (
        <span role="group" aria-label={`Branch taken: ${branchLabel}`}>
          <NodeStatusBadge status={branchBadgeStatus} label={branchLabel} />
        </span>
      )}
      {node.kind === 'step' && node.doc_path !== null && (
        <DocumentLink path={node.doc_path} label="Doc" onDocClick={onDocClick} />
      )}
    </div>
  );
}
