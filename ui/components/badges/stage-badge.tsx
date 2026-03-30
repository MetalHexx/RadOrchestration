"use client";

import { SpinnerBadge } from "./spinner-badge";
import type { TaskStage, PhaseStage, TaskStatus, PhaseStatus } from "@/types/state";

interface StageBadgeProps {
  stage: TaskStage | PhaseStage;
  status: PhaseStatus | TaskStatus;
}

const STAGE_CONFIG: Record<string, { label: string; cssVar: string }> = {
  planning:  { label: "Planning",  cssVar: "--tier-planning" },
  coding:    { label: "Coding",    cssVar: "--tier-execution" },
  executing: { label: "Executing", cssVar: "--tier-execution" },
  reviewing: { label: "Reviewing", cssVar: "--tier-review" },
  complete:  { label: "Complete",  cssVar: "--status-complete" },
  failed:    { label: "Failed",    cssVar: "--status-failed" },
};

const NOT_STARTED_CONFIG = { label: "Not Started", cssVar: "--status-not-started" };

export function StageBadge({ stage, status }: StageBadgeProps) {
  // status === 'not_started' always wins regardless of stage
  if (status === 'not_started') {
    return (
      <SpinnerBadge
        label={NOT_STARTED_CONFIG.label}
        cssVar={NOT_STARTED_CONFIG.cssVar}
        isSpinning={false}
        ariaLabel="Stage: Not Started"
      />
    );
  }

  // Complete stage renders a checkmark badge
  if (stage === 'complete') {
    const config = STAGE_CONFIG['complete'];
    return (
      <SpinnerBadge
        label={config.label}
        cssVar={config.cssVar}
        isSpinning={false}
        isComplete={true}
        hideLabel={true}
        ariaLabel="Stage: Complete"
      />
    );
  }

  const config = STAGE_CONFIG[stage];
  const isSpinning = status === 'in_progress';

  return (
    <SpinnerBadge
      label={config.label}
      cssVar={config.cssVar}
      isSpinning={isSpinning}
      ariaLabel={isSpinning ? `Stage: ${config.label}, active` : `Stage: ${config.label}`}
    />
  );
}
