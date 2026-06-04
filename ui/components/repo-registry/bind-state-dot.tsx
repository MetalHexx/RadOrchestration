import type { BindState } from './types';
import { BIND_STATE_MAP } from './bind-state-map';

export function BindStateDot({ state, decorative }: { state: BindState; decorative?: boolean }) {
  const entry = BIND_STATE_MAP[state];
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { 'aria-label': entry.label })}
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: `var(${entry.cssVar})` }}
    />
  );
}
