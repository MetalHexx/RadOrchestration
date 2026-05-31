export interface Layer { fileName: string; }
export interface StageState {
  front: Layer; // visible
  back: Layer | null; // hidden incoming
  crossfading: boolean;
}

export function initStage(fileName: string): StageState {
  return { front: { fileName }, back: null, crossfading: false };
}

export function isNavigation(s: StageState, nextFileName: string): boolean {
  return s.front.fileName !== nextFileName;
}

/** Load the incoming file on the hidden back layer; front stays visible (no white gap). */
export function beginNavigate(s: StageState, nextFileName: string): StageState {
  if (!isNavigation(s, nextFileName)) return s;
  return { front: s.front, back: { fileName: nextFileName }, crossfading: false };
}

/** Incoming content reported ready → promote to front and cross-fade. */
export function markIncomingReady(s: StageState): StageState {
  if (!s.back) return s;
  return { front: s.back, back: s.front, crossfading: true };
}

export interface LiveUpdatePlan { preserveScroll: boolean; crossfade: boolean; }
/** Same-file live update: re-render in place, preserve scroll, no cross-fade (DD-11). */
export function applyLiveUpdate(s: StageState, fileName: string): LiveUpdatePlan {
  const sameFile = s.front.fileName === fileName;
  return { preserveScroll: sameFile, crossfade: !sameFile };
}
