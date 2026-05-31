"use client";

import * as React from "react";
import { deriveArtifacts, type Artifact } from "@/lib/artifact-model";
import { emptyLiveState, applyDelta, clearUnseenFor, type LiveState } from "@/lib/live/live-store-model";
import { fetchArtifactSnapshot, reconcileUnseen, diffSnapshots } from "@/lib/live/snapshot";

interface ArtifactLiveValue {
  artifacts: Artifact[];
  unseen: Set<string>;
  activePulse: Set<string>;
  degraded: boolean;
  markActive: (fileName: string | null) => void;
}

export const defaultArtifactLiveValue: ArtifactLiveValue = {
  artifacts: [],
  unseen: new Set(),
  activePulse: new Set(),
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

  const applyChange = React.useCallback((fileName: string, kind: 'added' | 'changed' | 'removed') => {
    setLive((s) => applyDelta(s, { fileName, kind, activeFileName: activeRef.current }));
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

  const markActive = React.useCallback((fileName: string | null) => {
    if (!fileName) return;
    setLive((s) => clearUnseenFor(s, fileName));
  }, []);

  const artifacts = React.useMemo(
    () => (projectName ? deriveArtifacts(projectName, files, mtimes) : []),
    [projectName, files, mtimes],
  );

  const value = React.useMemo<ArtifactLiveValue>(
    () => ({ artifacts, unseen: live.unseen, activePulse: live.activePulse, degraded, markActive }),
    [artifacts, live.unseen, live.activePulse, degraded, markActive],
  );

  return <ArtifactLiveContext.Provider value={value}>{children}</ArtifactLiveContext.Provider>;
}

export function useArtifactLive(): ArtifactLiveValue {
  return React.useContext(ArtifactLiveContext);
}
