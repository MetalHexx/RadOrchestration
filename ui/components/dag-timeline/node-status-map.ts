import type { NodeStatus } from '@/types/state';

export interface StatusMapEntry {
  cssVar: string;
  isSpinning: boolean;
  isComplete: boolean;
  isRejected: boolean;
  defaultLabel: string;
}

export const STATUS_MAP: Record<NodeStatus, StatusMapEntry> = {
  not_started: { cssVar: '--status-not-started', isSpinning: false, isComplete: false, isRejected: false, defaultLabel: 'Not Started' },
  in_progress:  { cssVar: '--status-in-progress', isSpinning: true,  isComplete: false, isRejected: false, defaultLabel: 'In Progress' },
  completed:    { cssVar: '--status-complete',     isSpinning: false, isComplete: true,  isRejected: false, defaultLabel: 'Completed' },
  failed:       { cssVar: '--status-failed',       isSpinning: false, isComplete: false, isRejected: true,  defaultLabel: 'Failed' },
  halted:       { cssVar: '--status-halted',       isSpinning: false, isComplete: false, isRejected: true,  defaultLabel: 'Halted' },
  skipped:      { cssVar: '--status-skipped',      isSpinning: false, isComplete: false, isRejected: false, defaultLabel: 'Skipped' },
};
