"use client";

import * as React from "react";
import { deriveArtifacts, type Artifact } from "@/lib/artifact-model";
import { emptyLiveState, applyDelta, clearUnseenFor, endPulseFor, type LiveState } from "@/lib/live/live-store-model";
import { fetchArtifactSnapshot, reconcileUnseen, diffSnapshots } from "@/lib/live/snapshot";
import { useSSEContext } from "@/hooks/use-sse-context";
import type { SSEEvent } from "@/types/events";

// How long a file stays in activePulse after the LAST change lands. Spans ~2 cycles
// of the 1.4s CSS breathe so an isolated change pulses clearly (not a single missable
// flash); each new change re-arms this timer below, extending the pulse while writes
// continue, then it clears so the indicator is bounded — never indefinite.
const MIN_PULSE_MS = 2600;

interface ArtifactLiveValue {
  artifacts: Artifact[];
  unseen: Set<string>;
  activePulse: Set<string>;
  /** Per-file modification times from the latest snapshot. Monotonic per file, so
   *  the viewer can reload the open HTML doc on every change — including a repeat
   *  inside the pulse-settle window the pulse edge alone misses (BUG 2). */
  mtimes: Record<string, number>;
  degraded: boolean;
  markActive: (fileName: string | null) => void;
}

export const defaultArtifactLiveValue: ArtifactLiveValue = {
  artifacts: [],
  unseen: new Set(),
  activePulse: new Set(),
  mtimes: {},
  degraded: false,
  markActive: () => {},
};

export const ArtifactLiveContext = React.createContext<ArtifactLiveValue>(defaultArtifactLiveValue);

export function ArtifactLiveProvider({
  projectName,
  activeFileName,
  children,
}: {
  projectName: string | null;
  activeFileName: string | null;
  children: React.ReactNode;
}) {
  const [files, setFiles] = React.useState<string[]>([]);
  const [mtimes, setMtimes] = React.useState<Record<string, number>>({});
  const [live, setLive] = React.useState<LiveState>(emptyLiveState);
  const [degraded, setDegraded] = React.useState(false);
  const activeRef = React.useRef<string | null>(activeFileName);
  activeRef.current = activeFileName;

  // Live deltas now ride the single shared multiplexed EventSource via the SSE
  // provider rather than this provider opening its own connection (AD-11 fallback
  // retired): one tab holds exactly one /api/events stream.
  const { subscribe, sseStatus } = useSSEContext();

  const prevFilesRef = React.useRef<string[] | null>(null);
  const prevMtimesRef = React.useRef<Record<string, number>>({});
  const pulseTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const applyChange = React.useCallback((fileName: string, kind: 'added' | 'changed' | 'removed') => {
    setLive((s) => applyDelta(s, { fileName, kind, activeFileName: activeRef.current }));
    const timers = pulseTimersRef.current;
    const existing = timers.get(fileName);
    if (existing) clearTimeout(existing);
    if (kind === 'removed') { timers.delete(fileName); return; }
    const timer = setTimeout(() => {
      timers.delete(fileName);
      setLive((s) => endPulseFor(s, fileName));
    }, MIN_PULSE_MS);
    timers.set(fileName, timer);
  }, []);

  const refreshSnapshot = React.useCallback(async (reconcile: boolean) => {
    if (!projectName) return;
    const snap = await fetchArtifactSnapshot(projectName);
    setFiles(snap.files);
    setMtimes(snap.mtimes);

    // On a live refresh (have a baseline, not a reconnect self-heal), derive which
    // files changed since the previous snapshot and feed each through the reducer.
    const prevFiles = prevFilesRef.current;
    if (!reconcile && prevFiles !== null) {
      for (const c of diffSnapshots(prevFiles, prevMtimesRef.current, snap.files, snap.mtimes)) {
        applyChange(c.fileName, c.kind);
      }
    }
    prevFilesRef.current = snap.files;
    prevMtimesRef.current = snap.mtimes;

    if (reconcile) setLive((s) => ({ ...s, unseen: reconcileUnseen(s.unseen, snap.files) }));
  }, [projectName, applyChange]);

  // On project change: reset the diff baseline and take an initial snapshot.
  React.useEffect(() => {
    if (!projectName) {
      setFiles([]); setLive(emptyLiveState());
      prevFilesRef.current = null; prevMtimesRef.current = {};
      return;
    }
    prevFilesRef.current = null;
    prevMtimesRef.current = {};
    void refreshSnapshot(false);
  }, [projectName, refreshSnapshot]);

  // Subscribe to the shared provider for live deltas. Where the old code held its
  // own EventSource and parsed raw MessageEvents, the provider now delivers parsed
  // SSEEvents; we filter artifact_change to the active project and forward
  // live_degraded — byte-for-byte the same reconcile/setDegraded behavior.
  React.useEffect(() => {
    if (!projectName) return;
    return subscribe((ev: SSEEvent) => {
      if (ev.type === "artifact_change") {
        const payload = ev.payload as { projectName: string; kind: 'added' | 'changed' | 'removed' };
        if (payload.projectName !== projectName) return;
        void refreshSnapshot(false);
      } else if (ev.type === "live_degraded") {
        const payload = ev.payload as { degraded: boolean };
        setDegraded(payload.degraded);
      }
    });
  }, [projectName, subscribe, refreshSnapshot]);

  // Reconnect self-heal: when the shared connection drops to reconnecting/disconnected,
  // reconcile the unseen set against a fresh snapshot — the same self-heal the old
  // `es.onerror = () => refreshSnapshot(true)` provided, now driven by the status edge.
  React.useEffect(() => {
    if (!projectName) return;
    if (sseStatus === "reconnecting" || sseStatus === "disconnected") {
      void refreshSnapshot(true);
    }
  }, [projectName, sseStatus, refreshSnapshot]);

  React.useEffect(() => {
    const timers = pulseTimersRef.current;
    return () => { for (const t of timers.values()) clearTimeout(t); timers.clear(); };
  }, []);

  const markActive = React.useCallback((fileName: string | null) => {
    if (!fileName) return;
    setLive((s) => clearUnseenFor(s, fileName));
  }, []);

  const artifacts = React.useMemo(
    () => (projectName ? deriveArtifacts(projectName, files) : []),
    [projectName, files],
  );

  const value = React.useMemo<ArtifactLiveValue>(
    () => ({ artifacts, unseen: live.unseen, activePulse: live.activePulse, mtimes, degraded, markActive }),
    [artifacts, live.unseen, live.activePulse, mtimes, degraded, markActive],
  );

  return <ArtifactLiveContext.Provider value={value}>{children}</ArtifactLiveContext.Provider>;
}

export function useArtifactLive(): ArtifactLiveValue {
  return React.useContext(ArtifactLiveContext);
}
