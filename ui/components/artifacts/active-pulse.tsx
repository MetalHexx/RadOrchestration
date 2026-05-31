"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Transient active pulse. `frame` for tiles/filmstrip/stage; `row` for DAG rows.
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
