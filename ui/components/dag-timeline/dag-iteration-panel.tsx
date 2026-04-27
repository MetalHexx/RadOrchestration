"use client";

import { useCallback } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { DAGNodeRow } from './dag-node-row';
import { DAGCorrectiveTaskGroup } from './dag-corrective-task-group';
import { DAGLoopNode } from './dag-loop-node';
import { DocumentLink, ExternalLink } from '@/components/documents';
import { ProgressBar } from '@/components/execution/progress-bar';
import { NodeStatusBadge } from './node-status-badge';
import { getCommitLinkData, isLoopNode, parsePhaseNameFromDocPath, parseTaskNameFromDocPath, buildIterationItemValue, deriveIterationTaskProgress, deriveIterationBadgeLabel, shouldRenderTimelineRow } from './dag-timeline-helpers';
import type { CompatibleNodeState } from './dag-timeline-helpers';
import type { IterationEntry } from '@/types/state';

interface DAGIterationPanelProps {
  iteration: IterationEntry;
  iterationIndex: number;
  parentNodeId: string;
  parentKind: 'for_each_phase' | 'for_each_task';
  currentNodePath: string | null;
  onDocClick: (path: string) => void;
  repoBaseUrl: string | null;
  projectName: string;
  expandedLoopIds: string[];
  onAccordionChange: (
    value: string[],
    eventDetails: { reason: string }
  ) => void;
  focusedRowKey: string | null;
  onFocusChange: (nodeId: string) => void;
}

export const ITERATION_CHILD_DEPTH = 1;

export function buildIterationLabel(iterationIndex: number): string {
  return `Iteration ${iterationIndex + 1}`;
}

export function buildIterationChildNodeId(parentNodeId: string, iterationIndex: number, childNodeId: string): string {
  return `${parentNodeId}.iter${iterationIndex}.${childNodeId}`;
}

export function buildCorrectiveGroupParentId(parentNodeId: string, iterationIndex: number): string {
  return `${parentNodeId}.iter${iterationIndex}`;
}

export function DAGIterationPanel({
  iteration,
  iterationIndex,
  parentNodeId,
  parentKind,
  currentNodePath,
  onDocClick,
  repoBaseUrl,
  projectName,
  expandedLoopIds,
  onAccordionChange,
  focusedRowKey,
  onFocusChange,
}: DAGIterationPanelProps) {
  const commitData = getCommitLinkData(iteration.commit_hash, repoBaseUrl);
  const correctiveGroupParentId = buildCorrectiveGroupParentId(parentNodeId, iterationIndex);

  // Derive iteration name from iteration.doc_path (post-unify) with a
  // fallback to the legacy per-iteration synthetic nodes
  // (`phase_planning` / `task_handoff`) so existing completed projects
  // browsed via the UI keep their labels.
  let iterationName: string;
  let isFallback: boolean;
  let docPath: string | null;

  if (parentKind === 'for_each_phase') {
    const phaseNode = iteration.nodes['phase_planning'];
    const legacyDocPath = (phaseNode && 'doc_path' in phaseNode) ? phaseNode.doc_path : null;
    docPath = iteration.doc_path ?? legacyDocPath ?? null;
    isFallback = !docPath;
    iterationName = parsePhaseNameFromDocPath(docPath, iterationIndex);
  } else {
    const taskNode = iteration.nodes['task_handoff'];
    const legacyDocPath = (taskNode && 'doc_path' in taskNode) ? taskNode.doc_path : null;
    docPath = iteration.doc_path ?? legacyDocPath ?? null;
    isFallback = !docPath;
    iterationName = parseTaskNameFromDocPath(docPath, iterationIndex);
  }

  // Shared roving-tabindex wiring (FR-16, AD-5)
  const itemValue = buildIterationItemValue(parentNodeId, iterationIndex);
  const isFocused = focusedRowKey === itemValue;
  const handleFocus = useCallback(() => {
    onFocusChange(itemValue);
  }, [itemValue, onFocusChange]);

  // Compute card container classes
  let cardClasses: string;

  if (parentKind === 'for_each_phase') {
    switch (iteration.status) {
      case 'in_progress':
        cardClasses = 'border border-[var(--color-link)] bg-card rounded-md mb-2';
        break;
      case 'completed':
        cardClasses = 'border border-border bg-muted/50 rounded-md mb-2';
        break;
      case 'failed':
      case 'halted':
        cardClasses = 'border border-[var(--status-failed)] bg-card rounded-md mb-2';
        break;
      default:
        cardClasses = 'border border-border bg-card rounded-md mb-2';
    }
  } else {
    switch (iteration.status) {
      case 'in_progress':
        cardClasses = 'border border-border/70 bg-card rounded-md mb-1.5';
        break;
      case 'completed':
        cardClasses = 'border border-border/50 bg-muted/30 rounded-md mb-1.5';
        break;
      case 'failed':
      case 'halted':
        cardClasses = 'border border-[var(--status-failed)] bg-card rounded-md mb-1.5';
        break;
      default:
        cardClasses = 'border border-border/40 bg-card rounded-md mb-1.5';
    }
  }

  if (parentKind === 'for_each_phase') {
    const progress = deriveIterationTaskProgress(iteration);
    const derivedBadge = deriveIterationBadgeLabel(iteration);
    const headerAriaLabel = `Phase iteration ${iterationIndex + 1} — ${iterationName} — ${derivedBadge.label}`;
    const hasPhasePlan = iteration.doc_path != null && iteration.doc_path !== '';
    return (
      <Accordion multiple value={expandedLoopIds} onValueChange={onAccordionChange}>
        <AccordionItem value={buildIterationItemValue(parentNodeId, iterationIndex)} className={cardClasses}>
          <div className="relative flex items-center gap-2 rounded-md hover:bg-accent/50 pr-3">
            <div className="flex-1 flex items-center gap-2 min-w-0 [&>h3]:flex-1 [&>h3]:min-w-0">
              <AccordionTrigger
                role="option"
                aria-selected={false}
                aria-label={headerAriaLabel}
                className="hover:no-underline gap-2 items-center py-2 px-3 border-0 w-full"
                data-timeline-row
                data-row-key={itemValue}
                tabIndex={isFocused ? 0 : -1}
                onFocus={handleFocus}
              >
                <NodeStatusBadge
                  status={derivedBadge.status}
                  label={derivedBadge.label}
                  iconOnly={iteration.status === 'completed'}
                />
                <span className={isFallback ? 'text-sm italic text-muted-foreground truncate min-w-0' : 'text-sm font-medium truncate min-w-0'}>
                  {iterationName}
                </span>
                {progress !== null && (
                  <div className="flex-1 min-w-24">
                    <ProgressBar
                      completed={progress.completed}
                      total={progress.total}
                      showCount={progress.total > 0}
                    />
                  </div>
                )}
                {/* Invisible placeholder reserves layout space for the absolute-positioned Phase Plan link below; chevron auto-renders next via shadcn's ml-auto on data-slot=accordion-trigger-icon. The pl-3 widens the reserved area so the visible Phase Plan link doesn't crowd the ProgressBar's "N/N tasks" label. */}
                {hasPhasePlan && (
                  <span aria-hidden="true" className="invisible inline-flex items-center gap-1.5 pl-3 text-sm shrink-0">
                    <span className="inline-block h-3.5 w-3.5" />
                    <span>Phase Plan</span>
                  </span>
                )}
              </AccordionTrigger>
            </div>
            {hasPhasePlan && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2 z-10">
                <DocumentLink path={iteration.doc_path!} label="Phase Plan" onDocClick={onDocClick} />
              </div>
            )}
          </div>
          <AccordionContent>
            <div className="border-l border-border pl-3 ml-3">
              {/* Body: task iteration list (phase_review verdict now rendered inline on its row, see DD-11/FR-16) */}
              {Object.entries(iteration.nodes).filter(([childNodeId, childNode]) =>
                shouldRenderTimelineRow(childNodeId, childNode as CompatibleNodeState, { commitHash: iteration.commit_hash ?? null, prUrl: null })
              ).map(([childNodeId, childNode]) => {
                const childKey = buildIterationChildNodeId(parentNodeId, iterationIndex, childNodeId);
                return isLoopNode(childNode) ? (
                  <DAGLoopNode
                    key={childNodeId}
                    nodeId={childKey}
                    node={childNode}
                    currentNodePath={currentNodePath}
                    onDocClick={onDocClick}
                    expandedLoopIds={expandedLoopIds}
                    onAccordionChange={onAccordionChange}
                    repoBaseUrl={repoBaseUrl}
                    projectName={projectName}
                    focusedRowKey={focusedRowKey}
                    isFocused={focusedRowKey === childKey}
                    onFocusChange={onFocusChange}
                  />
                ) : (
                  <DAGNodeRow
                    key={childNodeId}
                    nodeId={childKey}
                    node={childNode}
                    depth={ITERATION_CHILD_DEPTH}
                    currentNodePath={currentNodePath}
                    onDocClick={onDocClick}
                    isFocused={focusedRowKey === childKey}
                    onFocusChange={onFocusChange}
                  />
                );
              })}
              <DAGCorrectiveTaskGroup
                correctiveTasks={iteration.corrective_tasks}
                parentIterationKey={itemValue}
                parentNodeId={correctiveGroupParentId}
                currentNodePath={currentNodePath}
                onDocClick={onDocClick}
                repoBaseUrl={repoBaseUrl}
                focusedRowKey={focusedRowKey}
                onFocusChange={onFocusChange}
                expandedLoopIds={expandedLoopIds}
                onAccordionChange={onAccordionChange}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  // for_each_task branch (FR-5, FR-9)
  const derivedBadge = deriveIterationBadgeLabel(iteration);
  const headerAriaLabel = `Task iteration ${iterationIndex + 1} — ${iterationName} — ${derivedBadge.label}`;
  const hasTaskHandoff = iteration.doc_path != null && iteration.doc_path !== '';
  const hasCommitLink = commitData !== null && iteration.commit_hash != null;
  const hasAnyTaskTrailing = hasTaskHandoff || hasCommitLink;
  return (
    <Accordion multiple value={expandedLoopIds} onValueChange={onAccordionChange}>
      <AccordionItem value={buildIterationItemValue(parentNodeId, iterationIndex)} className={cardClasses}>
        <div className="relative flex items-center gap-2 rounded-md hover:bg-accent/50 pr-3">
          <div className="flex-1 flex items-center gap-2 min-w-0 [&>h3]:flex-1 [&>h3]:min-w-0">
            <AccordionTrigger
              role="option"
              aria-selected={false}
              aria-label={headerAriaLabel}
              className="hover:no-underline gap-2 items-center py-2 px-3 border-0 w-full"
              data-timeline-row
              data-row-key={itemValue}
              tabIndex={isFocused ? 0 : -1}
              onFocus={handleFocus}
            >
              <NodeStatusBadge
                status={derivedBadge.status}
                label={derivedBadge.label}
                iconOnly={iteration.status === 'completed'}
              />
              <span className={isFallback ? 'text-sm italic text-muted-foreground truncate min-w-0' : 'text-sm font-medium truncate min-w-0'}>
                {iterationName}
              </span>
              {/* Invisible placeholder reserves layout space for the absolute-positioned Task Handoff + Commit links below; pl-3 keeps the visible links from crowding the iteration name when it's long. */}
              {hasAnyTaskTrailing && (
                <span aria-hidden="true" className="invisible ml-auto inline-flex items-center gap-2 pl-3 text-sm shrink-0">
                  {hasTaskHandoff && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5" />
                      <span>Task Handoff</span>
                    </span>
                  )}
                  {hasCommitLink && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-3.5" />
                      <span>{commitData!.label}</span>
                    </span>
                  )}
                </span>
              )}
            </AccordionTrigger>
          </div>
          {hasAnyTaskTrailing && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 z-10 flex items-center gap-2">
              {hasTaskHandoff && (
                <DocumentLink path={iteration.doc_path!} label="Task Handoff" onDocClick={onDocClick} />
              )}
              {hasCommitLink && (
                commitData!.href !== null ? (
                  <ExternalLink
                    href={commitData!.href}
                    label="Commit"
                    icon="github"
                    title={iteration.commit_hash!}
                  />
                ) : (
                  <span
                    className="text-xs font-mono text-muted-foreground"
                    title={iteration.commit_hash!}
                  >
                    {commitData!.label}
                  </span>
                )
              )}
            </div>
          )}
        </div>
        <AccordionContent>
          {Object.entries(iteration.nodes).filter(([childNodeId, childNode]) =>
            shouldRenderTimelineRow(childNodeId, childNode as CompatibleNodeState, { commitHash: iteration.commit_hash ?? null, prUrl: null })
          ).map(([childNodeId, childNode]) => {
            const childKey = buildIterationChildNodeId(parentNodeId, iterationIndex, childNodeId);
            return isLoopNode(childNode) ? (
              <DAGLoopNode
                key={childNodeId}
                nodeId={childKey}
                node={childNode}
                currentNodePath={currentNodePath}
                onDocClick={onDocClick}
                expandedLoopIds={expandedLoopIds}
                onAccordionChange={onAccordionChange}
                repoBaseUrl={repoBaseUrl}
                projectName={projectName}
                focusedRowKey={focusedRowKey}
                isFocused={focusedRowKey === childKey}
                onFocusChange={onFocusChange}
              />
            ) : (
              <DAGNodeRow
                key={childNodeId}
                nodeId={childKey}
                node={childNode}
                depth={ITERATION_CHILD_DEPTH}
                currentNodePath={currentNodePath}
                onDocClick={onDocClick}
                isFocused={focusedRowKey === childKey}
                onFocusChange={onFocusChange}
              />
            );
          })}
          <DAGCorrectiveTaskGroup
            correctiveTasks={iteration.corrective_tasks}
            parentIterationKey={itemValue}
            parentNodeId={correctiveGroupParentId}
            currentNodePath={currentNodePath}
            onDocClick={onDocClick}
            repoBaseUrl={repoBaseUrl}
            focusedRowKey={focusedRowKey}
            onFocusChange={onFocusChange}
            expandedLoopIds={expandedLoopIds}
            onAccordionChange={onAccordionChange}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
