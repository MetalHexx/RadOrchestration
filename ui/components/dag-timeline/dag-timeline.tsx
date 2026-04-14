"use client";

import { Fragment } from 'react';
import type { NodesRecord } from '@/types/state';
import { DAGNodeRow } from './dag-node-row';
import { DAGLoopNode } from './dag-loop-node';
import { isLoopNode, groupNodesBySection, NODE_SECTION_MAP } from './dag-timeline-helpers';
import { DAGSectionGroup } from './dag-section-group';
import { Separator } from '@/components/ui/separator';

interface DAGTimelineProps {
  nodes: NodesRecord;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
}

export function DAGTimeline({ nodes, currentNodePath, onDocClick }: DAGTimelineProps) {
  const groups = groupNodesBySection(nodes);
  const unmatchedEntries = Object.entries(nodes).filter(([nodeId]) => !(nodeId in NODE_SECTION_MAP));

  return (
    <div className="flex flex-col gap-0" role="list">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <Separator className="my-3" />}
          <DAGSectionGroup label={group.label}>
            {group.entries.map(([nodeId, node]) => (
              <div key={nodeId} role="listitem">
                {isLoopNode(node) ? (
                  <DAGLoopNode
                    nodeId={nodeId}
                    node={node}
                    currentNodePath={currentNodePath}
                    onDocClick={onDocClick}
                  />
                ) : (
                  <DAGNodeRow
                    nodeId={nodeId}
                    node={node}
                    currentNodePath={currentNodePath}
                    onDocClick={onDocClick}
                  />
                )}
              </div>
            ))}
          </DAGSectionGroup>
        </Fragment>
      ))}
      {groups.length > 0 && unmatchedEntries.length > 0 && <Separator className="my-3" />}
      {unmatchedEntries.map(([nodeId, node]) => (
        <div key={nodeId} role="listitem">
          {isLoopNode(node) ? (
            <DAGLoopNode
              nodeId={nodeId}
              node={node}
              currentNodePath={currentNodePath}
              onDocClick={onDocClick}
            />
          ) : (
            <DAGNodeRow
              nodeId={nodeId}
              node={node}
              currentNodePath={currentNodePath}
              onDocClick={onDocClick}
            />
          )}
        </div>
      ))}
    </div>
  );
}
