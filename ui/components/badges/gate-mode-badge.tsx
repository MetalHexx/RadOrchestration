"use client";

import { Badge } from "@/components/ui/badge";
import type { GateMode } from "@/types/state";

interface GateModeBadgeProps {
  mode: GateMode | null;
}

const MODE_CONFIG: Record<string, { label: string; cssVar: string }> = {
  task:       { label: "Task gate",      cssVar: "--gate-task" },
  phase:      { label: "Phase gate",     cssVar: "--gate-phase" },
  autonomous: { label: "Autonomous",     cssVar: "--gate-autonomous" },
  global:     { label: "Global default", cssVar: "--gate-global" },
};

export function GateModeBadge({ mode }: GateModeBadgeProps) {
  const key = mode ?? "global";
  const config = MODE_CONFIG[key];

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-transparent"
      style={{
        backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
        color: `var(${config.cssVar})`,
      }}
      aria-label={`Gate mode: ${config.label}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `var(${config.cssVar})` }}
        aria-hidden="true"
      />
      {config.label}
    </Badge>
  );
}
