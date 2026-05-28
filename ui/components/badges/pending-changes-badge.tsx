"use client";

import { CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PendingChangesBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-transparent"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
        color: "var(--color-warning)",
      }}
      aria-label="Pending Changes"
    >
      <CircleDot size={14} />
      Pending Changes
    </Badge>
  );
}
