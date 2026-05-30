"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, Trash2, X, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/documents/markdown-renderer";
import { IframePreview } from "./iframe-preview";
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
  onRequestDelete: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

export function ArtifactViewerModal({
  projectName, artifacts, activeIndex, markdownContent,
  onClose, onPrev, onNext, onRequestDelete, isFullScreen, onToggleFullScreen,
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
          <Badge variant="secondary">{active.label}</Badge>
          <span className="text-sm font-medium text-foreground">{friendly}</span>
          <span className="truncate text-xs text-muted-foreground">{active.fileName}</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Full screen" onClick={onToggleFullScreen}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <Maximize2 className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Delete artifact" onClick={onRequestDelete}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Close" onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden bg-muted">
          {active.isMarkdown ? (
            <div className="h-full overflow-auto bg-background p-6">
              {markdownContent !== null
                ? <MarkdownRenderer content={markdownContent} />
                : <p className="text-sm text-muted-foreground">Loading…</p>}
            </div>
          ) : (
            <div className="h-full w-full overflow-hidden">
              <IframePreview
                projectName={projectName}
                fileName={active.fileName}
                scale={0.66}
                className="h-full w-full"
              />
            </div>
          )}
          <button type="button" aria-label="Previous artifact" onClick={onPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground hover:bg-background">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next artifact" onClick={onNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground hover:bg-background">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <footer className="flex items-end gap-2 overflow-x-auto border-t border-border px-4 py-3">
          {artifacts.map((artifact, i) => (
            <div
              key={artifact.fileName}
              data-filmstrip-cell
              className={cn(
                "flex h-16 w-24 shrink-0 flex-col items-center overflow-hidden rounded-md border",
                i === activeIndex ? "border-2 ring-2 ring-ring border-ring" : "border-border",
              )}
            >
              <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-background">
                {artifact.isMarkdown ? (
                  <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <IframePreview
                    projectName={projectName}
                    fileName={artifact.fileName}
                    scale={0.12}
                    interactive={false}
                    className="h-full w-full"
                  />
                )}
              </div>
              <span className="w-full truncate px-1 text-center text-[9px] leading-tight text-muted-foreground">
                {artifact.label}
              </span>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
