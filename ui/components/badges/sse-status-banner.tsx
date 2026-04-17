"use client";

import type { SSEConnectionStatus } from '@/types/events';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SSEStatusBannerProps {
  status: SSEConnectionStatus;
  onReconnect: () => void;
}

export function shouldRenderSSEStatus(status: SSEConnectionStatus): boolean {
  return status !== 'connected';
}

export function SSEStatusBanner(props: SSEStatusBannerProps): React.ReactElement | null {
  if (!shouldRenderSSEStatus(props.status)) {
    return null;
  }

  const isReconnecting = props.status === 'reconnecting';

  return (
    <div
      aria-live="polite"
      className={cn(
        'px-6 py-3',
        'border-l-4',
        isReconnecting
          ? 'border-l-[var(--connection-warning)] bg-[color-mix(in_srgb,var(--connection-warning)_10%,transparent)]'
          : 'border-l-[var(--connection-error)] bg-[color-mix(in_srgb,var(--connection-error)_10%,transparent)]',
        'flex items-center gap-2',
      )}
    >
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          isReconnecting && 'animate-pulse',
        )}
        style={{ backgroundColor: isReconnecting ? 'var(--connection-warning)' : 'var(--connection-error)' }}
      />
      <span className="text-sm leading-snug">
        {isReconnecting
          ? 'Live updates paused \u2014 reconnecting\u2026'
          : 'Live updates unavailable \u2014 timeline may be stale.'}
      </span>
      {!isReconnecting && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs ml-auto"
          onClick={props.onReconnect}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
