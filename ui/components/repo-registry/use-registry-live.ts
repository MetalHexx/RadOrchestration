"use client";
import { useEffect, useRef } from 'react';
import { useSSE } from '@/hooks/use-sse';
import type { SSEEvent } from '@/types/events';

export type LiveInput =
  | { event: 'nudge'; dirty: boolean; held: boolean }
  | { event: 'clean'; dirty: boolean; held: boolean };

export interface LiveAction { refetch: boolean; held: boolean }

// Pure policy: nudge-while-clean refetches now; nudge-while-dirty is held;
// a dirty→clean transition with a held nudge runs exactly one catch-up.
export function nextLiveAction(input: LiveInput): LiveAction {
  if (input.event === 'nudge') {
    return input.dirty ? { refetch: false, held: true } : { refetch: true, held: false };
  }
  // 'clean' transition
  return input.held ? { refetch: true, held: false } : { refetch: false, held: false };
}

// opts.onRefetch must call GET /api/registry and reconcile the result into the registry store.
export function useRegistryLive(opts: { dirty: boolean; onRefetch: () => void }) {
  const dirtyRef = useRef(opts.dirty);
  const heldRef = useRef(false);
  dirtyRef.current = opts.dirty;

  // dirty → clean: run a single catch-up if a nudge was held
  useEffect(() => {
    if (!opts.dirty) {
      const a = nextLiveAction({ event: 'clean', dirty: false, held: heldRef.current });
      heldRef.current = a.held;
      if (a.refetch) opts.onRefetch();
    }
  }, [opts.dirty, opts.onRefetch]);

  useSSE({
    url: '/api/events',
    onEvent: (e: SSEEvent) => {
      if (e.type !== 'registry_change') return;
      const a = nextLiveAction({ event: 'nudge', dirty: dirtyRef.current, held: heldRef.current });
      heldRef.current = a.held;
      if (a.refetch) opts.onRefetch();
    },
  });
}
