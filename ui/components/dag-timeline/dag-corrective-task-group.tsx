"use client";

import { useCallback } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { NodeStatusBadge, STATUS_MAP } from './node-status-badge';
import { DAGNodeRow } from './dag-node-row';
import { DocumentLink, ExternalLink } from '@/components/documents';
import { getCommitLinkData, filterCompatibleNodes, buildCorrectiveItemValue } from './dag-timeline-helpers';
import type { CorrectiveTaskEntry } from '@/types/state';

interface DAGCorrectiveTaskGroupProps {
  correctiveTasks: CorrectiveTaskEntry[];
  /** The iteration key (iter-...) the corrective is nested under. Used as the `parentIterationKey` argument to buildCorrectiveItemValue (AD-3). */
  parentIterationKey: string;
  parentNodeId: string;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  focusedRowKey: string | null;
  onFocusChange: (nodeId: string) => void;
  expandedLoopIds: string[];
  onAccordionChange: (value: string[], eventDetails: { reason: string }) => void;
}

export const GROUP_ARIA_LABEL = "Corrective tasks";
export const CORRECTIVE_CHILD_DEPTH = 2;

export function buildCorrectiveChildNodeId(parentNodeId: string, ctIndex: number, childNodeId: string): string {
  return `${parentNodeId}.ct${ctIndex}.${childNodeId}`;
}

export function buildTriggerText(index: number): string {
  return `Corrective Task ${index}`;
}

function CorrectiveRow({
  entry,
  parentIterationKey,
  isFocused,
  onFocusChange,
  parentNodeId,
  currentNodePath,
  onDocClick,
  repoBaseUrl,
  focusedRowKey,
}: {
  entry: CorrectiveTaskEntry;
  parentIterationKey: string;
  isFocused: boolean;
  onFocusChange: (id: string) => void;
  parentNodeId: string;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  focusedRowKey: string | null;
}) {
  const itemValue = buildCorrectiveItemValue(parentIterationKey, entry.index);
  const handleFocus = useCallback(() => onFocusChange(itemValue), [itemValue, onFocusChange]);
  const commitData = getCommitLinkData(entry.commit_hash, repoBaseUrl);
  const compatibleNodes = filterCompatibleNodes(entry.nodes);
  const statusEntry = STATUS_MAP[entry.status];
  return (
    <AccordionItem value={buildCorrectiveItemValue(parentIterationKey, entry.index)}>
      {/*
        Header row — AccordionTrigger wraps ONLY the icon + text so that
        DocumentLink (a <button>) and ExternalLink (an <a>) render as SIBLINGS of
        the trigger, not nested inside it. Nesting interactive controls inside a
        <button> is invalid HTML and breaks click/keyboard behavior.
        Mirrors the clean pattern already in dag-iteration-panel.tsx.
      */}
      <div className="flex items-center gap-2 rounded-md hover:bg-accent/50">
        {/*
          flex-1 lives on this wrapper <div> — NOT on AccordionTrigger's className —
          because AccordionTrigger renders AccordionPrimitive.Header (hardcoded
          className="flex") wrapping the inner Trigger <button>. Putting flex-1 on
          the Trigger is a no-op for the row layout.

          Padding + w-full live on the Trigger so the entire padded band of the
          flex-1 column is part of the <button>'s click/focus target.
        */}
        <div className="flex-1">
          <AccordionTrigger
            role="option"
            aria-selected={false}
            aria-label={`${buildTriggerText(entry.index)} — ${statusEntry.defaultLabel}`}
            className="hover:no-underline gap-2 items-center py-2 px-3 border-0 w-full"
            data-timeline-row
            data-row-key={itemValue}
            tabIndex={isFocused ? 0 : -1}
            onFocus={handleFocus}
          >
            <NodeStatusBadge
              status={entry.status}
              iconOnly={entry.status === 'completed'}
            />
            <span className="text-sm font-medium">{buildTriggerText(entry.index)}</span>
          </AccordionTrigger>
        </div>
        {entry.doc_path != null && entry.doc_path !== '' && (
          // Rendered OUTSIDE AccordionTrigger — see header comment. No tabIndex
          // override: the trigger consumes Enter/Space for expand/collapse, so
          // keyboard users reach this link via natural tab order.
          <DocumentLink path={entry.doc_path} label="Doc" onDocClick={onDocClick} />
        )}
        {commitData !== null && (
          commitData.href !== null ? (
            // No tabIndex override: rendered OUTSIDE AccordionTrigger.
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
      <AccordionContent>
        {compatibleNodes.map(([childNodeId, childNode]) => {
          const childKey = buildCorrectiveChildNodeId(parentNodeId, entry.index, childNodeId);
          return (
            <DAGNodeRow
              key={childNodeId}
              nodeId={childKey}
              node={childNode}
              depth={CORRECTIVE_CHILD_DEPTH}
              currentNodePath={currentNodePath}
              onDocClick={onDocClick}
              isFocused={focusedRowKey === childKey}
              onFocusChange={onFocusChange}
            />
          );
        })}
      </AccordionContent>
    </AccordionItem>
  );
}

export function DAGCorrectiveTaskGroup({
  correctiveTasks,
  parentIterationKey,
  parentNodeId,
  currentNodePath,
  onDocClick,
  repoBaseUrl,
  focusedRowKey,
  onFocusChange,
  expandedLoopIds,
  onAccordionChange,
}: DAGCorrectiveTaskGroupProps) {
  if (correctiveTasks.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={GROUP_ARIA_LABEL}
      className="mt-2 border-l-2 border-dashed border-[var(--color-warning)] pl-3 ml-3"
    >
      <span className="text-xs text-muted-foreground font-medium mb-1 block">Corrective Tasks</span>
      <Accordion multiple value={expandedLoopIds} onValueChange={onAccordionChange}>
        {correctiveTasks.map((entry) => (
          <CorrectiveRow
            key={entry.index}
            entry={entry}
            parentIterationKey={parentIterationKey}
            isFocused={focusedRowKey === buildCorrectiveItemValue(parentIterationKey, entry.index)}
            onFocusChange={onFocusChange}
            parentNodeId={parentNodeId}
            currentNodePath={currentNodePath}
            onDocClick={onDocClick}
            repoBaseUrl={repoBaseUrl}
            focusedRowKey={focusedRowKey}
          />
        ))}
      </Accordion>
    </div>
  );
}
