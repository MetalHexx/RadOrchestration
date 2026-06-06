"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";

interface ProjectKindBadgeProps {
  projectType?: 'standard' | 'side-project';
}

export const ProjectKindBadge = React.forwardRef<HTMLSpanElement, ProjectKindBadgeProps>(
  function ProjectKindBadge({ projectType }, ref) {
    const isSide = (projectType ?? 'standard') === 'side-project';
    const label = isSide ? 'Local · side-project' : 'Standard';
    return (
      <Badge ref={ref} variant="outline" className="gap-1.5" aria-label={`Project kind: ${label}`}>
        {label}
      </Badge>
    );
  },
);
ProjectKindBadge.displayName = "ProjectKindBadge";
