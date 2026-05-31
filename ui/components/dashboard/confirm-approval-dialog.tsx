"use client";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmApprovalDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change open state. Blocked when isPending is true. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title (e.g., "Approve Master Plan"). */
  title: string;
  /** Filename of the document being approved (highlighted in description). */
  documentName: string;
  /** Plain-language description of what will change upon approval. */
  description: string;
  /** Callback invoked when the user clicks Confirm. */
  onConfirm: () => void;
  /** Whether the approval API call is currently in flight. */
  isPending: boolean;
  /** Confirm button label. Defaults to "Confirm Approval". */
  confirmLabel?: string;
  /** Confirm button label while the action is in flight. Defaults to "Approving…". */
  pendingLabel?: string;
  /**
   * Optional error message to display above the button row. When truthy, renders
   * as a destructive-styled accessible alert. When falsy, renders nothing.
   * Backward-compatible: existing approval-gate usages are unaffected.
   */
  errorMessage?: string | null;
}

export function ConfirmApprovalDialog({
  open,
  onOpenChange,
  title,
  documentName,
  description,
  onConfirm,
  isPending,
  confirmLabel = "Confirm Approval",
  pendingLabel = "Approving…",
  errorMessage,
}: ConfirmApprovalDialogProps) {
  const guardedOnOpenChange = (value: boolean) => {
    if (!isPending) {
      onOpenChange(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">
          {description}{" "}
          <span className={cn("font-medium text-foreground")}>
            {documentName}
          </span>
          . Proceed?
        </DialogDescription>
        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">{errorMessage}</p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => guardedOnOpenChange(false)}
            disabled={isPending}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={isPending}
            aria-busy={isPending ? "true" : undefined}
            aria-disabled={isPending ? "true" : undefined}
          >
            {isPending ? (
              <>
                <Loader2
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
                {pendingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
