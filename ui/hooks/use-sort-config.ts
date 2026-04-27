"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary } from "@/types/components";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SortField = 'status' | 'name' | 'updated';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  primary: SortField;
  primaryDir: SortDirection;
  secondary: SortField | 'none';
  secondaryDir: SortDirection;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DEFAULT_SORT_CONFIG: SortConfig = {
  primary: 'status',
  primaryDir: 'asc',
  secondary: 'name',
  secondaryDir: 'asc',
};

const STORAGE_KEY = "monitoring-ui-sort-config";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// FR-14 / AD-4 — Urgent-first priority map keyed off the same four fields
// the row badge reads (`tier`, `planningStatus`, `executionStatus`,
// `hasMalformedState`). Lower number = higher urgency = floats to top in
// `asc` ('Urgent first') direction. Slot 9 is the bottom (Not Initialized
// and any unrecognized combination — see AD-4 final clause).
const STATUS_PRIORITY_URGENT_FIRST = {
  halted: 0,
  malformed: 1,
  executing: 2,
  approved: 3,
  finalReview: 4,   // AD-5 — between Approved and Planning
  planning: 5,
  planned: 6,
  notStarted: 7,
  complete: 8,
  notInitialized: 9,
} as const;

type StatusBucket = keyof typeof STATUS_PRIORITY_URGENT_FIRST;

function classifyStatus(p: ProjectSummary): StatusBucket {
  const { tier, planningStatus, executionStatus, hasMalformedState } = p;

  // tier === 'execution' AND executionStatus === 'halted' renders as Halted
  // in the badge; same source-of-truth for sort.
  if (tier === 'halted' || executionStatus === 'halted') return 'halted';
  if (hasMalformedState) return 'malformed';

  if (tier === 'execution') {
    if (executionStatus === 'in_progress') return 'executing';
    // not_started | complete | undefined → Approved badge
    return 'approved';
  }

  if (tier === 'review') return 'finalReview';

  if (tier === 'planning') {
    if (planningStatus === 'in_progress') return 'planning';
    if (planningStatus === 'complete') return 'planned';
    // not_started | undefined → Not Started badge
    return 'notStarted';
  }

  if (tier === 'complete') return 'complete';

  // tier === 'not_initialized' or any unrecognized combination — pin to bottom.
  return 'notInitialized';
}

function getStatusPriority(p: ProjectSummary): number {
  return STATUS_PRIORITY_URGENT_FIRST[classifyStatus(p)];
}

function compareField(
  a: ProjectSummary,
  b: ProjectSummary,
  field: SortField,
  dir: SortDirection
): number {
  if (field === 'status') {
    const result = getStatusPriority(a) - getStatusPriority(b);
    return dir === 'desc' ? result * -1 : result;
  }

  if (field === 'name') {
    const result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return dir === 'desc' ? result * -1 : result;
  }

  // field === 'updated'
  // Projects with lastUpdated === undefined always sort to bottom regardless of direction
  const aUndef = a.lastUpdated === undefined;
  const bUndef = b.lastUpdated === undefined;

  if (aUndef && bUndef) return 0;
  if (aUndef) return 1;   // a goes to bottom
  if (bUndef) return -1;  // b goes to bottom

  // Both defined — compare ISO 8601 strings (lexicographically sortable)
  const result =
    a.lastUpdated! < b.lastUpdated! ? -1 :
    a.lastUpdated! > b.lastUpdated! ? 1 :
    0;
  return dir === 'desc' ? result * -1 : result;
}

// ─── Comparator ──────────────────────────────────────────────────────────────

export function compareSortConfig(
  a: ProjectSummary,
  b: ProjectSummary,
  config: SortConfig
): number {
  const primary = compareField(a, b, config.primary, config.primaryDir);
  if (primary !== 0) return primary;

  if (config.secondary === 'none') return 0;

  return compareField(a, b, config.secondary, config.secondaryDir);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSortConfigReturn {
  config: SortConfig;
  setConfig: (config: SortConfig) => void;
}

export function useSortConfig(): UseSortConfigReturn {
  const [config, setConfigState] = useState<SortConfig>(DEFAULT_SORT_CONFIG);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed.primary === 'status' || parsed.primary === 'name' || parsed.primary === 'updated') &&
          (parsed.primaryDir === 'asc' || parsed.primaryDir === 'desc') &&
          (parsed.secondary === 'none' || parsed.secondary === 'status' || parsed.secondary === 'name' || parsed.secondary === 'updated') &&
          (parsed.secondaryDir === 'asc' || parsed.secondaryDir === 'desc')
        ) {
          setConfigState(parsed as SortConfig);
        } else {
          setConfigState(DEFAULT_SORT_CONFIG);
        }
      }
    } catch {
      // Missing, malformed, or localStorage unavailable — use default
    }
  }, []);

  const setConfig = useCallback((newConfig: SortConfig) => {
    setConfigState(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch {
      // Silently ignore write errors
    }
  }, []);

  return { config, setConfig };
}
