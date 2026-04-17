"use client";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface DAGTimelineSkeletonProps {
  /** Number of row-shaped placeholders to render. Default is 6. */
  rowCount?: number;
}

/**
 * Presentational loading skeleton for the v5 DAGTimeline body.
 *
 * Renders a fixed-shape placeholder composed entirely from the existing
 * `Skeleton` primitive — no live data, no hooks, no side effects. The
 * `rowCount` prop (default 6) is exposed so tests can assert on deterministic
 * element counts.
 *
 * Shape (for default rowCount=6):
 *   - 1 section-label bar
 *   - rowCount standard row placeholders (icon + label + status pill)
 *   - loop-shaped placeholders interleaved after rows 2 and 4 (deterministic)
 */
export function DAGTimelineSkeleton(props?: DAGTimelineSkeletonProps): React.ReactElement {
  const rowCount = props?.rowCount ?? 6;

  const rows: React.ReactElement[] = [];

  for (let i = 0; i < rowCount; i++) {
    rows.push(
      <div key={`row-${i}`} className="flex items-center gap-3">
        {/* Icon-sized leading block */}
        <Skeleton className="h-4 w-4 rounded-md" />
        {/* Label-sized middle block */}
        <Skeleton className="h-4 flex-1 max-w-[40%]" />
        {/* Status-pill-sized trailing block */}
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    );

    // Interleave loop-shaped placeholders deterministically after row index 1 (2nd row) and row index 3 (4th row)
    if (i === 1 || i === 3) {
      rows.push(
        <Skeleton
          key={`loop-${i}`}
          className={cn('h-6 w-full max-w-[60%] rounded-md')}
        />
      );
    }
  }

  return (
    <div
      role="status"
      aria-label="Loading timeline"
      className="flex flex-col gap-3"
    >
      {/* Section-label-shaped bar */}
      <Skeleton className="h-4 w-32" />
      {rows}
    </div>
  );
}
