"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PipelineTier, PlanningStatus, ExecutionStatus } from "@/types/state";

interface PipelineTierBadgeProps {
  tier: PipelineTier | "not_initialized";
  planningStatus?: PlanningStatus;   // NEW — drives "Planning" (spinner) vs "Planned" (dot)
  executionStatus?: ExecutionStatus; // NEW — drives "Executing" (spinner) vs "Execution" (dot)
}

const TIER_CONFIG: Record<string, { label: string; cssVar: string }> = {
  planning: { label: "Planning", cssVar: "--tier-planning" },
  execution: { label: "Execution", cssVar: "--tier-execution" },
  review: { label: "Review", cssVar: "--tier-review" },
  complete: { label: "Complete", cssVar: "--tier-complete" },
  halted: { label: "Halted", cssVar: "--tier-halted" },
  not_initialized: { label: "Not Started", cssVar: "--tier-not-initialized" },
};

function resolveBadgeState(
  tier: PipelineTier | "not_initialized",
  planningStatus: PlanningStatus | undefined,
  executionStatus: ExecutionStatus | undefined,
): { label: string; ariaLabel: string; isSpinning: boolean; cssVar: string } {
  const base = TIER_CONFIG[tier];
  const cssVar = base.cssVar;

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
    if (executionStatus === "in_progress") {
      label = "Executing";
      isSpinning = true;
    } else {
      label = "Execution";
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
    <Badge
      variant="outline"
      className="gap-1.5 border-transparent"
      style={{
        backgroundColor: `color-mix(in srgb, var(${cssVar}) 15%, transparent)`,
        color: `var(${cssVar})`,
      }}
      aria-label={ariaLabel}
    >
      {isSpinning ? (
        <Loader2
          size={12}
          className="animate-spin"
          style={{ color: `var(${cssVar})` }}
          aria-hidden="true"
        />
      ) : (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: `var(${cssVar})` }}
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  );
}
