"use client";

import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SpinnerBadgeProps {
  /** Visible badge text — e.g. "Planning", "In Progress", "Complete" */
  label: string;
  /** CSS custom property name including -- prefix — e.g. "--status-complete" */
  cssVar: string;
  /** true → animated Loader2 icon; false → defers to isComplete for icon selection */
  isSpinning: boolean;
  /** When true (and isSpinning is false), renders a static Check icon.
   *  Defaults to false when omitted. isSpinning=true takes unconditional precedence. */
  isComplete?: boolean;
  /** Accessible label override; defaults to label when omitted */
  ariaLabel?: string;
  /** When true, suppresses visible label text; aria-label is unaffected. Defaults to false. */
  hideLabel?: boolean;
}

export function SpinnerBadge({ label, cssVar, isSpinning, isComplete, ariaLabel, hideLabel }: SpinnerBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-transparent"
      style={{
        backgroundColor: `color-mix(in srgb, var(${cssVar}) 15%, transparent)`,
        color: `var(${cssVar})`,
      }}
      aria-label={ariaLabel ?? label}
    >
      {isSpinning ? (
        <Loader2
          size={12}
          className="animate-spin"
          style={{ color: `var(${cssVar})` }}
          aria-hidden="true"
        />
      ) : isComplete ? (
        <Check
          size={12}
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
      {!hideLabel && <span>{label}</span>}
    </Badge>
  );
}
