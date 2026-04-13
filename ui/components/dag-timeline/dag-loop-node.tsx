"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { NodeKindIcon } from './node-kind-icon';
import { NodeStatusBadge } from './node-status-badge';
import { DAGIterationPanel } from './dag-iteration-panel';
import { getDisplayName } from './dag-timeline-helpers';
import type { ForEachPhaseNodeState, ForEachTaskNodeState } from '@/types/state';

export interface DAGLoopNodeProps {
  nodeId: string;
  node: ForEachPhaseNodeState | ForEachTaskNodeState;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
}

export function buildLoopItemValue(nodeId: string): string {
  return `loop-${nodeId}`;
}

export function DAGLoopNode({ nodeId, node, currentNodePath, onDocClick }: DAGLoopNodeProps) {
  const sortedIterations = [...node.iterations].sort((a, b) => a.index - b.index);

  return (
    <Accordion defaultValue={[]}>
      <AccordionItem value={buildLoopItemValue(nodeId)} className="border-b-0">
        <AccordionTrigger className="hover:no-underline py-2 px-3 rounded-md gap-2 hover:bg-accent/50 items-center">
          <NodeKindIcon kind={node.kind} />
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
              currentNodePath={currentNodePath}
              onDocClick={onDocClick}
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
