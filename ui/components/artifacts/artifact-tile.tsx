"use client";

import * as React from "react";
import { FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IframePreview } from "./iframe-preview";
import type { Artifact } from "@/lib/artifact-model";
import { cn } from "@/lib/utils";

export interface ArtifactTileProps {
  projectName: string;
  artifact: Artifact;
  onOpen: () => void;
  onDelete: () => void;
}

export function ArtifactTile({ projectName, artifact, onOpen, onDelete }: ArtifactTileProps) {
  const friendly = artifact.title ?? artifact.label;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-md border border-border bg-card text-left",
        "transition-transform hover:-translate-y-0.5 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="relative h-36 w-full overflow-hidden bg-muted">
        {artifact.isMarkdown ? (
          <div className="flex h-full w-full items-center justify-center">
            <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <IframePreview
            projectName={projectName}
            fileName={artifact.fileName}
            scale={0.25}
            interactive={false}
            className="h-full w-full"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <Badge variant="secondary" className="w-fit">{artifact.label}</Badge>
        <span className="text-sm font-medium text-foreground">{friendly}</span>
        <span className="truncate text-xs text-muted-foreground">{artifact.fileName}</span>
      </div>
      <span
        role="button"
        tabIndex={0}
        aria-label="Delete artifact"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDelete(); } }}
        className={cn(
          "absolute right-2 top-2 hidden rounded-md bg-background/80 p-1.5 text-muted-foreground",
          "group-hover:flex hover:text-destructive",
        )}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}
