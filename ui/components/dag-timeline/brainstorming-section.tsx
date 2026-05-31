"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, LayoutTemplate, Trash2 } from "lucide-react";
import { NodeStatusBadge } from "./node-status-badge";
import { SECTION_LABEL_CLASSES, CARD_SHELL_CLASSES } from "./dag-section-group";
import { ActivePulse } from "@/components/artifacts/active-pulse";
import { ChangeBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import type { Artifact, ArtifactKind } from "@/lib/artifact-model";

const BLUE = "--tier-planning";

function iconFor(kind: ArtifactKind): React.ReactNode {
  if (kind === "markdown") return <FileText size={12} aria-hidden="true" />;
  if (kind === "visual" || kind === "html") return <ImageIcon size={12} aria-hidden="true" />;
  return <LayoutTemplate size={12} aria-hidden="true" />;
}

export interface BrainstormingSectionProps {
  artifacts: Artifact[];
  onOpen: (index: number) => void;
  onDelete: (artifact: Artifact) => void;
  unseen?: Set<string>;
  activePulse?: Set<string>;
}

export function BrainstormingSection({ artifacts, onOpen, onDelete, unseen, activePulse }: BrainstormingSectionProps) {
  if (artifacts.length === 0) return null;
  return (
    <div role="group" aria-label="Brainstorming section">
      <div aria-hidden="true" className={SECTION_LABEL_CLASSES}>Brainstorming</div>
      <div className={CARD_SHELL_CLASSES}>
        <div className="py-2">
          {artifacts.map((artifact, index) => {
            const friendly = artifact.title ?? artifact.label;
            const isUnseen = unseen?.has(artifact.fileName) ?? false;
            const isActive = activePulse?.has(artifact.fileName) ?? false;
            return (
              <ActivePulse key={artifact.fileName} active={isActive} variant="row">
              <div
                className="flex items-center gap-2 py-2 pr-3 pl-3 rounded-md hover:bg-accent/50"
              >
                {/* Primary "open" control and the delete control are sibling
                    real <button>s — never nested — so assistive tech targets
                    each correctly and Space/Enter activate natively (no
                    page-scroll on Space, no double-fire). */}
                <button
                  type="button"
                  aria-label={`${friendly} — ${artifact.label}`}
                  onClick={() => onOpen(index)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 cursor-pointer text-left rounded-md",
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
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{friendly}</span>
                  {isUnseen && <ChangeBadge />}
                </button>
                <div className="flex min-w-0 shrink-0 items-center gap-3">
                  <span title={artifact.fileName} className="truncate font-mono text-xs text-muted-foreground">{artifact.fileName}</span>
                  <button
                    type="button"
                    aria-label="Delete artifact"
                    onClick={() => onDelete(artifact)}
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              </ActivePulse>
            );
          })}
        </div>
      </div>
    </div>
  );
}
