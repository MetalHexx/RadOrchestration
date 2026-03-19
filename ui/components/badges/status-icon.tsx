"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  XOctagon,
  XCircle,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  PhaseStatus,
  PlanningStepStatus,
  TaskStatus,
} from "@/types/state";

interface StatusIconProps {
  status: PlanningStepStatus | PhaseStatus | TaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.FC<LucideProps>; cssVar: string; label: string }
> = {
  complete: { icon: CheckCircle2, cssVar: "--status-complete", label: "Complete" },
  in_progress: { icon: Loader2, cssVar: "--status-in-progress", label: "In Progress" },
  not_started: { icon: Circle, cssVar: "--status-not-started", label: "Not Started" },
  failed: { icon: XCircle, cssVar: "--status-failed", label: "Failed" },
  halted: { icon: XOctagon, cssVar: "--status-halted", label: "Halted" },
};

export function StatusIcon({ status, className }: StatusIconProps) {
  const { icon: Icon, cssVar, label } = STATUS_CONFIG[status];

  return (
    <Icon
      size={16}
      className={cn(status === "in_progress" && "animate-spin", className)}
      style={{ color: `var(${cssVar})` }}
      role="img"
      aria-label={label}
    />
  );
}
