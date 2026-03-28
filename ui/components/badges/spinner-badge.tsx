"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SpinnerBadgeProps {
  /** Visible badge text — e.g. "Planning", "In Progress", "Complete" */
  label: string;
  /** CSS custom property name including -- prefix — e.g. "--tier-planning" */
  cssVar: string;
  /** true → animated Loader2 icon; false → 6×6px dot span */
  isSpinning: boolean;
  /** Accessible label override; defaults to label when omitted */
  ariaLabel?: string;
}

export function SpinnerBadge({ label, cssVar, isSpinning, ariaLabel }: SpinnerBadgeProps) {
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
      ) : (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: `var(${cssVar})` }}
          aria-hidden="true"
        />
      )}
      {label}
    </Badge>
  );
}
