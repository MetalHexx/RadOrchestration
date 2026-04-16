"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NodesRecord, NodeState } from "@/types/state";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseFollowModeReturn {
  followMode: boolean;
  expandedLoopIds: string[];
  onAccordionChange: (
    value: string[],
    eventDetails: { reason: string }
  ) => void;
  toggleFollowMode: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively walk a v5 nodes record and return the list of loop-item values
 * for every `for_each_phase` / `for_each_task` node whose own aggregate
 * `status === 'in_progress'`. The returned values use the
 * `` `loop-${nodeId}` `` format produced by `buildLoopItemValue` in
 * `dag-loop-node.tsx`.
 *
 * Recursion covers:
 *   - `parallel.nodes` (nested loops inside a parallel block)
 *   - Each iteration's `nodes` record on `for_each_phase` / `for_each_task`
 *     entries (e.g. a `task_loop` nested inside a `for_each_phase` iteration)
 *
 * The loop node's own status is the single source of truth for expansion —
 * this helper does NOT inspect inner iteration statuses to decide whether a
 * loop is "active".
 */
export function computeSmartDefaults(nodes: NodesRecord | null): string[] {
  if (nodes === null) return [];
  const result: string[] = [];
  walkNodes(nodes, result);
  return result;
}

function walkNodes(nodes: NodesRecord, result: string[]): void {
  for (const nodeId of Object.keys(nodes)) {
    const node: NodeState | undefined = nodes[nodeId];
    if (!node) continue;

    if (node.kind === "for_each_phase" || node.kind === "for_each_task") {
      if (node.status === "in_progress") {
        result.push(`loop-${nodeId}`);
      }
      // Recurse into each iteration's nodes to discover nested loops.
      for (const iteration of node.iterations) {
        walkNodes(iteration.nodes, result);
      }
    } else if (node.kind === "parallel") {
      // Recurse into the parallel block's nodes to discover nested loops.
      walkNodes(node.nodes, result);
    }
    // step / gate / conditional nodes have no nested loop children — skip.
  }
}

/**
 * Shallow-equal comparison for string arrays — returns true when both arrays
 * have the same length and the same items in the same order.
 */
function shallowEqualStringArrays(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Exported for tests — the helper above is pure and has no React dependencies.
export const __shallowEqualStringArrays = shallowEqualStringArrays;

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * `useFollowMode` owns follow-mode state for the DAG timeline. It:
 *
 *   1. Computes smart defaults from the v5 nodes record — expanding active
 *      iterations (`status === 'in_progress'`) and collapsing everything else.
 *   2. Reacts to SSE-driven `nodes` changes while follow-mode is engaged, so
 *      the active iteration stays expanded as the pipeline progresses.
 *   3. Disengages follow-mode silently on any user-initiated accordion
 *      interaction using a double-guard:
 *        a) `eventDetails.reason === 'trigger-press'` AND
 *        b) the `isProgrammaticRef` suppression flag is `false`.
 *      The suppression flag is set immediately before every hook-initiated
 *      state update and cleared via `queueMicrotask` so the ensuing
 *      `onValueChange` callback never misinterprets the programmatic update
 *      as a user interaction.
 *   4. Resets to smart defaults + re-engages follow-mode when the selected
 *      project changes.
 *
 * When `nodes === null` (no project selected or v4 project), the hook returns
 * `followMode: true`, `expandedLoopIds: []`, and stable no-op callbacks — so
 * callers can invoke it unconditionally from the page.
 */
export function useFollowMode(
  nodes: NodesRecord | null,
  selectedProject: string | null
): UseFollowModeReturn {
  const [followMode, setFollowMode] = useState<boolean>(true);
  const [expandedLoopIds, setExpandedLoopIds] = useState<string[]>([]);
  const isProgrammaticRef = useRef<boolean>(false);
  const prevProjectRef = useRef<string | null>(selectedProject);

  // ── SSE-driven reactivity ──────────────────────────────────────────────────
  // Piggybacks on React re-renders produced by the existing `useProjects` SSE
  // pipeline — the hook does NOT register its own SSE listener.
  //
  // Uses a functional setter so the shallow-equal short-circuit reads the
  // up-to-date expanded list without needing to add `expandedLoopIds` to the
  // effect's dep array (the handoff keys this effect on `[nodes, followMode]`
  // exactly).
  useEffect(() => {
    if (!followMode) return;
    const nextExpanded = computeSmartDefaults(nodes);
    let didUpdate = false;
    setExpandedLoopIds((current) => {
      if (shallowEqualStringArrays(current, nextExpanded)) return current;
      didUpdate = true;
      return nextExpanded;
    });
    if (didUpdate) {
      isProgrammaticRef.current = true;
      queueMicrotask(() => {
        isProgrammaticRef.current = false;
      });
    }
  }, [nodes, followMode]);

  // ── Project-reset effect ───────────────────────────────────────────────────
  // Follow-mode is per-project and per-session. When the user switches
  // projects, re-engage follow-mode and snap to smart defaults.
  useEffect(() => {
    if (selectedProject === prevProjectRef.current) return;
    prevProjectRef.current = selectedProject;
    isProgrammaticRef.current = true;
    setFollowMode(true);
    setExpandedLoopIds(computeSmartDefaults(nodes));
    queueMicrotask(() => {
      isProgrammaticRef.current = false;
    });
    // `nodes` is intentionally read at the moment of the project switch — we
    // don't want this effect to re-fire on every nodes change, only on
    // selectedProject changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // ── Accordion change handler ───────────────────────────────────────────────
  // Always mirror the new value into `expandedLoopIds` so the UI reflects the
  // click immediately. Then apply the double-guard: disengage follow-mode
  // ONLY when BOTH the reason is 'trigger-press' AND the suppression flag is
  // clear. Disengagement is silent — no toast / banner / log.
  const onAccordionChange = useCallback(
    (value: string[], eventDetails: { reason: string }) => {
      setExpandedLoopIds(value);
      if (eventDetails.reason === "trigger-press" && !isProgrammaticRef.current) {
        setFollowMode(false);
      }
    },
    []
  );

  // ── Toggle (re-engage) ─────────────────────────────────────────────────────
  // The toolbar's Follow Mode toggle invokes this. Re-engaging re-applies
  // smart defaults through the suppression-flag-guarded path so the ensuing
  // `onValueChange` callback from the accordion is not misread as a user
  // interaction.
  const toggleFollowMode = useCallback(() => {
    const nextExpanded = computeSmartDefaults(nodes);
    isProgrammaticRef.current = true;
    setFollowMode(true);
    setExpandedLoopIds(nextExpanded);
    queueMicrotask(() => {
      isProgrammaticRef.current = false;
    });
  }, [nodes]);

  // ── `nodes === null` fallback ──────────────────────────────────────────────
  // No project selected or v4 project — return safe defaults and no-op
  // callbacks. The callbacks above are already stable (memoized with []
  // / [nodes]), so we return a fresh object but the callback identities are
  // preserved across renders.
  if (nodes === null) {
    return {
      followMode: true,
      expandedLoopIds: EMPTY_ARRAY,
      onAccordionChange: NOOP_ON_ACCORDION_CHANGE,
      toggleFollowMode: NOOP_TOGGLE,
    };
  }

  return {
    followMode,
    expandedLoopIds,
    onAccordionChange,
    toggleFollowMode,
  };
}

// Stable module-scope constants for the `nodes === null` fallback so every
// call with `nodes === null` returns reference-equal callbacks and array.
const EMPTY_ARRAY: string[] = [];
const NOOP_ON_ACCORDION_CHANGE = (_value: string[], _eventDetails: { reason: string }): void => {
  // no-op — the hook has no project to track
};
const NOOP_TOGGLE = (): void => {
  // no-op — the hook has no project to track
};
