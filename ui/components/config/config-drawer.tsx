"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { LockBadge } from "@/components/badges";
import { ConfigSection } from "./config-section";
import type { OrchestrationConfig } from "@/types/config";

interface ConfigDrawerProps {
  open: boolean;
  config: OrchestrationConfig | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

const SECTION_KEYS = [
  "projects",
  "limits",
  "human-gates",
  "source-control",
];

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function GateRow({
  label,
  value,
  locked,
}: {
  label: string;
  value: boolean;
  locked: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-foreground">
        {String(value)}
        {locked && <LockBadge />}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-muted/50 p-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ConfigDrawer({
  open,
  config,
  loading,
  error,
  onClose,
}: ConfigDrawerProps) {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px]" aria-label="Pipeline configuration">
        <SheetHeader>
          <SheetTitle>Pipeline Configuration</SheetTitle>
          <SheetDescription>
            Current orchestration pipeline settings
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {loading && <LoadingSkeleton />}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Failed to load configuration</p>
              <p className="mt-1 text-destructive/80">{error}</p>
            </div>
          )}

          {config && !loading && !error && (
            <Accordion multiple defaultValue={SECTION_KEYS}>
              <ConfigSection value="projects" title="Project Storage">
                <ConfigRow label="Base Path" value={config.projects.base_path} />
                <ConfigRow label="Naming" value={config.projects.naming} />
              </ConfigSection>

              <ConfigSection value="limits" title="Pipeline Limits">
                <ConfigRow label="Max Phases" value={config.limits.max_phases} />
                <ConfigRow
                  label="Max Tasks per Phase"
                  value={config.limits.max_tasks_per_phase}
                />
                <ConfigRow
                  label="Max Retries per Task"
                  value={config.limits.max_retries_per_task}
                />
                <ConfigRow
                  label="Max Consecutive Review Rejections"
                  value={config.limits.max_consecutive_review_rejections}
                />
              </ConfigSection>

              <ConfigSection value="human-gates" title="Human Gates">
                <GateRow
                  label="After Planning"
                  value={config.human_gates.after_planning}
                  locked={true}
                />
                <ConfigRow
                  label="Execution Mode"
                  value={config.human_gates.execution_mode}
                />
                <GateRow
                  label="After Final Review"
                  value={config.human_gates.after_final_review}
                  locked={true}
                />
              </ConfigSection>

              <ConfigSection value="source-control" title="Source Control">
                <ConfigRow label="Auto Commit" value={config.source_control.auto_commit} />
                <ConfigRow label="Auto PR" value={config.source_control.auto_pr} />
                <ConfigRow label="Provider" value={config.source_control.provider} />
              </ConfigSection>
            </Accordion>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
