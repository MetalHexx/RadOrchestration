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

// ─── Fan-out ─────────────────────────────────────────────────────────────────

/**
 * Deliver one event to every subscriber, isolating failures: a listener that
 * throws is logged and skipped so it can neither starve the remaining
 * subscribers nor bubble out through useSSE's EventSource callback (which would
 * destabilize the single shared connection the whole tab rides). Exported for
 * direct behavioral testing of the isolation contract.
 */
export function fanOut(listeners: Iterable<SSEListener>, event: SSEEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[SSEProvider] subscriber threw while handling SSE event:", err);
    }
  }
}

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
    fanOut(listenersRef.current, event);
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
