"use client";

import React from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStartAction } from "@/hooks/use-start-action";
import { cn } from "@/lib/utils";

export interface ExecutePlanButtonProps {
  /** Project name; used by useStartAction for the API URL path. */
  projectName: string;
  /** Optional CSS classes for the wrapper element (DD-1: ml-auto slot). */
  className?: string;
  /**
   * Optional inner-button tabIndex override; matches ApproveGateButton's
   * convention so the row's keyboard-handling stays page-level.
   */
  tabIndex?: number;
}

/** Idle vs pending label resolver. Exported for test (DD-2, DD-4). */
export function computeExecutePlanLabel(isPending: boolean): string {
  return isPending ? "Launching…" : "Execute Plan";
}

/** Idle vs pending disabled resolver. Exported for test (FR-8, DD-4). */
export function computeExecutePlanDisabled(isPending: boolean): boolean {
  return isPending;
}

/**
 * Execute Plan button (FR-2, FR-4, FR-8). Invokes useStartAction with the
 * 'execute-plan' verb (AD-5). On failure the inline error renders below
 * the button using the destructive token (DD-5). On success no client
 * state mutates (AD-7) — the SSE/projects refresh picks up phase_loop.
 */
export const ExecutePlanButton = React.forwardRef<
  HTMLButtonElement,
  ExecutePlanButtonProps
>(function ExecutePlanButton({ projectName, className, tabIndex }, ref) {
  const { pendingAction, errorMessage, start } = useStartAction(projectName);
  const isPending = pendingAction === "execute-plan";

  return (
    <div className={className}>
      <Button
        ref={ref}
        variant="default"
        size="sm"
        className={cn("w-full sm:w-auto")}
        disabled={computeExecutePlanDisabled(isPending)}
        aria-busy={isPending ? "true" : undefined}
        aria-disabled={isPending ? "true" : undefined}
        tabIndex={tabIndex}
        onClick={() => { void start("execute-plan"); }}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-3.5" aria-hidden="true" />
        )}
        {computeExecutePlanLabel(isPending)}
      </Button>
      {errorMessage && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
});
ExecutePlanButton.displayName = "ExecutePlanButton";
