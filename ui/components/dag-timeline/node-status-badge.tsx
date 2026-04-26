"use client";

import * as React from "react";
import type { NodeStatus } from '@/types/state';
import { SpinnerBadge } from '@/components/badges';

interface NodeStatusBadgeProps {
  status: NodeStatus;
  label?: string;
  /** When true, suppresses visible label text on the badge — used by the compact row treatment (DD-1). */
  iconOnly?: boolean;
}

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

export const NodeStatusBadge = React.forwardRef<HTMLSpanElement, NodeStatusBadgeProps>(
  function NodeStatusBadge({ status, label, iconOnly }, ref) {
    const { cssVar, isSpinning, isComplete, isRejected, defaultLabel } = STATUS_MAP[status];
    const resolvedLabel = label ?? defaultLabel;
    return (
      <SpinnerBadge
        ref={ref}
        label={resolvedLabel}
        cssVar={cssVar}
        isSpinning={isSpinning}
        isComplete={isComplete}
        isRejected={isRejected}
        ariaLabel={resolvedLabel}
        hideLabel={iconOnly}
      />
    );
  },
);

NodeStatusBadge.displayName = "NodeStatusBadge";
