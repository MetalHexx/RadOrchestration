"use client";
import { useState, useCallback } from 'react';
export { UnsavedChangesDialog } from '@/components/action-events/unsaved-changes-dialog';

export function resolveGuard(dirty: boolean, intent: () => void): { prompt: boolean; confirm?: () => void } {
  if (!dirty) { intent(); return { prompt: false }; }
  return { prompt: true, confirm: intent };
}

export function useNavGuard() {
  const [pending, setPending] = useState<null | (() => void)>(null);

  // guard(dirty, intent): run now if clean, else stash and open the dialog
  const guard = useCallback((dirty: boolean, intent: () => void) => {
    const r = resolveGuard(dirty, intent);
    if (r.prompt) setPending(() => r.confirm!);
  }, []);

  const onConfirm = useCallback(() => {
    pending?.();
    setPending(null);
  }, [pending]);

  const onCancel = useCallback(() => setPending(null), []);

  return { open: pending !== null, guard, onConfirm, onCancel };
}
