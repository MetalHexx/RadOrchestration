"use client";

import * as React from "react";
import { deriveArtifacts, type Artifact } from "@/lib/artifact-model";
import { emptyLiveState, applyDelta, clearUnseenFor, endPulseFor, type LiveState } from "@/lib/live/live-store-model";
import { fetchArtifactSnapshot, reconcileUnseen, diffSnapshots } from "@/lib/live/snapshot";

// How long a file stays in activePulse after a change lands. Outlasts the 0.9s CSS
// pulse animation so the visual finishes, then clears so a later change re-pulses.
const PULSE_SETTLE_MS = 1500;

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
    }, PULSE_SETTLE_MS);
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

  React.useEffect(() => {
    if (!projectName) {
      setFiles([]); setLive(emptyLiveState());
      prevFilesRef.current = null; prevMtimesRef.current = {};
      return;
    }
    prevFilesRef.current = null;
    prevMtimesRef.current = {};
    let es: EventSource | null = new EventSource("/api/events");
    void refreshSnapshot(false);
    es.addEventListener("artifact_change", (m: MessageEvent) => {
      const ev = JSON.parse(m.data) as { payload: { projectName: string; kind: 'added' | 'changed' | 'removed' } };
      if (ev.payload.projectName !== projectName) return;
      void refreshSnapshot(false);
    });
    es.addEventListener("live_degraded", (m: MessageEvent) => {
      const ev = JSON.parse(m.data) as { payload: { degraded: boolean } };
      setDegraded(ev.payload.degraded);
    });
    es.onerror = () => { void refreshSnapshot(true); };
    return () => { es?.close(); es = null; };
  }, [projectName, refreshSnapshot]);

  React.useEffect(() => {
    const timers = pulseTimersRef.current;
    return () => { for (const t of timers.values()) clearTimeout(t); timers.clear(); };
  }, []);

  const markActive = React.useCallback((fileName: string | null) => {
    if (!fileName) return;
    setLive((s) => clearUnseenFor(s, fileName));
  }, []);

  const artifacts = React.useMemo(
    () => (projectName ? deriveArtifacts(projectName, files, mtimes) : []),
    [projectName, files, mtimes],
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
