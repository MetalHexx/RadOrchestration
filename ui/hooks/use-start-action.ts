"use client";

import { useCallback, useState } from "react";
import type { StartActionKind } from "@/components/layout";

export interface StartActionResult {
  success: boolean;
  platform?: string;
  error?: string;
}

/**
 * Shared fetch helper — exported for unit testing so the hook's effect
 * tree doesn't need a React renderer.
 */
export async function postStartAction(
  projectName: string,
  action: StartActionKind,
): Promise<StartActionResult> {
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/start-action`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as StartActionResult;
    if (!res.ok) {
      return { success: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return json;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Request failed.",
    };
  }
}

export interface UseStartActionReturn {
  pendingAction: StartActionKind | null;
  errorMessage: string | null;
  start: (action: StartActionKind) => Promise<void>;
  clearError: () => void;
}

/**
 * Client hook used by the NotStartedPaneV5. Tracks which action is in
 * flight (for DD-6 disabled state) and the most recent error message
 * (for DD-5 inline error). Success explicitly does not mutate /projects
 * client state — the natural refresh path picks up any filesystem change.
 * (AD-6)
 */
export function useStartAction(projectName: string | null): UseStartActionReturn {
  const [pendingAction, setPendingAction] = useState<StartActionKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const start = useCallback(
    async (action: StartActionKind) => {
      if (!projectName) return;
      setPendingAction(action);
      setErrorMessage(null);
      const res = await postStartAction(projectName, action);
      setPendingAction(null);
      if (!res.success) {
        setErrorMessage(res.error ?? "Launch failed.");
      }
    },
    [projectName],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  return { pendingAction, errorMessage, start, clearError };
}
