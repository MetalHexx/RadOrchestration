"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ConfigFieldRowProps {
  /** Display label for the field */
  label: string;
  /** Tooltip help text shown on HelpCircle hover/focus */
  tooltip: string;
  /** HTML id of the control element — used for label htmlFor and aria linkage */
  htmlFor: string;
  /** Validation error message — shown below control when present */
  error?: string;
  /** The form control (Input, Switch, ToggleGroup, etc.) */
  children: React.ReactNode;
}

export function ConfigFieldRow({
  label,
  tooltip,
  htmlFor,
  error,
  children,
}: ConfigFieldRowProps) {
  const tooltipId = `${htmlFor}-tooltip`;
  const errorId = `${htmlFor}-error`;

  const describedBy = [
    tooltipId,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div data-slot="config-field-row" className="space-y-1.5 py-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        <Tooltip>
          <TooltipTrigger
            tabIndex={0}
            aria-label={`Help for ${label}`}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-help"
          >
            <HelpCircle size={16} />
          </TooltipTrigger>
          <TooltipContent id={tooltipId}>{tooltip}</TooltipContent>
        </Tooltip>
      </div>

      <div
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? "true" : undefined}
      >
        {children}
      </div>

      {error && (
        <div aria-live="polite">
          <p id={errorId} className="text-xs text-destructive mt-1">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
