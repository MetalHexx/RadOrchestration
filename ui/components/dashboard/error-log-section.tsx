"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DocumentLink } from "@/components/documents";
import type { NormalizedErrors } from "@/types/state";

interface ErrorLogSectionProps {
  errors: NormalizedErrors;
  /** Path to error log file, or null if no error log exists */
  errorLogPath?: string | null;
  /** Callback to open a document in the viewer */
  onDocClick?: (path: string) => void;
}

export function ErrorLogSection({ errors, errorLogPath = null, onDocClick }: ErrorLogSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Log</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            Total Retries: <span className="font-mono">{errors.total_retries}</span>
          </span>
          <span>
            Total Halts: <span className="font-mono">{errors.total_halts}</span>
          </span>
        </div>

        {errors.active_blockers.length > 0 ? (
          <ul className="space-y-1 text-sm text-destructive">
            {errors.active_blockers.map((blocker, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="select-none" aria-hidden="true">•</span>
                <span>{blocker}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No active blockers</p>
        )}

        {errorLogPath !== null && onDocClick && (
          <div>
            <DocumentLink path={errorLogPath} label="View Error Log" onDocClick={onDocClick} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
