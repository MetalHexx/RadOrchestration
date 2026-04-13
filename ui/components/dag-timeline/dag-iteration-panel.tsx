"use client";

import { DAGNodeRow } from './dag-node-row';
import { NodeStatusBadge } from './node-status-badge';
import { DAGCorrectiveTaskGroup } from './dag-corrective-task-group';
import { ExternalLink } from '@/components/documents';
import { getCommitLinkData, filterCompatibleNodes } from './dag-timeline-helpers';
import type { IterationEntry } from '@/types/state';

interface DAGIterationPanelProps {
  iteration: IterationEntry;
  iterationIndex: number;
  parentNodeId: string;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
}

export const CHILD_DEPTH = 1;

export function buildIterationLabel(iterationIndex: number): string {
  return `Iteration ${iterationIndex + 1}`;
}

export function buildChildNodeId(parentNodeId: string, iterationIndex: number, childNodeId: string): string {
  return `${parentNodeId}.iter${iterationIndex}.${childNodeId}`;
}

export function buildCorrectiveGroupParentId(parentNodeId: string, iterationIndex: number): string {
  return `${parentNodeId}.iter${iterationIndex}`;
}

export function shouldRenderCorrectiveTasks(correctiveTasks: IterationEntry['corrective_tasks']): boolean {
  return correctiveTasks.length > 0;
}

export function DAGIterationPanel({
  iteration,
  iterationIndex,
  parentNodeId,
  currentNodePath,
  onDocClick,
}: DAGIterationPanelProps) {
  const commitData = getCommitLinkData(iteration.commit_hash);
  const compatibleNodes = filterCompatibleNodes(iteration.nodes);
  const correctiveGroupParentId = buildCorrectiveGroupParentId(parentNodeId, iterationIndex);

  return (
    <div className="pl-4 border-l border-border ml-3">
      <div className="py-1 flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {buildIterationLabel(iterationIndex)}
        </span>
        <NodeStatusBadge status={iteration.status} />
        {commitData !== null && (
          <ExternalLink href={commitData.href} label={commitData.label} icon="github" />
        )}
      </div>
      {compatibleNodes.map(([childNodeId, childNode]) => (
        <DAGNodeRow
          key={childNodeId}
          nodeId={buildChildNodeId(parentNodeId, iterationIndex, childNodeId)}
          node={childNode}
          depth={CHILD_DEPTH}
          currentNodePath={currentNodePath}
          onDocClick={onDocClick}
        />
      ))}
      {shouldRenderCorrectiveTasks(iteration.corrective_tasks) && (
        <DAGCorrectiveTaskGroup
          correctiveTasks={iteration.corrective_tasks}
          parentNodeId={correctiveGroupParentId}
          currentNodePath={currentNodePath}
          onDocClick={onDocClick}
        />
      )}
    </div>
  );
}
