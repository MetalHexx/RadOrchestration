"use client";
import * as React from "react";
import { FolderGit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectKindBadgeProps {
  projectType?: 'standard' | 'side-project';
}

export const ProjectKindBadge = React.forwardRef<HTMLSpanElement, ProjectKindBadgeProps>(
  function ProjectKindBadge({ projectType }, ref) {
    // Side-project only — standard (and absent) project types render nothing.
    if ((projectType ?? 'standard') !== 'side-project') return null;
    return (
      <Badge
        ref={ref}
        variant="outline"
        className="gap-1.5 border-transparent"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--kind-side-project) 15%, transparent)',
          color: 'var(--kind-side-project)',
        }}
        aria-label="Project kind: Side Project"
      >
        <FolderGit2 />
        Side Project
      </Badge>
    );
  },
);
ProjectKindBadge.displayName = "ProjectKindBadge";
