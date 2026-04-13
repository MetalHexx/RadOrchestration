"use client";

import { Badge } from '@/components/ui/badge';

interface ProjectHeaderProps {
  projectName: string;
  schemaVersion: 'v4' | 'v5';
}

export function ProjectHeader({ projectName, schemaVersion }: ProjectHeaderProps) {
  return (
    <div className="border-b border-border px-6 py-4 flex items-center gap-3">
      <span className="text-lg font-semibold">{projectName}</span>
      <Badge variant="secondary" className="text-xs">{schemaVersion}</Badge>
    </div>
  );
}
