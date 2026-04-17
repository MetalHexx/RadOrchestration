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

function getStatusPriority(p: ProjectSummary): number {
  const { graphStatus, hasMalformedState } = p;

  // Bucket 0: halted — v5 halted projects (live or persisted)
  if (graphStatus === 'halted') return 0;

  // Bucket 1: malformed / warning state — wins over any active status
  if (hasMalformedState) return 1;

  // Bucket 2: actively running v5 pipelines
  if (graphStatus === 'in_progress') return 2;

  // Bucket 3: v5 pipelines that have not yet begun
  if (graphStatus === 'not_started') return 3;

  // Bucket 4: v5 pipelines that finished successfully
  if (graphStatus === 'completed') return 4;

  // Bucket 5: legacy fallback — 'not_initialized', undefined, or any unrecognized value
  return 5;
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
