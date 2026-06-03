import type { BindState } from './types';

export interface BindStateEntry { cssVar: string; label: string }

export const BIND_STATE_MAP: Record<BindState, BindStateEntry> = {
  bound:   { cssVar: '--status-complete', label: 'bound' },
  unbound: { cssVar: '--color-warning',   label: 'unbound' },
  missing: { cssVar: '--destructive',     label: 'missing' },
};
