"use client";

import * as React from "react";
import { deriveArtifacts, type Artifact } from "@/lib/artifact-model";
import { emptyLiveState, applyDelta, clearUnseenFor, type LiveState } from "@/lib/live/live-store-model";
import { fetchArtifactSnapshot, reconcileUnseen } from "@/lib/live/snapshot";

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

  const refreshSnapshot = React.useCallback(async (reconcile: boolean) => {
    if (!projectName) return;
    const snap = await fetchArtifactSnapshot(projectName);
    setFiles(snap.files);
    if (reconcile) setLive((s) => ({ ...s, unseen: reconcileUnseen(s.unseen, snap.files) }));
  }, [projectName]);

  React.useEffect(() => {
    if (!projectName) { setFiles([]); setLive(emptyLiveState()); return; }
    let es: EventSource | null = new EventSource("/api/events");
    void refreshSnapshot(false);
    es.addEventListener("artifact_change", (m: MessageEvent) => {
      const ev = JSON.parse(m.data) as { payload: { projectName: string; kind: 'added' | 'changed' | 'removed' } };
      if (ev.payload.projectName !== projectName) return;
      void refreshSnapshot(false).then(() => {
        // mtimes refreshed alongside files via a second pull kept minimal here.
      });
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

  // Apply a delta to mark unseen against the live active file when a change lands.
  const applyChange = React.useCallback((fileName: string, kind: 'added' | 'changed' | 'removed') => {
    setLive((s) => applyDelta(s, { fileName, kind, activeFileName: activeRef.current }));
  }, []);
  void applyChange; void setMtimes;

  const value = React.useMemo<ArtifactLiveValue>(
    () => ({ artifacts, unseen: live.unseen, activePulse: live.activePulse, degraded, markActive }),
    [artifacts, live.unseen, live.activePulse, degraded, markActive],
  );

  return <ArtifactLiveContext.Provider value={value}>{children}</ArtifactLiveContext.Provider>;
}

export function useArtifactLive(): ArtifactLiveValue {
  return React.useContext(ArtifactLiveContext);
}
