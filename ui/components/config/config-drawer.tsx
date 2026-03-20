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
import type { ParsedConfig } from "@/types/config";

interface ConfigDrawerProps {
  open: boolean;
  config: ParsedConfig | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

const SECTION_KEYS = [
  "project-storage",
  "pipeline-limits",
  "human-gates",
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
              <ConfigSection value="project-storage" title="Project Storage">
                <ConfigRow label="Base Path" value={config.projectStorage.basePath} />
                <ConfigRow label="Naming" value={config.projectStorage.naming} />
              </ConfigSection>

              <ConfigSection value="pipeline-limits" title="Pipeline Limits">
                <ConfigRow label="Max Phases" value={config.pipelineLimits.maxPhases} />
                <ConfigRow
                  label="Max Tasks per Phase"
                  value={config.pipelineLimits.maxTasksPerPhase}
                />
                <ConfigRow
                  label="Max Retries per Task"
                  value={config.pipelineLimits.maxRetriesPerTask}
                />
                <ConfigRow
                  label="Max Consecutive Review Rejections"
                  value={config.pipelineLimits.maxConsecutiveReviewRejections}
                />
              </ConfigSection>

              <ConfigSection value="human-gates" title="Human Gates">
                <GateRow
                  label="After Planning"
                  value={config.humanGates.afterPlanning.value}
                  locked={config.humanGates.afterPlanning.locked}
                />
                <ConfigRow
                  label="Execution Mode"
                  value={config.humanGates.executionMode}
                />
                <GateRow
                  label="After Final Review"
                  value={config.humanGates.afterFinalReview.value}
                  locked={config.humanGates.afterFinalReview.locked}
                />
              </ConfigSection>
            </Accordion>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
