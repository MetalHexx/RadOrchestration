"use client";

import { Badge } from '@/components/ui/badge';
import type { GraphStatus, GateMode, V5SourceControlState } from '@/types/state';
import { NodeStatusBadge } from './node-status-badge';
import { GateModeBadge } from '@/components/badges/gate-mode-badge';
import { SourceControlRow } from './source-control-row';

interface ProjectHeaderProps {
  projectName: string;
  schemaVersion: 'v4' | 'v5';
  graphStatus?: GraphStatus;
  gateMode?: GateMode | null;
  currentPhaseName?: string | null;
  progress?: { completed: number; total: number } | null;
  sourceControl?: V5SourceControlState | null;
}

export function ProjectHeader({ projectName, schemaVersion, graphStatus, gateMode, currentPhaseName, progress, sourceControl }: ProjectHeaderProps) {
  return (
    <header className="border-b border-border px-6 py-4" aria-label={`Project ${projectName}`}>
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">{projectName}</span>
        <Badge variant="secondary" className="text-xs">{schemaVersion}</Badge>
        {graphStatus && <NodeStatusBadge status={graphStatus} />}
        {gateMode !== undefined && <GateModeBadge mode={gateMode} />}
      </div>
      {graphStatus === 'in_progress' && currentPhaseName && (
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-muted-foreground">{currentPhaseName}</span>
          {progress && (
            <span className="text-sm text-muted-foreground">
              {progress.completed} of {progress.total} phases
            </span>
          )}
        </div>
      )}
      {sourceControl && (
        <div className="mt-2">
          <SourceControlRow sourceControl={sourceControl} />
        </div>
      )}
    </header>
  );
}
