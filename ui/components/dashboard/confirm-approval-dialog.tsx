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
}

export function ConfirmApprovalDialog({
  open,
  onOpenChange,
  title,
  documentName,
  description,
  onConfirm,
  isPending,
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
          . This action cannot be undone.
        </DialogDescription>
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
                Approving…
              </>
            ) : (
              "Confirm Approval"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
