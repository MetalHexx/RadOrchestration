"use client";
import { useEffect, useState } from "react";
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

export function useCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/action-events/catalog");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load catalog");
      setEntries(body.entries);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  return { entries, error, loading, refresh };
}
