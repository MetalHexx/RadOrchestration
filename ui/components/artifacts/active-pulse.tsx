"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Active pulse. `frame` for tiles/filmstrip/stage; `row` for DAG rows. While
 *  `active`, the CSS class drives a looping "breathing" animation; the pulse is
 *  bounded by the JS hold in use-artifact-live.tsx (active is cleared after
 *  MIN_PULSE_MS), not by the animation itself — so it's transient, never indefinite.
 *  Pure presentation — all live behavior is app-side, never inside artifact files. */
export function ActivePulse({
  active,
  variant,
  className,
  children,
}: {
  active: boolean;
  variant: "frame" | "row";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative",
        active && variant === "frame" && "live-pulse-frame",
        active && variant === "row" && "live-pulse-row",
        className,
      )}
    >
      {children}
    </div>
  );
}
