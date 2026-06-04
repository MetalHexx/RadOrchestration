import { Badge } from '@/components/ui/badge';
import type { BindState } from './types';
import { BIND_STATE_MAP } from './bind-state-map';
import { BindStateDot } from './bind-state-dot';

export function BindStateBadge({ state }: { state: BindState }) {
  const entry = BIND_STATE_MAP[state];
  return (
    <Badge
      variant="outline"
      className="gap-1.5"
      style={{ color: `var(${entry.cssVar})`, borderColor: `var(${entry.cssVar})` }}
    >
      <BindStateDot state={state} decorative />
      {entry.label}
    </Badge>
  );
}
