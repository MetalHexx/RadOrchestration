"use client";
import { useState, useCallback } from 'react';

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return [...v].map(canonical).sort();
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, canonical(val)]));
  }
  return v;
}

export function isDirty(baseline: unknown, draft: unknown): boolean {
  return JSON.stringify(canonical(baseline)) !== JSON.stringify(canonical(draft));
}

export function useDirtyBatch<T>(baseline: T) {
  const [draft, setDraft] = useState<T>(baseline);
  const reset = useCallback(() => setDraft(baseline), [baseline]);
  return { draft, setDraft, reset, dirty: isDirty(baseline, draft) };
}
