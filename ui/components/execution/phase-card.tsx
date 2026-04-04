"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { ReviewVerdictBadge } from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import { StageBadge } from "@/components/badges/stage-badge";
import { ProgressBar } from "@/components/execution/progress-bar";
import { TaskCard } from "@/components/execution/task-card";
import type { Phase } from "@/types/state";

interface PhaseCardProps {
  phase: Phase;
  phaseNumber: number;
  isActive: boolean;
  maxRetries: number;
  onDocClick: (path: string) => void;
  remoteUrl: string | null;
}

export function PhaseCard({
  phase,
  phaseNumber,
  isActive,
  maxRetries,
  onDocClick,
  remoteUrl,
}: PhaseCardProps) {
  const completedTasks = phase.tasks.filter(
    (t) => t.status === "complete"
  ).length;

  const borderColor =
    phase.status === "halted"
      ? "var(--status-failed)"
      : isActive
        ? "var(--status-in-progress)"
        : "transparent";

  return (
    <div
      className="border-l-2 rounded-md"
      style={{ borderLeftColor: borderColor }}
      aria-label={`Phase ${phaseNumber}: ${phase.name}`}
    >
      <Accordion>
        <AccordionItem>
          <AccordionTrigger>
            <div className="flex items-center gap-2 flex-1 mr-2 pl-3">
              <StageBadge stage={phase.stage} status={phase.status} />
              <span className="font-medium whitespace-nowrap">
                Phase {phaseNumber}: {phase.name}
              </span>
              <div className="flex-1 min-w-24">
                <ProgressBar
                  completed={completedTasks}
                  total={phase.tasks.length}
                  status={phase.status}
                />
              </div>
              {phase.docs.phase_plan && (
                <div
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <DocumentLink
                    path={phase.docs.phase_plan}
                    label="Phase Plan"
                    onDocClick={onDocClick}
                  />
                </div>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div role="list" className="space-y-1 pl-3">
              {phase.tasks.map((task, index) => (
                <TaskCard
                  key={index}
                  task={task}
                  taskNumber={index + 1}
                  maxRetries={maxRetries}
                  onDocClick={onDocClick}
                  remoteUrl={remoteUrl}
                />
              ))}
            </div>
            {(phase.review.verdict || phase.docs.phase_review || phase.docs.phase_report) && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t pl-2">
                {phase.review.verdict && (
                  <ReviewVerdictBadge verdict={phase.review.verdict} />
                )}
                {phase.docs.phase_report && (
                  <DocumentLink
                    path={phase.docs.phase_report}
                    label="Phase Report"
                    onDocClick={onDocClick}
                  />
                )}
                {phase.docs.phase_review && (
                  <DocumentLink
                    path={phase.docs.phase_review}
                    label="Phase Review"
                    onDocClick={onDocClick}
                  />
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}