"use client";

import * as React from "react";
import { FileText, Trash2 } from "lucide-react";
import { IframePreview } from "./iframe-preview";
import { ActivePulse } from "./active-pulse";
import { ChangeBadge } from "@/components/badges";
import type { Artifact } from "@/lib/artifact-model";
import { cn } from "@/lib/utils";

export interface ArtifactTileProps {
  projectName: string;
  artifact: Artifact;
  onOpen: () => void;
  onDelete: () => void;
  unseen?: boolean;
  activePulse?: boolean;
}

export function ArtifactTile({ projectName, artifact, onOpen, onDelete, unseen, activePulse }: ArtifactTileProps) {
  const friendly = artifact.title ?? artifact.label;
  return (
    <ActivePulse active={!!activePulse} variant="frame" className="w-full">
    <div
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-md border border-border bg-card text-left",
        "transition-transform hover:-translate-y-0.5 hover:bg-accent/40",
      )}
    >
      {/* Primary "open" control — wraps preview + info block.
          Sibling to the delete button so no interactive element is nested
          inside another (invalid HTML/ARIA). */}
      <button
        type="button"
        aria-label={friendly}
        onClick={onOpen}
        className={cn(
          "flex w-full cursor-pointer flex-col text-left",
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
          <span className="text-sm font-medium text-foreground">{friendly}</span>
          <span className="truncate text-xs text-muted-foreground">{artifact.fileName}</span>
        </div>
      </button>
      {/* Delete control — sibling of the open button, never nested inside it. */}
      <button
        type="button"
        aria-label="Delete artifact"
        onClick={() => onDelete()}
        className={cn(
          "absolute right-2 top-2 z-10 hidden cursor-pointer rounded-md bg-background/80 p-1.5 text-muted-foreground",
          "group-hover:flex hover:text-destructive",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
      {unseen && (
        <div className="absolute left-2 top-2 z-10">
          <ChangeBadge />
        </div>
      )}
    </div>
    </ActivePulse>
  );
}
