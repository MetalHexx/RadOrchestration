"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { SSEConnectionStatus, SSEEvent } from "@/types/events";

// ─── Interface ───────────────────────────────────────────────────────────────

type SSEListener = (event: SSEEvent) => void;

interface SSEContextValue {
  sseStatus: SSEConnectionStatus;
  reconnect: () => void;
  subscribe: (listener: SSEListener) => () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const defaultSSEContextValue: SSEContextValue = {
  sseStatus: "disconnected",
  reconnect: () => {},
  subscribe: () => () => {},
};

export const SSEContext = createContext<SSEContextValue>(defaultSSEContextValue);

// ─── Provider ────────────────────────────────────────────────────────────────

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<SSEListener>>(new Set());

  const subscribe = useCallback((listener: SSEListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const handleEvent = useCallback((event: SSEEvent) => {
    for (const listener of listenersRef.current) listener(event);
  }, []);

  const { status, reconnect } = useSSE({ url: "/api/events", onEvent: handleEvent });

  const value = useMemo<SSEContextValue>(
    () => ({ sseStatus: status, reconnect, subscribe }),
    [status, reconnect, subscribe]
  );

  return (
    <SSEContext.Provider value={value}>{children}</SSEContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export function useSSEContext(): SSEContextValue {
  return useContext(SSEContext);
}
