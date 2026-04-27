"use client";

import * as React from "react";
import type { NodeStatus } from '@/types/state';
import { SpinnerBadge } from '@/components/badges';
import { STATUS_MAP } from './node-status-map';

export { STATUS_MAP } from './node-status-map';
export type { StatusMapEntry } from './node-status-map';

interface NodeStatusBadgeProps {
  status: NodeStatus;
  label?: string;
  /** When true, suppresses visible label text on the badge — used by the compact row treatment (DD-1). */
  iconOnly?: boolean;
}

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
