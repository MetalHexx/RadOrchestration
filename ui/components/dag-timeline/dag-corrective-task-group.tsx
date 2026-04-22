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
              <AccordionTrigger className="hover:no-underline py-2 px-3 rounded-md gap-2 hover:bg-accent/50 items-center">
                <span className="text-sm font-medium">{buildTriggerText(entry.index)}</span>
                <NodeStatusBadge status={entry.status} />
                {entry.doc_path != null && entry.doc_path !== '' && (
                  // Mirrors the iteration-panel pattern (dag-iteration-panel.tsx:132-138):
                  // post-unify, CorrectiveTaskEntry.doc_path carries the corrective handoff
                  // doc path (entry.nodes can be empty), so the group itself renders the Doc
                  // button. No tabIndex override — the AccordionTrigger consumes Enter/Space
                  // for expand/collapse, so keyboard users must reach this link via natural
                  // tab order.
                  <DocumentLink path={entry.doc_path} label="Doc" onDocClick={onDocClick} />
                )}
                {commitData !== null && (
                  commitData.href !== null ? (
                    <ExternalLink
                      href={commitData.href}
                      label={commitData.label}
                      icon="external-link"
                      tabIndex={-1}
                    />
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      {commitData.label}
                    </span>
                  )
                )}
              </AccordionTrigger>
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
