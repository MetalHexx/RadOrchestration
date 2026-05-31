"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, Trash2, X, FileText } from "lucide-react";
import { IframePreview } from "./iframe-preview";
import { ActivePulse } from "./active-pulse";
import { BufferedStage } from "./buffered-stage";
import { ChangeBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import { modalKeyAction } from "@/hooks/use-artifact-modal";
import type { Artifact } from "@/lib/artifact-model";

export interface ArtifactViewerModalProps {
  projectName: string;
  artifacts: Artifact[];
  activeIndex: number;
  /** Fetched BRAINSTORMING.md body when the active (or any) md cell needs it. */
  markdownContent: string | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onRequestDelete: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  unseen?: Set<string>;
  activePulse?: Set<string>;
}

export function ArtifactViewerModal({
  projectName, artifacts, activeIndex, markdownContent,
  onClose, onPrev, onNext, onSelect, onRequestDelete, isFullScreen, onToggleFullScreen,
  unseen, activePulse,
}: ArtifactViewerModalProps) {
  const active = artifacts[activeIndex];

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const action = modalKeyAction(e.key);
      if (action === null) return;
      e.preventDefault();
      if (action === 'prev') onPrev();
      else if (action === 'next') onNext();
      else if (action === 'close') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, onClose]);

  if (!active) return null;
  const friendly = active.title ?? active.label;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${friendly} — ${active.fileName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 supports-backdrop-filter:backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 shadow-lg",
          isFullScreen ? "fixed inset-0 rounded-none" : "h-[85vh] w-[90vw] max-w-5xl",
        )}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">{friendly}</span>
          <span title={active.fileName} className="truncate text-xs text-muted-foreground">{active.fileName}</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Full screen" onClick={onToggleFullScreen}
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <Maximize2 className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Close" onClick={onClose}
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden bg-muted">
          <BufferedStage
            projectName={projectName}
            artifact={active}
            markdownContent={markdownContent}
            activePulse={activePulse?.has(active.fileName) ?? false}
          />
          <button type="button" aria-label="Previous artifact" onClick={onPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-background/70 p-2 text-foreground hover:bg-background">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next artifact" onClick={onNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-background/70 p-2 text-foreground hover:bg-background">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Delete artifact" onClick={onRequestDelete}
            className="absolute bottom-3 right-3 z-10 cursor-pointer rounded-full bg-background/70 p-2 text-muted-foreground hover:bg-background hover:text-destructive">
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </div>

        <footer className="flex items-end gap-2 overflow-x-auto border-t border-border px-4 py-3">
          {artifacts.map((artifact, i) => (
            <ActivePulse key={artifact.fileName} active={activePulse?.has(artifact.fileName) ?? false} variant="frame">
            <div
              data-filmstrip-cell
              role="button"
              tabIndex={0}
              aria-label={`View ${artifact.title ?? artifact.label}`}
              aria-current={i === activeIndex ? 'true' : undefined}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } }}
              className={cn(
                "flex h-16 w-24 shrink-0 cursor-pointer flex-col items-center overflow-hidden rounded-md border",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === activeIndex ? "border-2 ring-2 ring-ring border-ring" : "border-border",
              )}
            >
              <div className="relative h-10 w-full shrink-0 overflow-hidden bg-background">
                {artifact.isMarkdown ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                ) : (
                  <IframePreview
                    projectName={projectName}
                    fileName={artifact.fileName}
                    scale={0.12}
                    interactive={false}
                    eager
                    className="h-full w-full"
                  />
                )}
                {(unseen?.has(artifact.fileName) ?? false) && (
                  <div className="absolute left-1 top-1 z-10">
                    <ChangeBadge />
                  </div>
                )}
              </div>
              <div className="flex w-full flex-1 items-center justify-center px-1">
                <span className="w-full truncate text-center text-[9px] leading-tight text-muted-foreground">
                  {artifact.title ?? artifact.label}
                </span>
              </div>
            </div>
            </ActivePulse>
          ))}
        </footer>
      </div>
    </div>
  );
}
