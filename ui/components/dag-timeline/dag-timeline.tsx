"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/**
 * Parse the iteration-encoded `lostKey` and return the chain of ancestor
 * loop nodeIds, ordered deepest-first (longest prefix first). The encoding
 * follows `buildIterationChildNodeId` (`${parentNodeId}.iter${N}.${childNodeId}`)
 * and `buildCorrectiveChildNodeId` (which builds on a parent already shaped as
 * `${loopId}.iter${N}`), so each `.iter\d+\.` boundary in the key marks an
 * ancestor loop nodeId ending. A lostKey with no `.iter\d+\.` boundary
 * (e.g. a top-level row key) returns an empty array — there is no loop to
 * fall back to.
 */
export function deriveAncestorLoopKeys(lostKey: string): string[] {
  const result: string[] = [];
  const regex = /\.iter\d+\./g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lostKey)) !== null) {
    result.push(lostKey.slice(0, match.index));
  }
  return result.reverse();
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

  useEffect(() => {
    // Derive the keyset from the DOM so nested iteration/corrective rows
    // (keys like `phase_loop.iter0.task_handoff`) are honored — focusableRowKeys
    // only holds top-level nodeIds and would otherwise treat any nested focus
    // as stale and clobber it.
    const container = containerRef.current;
    if (container === null) return;
    const renderedKeys = Array.from(
      container.querySelectorAll<HTMLElement>('[data-timeline-row][data-row-key]')
    )
      .map((el) => el.dataset.rowKey)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    if (renderedKeys.length === 0) return;
    if (focusedRowKey === null || !renderedKeys.includes(focusedRowKey)) {
      setFocusedRowKey(renderedKeys[0]);
    }
  }, [focusableRowKeys, focusedRowKey, expandedLoopIds]);

  const handleFocusChange = useCallback((nodeId: string) => {
    setFocusedRowKey(nodeId);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    // Stop propagation so the event never reaches base-ui's AccordionTrigger
    // onKeyDown (which calls stopEvent + focuses "next trigger" in the same
    // single-item Accordion, trapping focus on the loop row). Combined with
    // onKeyDownCapture below, this runs before any child bubble-phase handler.
    event.stopPropagation();
    const container = containerRef.current;
    if (container === null) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-timeline-row]')
    );
    if (items.length === 0) return;
    // Resolve the active row via the nearest [data-timeline-row] ancestor so
    // arrow-nav stays anchored to the row even when focus is on a descendant
    // button (DocumentLink / ApproveGateButton are tabIndex={-1} but still
    // clickable and can hold focus).
    const activeElement =
      event.target instanceof Element
        ? event.target
        : document.activeElement instanceof Element
          ? document.activeElement
          : null;
    const activeRow = activeElement?.closest<HTMLElement>('[data-timeline-row]') ?? null;
    const currentIndex = items.findIndex((item) => item === activeRow);
    let nextIndex: number;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    }
    items[nextIndex].focus();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.activeElement !== document.body) return;
    if (focusedRowKey === null) return;

    const container = containerRef.current;
    if (container === null) return;

    const ancestorKeys = deriveAncestorLoopKeys(focusedRowKey);
    for (const ancestorKey of ancestorKeys) {
      const target = container.querySelector<HTMLElement>(
        `[data-row-key="${CSS.escape(ancestorKey)}"]`
      );
      if (target !== null) {
        target.focus();
        return;
      }
    }
  }, [expandedLoopIds, focusedRowKey]);

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
      onKeyDownCapture={handleKeyDown}
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
