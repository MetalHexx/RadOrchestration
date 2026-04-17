"use client";

import { Fragment, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const groups = groupNodesBySection(nodes);
  const unmatchedEntries = Object.entries(nodes).filter(([nodeId]) => !Object.hasOwn(NODE_SECTION_MAP, nodeId));

  const focusableRowKeys = useMemo(() => {
    const keys: string[] = [];
    for (const group of groups) {
      for (const [nodeId] of group.entries) {
        keys.push(nodeId);
      }
    }
    for (const [nodeId] of unmatchedEntries) {
      keys.push(nodeId);
    }
    return keys;
  }, [groups, unmatchedEntries]);

  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(() => focusableRowKeys[0] ?? null);

  const handleFocusChange = useCallback((nodeId: string) => {
    setFocusedRowKey(nodeId);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const container = containerRef.current;
    if (container === null) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-timeline-row]')
    );
    if (items.length === 0) return;
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement
    );
    let nextIndex: number;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    }
    items[nextIndex].focus();
  }, []);

  const renderNodeEntry = ([nodeId, node]: [string, NodeState]): ReactNode => (
    <div key={nodeId} role="presentation">
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
          focusedRowKey={focusedRowKey}
          isFocused={focusedRowKey === nodeId}
          onFocusChange={handleFocusChange}
        />
      ) : (
        <DAGNodeRow
          nodeId={nodeId}
          node={node}
          currentNodePath={currentNodePath}
          onDocClick={onDocClick}
          projectName={projectName}
          isFocused={focusedRowKey === nodeId}
          onFocusChange={handleFocusChange}
        />
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Pipeline timeline"
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-0"
    >
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
