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
  projectName, artifact, markdownContent, markdownContentFileName, activePulse, liveMtime = 0,
}: {
  projectName: string;
  artifact: Artifact;
  markdownContent: string | null;
  /** Which file `markdownContent` actually belongs to. When provided, a markdown
   *  layer only renders the body if its own fileName matches — preventing a stale
   *  flash of the previous doc on md→md navigation before the new fetch resolves
   *  (BUG 1). Omit (undefined) to keep the legacy "content always applies" behavior. */
  markdownContentFileName?: string;
  activePulse: boolean;
  /** Monotonic per-file change signal (the open file's live mtime). Each on-disk
   *  change advances it, even repeats inside the pulse-settle window — which the
   *  pulse rising edge alone misses (BUG 2). */
  liveMtime?: number;
}) {
  const [stage, setStage] = React.useState(() => initStage(artifact.fileName));
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [liveRefreshKey, setLiveRefreshKey] = React.useState(0);
  const prevMtimeRef = React.useRef(liveMtime);
  const prevMtimeFileRef = React.useRef(artifact.fileName);

  React.useEffect(() => {
    setStage((s) => (s.front.fileName === artifact.fileName ? s : beginNavigate(s, artifact.fileName)));
  }, [artifact.fileName]);

  React.useEffect(() => {
    // A live change just landed on the open document — detected via the monotonic
    // per-file mtime advancing (fires for EVERY change, including a repeat inside
    // the pulse-settle window where activePulse never drops, BUG 2). For a same-file
    // update, reload the front iframe in place — preserve scroll, no cross-fade (DD-11).
    const sameFile = prevMtimeFileRef.current === artifact.fileName;
    if (sameFile && liveMtime > prevMtimeRef.current) {
      const plan = applyLiveUpdate(stage, artifact.fileName);
      if (plan.preserveScroll) setLiveRefreshKey((k) => k + 1);
    }
    prevMtimeRef.current = liveMtime;
    prevMtimeFileRef.current = artifact.fileName;
  }, [liveMtime, stage, artifact.fileName]);

  const onReady = React.useCallback(() => setStage((s) => markIncomingReady(s)), []);

  // Per-layer ready signal: only the incoming (back) layer needs to report
  // ready; the visible front layer is already promoted.
  function renderLayer(fileName: string, visible: boolean, isIncoming: boolean, reloadKey?: number) {
    const isMd = fileName.endsWith(".md");
    const reportReady = isIncoming ? onReady : undefined;
    // Only apply the shared markdown body to the layer it actually belongs to. When
    // markdownContentFileName is supplied and doesn't match, pass null so the layer
    // shows its spinner and withholds onReady — the stale incoming doc is not
    // promoted/cross-faded until the correct fetch resolves (BUG 1). When the prop
    // is omitted (undefined), fall back to the legacy "content always applies" path.
    const layerContent =
      markdownContentFileName === undefined || fileName === markdownContentFileName
        ? markdownContent
        : null;
    return (
      <div
        data-stage-layer
        className={cn(
          "absolute inset-0 transition-all duration-300",
          visible ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-sm scale-[0.98]",
        )}
      >
        {isMd ? (
          <MarkdownLayer content={layerContent} scrollRef={scrollRef} onReady={reportReady} />
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
