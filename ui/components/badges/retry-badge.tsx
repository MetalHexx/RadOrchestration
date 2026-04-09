"use client";

import { Badge } from "@/components/ui/badge";

interface RetryBadgeProps {
  retries: number;
  max: number;
}

export function RetryBadge({ retries, max }: RetryBadgeProps) {
  return (
    <Badge
      variant="secondary"
      aria-label={`Retry count: ${retries} of ${max}`}
    >
      Retries: {retries}/{max}
    </Badge>
  );
}
