'use client';

import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText, Lock, GitBranch, type LucideIcon } from 'lucide-react';
import { type TemplateNodeKind, type TemplateGraphNodeData } from '@/types/template';
import { cn } from '@/lib/utils';

const iconMap: Partial<Record<TemplateNodeKind, LucideIcon>> = {
  step: FileText,
  gate: Lock,
  conditional: GitBranch,
};

const accentMap: Record<string, string> = {
  step: 'transparent',
  gate: 'var(--gate-phase)',
  conditional: 'var(--tier-execution)',
};

interface TemplateGraphNodeProps {
  data: TemplateGraphNodeData;
}

export function TemplateGraphNode({ data }: TemplateGraphNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const Icon = iconMap[data.kind];
  const accent = accentMap[data.kind] ?? 'transparent';
  const tooltipId = `tooltip-${data.id}`;

  return (
    <div
      className={cn(
        'relative flex items-center w-[200px] h-[56px]',
        'bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)]',
        'px-3 py-2 gap-2',
        'hover:bg-accent/50 cursor-default',
      )}
      style={{ borderLeft: `3px solid ${accent}` }}
      tabIndex={0}
      role="group"
      aria-label={data.label}
      aria-describedby={showTooltip ? tooltipId : undefined}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />

      {Icon && (
        <Icon
          className="h-4 w-4 text-[var(--muted-foreground)] shrink-0"
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-[var(--card-foreground)] truncate">
          {data.label}
        </span>
        <span className="text-[11px] text-[var(--muted-foreground)]">
          {data.kind}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />

      {showTooltip && (
        <div id={tooltipId} role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-md px-3 py-2 text-xs whitespace-nowrap z-50">
          <div>id: {data.id}</div>
          <div>kind: {data.kind}</div>
          {data.kind === 'step' && (
            <div>action: {data.meta.action ?? '—'}</div>
          )}
          {data.kind === 'gate' && (
            <div>mode_ref: {data.meta.mode_ref ?? '—'}</div>
          )}
          {data.kind === 'conditional' && (
            <div>
              condition: {data.meta.config_ref ?? '—'} {data.meta.operator ?? ''} {data.meta.value ?? ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
