import { Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BindState } from './types';
import { BindStateDot } from './bind-state-dot';
import { rowStatus } from './membership-diff';

export interface PickerOption {
  slug: string;
  description: string;
  bindState?: BindState; // present for repo options
}

interface Props {
  entityType: 'repos' | 'groups';
  options: PickerOption[];
  saved: string[];
  checked: Set<string>;
  mode: 'detail' | 'create';
  onToggle: (slug: string) => void;
}

export function MembershipPicker({ entityType, options, saved, checked, mode, onToggle }: Props) {
  return (
    <div className="mt-1 overflow-hidden rounded-lg border" role="group">
      {options.map(opt => {
        const status = rowStatus(opt.slug, saved, checked, mode);
        const isChecked = checked.has(opt.slug);
        return (
          <label
            key={opt.slug}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 border-b px-3 py-2.5 last:border-b-0 hover:bg-accent/30',
              status === 'pending-add' && 'bg-[color-mix(in_oklch,var(--status-complete)_12%,transparent)]',
              status === 'pending-remove' && 'opacity-55',
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={isChecked}
              onChange={() => onToggle(opt.slug)}
            />
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded border',
                isChecked && 'bg-primary text-primary-foreground',
              )}
              aria-hidden="true"
            >
              {isChecked && <Check className="size-3" />}
            </span>
            {entityType === 'repos' && opt.bindState
              ? <BindStateDot state={opt.bindState} />
              : <Layers className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className={cn('font-mono text-sm shrink-0', status === 'pending-remove' && 'line-through')}>
              {opt.slug}
            </span>
            <span className={cn('min-w-0 flex-1 truncate text-xs text-muted-foreground', status === 'pending-remove' && 'line-through')}>
              {opt.description}
            </span>
            {status === 'pending-add' && (
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: 'var(--status-complete)' }}>add</span>
            )}
            {status === 'pending-remove' && (
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: 'var(--color-warning)' }}>remove</span>
            )}
          </label>
        );
      })}
    </div>
  );
}
