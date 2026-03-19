"use client";

import { StatusIcon } from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import type { PlanningStep, PlanningStepName } from "@/types/state";

interface PlanningChecklistProps {
  steps: PlanningStep[];
  humanApproved: boolean;
  onDocClick: (path: string) => void;
}

const STEP_DISPLAY_NAMES: Record<PlanningStepName, string> = {
  research: "Research",
  prd: "PRD",
  design: "Design",
  architecture: "Architecture",
  master_plan: "Master Plan",
};

export function PlanningChecklist({
  steps,
  humanApproved,
  onDocClick,
}: PlanningChecklistProps) {
  return (
    <div>
      <ol className="list-none m-0 p-0" aria-label="Planning steps">
        {steps.map((step) => {
          return (
            <li
              key={step.name}
              className="flex items-center gap-2 py-2"
            >
              <StatusIcon status={step.status} />
              <span className="text-sm">{STEP_DISPLAY_NAMES[step.name]}</span>
              <span className="ml-auto">
                <DocumentLink
                  path={step.doc_path}
                  label={
                    step.doc_path
                      ? step.doc_path.split(/[\/\\]/).pop()!.replace(/\.md$/i, '')
                      : STEP_DISPLAY_NAMES[step.name]
                  }
                  onDocClick={onDocClick}
                />
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border my-2" />

      <div className="flex items-center gap-2 py-2">
        <StatusIcon status={humanApproved ? "complete" : "not_started"} />
        <span className="text-sm">Human Approval</span>
        <span className="text-sm ml-auto text-muted-foreground">
          {humanApproved ? "Approved" : "Pending"}
        </span>
      </div>
    </div>
  );
}
