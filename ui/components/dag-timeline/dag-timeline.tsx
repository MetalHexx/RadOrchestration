"use client";

import type { NodesRecord, NodeState } from '@/types/state';
import { DAGNodeRow } from './dag-node-row';
import { DAGLoopNode } from './dag-loop-node';

interface DAGTimelineProps {
  nodes: NodesRecord;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
}

export function isLoopNode(node: NodeState): node is Extract<NodeState, { kind: 'for_each_phase' | 'for_each_task' }> {
  return node.kind === 'for_each_phase' || node.kind === 'for_each_task';
}

export function DAGTimeline({ nodes, currentNodePath, onDocClick }: DAGTimelineProps) {
  return (
    <div className="flex flex-col gap-0" role="list">
      {Object.entries(nodes).map(([nodeId, node]) => (
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
