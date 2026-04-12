"use client";

import { createContext, useContext, useState, useMemo } from "react";

// ─── Interface ───────────────────────────────────────────────────────────────

interface ConfigClickContextValue {
  onConfigClick: (() => void) | undefined;
  setOnConfigClick: (handler: (() => void) | undefined) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const ConfigClickContext = createContext<ConfigClickContextValue>({
  onConfigClick: undefined,
  setOnConfigClick: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function ConfigClickProvider({ children }: { children: React.ReactNode }) {
  const [onConfigClick, setOnConfigClick] = useState<(() => void) | undefined>(undefined);

  const value = useMemo<ConfigClickContextValue>(
    () => ({ onConfigClick, setOnConfigClick }),
    [onConfigClick, setOnConfigClick]
  );

  return (
    <ConfigClickContext.Provider value={value}>{children}</ConfigClickContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export function useConfigClickContext(): ConfigClickContextValue {
  return useContext(ConfigClickContext);
}
