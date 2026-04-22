"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { DAGNodeRow } from './dag-node-row';
import { NodeStatusBadge } from './node-status-badge';
import { DocumentLink, ExternalLink } from '@/components/documents';
import { getCommitLinkData, filterCompatibleNodes } from './dag-timeline-helpers';
import type { CorrectiveTaskEntry } from '@/types/state';

interface DAGCorrectiveTaskGroupProps {
  correctiveTasks: CorrectiveTaskEntry[];
  parentNodeId: string;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  focusedRowKey: string | null;
  onFocusChange: (nodeId: string) => void;
}

export const GROUP_ARIA_LABEL = "Corrective tasks";
export const CORRECTIVE_CHILD_DEPTH = 2;

export function buildCorrectiveChildNodeId(parentNodeId: string, ctIndex: number, childNodeId: string): string {
  return `${parentNodeId}.ct${ctIndex}.${childNodeId}`;
}

export function buildTriggerText(index: number): string {
  return `Corrective Task ${index}`;
}

export function DAGCorrectiveTaskGroup({
  correctiveTasks,
  parentNodeId,
  currentNodePath,
  onDocClick,
  repoBaseUrl,
  focusedRowKey,
  onFocusChange,
}: DAGCorrectiveTaskGroupProps) {
  if (correctiveTasks.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={GROUP_ARIA_LABEL}
      className="mt-2 border-l-2 border-dashed border-[var(--color-warning)] pl-3 ml-3"
    >
      <span className="text-xs text-muted-foreground font-medium mb-1 block">
        Corrective Tasks
      </span>
      <Accordion multiple>
        {correctiveTasks.map((entry) => {
          const commitData = getCommitLinkData(entry.commit_hash, repoBaseUrl);
          const compatibleNodes = filterCompatibleNodes(entry.nodes);

          return (
            <AccordionItem key={entry.index} value={String(entry.index)}>
              {/*
                Header row — AccordionTrigger wraps ONLY the text + status badge so that
                DocumentLink (a <button>) and ExternalLink (an <a>) render as SIBLINGS of
                the trigger, not nested inside it. Nesting interactive controls inside a
                <button> is invalid HTML and breaks click/keyboard behavior (clicking the
                Doc link would also toggle the accordion, and ARIA/focus is undefined).
                Mirrors the clean pattern already in dag-iteration-panel.tsx:126-153, which
                uses a plain <div> header with sibling links.

                Hover/rounded classes sit on the outer row <div> so the whole header band
                (trigger + sibling links) reacts to hover as a single unit. Padding lives on
                the AccordionTrigger itself (not the outer row) so the full padded band is
                part of the <button>'s click/focus target — see the inner comment below.
              */}
              <div className="flex items-center gap-2 rounded-md hover:bg-accent/50">
                {/*
                  flex-1 lives on this wrapper <div> — NOT on AccordionTrigger's className —
                  because AccordionTrigger renders AccordionPrimitive.Header (hardcoded
                  className="flex" in ui/components/ui/accordion.tsx) wrapping the inner
                  Trigger <button>. The Header is therefore the actual flex item in THIS row,
                  and the className prop is applied to the inner Trigger. Putting flex-1 on
                  the Trigger is a no-op for the row layout; it must sit on a wrapper that is
                  a real direct child of this flex row so the Doc/commit link siblings are
                  pushed to the right edge.

                  Padding + w-full live on the Trigger (not the outer row) so that the entire
                  padded band of the flex-1 column is part of the <button>'s click/focus
                  target. Pre-R6 the whole row WAS a <button>; post-R6 (when Doc/commit links
                  had to become siblings to avoid nested interactive controls) padding briefly
                  moved onto the outer <div> and the click area shrank to the Trigger's
                  content height — Copilot R11 flagged that as a UX/a11y regression. Moving
                  padding + w-full back onto the Trigger restores the pre-R6 full-band
                  clickable behavior while keeping DocumentLink / ExternalLink outside the
                  trigger. Hover/rounded stay on the outer row so the entire header band
                  (trigger + sibling links) still reacts to hover as a single unit.
                */}
                <div className="flex-1">
                  <AccordionTrigger className="hover:no-underline gap-2 items-center py-2 px-3 border-0 w-full">
                    <span className="text-sm font-medium">{buildTriggerText(entry.index)}</span>
                    <NodeStatusBadge status={entry.status} />
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
                    // No tabIndex override: rendered OUTSIDE AccordionTrigger
                    // (see header comment). The trigger consumes Enter/Space
                    // for expand/collapse, so keyboard users must reach this
                    // link via natural tab order. Same rationale as
                    // DocumentLink above.
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
        })}
      </Accordion>
    </div>
  );
}
