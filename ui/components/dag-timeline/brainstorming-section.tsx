"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, LayoutTemplate, Trash2 } from "lucide-react";
import { NodeStatusBadge } from "./node-status-badge";
import { SECTION_LABEL_CLASSES, CARD_SHELL_CLASSES } from "./dag-section-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Artifact, ArtifactKind } from "@/lib/artifact-model";

const BLUE = "--tier-planning";

function iconFor(kind: ArtifactKind): React.ReactNode {
  if (kind === "markdown") return <FileText size={12} aria-hidden="true" />;
  if (kind === "visual") return <ImageIcon size={12} aria-hidden="true" />;
  return <LayoutTemplate size={12} aria-hidden="true" />;
}

export interface BrainstormingSectionProps {
  projectName: string;
  artifacts: Artifact[];
  onOpen: (index: number) => void;
  onDelete: (artifact: Artifact) => void;
}

export function BrainstormingSection({ projectName, artifacts, onOpen, onDelete }: BrainstormingSectionProps) {
  if (artifacts.length === 0) return null;
  return (
    <div role="group" aria-label="Brainstorming section">
      <div aria-hidden="true" className={SECTION_LABEL_CLASSES}>Brainstorming</div>
      <div className={CARD_SHELL_CLASSES}>
        <div className="py-2">
          {artifacts.map((artifact, index) => {
            const friendly = artifact.title ?? artifact.label;
            return (
              <div
                key={artifact.fileName}
                role="button"
                tabIndex={0}
                aria-label={`${friendly} — ${artifact.label}`}
                onClick={() => onOpen(index)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(index); } }}
                className={cn(
                  "flex items-center gap-2 py-2 pr-3 pl-3 rounded-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <NodeStatusBadge
                  status="completed"
                  label={artifact.label}
                  cssVar={BLUE}
                  iconOnly
                  icon={iconFor(artifact.kind)}
                />
                <span className="text-sm font-medium min-w-0 shrink truncate max-w-[55%]">{friendly}</span>
                <Badge variant="outline" className="text-xs">{artifact.fileName}</Badge>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Delete artifact"
                  onClick={(e) => { e.stopPropagation(); onDelete(artifact); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDelete(artifact); } }}
                  className="ml-auto rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
