"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApproveGate } from "@/hooks/use-approve-gate";
import { ConfirmApprovalDialog } from "@/components/dashboard/confirm-approval-dialog";
import { GateErrorBanner } from "@/components/dashboard/gate-error-banner";
import { cn } from "@/lib/utils";
import type { GateEvent } from "@/types/state";

export interface ApproveGateButtonProps {
  /** The pipeline gate event to fire: 'plan_approved' or 'final_approved'. */
  gateEvent: GateEvent;
  /** The project name (used in the API URL path). */
  projectName: string;
  /** Display name of the document being approved (e.g., "UI-HUMAN-GATE-CONTROLS-MASTER-PLAN.md"). */
  documentName: string;
  /** Button label text (e.g., "Approve Plan" or "Approve Final Review"). */
  label: string;
  /** Optional additional CSS classes for the wrapper element. */
  className?: string;
  /**
   * Optional override of the inner Button's tabIndex. When set to -1, the
   * button is removed from the page-level Tab order while remaining
   * mouse-clickable and reachable via assistive-technology virtual cursor.
   * Defaults to undefined — existing call sites render identically to today.
   */
  tabIndex?: number;
}

const DIALOG_TITLES: Record<GateEvent, string> = {
  plan_approved: "Approve Master Plan",
  final_approved: "Approve Final Review",
};

const DIALOG_DESCRIPTIONS: Record<GateEvent, string> = {
  plan_approved:
    "This will advance the pipeline from planning to execution. You are approving",
  final_approved:
    "This will mark the project as complete. You are approving",
};

export const ApproveGateButton = React.forwardRef<
  HTMLButtonElement,
  ApproveGateButtonProps
>(function ApproveGateButton(
  { gateEvent, projectName, documentName, label, className, tabIndex },
  ref,
) {
  const { approveGate, isPending, error, clearError } = useApproveGate();
  const [open, setOpen] = useState<boolean>(false);

  const dialogTitle = DIALOG_TITLES[gateEvent];
  const consequenceDescription = DIALOG_DESCRIPTIONS[gateEvent];

  const handleConfirm = async () => {
    const success = await approveGate(projectName, gateEvent);
    if (success) {
      setOpen(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) clearError();
    setOpen(value);
  };

  return (
    <div className={className}>
      <Button
        ref={ref}
        variant="default"
        size="sm"
        className={cn("w-full sm:w-auto")}
        disabled={isPending}
        aria-busy={isPending ? "true" : undefined}
        aria-disabled={isPending ? "true" : undefined}
        tabIndex={tabIndex}
        onClick={() => setOpen(true)}
      >
        {isPending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Approving…
          </>
        ) : (
          label
        )}
      </Button>
      <ConfirmApprovalDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={dialogTitle}
        documentName={documentName}
        description={consequenceDescription}
        onConfirm={handleConfirm}
        isPending={isPending}
      />
      {error && (
        <div className="mt-2">
          <GateErrorBanner
            message={error.message}
            detail={error.detail}
            onDismiss={clearError}
          />
        </div>
      )}
    </div>
  );
});
ApproveGateButton.displayName = "ApproveGateButton";
