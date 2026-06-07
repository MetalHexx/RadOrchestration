"use client";

import { useCallback, useRef } from "react";
import type { Artifact } from "@/lib/artifact-model";

export function markdownPathForActive(artifacts: Artifact[], fileName: string | null): string | null {
  if (fileName === null) return null;
  const a = artifacts.find((art) => art.fileName === fileName);
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

export function modalKeyAction(key: string): 'prev' | 'next' | 'close' | null {
  if (key === 'ArrowLeft') return 'prev';
  if (key === 'ArrowRight') return 'next';
  if (key === 'Escape') return 'close';
  return null;
}

/**
 * The filename `offset` steps away from `current` in the CURRENT ordered list,
 * wrapping modulo length. Identity is the filename, not the index, so a list
 * that reordered underneath the modal lands on the neighbour of the document
 * the user is actually looking at — never a stale slot. If `current` is no
 * longer in the list, falls back to the first file. Returns null for an empty
 * list. `offset` is +1 (next) or -1 (prev).
 */
export function fileNameAtOffset(
  artifacts: Artifact[],
  current: string | null,
  offset: 1 | -1,
): string | null {
  if (artifacts.length === 0) return null;
  const i = artifacts.findIndex((a) => a.fileName === current);
  if (i < 0) return artifacts[0]?.fileName ?? null;
  const stepped = offset === 1 ? nextIndex(i, artifacts.length) : prevIndex(i, artifacts.length);
  return artifacts[stepped]?.fileName ?? null;
}

/**
 * The filename to focus after deleting `current` from the CURRENT ordered list
 * (the active file is still present at call time). Mirrors `indexAfterDelete`'s
 * clamp semantics in filename terms: keep position when a middle item goes,
 * clamp to the new last when the tail goes, and return null (closes) when the
 * only item is removed or `current` is absent.
 */
export function fileNameAfterDelete(artifacts: Artifact[], current: string | null): string | null {
  const i = artifacts.findIndex((a) => a.fileName === current);
  if (i < 0) return null;
  const remaining = artifacts.filter((_, idx) => idx !== i);
  if (remaining.length === 0) return null;
  return remaining[Math.min(i, remaining.length - 1)]?.fileName ?? null;
}

export function openNavMode(isOpen: boolean): 'push' | 'replace' { return isOpen ? 'replace' : 'push'; }
export function closeNavMode(openedViaPush: boolean): 'back' | 'replace' { return openedViaPush ? 'back' : 'replace'; }

/**
 * Modal identity is anchored to a FILENAME, not an array index. The artifact
 * list can reorder/insert/delete at runtime (live file changes); pinning to
 * `activeFileName` keeps focus on the same document across those mutations.
 *
 * @param getArtifacts   getter for the CURRENT ordered list — read at navigation
 *                       time so prev/next/onDeleted operate on live positions.
 * @param activeFileName the URL-derived active filename (source of truth).
 * @param navigate       callback to push a new filename (or null to close) into
 *                       the router — the caller owns URL → modal wiring.
 */
export function useArtifactModal(
  getArtifacts: () => Artifact[],
  activeFileName: string | null,
  navigate: (fileName: string | null, mode: 'push' | 'replace' | 'back') => void,
) {
  const open = activeFileName !== null;
  const pushedRef = useRef(false);
  const openByName = useCallback((fileName: string) => {
    const mode = openNavMode(open);
    if (mode === 'push') pushedRef.current = true;
    navigate(fileName, mode);
  }, [open, navigate]);
  const close = useCallback(() => {
    const mode = closeNavMode(pushedRef.current);
    pushedRef.current = false;
    navigate(null, mode);
  }, [navigate]);
  const goNext = useCallback(() => navigate(fileNameAtOffset(getArtifacts(), activeFileName, 1), 'replace'), [getArtifacts, activeFileName, navigate]);
  const goPrev = useCallback(() => navigate(fileNameAtOffset(getArtifacts(), activeFileName, -1), 'replace'), [getArtifacts, activeFileName, navigate]);
  const onDeleted = useCallback(() => navigate(fileNameAfterDelete(getArtifacts(), activeFileName), 'replace'), [getArtifacts, activeFileName, navigate]);
  return { activeFileName, open, openByName, close, goNext, goPrev, onDeleted };
}
