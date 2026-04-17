"use client";

import { useCallback } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { NodeKindIcon } from './node-kind-icon';
import { NodeStatusBadge, STATUS_MAP } from './node-status-badge';
import { DAGIterationPanel } from './dag-iteration-panel';
import { getDisplayName } from './dag-timeline-helpers';
import type { ForEachPhaseNodeState, ForEachTaskNodeState } from '@/types/state';

export interface DAGLoopNodeProps {
  nodeId: string;
  node: ForEachPhaseNodeState | ForEachTaskNodeState;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  expandedLoopIds: string[];
  onAccordionChange: (
    value: string[],
    eventDetails: { reason: string }
  ) => void;
  repoBaseUrl: string | null;
  projectName: string;
  focusedRowKey: string | null;
  isFocused: boolean;
  onFocusChange: (nodeId: string) => void;
}

export function buildLoopItemValue(nodeId: string): string {
  return `loop-${nodeId}`;
}

export function DAGLoopNode({
  nodeId,
  node,
  currentNodePath,
  onDocClick,
  expandedLoopIds,
  onAccordionChange,
  repoBaseUrl,
  projectName,
  focusedRowKey,
  isFocused,
  onFocusChange,
}: DAGLoopNodeProps) {
  const sortedIterations = [...node.iterations].sort((a, b) => a.index - b.index);
  const isActive = nodeId === currentNodePath;
  const ariaLabel = `${getDisplayName(nodeId)} — ${STATUS_MAP[node.status].defaultLabel}`;

  const handleFocus = useCallback(() => {
    onFocusChange(nodeId);
  }, [nodeId, onFocusChange]);

  return (
    <Accordion multiple value={expandedLoopIds} onValueChange={onAccordionChange}>
      <AccordionItem value={buildLoopItemValue(nodeId)} className="border-b-0">
        <AccordionTrigger
          role="option"
          aria-selected={isActive}
          aria-label={ariaLabel}
          className="hover:no-underline py-2 px-3 rounded-md gap-2 hover:bg-accent/50 items-center"
          tabIndex={isFocused ? 0 : -1}
          data-timeline-row
          data-row-key={nodeId}
          onFocus={handleFocus}
        >
          <NodeKindIcon kind={node.kind} />
          {/* flex-1 is intentional here — loop node triggers are accordion headers where the label,
              status badge, and chevron share a flex row. flex-1 fills available space before the
              badge and chevron, keeping the chevron right-aligned. DAGNodeRow uses max-w-[55%]
              instead because standard rows have additional trailing elements (document links, branch
              badges) that need predictable horizontal space. */}
          <span className="text-sm font-medium truncate flex-1">{getDisplayName(nodeId)}</span>
          <NodeStatusBadge status={node.status} />
        </AccordionTrigger>
        <AccordionContent>
          {sortedIterations.map((iteration) => (
            <DAGIterationPanel
              key={iteration.index}
              iteration={iteration}
              iterationIndex={iteration.index}
              parentNodeId={nodeId}
              parentKind={node.kind}
              currentNodePath={currentNodePath}
              onDocClick={onDocClick}
              repoBaseUrl={repoBaseUrl}
              projectName={projectName}
              expandedLoopIds={expandedLoopIds}
              onAccordionChange={onAccordionChange}
              focusedRowKey={focusedRowKey}
              onFocusChange={onFocusChange}
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
