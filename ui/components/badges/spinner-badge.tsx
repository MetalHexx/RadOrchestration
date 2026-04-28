"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
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
  /**
   * When true (and isSpinning & isComplete are false), renders a static X icon.
   * Defaults to false when omitted. Priority: isSpinning → isComplete → isRejected → no icon.
   * The legacy dot fallback was removed in UI-IMPROVE-3 (FR-5 / AD-5 / DD-3) — when none
   * of the three flags is true, the icon slot renders nothing and the badge is a plain
   * colored-text-on-fill pill.
   */
  isRejected?: boolean;
  /** Accessible label override; defaults to label when omitted */
  ariaLabel?: string;
  /** When true, suppresses visible label text; aria-label is unaffected. Defaults to false. */
  hideLabel?: boolean;
}

export const SpinnerBadge = React.forwardRef<HTMLSpanElement, SpinnerBadgeProps>(
  function SpinnerBadge(
    { label, cssVar, isSpinning, isComplete, isRejected, ariaLabel, hideLabel },
    ref,
  ) {
    return (
      <Badge
        ref={ref}
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
        ) : isRejected ? (
          <X
            size={12}
            style={{ color: `var(${cssVar})` }}
            aria-hidden="true"
          />
        ) : null}
        {!hideLabel && <span>{label}</span>}
      </Badge>
    );
  },
);

SpinnerBadge.displayName = "SpinnerBadge";
