"use client";

import { DAGNodeRow } from './dag-node-row';
import { NodeStatusBadge } from './node-status-badge';
import { DAGCorrectiveTaskGroup } from './dag-corrective-task-group';
import { DAGLoopNode } from './dag-loop-node';
import { ExternalLink } from '@/components/documents';
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
}: DAGIterationPanelProps) {
  const commitData = getCommitLinkData(iteration.commit_hash, repoBaseUrl);
  const correctiveGroupParentId = buildCorrectiveGroupParentId(parentNodeId, iterationIndex);

  // Derive iteration name from child node doc path
  let iterationName: string;
  let isFallback: boolean;

  if (parentKind === 'for_each_phase') {
    const phaseNode = iteration.nodes['phase_planning'];
    const docPath = (phaseNode && 'doc_path' in phaseNode) ? phaseNode.doc_path : null;
    isFallback = !docPath;
    iterationName = parsePhaseNameFromDocPath(docPath, iterationIndex);
  } else {
    const taskNode = iteration.nodes['task_handoff'];
    const docPath = (taskNode && 'doc_path' in taskNode) ? taskNode.doc_path : null;
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
        {commitData !== null && (
          commitData.href !== null ? (
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
      {Object.entries(iteration.nodes).map(([childNodeId, childNode]) =>
        isLoopNode(childNode) ? (
          <DAGLoopNode
            key={childNodeId}
            nodeId={buildIterationChildNodeId(parentNodeId, iterationIndex, childNodeId)}
            node={childNode}
            currentNodePath={currentNodePath}
            onDocClick={onDocClick}
            expandedLoopIds={[]}
            onAccordionChange={() => {}}
            repoBaseUrl={repoBaseUrl}
            projectName={projectName}
          />
        ) : (
          <DAGNodeRow
            key={childNodeId}
            nodeId={buildIterationChildNodeId(parentNodeId, iterationIndex, childNodeId)}
            node={childNode}
            depth={ITERATION_CHILD_DEPTH}
            currentNodePath={currentNodePath}
            onDocClick={onDocClick}
          />
        )
      )}
      <DAGCorrectiveTaskGroup
        correctiveTasks={iteration.corrective_tasks}
        parentNodeId={correctiveGroupParentId}
        currentNodePath={currentNodePath}
        onDocClick={onDocClick}
        repoBaseUrl={repoBaseUrl}
      />
    </div>
  );
}
