"use client";

import * as React from "react";
import { MarkdownRenderer } from "@/components/documents/markdown-renderer";
import { StageIframe } from "./iframe-preview";
import { ActivePulse } from "./active-pulse";
import { initStage, beginNavigate, markIncomingReady, applyLiveUpdate } from "./stage-transition";
import type { Artifact } from "@/lib/artifact-model";
import { cn } from "@/lib/utils";

/** Markdown layer: reports ready via a layout effect once the body is committed
 *  to the DOM — a deterministic signal that does NOT depend on a <div onLoad>,
 *  which never fires for a markdown subtree (DD-7/FR-16). */
export function MarkdownLayer({
  content, scrollRef, onReady,
}: {
  content: string | null;
  scrollRef: React.RefObject<HTMLDivElement>;
  onReady?: () => void;
}) {
  React.useLayoutEffect(() => {
    if (content !== null) onReady?.();
  }, [content, onReady]);
  return (
    <div ref={scrollRef} className="h-full overflow-auto bg-background p-6">
      {content !== null ? (
        <MarkdownRenderer content={content} />
      ) : (
        <div role="status" aria-label="Loading document" className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      )}
    </div>
  );
}

export function BufferedStage({
  projectName, artifact, markdownContent, activePulse,
}: {
  projectName: string;
  artifact: Artifact;
  markdownContent: string | null;
  activePulse: boolean;
}) {
  const [stage, setStage] = React.useState(() => initStage(artifact.fileName));
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [liveRefreshKey, setLiveRefreshKey] = React.useState(0);
  const prevPulseRef = React.useRef(activePulse);

  React.useEffect(() => {
    setStage((s) => (s.front.fileName === artifact.fileName ? s : beginNavigate(s, artifact.fileName)));
  }, [artifact.fileName]);

  React.useEffect(() => {
    // A live change just landed on the open document (pulse rose). For a same-file
    // update, reload the front iframe in place — preserve scroll, no cross-fade (DD-11).
    if (activePulse && !prevPulseRef.current) {
      const plan = applyLiveUpdate(stage, artifact.fileName);
      if (plan.preserveScroll) setLiveRefreshKey((k) => k + 1);
    }
    prevPulseRef.current = activePulse;
  }, [activePulse, stage, artifact.fileName]);

  const onReady = React.useCallback(() => setStage((s) => markIncomingReady(s)), []);

  // Per-layer ready signal: only the incoming (back) layer needs to report
  // ready; the visible front layer is already promoted.
  function renderLayer(fileName: string, visible: boolean, isIncoming: boolean, reloadKey?: number) {
    const isMd = fileName.endsWith(".md");
    const reportReady = isIncoming ? onReady : undefined;
    return (
      <div
        data-stage-layer
        className={cn(
          "absolute inset-0 transition-all duration-300",
          visible ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-sm scale-[0.98]",
        )}
      >
        {isMd ? (
          <MarkdownLayer content={markdownContent} scrollRef={scrollRef} onReady={reportReady} />
        ) : (
          <StageIframe projectName={projectName} fileName={fileName} onLoad={reportReady} reloadKey={reloadKey} />
        )}
      </div>
    );
  }

  return (
    <ActivePulse active={activePulse} variant="frame" className="absolute inset-0">
      {/* Dark backstop replaces the white iframe background (DD-8). No onLoad
          here — readiness is reported per layer by each renderer. */}
      <div className="absolute inset-0 bg-background">
        {renderLayer(stage.front.fileName, true, false, liveRefreshKey)}
        {renderLayer(
          stage.back?.fileName ?? stage.front.fileName,
          stage.back ? stage.crossfading : false,
          stage.back !== null,
        )}
      </div>
    </ActivePulse>
  );
}
