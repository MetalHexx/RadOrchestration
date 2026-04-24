import { FileText, Lock, GitBranch, LayoutGrid, Layers, RefreshCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NodeKind } from '@/types/state';
import { cn } from '@/lib/utils';

interface NodeKindIconProps {
  kind: NodeKind;
  className?: string;
}

export const KIND_ICON_MAP: Record<NodeKind, LucideIcon> = {
  step: FileText,
  gate: Lock,
  conditional: GitBranch,
  parallel: LayoutGrid,
  for_each_phase: Layers,
  for_each_task: RefreshCcw,
};

export function NodeKindIcon({ kind, className }: NodeKindIconProps) {
  const Icon = KIND_ICON_MAP[kind];
  return (
    <Icon
      className={cn('h-4 w-4 text-muted-foreground shrink-0', className)}
      aria-hidden="true"
    />
  );
}
