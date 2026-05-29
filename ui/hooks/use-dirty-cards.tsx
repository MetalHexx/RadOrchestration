"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";

export type DirtyMap = Record<string, boolean>;
export interface DirtyAction { type: "set"; key: string; dirty: boolean }

export function reduceDirty(state: DirtyMap, action: DirtyAction): DirtyMap {
  return { ...state, [action.key]: action.dirty };
}
export function computeAnyDirty(map: DirtyMap): boolean {
  return Object.values(map).some(Boolean);
}

interface DirtyCardsState {
  dirty: DirtyMap;
  anyDirty: boolean;
  setDirty: (key: string, isDirty: boolean) => void;
}

const DirtyCardsContext = createContext<DirtyCardsState | null>(null);

// One reducer per provider instance so the page-level navigation guard and each
// EditableSlotCard observe the same dirty map. Without this, each useDirtyCards()
// call owned its own reducer — the card's setDirty only mutated PairView's copy
// and the page's anyDirty stayed false, so the UnsavedChangesDialog never opened
// (FR-22: unsaved-changes dialog must fire on in-app navigation).
export function DirtyCardsProvider({ children }: { children: ReactNode }) {
  const [dirty, dispatch] = useReducer(reduceDirty, {} as DirtyMap);
  const anyDirty = useMemo(() => computeAnyDirty(dirty), [dirty]);
  const setDirty = useCallback((key: string, isDirty: boolean) => dispatch({ type: "set", key, dirty: isDirty }), []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (anyDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);
  return (
    <DirtyCardsContext.Provider value={{ dirty, anyDirty, setDirty }}>
      {children}
    </DirtyCardsContext.Provider>
  );
}

export function useDirtyCards(): DirtyCardsState {
  const ctx = useContext(DirtyCardsContext);
  if (!ctx) throw new Error("useDirtyCards must be used inside <DirtyCardsProvider>");
  return ctx;
}
