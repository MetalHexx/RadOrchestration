import { GitBranch, Layers } from 'lucide-react';
import type { BindState } from './types';
import { BindStateBadge } from './bind-state-badge';

type Props =
  | { kind: 'repo'; slug: string; bindState: BindState }
  | { kind: 'group'; slug: string };

export function EntityHeader(props: Props) {
  const Glyph = props.kind === 'repo' ? GitBranch : Layers;
  const label = props.kind === 'repo' ? 'Repo:' : 'Repo Group:';
  return (
    <div className="flex items-center gap-3">
      <Glyph className="size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
      <h1 className="font-mono text-xl font-semibold tracking-tight">
        <span className="font-medium text-muted-foreground">{label} </span>
        {props.slug}
      </h1>
      {props.kind === 'repo' && (
        <span className="ml-auto">
          <BindStateBadge state={props.bindState} />
        </span>
      )}
    </div>
  );
}
