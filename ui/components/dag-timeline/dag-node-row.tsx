"use client";

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { NodeKindIcon } from './node-kind-icon';
import { NodeStatusBadge, STATUS_MAP } from './node-status-badge';
import { DocumentLink } from '@/components/documents';
import { ApproveGateButton } from '@/components/dashboard';
import { getDisplayName, getGateNodeConfig } from './dag-timeline-helpers';
import type { CompatibleNodeState } from './dag-timeline-helpers';

interface DAGNodeRowProps {
  nodeId: string;
  node: CompatibleNodeState;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  depth?: number;  // default: 0
  projectName?: string;
  isFocused: boolean;
  onFocusChange: (nodeId: string) => void;
}

// Re-export formatNodeId to preserve barrel export contract
export { formatNodeId } from './dag-timeline-helpers';

export function DAGNodeRow({ nodeId, node, currentNodePath, onDocClick, depth = 0, projectName, isFocused, onFocusChange }: DAGNodeRowProps) {
  const isActive = nodeId === currentNodePath;
  const branchTaken = node.kind === 'conditional' ? node.branch_taken : null;
  const branchLabel = branchTaken != null ? (branchTaken === 'true' ? 'Yes' : 'No') : null;
  const branchBadgeStatus = branchTaken != null ? (branchTaken === 'true' ? 'completed' : 'skipped') : null;
  const gateConfig = node.kind === 'gate' && node.status !== 'completed' && projectName !== undefined
    ? getGateNodeConfig(nodeId)
    : null;
  const hasGate = gateConfig !== null;

  const gateButtonRef = useRef<HTMLButtonElement | null>(null);

  const ariaLabel = `${getDisplayName(nodeId)} — ${STATUS_MAP[node.status].defaultLabel}`;

  const handleFocus = useCallback(() => {
    onFocusChange(nodeId);
  }, [nodeId, onFocusChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (hasGate && gateButtonRef.current !== null) {
      event.preventDefault();
      gateButtonRef.current.click();
    }
  }, [hasGate]);

  return (
    <div
      role="option"
      aria-selected={false}
      tabIndex={isFocused ? 0 : -1}
      data-timeline-row
      aria-label={ariaLabel}
      aria-current={isActive ? 'step' : undefined}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        'py-2 pr-3 rounded-md gap-2 flex items-center hover:bg-accent/50',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        isActive && 'border-l-2 border-l-[var(--color-link)]'
      )}
      style={{ paddingLeft: 12 + depth * 16 }}
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
      {gateConfig !== null && (
        <ApproveGateButton
          ref={gateButtonRef}
          gateEvent={gateConfig.event}
          projectName={projectName!}
          documentName={projectName!}
          label={gateConfig.label}
          className="ml-auto"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
