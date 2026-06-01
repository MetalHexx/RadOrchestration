export interface LiveState {
  unseen: Set<string>;
  activePulse: Set<string>;
}
export interface Delta {
  fileName: string;
  kind: 'added' | 'changed' | 'removed';
  activeFileName: string | null;
}

export function emptyLiveState(): LiveState {
  return { unseen: new Set(), activePulse: new Set() };
}

export function applyDelta(s: LiveState, d: Delta): LiveState {
  const unseen = new Set(s.unseen);
  const activePulse = new Set(s.activePulse);
  if (d.kind === 'removed') {
    unseen.delete(d.fileName);
    activePulse.delete(d.fileName);
    return { unseen, activePulse };
  }
  // Pulse fires for any landing change (FR-6), even the open doc.
  activePulse.add(d.fileName);
  // Unseen only for artifacts not currently being viewed (AD-9).
  if (d.fileName !== d.activeFileName) unseen.add(d.fileName);
  return { unseen, activePulse };
}

export function clearUnseenFor(s: LiveState, fileName: string): LiveState {
  if (!s.unseen.has(fileName)) return s;
  const unseen = new Set(s.unseen);
  unseen.delete(fileName);
  return { unseen, activePulse: s.activePulse };
}

export function endPulseFor(s: LiveState, fileName: string): LiveState {
  if (!s.activePulse.has(fileName)) return s;
  const activePulse = new Set(s.activePulse);
  activePulse.delete(fileName);
  return { unseen: s.unseen, activePulse };
}

export function isUnseen(s: LiveState, fileName: string): boolean {
  return s.unseen.has(fileName);
}
