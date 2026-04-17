"use client";

import { Fragment, type ReactNode } from 'react';
import type { NodesRecord, NodeState } from '@/types/state';
import { DAGNodeRow } from './dag-node-row';
import { DAGLoopNode } from './dag-loop-node';
import { isLoopNode, groupNodesBySection, NODE_SECTION_MAP } from './dag-timeline-helpers';
import { DAGSectionGroup } from './dag-section-group';
import { Separator } from '@/components/ui/separator';

interface DAGTimelineProps {
  nodes: NodesRecord;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  expandedLoopIds: string[];
  onAccordionChange: (
    value: string[],
    eventDetails: { reason: string }
  ) => void;
  repoBaseUrl: string | null;
  projectName: string;
}

export function DAGTimeline({ nodes, currentNodePath, onDocClick, expandedLoopIds, onAccordionChange, repoBaseUrl, projectName }: DAGTimelineProps) {
  const groups = groupNodesBySection(nodes);
  const unmatchedEntries = Object.entries(nodes).filter(([nodeId]) => !Object.hasOwn(NODE_SECTION_MAP, nodeId));

  const renderNodeEntry = ([nodeId, node]: [string, NodeState]): ReactNode => (
    <div key={nodeId} role="listitem">
      {isLoopNode(node) ? (
        <DAGLoopNode
          nodeId={nodeId}
          node={node}
          currentNodePath={currentNodePath}
          onDocClick={onDocClick}
          expandedLoopIds={expandedLoopIds}
          onAccordionChange={onAccordionChange}
          repoBaseUrl={repoBaseUrl}
          projectName={projectName}
          isFocused={false}
          onFocusChange={() => {}}
        />
      ) : (
        <DAGNodeRow
          nodeId={nodeId}
          node={node}
          currentNodePath={currentNodePath}
          onDocClick={onDocClick}
          projectName={projectName}
          isFocused={false}
          onFocusChange={() => {}}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-0" role="list">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <Separator className="my-3" role="none" />}
          <DAGSectionGroup label={group.label}>
            {group.entries.map(renderNodeEntry)}
          </DAGSectionGroup>
        </Fragment>
      ))}
      {groups.length > 0 && unmatchedEntries.length > 0 && <Separator className="my-3" role="none" />}
      {unmatchedEntries.map(renderNodeEntry)}
    </div>
  );
}
