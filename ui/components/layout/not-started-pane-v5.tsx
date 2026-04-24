"use client";

import { FileText, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StartActionKind = "start-planning" | "start-brainstorming";

export interface NotStartedPaneV5Props {
  /** Selected project's name (ProjectSummary.name, SCREAMING_CASE). */
  projectName: string;
  /** Relative brainstorming-doc path, or null when absent (FR-2). */
  brainstormingDoc: string | null;
  /** Called with the brainstorming-doc path when the user clicks View. */
  onViewBrainstorming: (path: string) => void;
  /** Called when the user clicks Start Planning. */
  onStartPlanning: () => void;
  /** Called when the user clicks Start Brainstorming. */
  onStartBrainstorming: () => void;
  /** Which start-action is currently in flight, or null (DD-6). */
  pendingAction: StartActionKind | null;
  /** Inline error message to show below the button row, or null (DD-5). */
  errorMessage: string | null;
}

/**
 * v5 Not-Started pane — renders the project-specific right-pane card for a
 * Not-Started project. Visual reference is the v4 NotInitializedView but
 * with v5 Button primitives and conditional two-state button row.
 */
export function NotStartedPaneV5({
  projectName,
  brainstormingDoc,
  onViewBrainstorming,
  onStartPlanning,
  onStartBrainstorming,
  pendingAction,
  errorMessage,
}: NotStartedPaneV5Props) {
  const hasDoc = brainstormingDoc !== null;
  const planningPending = pendingAction === "start-planning";
  const brainstormingPending = pendingAction === "start-brainstorming";

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-base">{projectName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">Not Started</h2>
          <p className="text-sm text-muted-foreground">
            {hasDoc
              ? "This project has not been started yet. A brainstorming document exists — review it or move on to planning."
              : "This project has not been started yet. No brainstorming document exists — start brainstorming to create one."}
          </p>

          <div className="flex items-center justify-center gap-2 pt-1">
            {hasDoc ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  disabled={planningPending}
                  aria-busy={planningPending ? "true" : undefined}
                  onClick={onStartPlanning}
                >
                  {planningPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      Start Planning
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" aria-hidden="true" />
                      Start Planning
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // FR-3 / DD-4: the v5 page wires onViewBrainstorming to the
                    // existing useDocumentDrawer().openDocument so the current
                    // DocumentDrawer slide-out opens with the exact path.
                    if (brainstormingDoc) onViewBrainstorming(brainstormingDoc);
                  }}
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  View Brainstorming
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                disabled={brainstormingPending}
                aria-busy={brainstormingPending ? "true" : undefined}
                onClick={onStartBrainstorming}
              >
                {brainstormingPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Start Brainstorming
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" aria-hidden="true" />
                    Start Brainstorming
                  </>
                )}
              </Button>
            )}
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
