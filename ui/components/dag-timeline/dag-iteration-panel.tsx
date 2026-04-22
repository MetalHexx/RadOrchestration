"use client";

import { DAGNodeRow } from './dag-node-row';
import { NodeStatusBadge } from './node-status-badge';
import { DAGCorrectiveTaskGroup } from './dag-corrective-task-group';
import { DAGLoopNode } from './dag-loop-node';
import { DocumentLink, ExternalLink } from '@/components/documents';
import { getCommitLinkData, isLoopNode, parsePhaseNameFromDocPath, parseTaskNameFromDocPath } from './dag-timeline-helpers';
import type { IterationEntry } from '@/types/state';

interface DAGIterationPanelProps {
  iteration: IterationEntry;
  iterationIndex: number;
  parentNodeId: string;
  parentKind: 'for_each_phase' | 'for_each_task';
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  projectName: string;
  expandedLoopIds: string[];
  onAccordionChange: (
    value: string[],
    eventDetails: { reason: string }
  ) => void;
  focusedRowKey: string | null;
  onFocusChange: (nodeId: string) => void;
}

export const ITERATION_CHILD_DEPTH = 1;

export function buildIterationLabel(iterationIndex: number): string {
  return `Iteration ${iterationIndex + 1}`;
}

export function buildIterationChildNodeId(parentNodeId: string, iterationIndex: number, childNodeId: string): string {
  return `${parentNodeId}.iter${iterationIndex}.${childNodeId}`;
}

export function buildCorrectiveGroupParentId(parentNodeId: string, iterationIndex: number): string {
  return `${parentNodeId}.iter${iterationIndex}`;
}

export function DAGIterationPanel({
  iteration,
  iterationIndex,
  parentNodeId,
  parentKind,
  currentNodePath,
  onDocClick,
  repoBaseUrl,
  projectName,
  expandedLoopIds,
  onAccordionChange,
  focusedRowKey,
  onFocusChange,
}: DAGIterationPanelProps) {
  const commitData = getCommitLinkData(iteration.commit_hash, repoBaseUrl);
  const correctiveGroupParentId = buildCorrectiveGroupParentId(parentNodeId, iterationIndex);

  // Derive iteration name from iteration.doc_path (post-unify) with a
  // fallback to the legacy per-iteration synthetic nodes
  // (`phase_planning` / `task_handoff`) so existing completed projects
  // browsed via the UI keep their labels.
  let iterationName: string;
  let isFallback: boolean;
  let docPath: string | null;

  if (parentKind === 'for_each_phase') {
    const phaseNode = iteration.nodes['phase_planning'];
    const legacyDocPath = (phaseNode && 'doc_path' in phaseNode) ? phaseNode.doc_path : null;
    docPath = iteration.doc_path ?? legacyDocPath ?? null;
    isFallback = !docPath;
    iterationName = parsePhaseNameFromDocPath(docPath, iterationIndex);
  } else {
    const taskNode = iteration.nodes['task_handoff'];
    const legacyDocPath = (taskNode && 'doc_path' in taskNode) ? taskNode.doc_path : null;
    docPath = iteration.doc_path ?? legacyDocPath ?? null;
    isFallback = !docPath;
    iterationName = parseTaskNameFromDocPath(docPath, iterationIndex);
  }

  // Compute card container classes
  let cardClasses: string;

  if (parentKind === 'for_each_phase') {
    switch (iteration.status) {
      case 'in_progress':
        cardClasses = 'border border-[var(--color-link)] bg-card rounded-md p-3 mb-2';
        break;
      case 'completed':
        cardClasses = 'border border-border bg-muted/50 rounded-md p-3 mb-2';
        break;
      case 'failed':
      case 'halted':
        cardClasses = 'border border-[var(--status-failed)] bg-card rounded-md p-3 mb-2';
        break;
      default:
        cardClasses = 'border border-border bg-card rounded-md p-3 mb-2';
    }
  } else {
    switch (iteration.status) {
      case 'in_progress':
        cardClasses = 'border border-border/70 bg-card rounded-md p-2 mb-1.5';
        break;
      case 'completed':
        cardClasses = 'border border-border/50 bg-muted/30 rounded-md p-2 mb-1.5';
        break;
      case 'failed':
      case 'halted':
        cardClasses = 'border border-[var(--status-failed)] bg-card rounded-md p-2 mb-1.5';
        break;
      default:
        cardClasses = 'border border-border/40 bg-card rounded-md p-2 mb-1.5';
    }
  }

  const ariaLabel = parentKind === 'for_each_phase'
    ? `Phase iteration ${iterationIndex + 1} \u2014 ${iterationName} \u2014 ${iteration.status}`
    : `Task iteration ${iterationIndex + 1} \u2014 ${iterationName} \u2014 ${iteration.status}`;

  const headerClass = parentKind === 'for_each_phase'
    ? 'py-1 flex items-center gap-2 mb-1.5'
    : 'py-1 flex items-center gap-2 mb-1';

  return (
    <div className={cardClasses} aria-label={ariaLabel}>
      <div className={headerClass}>
        <span className={isFallback ? 'text-sm italic text-muted-foreground truncate max-w-[60%] min-w-0' : 'text-sm font-medium truncate max-w-[60%] min-w-0'}>
          {iterationName}
        </span>
        <NodeStatusBadge status={iteration.status} />
        {iteration.doc_path != null && iteration.doc_path !== '' && (
          // Gate on iteration.doc_path (new shape) only — NOT on the combined `docPath` that
          // includes the legacy `phase_planning` / `task_handoff` fallback. Legacy projects
          // already render a Doc button on those synthetic child rows via DAGNodeRow; adding
          // a second one here would duplicate the link on every pre-unify completed project.
          <DocumentLink path={iteration.doc_path} label="Doc" onDocClick={onDocClick} />
        )}
        {commitData !== null && (
          commitData.href !== null ? (
            // No tabIndex override: this header <div> has no row-level focus
            // wiring (unlike DAGNodeRow, which owns a roving tabindex + keydown
            // handler), so keyboard users must reach the commit link via
            // natural tab order. Same rationale as DocumentLink above.
            <ExternalLink
              href={commitData.href}
              label={commitData.label}
              icon="external-link"
            />
          ) : (
            <span className="text-xs font-mono text-muted-foreground">
              {commitData.label}
            </span>
          )
        )}
      </div>
      {Object.entries(iteration.nodes).map(([childNodeId, childNode]) => {
        const childKey = buildIterationChildNodeId(parentNodeId, iterationIndex, childNodeId);
        return isLoopNode(childNode) ? (
          <DAGLoopNode
            key={childNodeId}
            nodeId={childKey}
            node={childNode}
            currentNodePath={currentNodePath}
            onDocClick={onDocClick}
            expandedLoopIds={expandedLoopIds}
            onAccordionChange={onAccordionChange}
            repoBaseUrl={repoBaseUrl}
            projectName={projectName}
            focusedRowKey={focusedRowKey}
            isFocused={focusedRowKey === childKey}
            onFocusChange={onFocusChange}
          />
        ) : (
          <DAGNodeRow
            key={childNodeId}
            nodeId={childKey}
            node={childNode}
            depth={ITERATION_CHILD_DEPTH}
            currentNodePath={currentNodePath}
            onDocClick={onDocClick}
            isFocused={focusedRowKey === childKey}
            onFocusChange={onFocusChange}
          />
        );
      })}
      <DAGCorrectiveTaskGroup
        correctiveTasks={iteration.corrective_tasks}
        parentNodeId={correctiveGroupParentId}
        currentNodePath={currentNodePath}
        onDocClick={onDocClick}
        repoBaseUrl={repoBaseUrl}
        focusedRowKey={focusedRowKey}
        onFocusChange={onFocusChange}
      />
    </div>
  );
}
