"use client";

import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertAction } from "@/components/ui/alert";
import type { ConfigSaveState } from "@/types/config";

interface ConfigFooterProps {
  onSave: () => void;
  saveState: ConfigSaveState;
  errorMessage?: string;
  disabled: boolean;
  onDismissError?: () => void;
}

export function ConfigFooter({ onSave, saveState, errorMessage, disabled, onDismissError }: ConfigFooterProps) {
  const isSaving = saveState === "saving";
  const isSuccess = saveState === "success";
  const isError = saveState === "error";

  return (
    <div className="px-4 py-3 border-t border-border space-y-2">
      {isError && errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
          {onDismissError && (
            <AlertAction>
              <Button variant="ghost" size="icon" className="size-6" onClick={onDismissError}>
                <X className="size-3" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={disabled || isSaving}
          className="w-full sm:w-auto sm:min-w-[100px]"
          aria-live="polite"
        >
          {isSaving && <Loader2 className="size-4 animate-spin mr-2" />}
          {isSuccess && <Check className="size-4 mr-2 text-status-complete" />}
          {isSaving ? "Saving…" : isSuccess ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
