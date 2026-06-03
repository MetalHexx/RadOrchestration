"use client";
import { useState, useEffect, useCallback } from 'react';
import type { RegistrySnapshot } from './types';
import {
  hydrate, upsertRepo as up, removeRepo as rr,
  upsertGroup as ug, removeGroup as rg, type RegistryStore,
} from './registry-store';

export function useRegistryStore() {
  const [store, setStore] = useState<RegistryStore>({ repos: [], repoGroups: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/registry', { cache: 'no-store' });
      if (res.ok) {
        setStore(hydrate((await res.json()) as RegistrySnapshot));
        setError(null);
      } else {
        setError(`Failed to load registry (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registry');
    }
  }, []);

  useEffect(() => { void refetch().finally(() => setIsLoading(false)); }, [refetch]);

  return {
    store, isLoading, error, refetch, setStore,
    upsertRepo: (r: Parameters<typeof up>[1]) => setStore(s => up(s, r)),
    removeRepo: (slug: string) => setStore(s => rr(s, slug)),
    upsertGroup: (g: Parameters<typeof ug>[1]) => setStore(s => ug(s, g)),
    removeGroup: (slug: string) => setStore(s => rg(s, slug)),
  };
}
