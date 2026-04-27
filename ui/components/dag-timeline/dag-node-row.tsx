"use client";

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { NodeStatusBadge, STATUS_MAP } from './node-status-badge';
import { DocumentLink, ExternalLink } from '@/components/documents';
import { ApproveGateButton, ExecutePlanButton } from '@/components/dashboard';
import { getDisplayName, getRowButtonDescriptor, deriveGateBadgeStatusAndLabel, getDocLinkLabel, derivePlanningStepLabel } from './dag-timeline-helpers';
import type { CompatibleNodeState } from './dag-timeline-helpers';
import type { NodeStatus } from '@/types/state';

interface DAGNodeRowProps {
  nodeId: string;
  node: CompatibleNodeState;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  depth?: number;
  projectName?: string;
  isFocused: boolean;
  onFocusChange: (nodeId: string) => void;
  /** Top-level phase_loop status; drives FR-2 Execute Plan visibility (AD-2). */
  phaseLoopStatus?: NodeStatus;
  /** PR URL surfaced on the `final_pr` row (Completion section). Sourced
   *  from `state.pipeline.source_control.pr_url` and threaded through
   *  DAGTimeline; ignored on every other row. */
  prUrl?: string | null;
}

// Re-export formatNodeId to preserve barrel export contract
export { formatNodeId } from './dag-timeline-helpers';

export function DAGNodeRow({ nodeId, node, currentNodePath, onDocClick, depth = 0, projectName, isFocused, onFocusChange, phaseLoopStatus, prUrl }: DAGNodeRowProps) {
  const isActive = nodeId === currentNodePath;
  const descriptor =
    node.kind === 'gate' && projectName !== undefined
      ? getRowButtonDescriptor(nodeId, node, phaseLoopStatus)
      : { kind: 'none' as const };
  const hasActionButton = descriptor.kind !== 'none';
  const isFinalPrRow = nodeId === 'final_pr' && prUrl != null && prUrl !== '';

  // Resolve the same {status,label} pair the visible badge uses, so the row's
  // aria-label announces what the user sees rather than a stale raw status.
  // Gate rows can present "Not Started" via deriveGateBadgeStatusAndLabel even
  // when node.status is 'in_progress'; planning steps surface "Executing" via
  // derivePlanningStepLabel.
  const planningLabel = derivePlanningStepLabel(nodeId, node.status);
  const resolvedBadge = node.kind === 'gate'
    ? deriveGateBadgeStatusAndLabel(node)
    : { status: node.status, label: planningLabel ?? STATUS_MAP[node.status].defaultLabel };

  const actionButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleFocus = useCallback(() => {
    onFocusChange(nodeId);
  }, [nodeId, onFocusChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (hasActionButton && actionButtonRef.current !== null) {
      actionButtonRef.current.click();
    } else if (isFinalPrRow) {
      window.open(prUrl!, '_blank', 'noopener,noreferrer');
    } else if (node.kind === 'step' && node.doc_path != null && node.doc_path !== '') {
      onDocClick(node.doc_path);
    }
  }, [hasActionButton, isFinalPrRow, prUrl, node, onDocClick]);

  return (
    <div
      role="option"
      aria-selected={isActive}
      tabIndex={isFocused ? 0 : -1}
      data-timeline-row
      aria-label={`${getDisplayName(nodeId)} — ${resolvedBadge.label}`}
      aria-current={isActive ? 'step' : undefined}
      data-row-key={nodeId}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={cn(
        'py-2 pr-3 rounded-md gap-2 flex items-center hover:bg-accent/50',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        isActive && 'border-l-2 border-l-[var(--color-link)]'
      )}
      style={{ paddingLeft: 12 + depth * 16 }}
    >
      <NodeStatusBadge
        status={resolvedBadge.status}
        label={node.kind === 'gate' ? resolvedBadge.label : planningLabel}
        iconOnly={resolvedBadge.status === 'completed'}
      />
      <span className="text-sm font-medium min-w-0 shrink truncate max-w-[55%]">{getDisplayName(nodeId)}</span>
      {node.kind === 'step' && node.doc_path != null && node.doc_path !== '' && (
        <DocumentLink path={node.doc_path} label={getDocLinkLabel(nodeId)} onDocClick={onDocClick} tabIndex={-1} />
      )}
      {nodeId === 'final_pr' && prUrl != null && prUrl !== '' && (
        <ExternalLink href={prUrl} label="Pull Request" icon="github" tabIndex={-1} />
      )}
      {descriptor.kind === 'approve' && (
        <ApproveGateButton
          ref={actionButtonRef}
          gateEvent={descriptor.event}
          projectName={projectName!}
          documentName={projectName!}
          label={descriptor.label}
          className="ml-auto"
          tabIndex={-1}
        />
      )}
      {descriptor.kind === 'execute' && (
        <ExecutePlanButton
          ref={actionButtonRef}
          projectName={projectName!}
          className="ml-auto"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
