"use client";

import { Badge } from "@/components/ui/badge";

export function CustomizedBadge() {
  return (
    <Badge
      variant="outline"
      className="border-transparent"
      style={{
        backgroundColor: "color-mix(in srgb, var(--badge-customized) 15%, transparent)",
        color: "var(--badge-customized)",
      }}
      aria-label="Customized"
    >
      Customized
    </Badge>
  );
}
