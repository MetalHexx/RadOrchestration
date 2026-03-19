"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskStage, PhaseStage, TaskStatus, PhaseStatus } from "@/types/state";

interface StageBadgeProps {
  stage: TaskStage | PhaseStage;
  status: PhaseStatus | TaskStatus;
}

const STAGE_CONFIG: Record<string, { label: string; cssVar: string }> = {
  planning:  { label: "Planning",  cssVar: "--tier-planning" },
  coding:    { label: "Coding",    cssVar: "--tier-execution" },
  executing: { label: "Executing", cssVar: "--tier-execution" },
  reporting: { label: "Reporting", cssVar: "--chart-2" },
  reviewing: { label: "Reviewing", cssVar: "--tier-review" },
  complete:  { label: "Complete",  cssVar: "--status-complete" },
  failed:    { label: "Failed",    cssVar: "--status-failed" },
};

const NOT_STARTED_CONFIG = { label: "Not Started", cssVar: "--status-not-started" };

export function StageBadge({ stage, status }: StageBadgeProps) {
  if (status === 'not_started') {
    const config = NOT_STARTED_CONFIG;
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-transparent"
        style={{
          backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
          color: `var(${config.cssVar})`,
        }}
        aria-label={`Stage: ${config.label}`}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: `var(${config.cssVar})` }}
          aria-hidden="true"
        />
        {config.label}
      </Badge>
    );
  }

  if (stage === 'complete' || stage === 'failed') {
    return null;
  }

  const config = STAGE_CONFIG[stage];

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-transparent"
      style={{
        backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
        color: `var(${config.cssVar})`,
      }}
      aria-label={`Stage: ${config.label}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `var(${config.cssVar})` }}
        aria-hidden="true"
      />
      {config.label}
    </Badge>
  );
}
