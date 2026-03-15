"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GateErrorBannerProps {
  /** Friendly user-facing error message. */
  message: string;
  /** Raw pipeline output for debugging. Shown in expandable detail section. */
  detail?: string;
  /** Callback to dismiss (clear) the error. */
  onDismiss: () => void;
}

export function GateErrorBanner({ message, detail, onDismiss }: GateErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="size-4 shrink-0 text-destructive mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-destructive font-medium">{message}</p>
          {detail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Show pipeline detail
              </summary>
              <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-auto max-h-32 rounded bg-muted p-2">
                {detail}
              </pre>
            </details>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
}
