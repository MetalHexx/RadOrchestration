"use client";

import { Badge } from "@/components/ui/badge";

type Severity = 'critical' | 'minor';

interface SeverityBadgeProps {
  severity: Severity | null;
}

const SEVERITY_CONFIG: Record<Severity, { label: string; cssVar: string }> = {
  critical: { label: "Critical", cssVar: "--severity-critical" },
  minor: { label: "Minor", cssVar: "--severity-minor" },
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  if (severity === null) return null;

  const config = SEVERITY_CONFIG[severity];

  return (
    <Badge
      variant="outline"
      style={{
        backgroundColor: `color-mix(in srgb, var(${config.cssVar}) 15%, transparent)`,
        color: `var(${config.cssVar})`,
        borderColor: 'transparent',
      }}
      aria-label={`Severity: ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}
