"use client";

import { createContext, useContext, useMemo } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { SSEConnectionStatus } from "@/types/events";

// ─── Interface ───────────────────────────────────────────────────────────────

interface SSEContextValue {
  sseStatus: SSEConnectionStatus;
  reconnect: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const SSEContext = createContext<SSEContextValue>({
  sseStatus: "disconnected",
  reconnect: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { status, reconnect } = useSSE({ url: "/api/events", statusOnly: true });

  const value = useMemo<SSEContextValue>(
    () => ({ sseStatus: status, reconnect }),
    [status, reconnect]
  );

  return (
    <SSEContext.Provider value={value}>{children}</SSEContext.Provider>
  );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export function useSSEContext(): SSEContextValue {
  return useContext(SSEContext);
}
