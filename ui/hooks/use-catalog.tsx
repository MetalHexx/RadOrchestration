"use client";
import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CatalogEntry } from "@/lib/action-events-fs";

export type ActionCategory = "agent-spawn" | "gate" | "terminal" | "source-control";

export interface GroupedCatalog {
  actions: Record<ActionCategory, CatalogEntry[]>;
  orphans: CatalogEntry[];
}

export function groupCatalog(entries: CatalogEntry[], query = ""): GroupedCatalog {
  const q = query.trim().toLowerCase();
  const matchesQuery = (e: CatalogEntry) => q === "" || e.name.toLowerCase().includes(q);
  const groups: GroupedCatalog = {
    actions: { "agent-spawn": [], "gate": [], "terminal": [], "source-control": [] },
    orphans: [],
  };
  for (const e of entries) {
    if (!matchesQuery(e)) continue;
    if (e.kind === "action" && e.category) groups.actions[e.category as ActionCategory].push(e);
    else if (e.kind === "event" && e.is_orphan === true) groups.orphans.push(e);
  }
  return groups;
}

/** Pure helper — returns a new array with only the matching entry's populated_slot_count replaced. */
export function applyEntryDelta(entries: CatalogEntry[], kind: string, name: string, populatedSlotCount: number): CatalogEntry[] {
  return entries.map((e) => e.kind === kind && e.name === name ? { ...e, populated_slot_count: populatedSlotCount } : e);
}

interface CatalogState {
  entries: CatalogEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshEntry: (kind: string, name: string, populatedSlotCount: number) => void;
}

const CatalogContext = createContext<CatalogState | null>(null);

// One store per provider instance so the sidebar badge, pair-view persist callback,
// and page-level entry lookups all observe the same entries[]. Without this, each
// useCatalog() call owned its own useState and refreshEntry only mutated the
// caller's copy — leaving the sidebar's CustomizedBadge stale after Save/Delete
// (FR-21, AD-8: "Badge updates immediately after save or delete").
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/action-events/catalog");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load catalog");
      setEntries(body.entries);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }, []);

  const refreshEntry = useCallback((kind: string, name: string, populatedSlotCount: number): void => {
    setEntries((prev) => applyEntryDelta(prev, kind, name, populatedSlotCount));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <CatalogContext.Provider value={{ entries, loading, error, refresh, refreshEntry }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}

export function findEntry(entries: CatalogEntry[], kind: "action" | "event", name: string) {
  return entries.find((e) => e.kind === kind && e.name === name) ?? null;
}
