"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectHeader } from "@/components/dashboard/project-header";
import { PlanningSection } from "@/components/dashboard/planning-section";
import { ExecutionSection } from "@/components/execution/execution-section";
import { FinalReviewSection } from "@/components/dashboard/final-review-section";
import { OtherDocsSection, SourceControlSection } from "@/components/dashboard";
import { NotInitializedView } from "./not-initialized-view";
import { MalformedStateView } from "./malformed-state-view";
import type { ProjectState } from "@/types/state";
import type { ProjectSummary } from "@/types/components";

interface MainDashboardProps {
  projectState: ProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
  otherDocs?: string[];
  maxRetries?: number;
}

export function MainDashboard({
  projectState,
  project,
  onDocClick,
  otherDocs,
  maxRetries = 3,
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

  const remoteUrl = projectState.pipeline.source_control?.remote_url ?? null;

  return (
    <ScrollArea className="h-[calc(100vh-56px)]">
      <div className="space-y-6 p-6">
        <ProjectHeader
          project={projectState.project}
          tier={projectState.pipeline.current_tier}
          gateMode={projectState.pipeline.gate_mode}
          planningStatus={projectState.planning.status}
          executionStatus={projectState.execution.status}
        />

        <PlanningSection
          planning={projectState.planning}
          projectName={projectState.project.name}
          onDocClick={onDocClick}
        />

        {projectState.pipeline.source_control != null && (
          <SourceControlSection sourceControl={projectState.pipeline.source_control} />
        )}

        <ExecutionSection
          execution={projectState.execution}
          maxRetries={maxRetries}
          onDocClick={onDocClick}
          remoteUrl={remoteUrl}
        />

        <FinalReviewSection
          finalReview={projectState.final_review}
          projectName={projectState.project.name}
          pipelineTier={projectState.pipeline.current_tier}
          onDocClick={onDocClick}
        />

        <OtherDocsSection files={otherDocs ?? []} onDocClick={onDocClick} />
      </div>
    </ScrollArea>
  );
}