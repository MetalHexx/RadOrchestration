import type { BindState } from './types';
import { BIND_STATE_MAP } from './bind-state-map';

export function BindStateDot({ state }: { state: BindState }) {
  const entry = BIND_STATE_MAP[state];
  return (
    <span
      aria-label={entry.label}
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: `var(${entry.cssVar})` }}
    />
  );
}
