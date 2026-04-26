"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { DAGNodeRow } from './dag-node-row';
import { DAGCorrectiveTaskGroup } from './dag-corrective-task-group';
import { DAGLoopNode } from './dag-loop-node';
import { DocumentLink, ExternalLink } from '@/components/documents';
import { SpinnerBadge, ReviewVerdictBadge } from '@/components/badges';
import { ProgressBar } from '@/components/execution/progress-bar';
import { STATUS_MAP } from './node-status-badge';
import { getCommitLinkData, isLoopNode, parsePhaseNameFromDocPath, parseTaskNameFromDocPath, buildIterationItemValue, deriveIterationTaskProgress } from './dag-timeline-helpers';
import type { IterationEntry, ReviewVerdict } from '@/types/state';

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

function renderStatusIcon(status: IterationEntry['status']) {
  const entry = STATUS_MAP[status];
  return (
    <SpinnerBadge
      label={entry.defaultLabel}
      cssVar={entry.cssVar}
      isSpinning={entry.isSpinning}
      isComplete={entry.isComplete}
      isRejected={entry.isRejected}
      ariaLabel={entry.defaultLabel}
      hideLabel
    />
  );
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
    // task-iteration variant unchanged for P02-T01 — handled in P02-T02
    switch (iteration.status) {
      case 'in_progress':
        cardClasses = 'border border-border/70 bg-card rounded-md p-2 mb-1.5';
        break;
      case 'completed':
        cardClasses = 'border border-border/50 bg-muted/30 rounded-md p-2 mb-1.5';
        break;
      case 'failed':
      case 'halted':
        cardClasses = 'border border-[var(--status-failed)] bg-card rounded-md p-2 mb-1.5';
        break;
      default:
        cardClasses = 'border border-border/40 bg-card rounded-md p-2 mb-1.5';
    }
  }

  const ariaLabel = parentKind === 'for_each_phase'
    ? `Phase iteration ${iterationIndex + 1} — ${iterationName} — ${iteration.status}`
    : `Task iteration ${iterationIndex + 1} — ${iterationName} — ${iteration.status}`;

  if (parentKind === 'for_each_phase') {
    const phaseReportNode = iteration.nodes['phase_report'];
    const phaseReviewNode = iteration.nodes['phase_review'];
    const phaseReportPath = phaseReportNode?.kind === 'step' ? phaseReportNode.doc_path : null;
    const phaseReviewPath = phaseReviewNode?.kind === 'step' ? phaseReviewNode.doc_path : null;
    const phaseReviewVerdict = phaseReviewNode?.kind === 'step' ? (phaseReviewNode.verdict ?? null) : null;
    const progress = deriveIterationTaskProgress(iteration);
    const headerAriaLabel = `Phase iteration ${iterationIndex + 1} — ${iterationName} — ${iteration.status}`;
    return (
      <Accordion multiple value={expandedLoopIds} onValueChange={onAccordionChange}>
        <AccordionItem value={buildIterationItemValue(parentNodeId, iterationIndex)} className={cardClasses}>
          <div className="flex items-center gap-2 rounded-md hover:bg-accent/50">
            <div className="flex-1">
              <AccordionTrigger
                role="option"
                aria-selected={false}
                aria-label={headerAriaLabel}
                className="hover:no-underline gap-2 items-center py-2 px-3 border-0 w-full"
                data-timeline-row
                data-row-key={buildIterationItemValue(parentNodeId, iterationIndex)}
              >
                {renderStatusIcon(iteration.status)}
                <span className={isFallback ? 'text-sm italic text-muted-foreground truncate min-w-0' : 'text-sm font-medium truncate min-w-0'}>
                  {iterationName}
                </span>
                {progress !== null && (
                  <div className="flex-1 min-w-24">
                    <ProgressBar completed={progress.completed} total={progress.total} />
                  </div>
                )}
              </AccordionTrigger>
            </div>
            {iteration.doc_path != null && iteration.doc_path !== '' && (
              <DocumentLink path={iteration.doc_path} label="Phase Plan" onDocClick={onDocClick} />
            )}
          </div>
          <AccordionContent>
            {/* Body: task iteration list + footer (Phase Report / Review) — populated in P02-T02 + P03-T01 */}
            {Object.entries(iteration.nodes).map(([childNodeId, childNode]) => {
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
              ) : null;
            })}
            <DAGCorrectiveTaskGroup
              correctiveTasks={iteration.corrective_tasks}
              parentNodeId={correctiveGroupParentId}
              currentNodePath={currentNodePath}
              onDocClick={onDocClick}
              repoBaseUrl={repoBaseUrl}
              focusedRowKey={focusedRowKey}
              onFocusChange={onFocusChange}
            />
            {(phaseReviewVerdict != null || phaseReportPath != null || phaseReviewPath != null) && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t pl-2">
                {phaseReviewVerdict != null && (
                  <ReviewVerdictBadge verdict={phaseReviewVerdict as ReviewVerdict} />
                )}
                {phaseReportPath != null && (
                  <DocumentLink path={phaseReportPath} label="Phase Report" onDocClick={onDocClick} />
                )}
                {phaseReviewPath != null && (
                  <DocumentLink path={phaseReviewPath} label="Phase Review" onDocClick={onDocClick} />
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  // task-iteration branch — preserved for P02-T02
  const headerClass = 'py-1 flex items-center gap-2 mb-1';

  return (
    <div className={cardClasses} aria-label={ariaLabel}>
      <div className={headerClass}>
        <span className={isFallback ? 'text-sm italic text-muted-foreground truncate max-w-[60%] min-w-0' : 'text-sm font-medium truncate max-w-[60%] min-w-0'}>
          {iterationName}
        </span>
        {iteration.doc_path != null && iteration.doc_path !== '' && (
          // Gate on iteration.doc_path (new shape) only — NOT on the combined `docPath` that
          // includes the legacy `phase_planning` / `task_handoff` fallback. Legacy projects
          // already render a Doc button on those synthetic child rows via DAGNodeRow; adding
          // a second one here would duplicate the link on every pre-unify completed project.
          <DocumentLink path={iteration.doc_path} label="Doc" onDocClick={onDocClick} />
        )}
        {commitData !== null && (
          commitData.href !== null ? (
            // No tabIndex override: this header <div> has no row-level focus
            // wiring (unlike DAGNodeRow, which owns a roving tabindex + keydown
            // handler), so keyboard users must reach the commit link via
            // natural tab order. Same rationale as DocumentLink above.
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
      {Object.entries(iteration.nodes).map(([childNodeId, childNode]) => {
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
    </div>
  );
}
