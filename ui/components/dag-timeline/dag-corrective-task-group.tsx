"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { DAGNodeRow } from './dag-node-row';
import { NodeStatusBadge } from './node-status-badge';
import { ExternalLink } from '@/components/documents';
import type { CorrectiveTaskEntry, NodeState, StepNodeState, GateNodeState, ConditionalNodeState, ParallelNodeState } from '@/types/state';

interface DAGCorrectiveTaskGroupProps {
  correctiveTasks: CorrectiveTaskEntry[];
  parentNodeId: string;
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
}

export const GROUP_ARIA_LABEL = "Corrective tasks";
export const CHILD_DEPTH = 2;

export function buildChildNodeId(parentNodeId: string, ctIndex: number, childNodeId: string): string {
  return `${parentNodeId}.ct${ctIndex}.${childNodeId}`;
}

export function getCommitLinkData(commitHash: string | null): { href: string; label: string } | null {
  if (commitHash === null) return null;
  return {
    href: `#${commitHash}`,
    label: commitHash.slice(0, 7),
  };
}

export function filterCompatibleNodes(
  nodes: Record<string, NodeState>
): Array<[string, StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState]> {
  const all = Object.entries(nodes) as Array<[string, NodeState]>;
  const filtered = all.filter(([, node]) => node.kind !== 'for_each_phase' && node.kind !== 'for_each_task');
  return filtered as Array<[string, StepNodeState | GateNodeState | ConditionalNodeState | ParallelNodeState]>;
}

export function buildTriggerText(index: number): string {
  return `Corrective Task ${index}`;
}

export function shouldRenderGroup(correctiveTasks: CorrectiveTaskEntry[]): boolean {
  return correctiveTasks.length > 0;
}

export function DAGCorrectiveTaskGroup({
  correctiveTasks,
  parentNodeId,
  currentNodePath,
  onDocClick,
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
          const commitData = getCommitLinkData(entry.commit_hash);
          const compatibleNodes = filterCompatibleNodes(entry.nodes);

          return (
            <AccordionItem key={entry.index} value={String(entry.index)}>
              <AccordionTrigger>
                <span className="text-sm font-medium">{buildTriggerText(entry.index)}</span>
                <NodeStatusBadge status={entry.status} />
                {commitData !== null && (
                  <ExternalLink href={commitData.href} label={commitData.label} icon="github" />
                )}
              </AccordionTrigger>
              <AccordionContent>
                {compatibleNodes.map(([childNodeId, childNode]) => (
                  <DAGNodeRow
                    key={childNodeId}
                    nodeId={buildChildNodeId(parentNodeId, entry.index, childNodeId)}
                    node={childNode}
                    depth={CHILD_DEPTH}
                    currentNodePath={currentNodePath}
                    onDocClick={onDocClick}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
