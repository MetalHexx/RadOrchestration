"use client";

import type { PhaseStatus } from "@/types/state";

interface ProgressBarProps {
  completed: number;
  total: number;
  status?: PhaseStatus;
  showCount?: boolean;
}

export function ProgressBar({
  completed,
  total,
  showCount = true,
}: ProgressBarProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Phase progress: ${completed} of ${total} tasks complete`}
    >
      <div
        className="h-2 flex-1 rounded-full"
        style={{ backgroundColor: "var(--color-progress-track)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: "var(--color-progress-fill)",
          }}
        />
      </div>
      {showCount && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completed}/{total} tasks
        </span>
      )}
    </div>
  );
}
