"use client";

import { useState, useCallback } from "react";
import type { GateEvent, GateErrorResponse } from "@/types/state";

/** Structured error object surfaced by the hook. */
export interface UseApproveGateError {
  message: string;
  detail?: string;
}

interface UseApproveGateReturn {
  /** Invoke the gate approval API. Never throws — errors captured in `error` state. */
  approveGate: (projectName: string, event: GateEvent) => Promise<boolean>;
  /** True while the API call is in flight. */
  isPending: boolean;
  /** Structured error with message and optional raw pipeline detail, or null. */
  error: UseApproveGateError | null;
  /** Clear the current error state. */
  clearError: () => void;
}

export function useApproveGate(): UseApproveGateReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<UseApproveGateError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const approveGate = useCallback(
    async (projectName: string, event: GateEvent): Promise<boolean> => {
      setIsPending(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectName)}/gate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event }),
          }
        );

        if (res.ok) {
          return true;
        }

        try {
          const parsed: GateErrorResponse = await res.json();
          setError({ message: parsed.error, detail: parsed.detail });
        } catch {
          setError({
            message: `Approval request failed (HTTP ${res.status}).`,
          });
        }

        return false;
      } catch {
        setError({
          message:
            "Network error. Please check your connection and try again.",
        });
        return false;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { approveGate, isPending, error, clearError };
}
