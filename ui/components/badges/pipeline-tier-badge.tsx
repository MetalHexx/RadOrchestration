"use client";

import { SpinnerBadge } from "./spinner-badge";
import type { PipelineTier, PlanningStatus, ExecutionStatus } from "@/types/state";

interface PipelineTierBadgeProps {
  tier: PipelineTier | "not_initialized";
  planningStatus?: PlanningStatus;   // NEW — drives "Planning" (spinner) vs "Planned" (dot)
  executionStatus?: ExecutionStatus; // NEW — drives "Executing" (spinner) vs "Execution" (dot)
}

const TIER_CONFIG = {
  planning: { label: "Planning", cssVar: "--tier-planning" },
  // label is never used directly for execution — resolveBadgeState() sets it explicitly per sub-status
  execution: { label: "Approved", cssVar: "--tier-execution" },
  review: { label: "Final Review", cssVar: "--tier-review" },
  complete: { label: "Complete", cssVar: "--tier-complete" },
  halted: { label: "Halted", cssVar: "--tier-halted" },
  not_initialized: { label: "Not Started", cssVar: "--tier-not-initialized" },
} satisfies Record<PipelineTier | "not_initialized", { label: string; cssVar: string }>;

function resolveBadgeState(
  tier: PipelineTier | "not_initialized",
  planningStatus: PlanningStatus | undefined,
  executionStatus: ExecutionStatus | undefined,
): { label: string; ariaLabel: string; isSpinning: boolean; cssVar: string } {
  const base = TIER_CONFIG[tier];
  let cssVar = base.cssVar;

  let label: string;
  let isSpinning: boolean;

  if (tier === "planning") {
    if (planningStatus === "in_progress") {
      label = "Planning";
      isSpinning = true;
    } else if (planningStatus === "complete") {
      label = "Planned";
      isSpinning = false;
    } else {
      label = "Planning";
      isSpinning = false;
    }
  } else if (tier === "execution") {
    if (executionStatus === "halted") {
      label = "Halted";
      cssVar = "--tier-halted";
      isSpinning = false;
    } else if (executionStatus === "in_progress") {
      label = "Executing";
      isSpinning = true;
    } else {
      // not_started, complete, or undefined → queued/approved state
      label = "Approved";
      isSpinning = false;
    }
  } else {
    label = base.label;
    isSpinning = false;
  }

  const ariaLabel = isSpinning
    ? `Pipeline status: ${label}, active`
    : `Pipeline status: ${label}`;

  return { label, ariaLabel, isSpinning, cssVar };
}

export function PipelineTierBadge({ tier, planningStatus, executionStatus }: PipelineTierBadgeProps) {
  const { label, ariaLabel, isSpinning, cssVar } = resolveBadgeState(tier, planningStatus, executionStatus);

  return (
    <SpinnerBadge
      label={label}
      cssVar={cssVar}
      isSpinning={isSpinning}
      ariaLabel={ariaLabel}
    />
  );
}
