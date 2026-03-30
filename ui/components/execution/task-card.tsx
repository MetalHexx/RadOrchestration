"use client";

import {
  RetryBadge,
  ReviewVerdictBadge,
} from "@/components/badges";
import { StageBadge } from "@/components/badges/stage-badge";
import { DocumentLink } from "@/components/documents";
import type { Task } from "@/types/state";

interface TaskCardProps {
  task: Task;
  taskNumber: number;
  maxRetries: number;
  onDocClick: (path: string) => void;
}

export function TaskCard({ task, taskNumber, maxRetries, onDocClick }: TaskCardProps) {
  return (
    <div className="space-y-1">
      <div
        role="listitem"
        aria-label={`Task ${taskNumber}: ${task.name}, status: ${task.status}`}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30"
      >
        <StageBadge stage={task.stage} status={task.status} />
        <span className="flex-1 text-sm font-medium truncate">
          T{taskNumber}: {task.name}
        </span>
        <div className="flex items-center gap-1">
          {task.review.verdict !== null && (
            <ReviewVerdictBadge verdict={task.review.verdict} />
          )}
          {task.retries > 0 && (
            <RetryBadge retries={task.retries} max={maxRetries} />
          )}
          <DocumentLink path={task.docs.handoff} label="Handoff" onDocClick={onDocClick} />
          <DocumentLink path={task.docs.review}  label="Review"  onDocClick={onDocClick} />
        </div>
      </div>
    </div>
  );
}
