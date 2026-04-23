import type { SSEEvent } from '@/types/events';

export type Handle = symbol;

export interface Subscriber {
  enqueue: (event?: SSEEvent) => void;
  onError: (err: unknown) => void;
}
