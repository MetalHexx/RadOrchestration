'use client';

import { useState } from 'react';
import { Layers, RefreshCcw, type LucideIcon } from 'lucide-react';
import { type TemplateNodeKind, type TemplateGraphNodeData } from '@/types/template';
import { cn } from '@/lib/utils';

const iconMap: Partial<Record<TemplateNodeKind, LucideIcon>> = {
  for_each_phase: Layers,
  for_each_task: RefreshCcw,
};

const accentMap: Partial<Record<TemplateNodeKind, string>> = {
  for_each_phase: 'var(--tier-planning)',
  for_each_task: 'var(--tier-review)',
};

const loopLabelMap: Partial<Record<TemplateNodeKind, string>> = {
  for_each_phase: 'Loop: each phase',
  for_each_task: 'Loop: each task',
};

interface TemplateGroupNodeProps {
  data: TemplateGraphNodeData;
}

export function TemplateGroupNode({ data }: TemplateGroupNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const Icon = iconMap[data.kind];
  const accent = accentMap[data.kind] ?? 'transparent';

  return (
    <div
      className="w-full h-full rounded-[var(--radius-lg)]"
      style={{
        background: 'var(--canvas-node-group-bg)',
        border: '1px dashed var(--canvas-node-group-border)',
        borderTop: `3px solid ${accent}`,
      }}
    >
      {/* Header row */}
      <div
        className={cn(
          'relative flex items-center h-[40px] px-3 gap-2 rounded-t-[var(--radius-lg)]',
          'bg-[var(--card)] cursor-default',
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {Icon && (
          <Icon
            className="h-4 w-4 text-[var(--muted-foreground)] shrink-0"
            aria-hidden="true"
          />
        )}

        <span className="text-sm font-medium text-[var(--card-foreground)] truncate">
          {data.label}
        </span>

        <span className="ml-auto text-[11px] text-[var(--muted-foreground)] shrink-0">
          {data.kind}
        </span>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-md px-3 py-2 text-xs whitespace-nowrap z-50">
            <div>id: {data.id}</div>
            <div>kind: {data.kind}</div>
            <div>{loopLabelMap[data.kind] ?? ''}</div>
          </div>
        )}
      </div>
    </div>
  );
}
