"use client";

import { createContext, useContext, useState, useMemo, useCallback } from "react";

// ─── Interface ───────────────────────────────────────────────────────────────

interface ConfigClickContextValue {
  onConfigClick: (() => void) | undefined;
  setOnConfigClick: (handler: (() => void) | undefined) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const defaultConfigClickContextValue: ConfigClickContextValue = {
  onConfigClick: undefined,
  setOnConfigClick: () => {},
};

export const ConfigClickContext = createContext<ConfigClickContextValue>(defaultConfigClickContextValue);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ConfigClickProvider({ children }: { children: React.ReactNode }) {
  const [onConfigClick, setOnConfigClickState] = useState<(() => void) | undefined>(undefined);

  // Wrap the setter so callers can pass a handler directly without running into
  // useState's updater-function gotcha (a bare function argument would be
  // interpreted as an updater and invoked instead of stored).
  const setOnConfigClick = useCallback(
    (handler: (() => void) | undefined) => {
      setOnConfigClickState(() => handler);
    },
    []
  );

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
