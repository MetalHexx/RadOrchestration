"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectHeader } from "@/components/dashboard/project-header";
import { ErrorSummaryBanner } from "@/components/planning/error-summary-banner";
import { PlanningSection } from "@/components/dashboard/planning-section";
import { ExecutionSection } from "@/components/execution/execution-section";
import { FinalReviewSection } from "@/components/dashboard/final-review-section";
import { ErrorLogSection } from "@/components/dashboard/error-log-section";
import { OtherDocsSection } from "@/components/dashboard";
import { GateHistorySection } from "@/components/dashboard/gate-history-section";
import { LimitsSection } from "@/components/dashboard/limits-section";
import { NotInitializedView } from "./not-initialized-view";
import { MalformedStateView } from "./malformed-state-view";
import type { NormalizedProjectState } from "@/types/state";
import type { ProjectSummary, GateEntry } from "@/types/components";

interface MainDashboardProps {
  projectState: NormalizedProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
  errorLogPath?: string | null;
  otherDocs?: string[];
}

function deriveGateEntries(state: NormalizedProjectState): GateEntry[] {
  const gates: GateEntry[] = [];

  // Post-Planning gate
  gates.push({
    gate: "Post-Planning",
    approved: state.planning.human_approved,
  });

  // Per-phase gates
  for (const phase of state.execution.phases) {
    gates.push({
      gate: `Phase ${phase.phase_number}: ${phase.title}`,
      approved: phase.human_approved,
    });
  }

  // Final Review gate
  if (state.final_review.status !== "not_started") {
    gates.push({
      gate: "Final Review",
      approved: state.final_review.human_approved,
    });
  }

  return gates;
}

export function MainDashboard({
  projectState,
  project,
  onDocClick,
  errorLogPath,
  otherDocs,
}: MainDashboardProps) {
  // Malformed state takes priority
  if (projectState === null && project.hasMalformedState) {
    return (
      <MalformedStateView
        projectName={project.name}
        errorMessage={project.errorMessage ?? "Unable to parse state.json"}
      />
    );
  }

  // Not initialized
  if (projectState === null && !project.hasState) {
    return (
      <NotInitializedView
        projectName={project.name}
        brainstormingDoc={project.brainstormingDoc}
        onDocClick={onDocClick}
      />
    );
  }

  // No state available (fallback)
  if (projectState === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          No project state available.
        </p>
      </div>
    );
  }

  const gates = deriveGateEntries(projectState);

  return (
    <ScrollArea className="h-[calc(100vh-56px)]">
      <div className="space-y-6 p-6">
        <ErrorSummaryBanner
          blockers={projectState.errors.active_blockers}
          totalRetries={projectState.errors.total_retries}
          totalHalts={projectState.errors.total_halts}
        />

        <ProjectHeader
          project={projectState.project}
          tier={projectState.pipeline.current_tier}
          gateMode={projectState.pipeline.human_gate_mode}
        />

        <PlanningSection
          planning={projectState.planning}
          projectName={projectState.project.name}
          onDocClick={onDocClick}
        />

        <ExecutionSection
          execution={projectState.execution}
          limits={projectState.limits}
          onDocClick={onDocClick}
        />

        <FinalReviewSection
          finalReview={projectState.final_review}
          projectName={projectState.project.name}
          pipelineTier={projectState.pipeline.current_tier}
          onDocClick={onDocClick}
        />

        <ErrorLogSection errors={projectState.errors} errorLogPath={errorLogPath} onDocClick={onDocClick} />

        <OtherDocsSection files={otherDocs ?? []} onDocClick={onDocClick} />

        <GateHistorySection gates={gates} />

        <LimitsSection limits={projectState.limits} />
      </div>
    </ScrollArea>
  );
}
