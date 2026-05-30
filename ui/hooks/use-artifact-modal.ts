"use client";

import { useCallback, useState } from "react";
import type { Artifact } from "@/lib/artifact-model";

export function markdownPathForActive(artifacts: Artifact[], index: number): string | null {
  const a = artifacts[index];
  return a && a.isMarkdown ? a.fileName : null;
}

export function nextIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  return (current + 1) % length;
}

export function prevIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  return (current - 1 + length) % length;
}

/** New active index after deleting the item at `current` from a list of `length`. */
export function indexAfterDelete(current: number, length: number): number {
  const newLength = length - 1;
  if (newLength <= 0) return -1;
  return Math.min(current, newLength - 1);
}

export function useArtifactModal(initialIndex: number, getLength: () => number) {
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(initialIndex >= 0);
  const goNext = useCallback(() => setIndex((i) => nextIndex(i, getLength())), [getLength]);
  const goPrev = useCallback(() => setIndex((i) => prevIndex(i, getLength())), [getLength]);
  const close = useCallback(() => setOpen(false), []);
  const openAt = useCallback((i: number) => { setIndex(i); setOpen(true); }, []);
  const onDeleted = useCallback(() => {
    const next = indexAfterDelete(index, getLength());
    if (next < 0) { setOpen(false); return; }
    setIndex(next);
  }, [index, getLength]);
  return { index, open, goNext, goPrev, close, openAt, onDeleted };
}
