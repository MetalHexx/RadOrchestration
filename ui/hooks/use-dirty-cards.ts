"use client";
import { useCallback, useEffect, useMemo, useReducer } from "react";

export type DirtyMap = Record<string, boolean>;
export interface DirtyAction { type: "set"; key: string; dirty: boolean }

export function reduceDirty(state: DirtyMap, action: DirtyAction): DirtyMap {
  return { ...state, [action.key]: action.dirty };
}
export function computeAnyDirty(map: DirtyMap): boolean {
  return Object.values(map).some(Boolean);
}

export function useDirtyCards() {
  const [dirty, dispatch] = useReducer(reduceDirty, {} as DirtyMap);
  const anyDirty = useMemo(() => computeAnyDirty(dirty), [dirty]);
  const setDirty = useCallback((key: string, isDirty: boolean) => dispatch({ type: "set", key, dirty: isDirty }), []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (anyDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);
  return { dirty, anyDirty, setDirty };
}
