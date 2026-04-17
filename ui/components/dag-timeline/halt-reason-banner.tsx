"use client";

import { XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GraphStatus } from '@/types/state';

export interface HaltReasonBannerProps {
  graphStatus: GraphStatus | undefined;
  haltReason: string | null;
}

export function shouldRenderHaltReason(
  graphStatus: GraphStatus | undefined,
  haltReason: string | null,
): boolean {
  if (graphStatus !== 'halted') return false;
  if (haltReason === null) return false;
  if (haltReason.trim() === '') return false;
  return true;
}

export function HaltReasonBanner(props: HaltReasonBannerProps): React.ReactElement | null {
  if (!shouldRenderHaltReason(props.graphStatus, props.haltReason)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'px-6 py-3',
        'border-l-4 border-l-[var(--status-halted)]',
        'bg-[color-mix(in_srgb,var(--status-halted)_10%,transparent)]',
        'flex items-start gap-2',
      )}
    >
      <XCircle
        aria-hidden="true"
        className="h-4 w-4 mt-0.5 shrink-0"
        style={{ color: 'var(--status-halted)' }}
      />
      <p className="text-sm leading-snug">
        <span className="font-semibold">Halted</span>
        {' \u2014 '}
        {props.haltReason}
      </p>
    </div>
  );
}
