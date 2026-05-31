"use client";

import { Loader2, Play, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactTile } from "@/components/artifacts";
import type { Artifact } from "@/lib/artifact-model";
import type { StartActionKind } from "./start-action-kinds";

export interface LaunchScreenProps {
  projectName: string;
  artifacts: Artifact[];
  onOpenArtifact: (index: number) => void;
  onDeleteArtifact: (artifact: Artifact) => void;
  onStartPlanning: () => void;
  onStartBrainstorming: () => void;
  pendingAction: StartActionKind | null;
  errorMessage: string | null;
  unseen?: Set<string>;
  activePulse?: Set<string>;
}

export function LaunchScreen({
  projectName, artifacts, onOpenArtifact, onDeleteArtifact,
  onStartPlanning, onStartBrainstorming, pendingAction, errorMessage,
  unseen, activePulse,
}: LaunchScreenProps) {
  const hasArtifacts = artifacts.length > 0;
  const planningPending = pendingAction === "start-planning";
  const brainstormingPending = pendingAction === "start-brainstorming";

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{projectName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasArtifacts
            ? "Keep brainstorming, generate a mockup or visual, or start planning whenever you're ready."
            : "Start brainstorming to capture your idea — generate a mockup or visual, then plan when you're ready."}
        </p>

        {hasArtifacts && (
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {artifacts.map((artifact, index) => (
              <div key={artifact.fileName} className="w-full sm:w-64">
                <ArtifactTile
                  projectName={projectName}
                  artifact={artifact}
                  onOpen={() => onOpenArtifact(index)}
                  onDelete={() => onDeleteArtifact(artifact)}
                  unseen={unseen?.has(artifact.fileName) ?? false}
                  activePulse={activePulse?.has(artifact.fileName) ?? false}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          {hasArtifacts ? (
            <>
              <Button variant="outline" disabled={brainstormingPending}
                aria-busy={brainstormingPending ? "true" : undefined} onClick={onStartBrainstorming}>
                {brainstormingPending
                  ? <><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Continue Brainstorming</>
                  : <><Lightbulb className="size-3.5" aria-hidden="true" />Continue Brainstorming</>}
              </Button>
              <Button variant="default" disabled={planningPending}
                aria-busy={planningPending ? "true" : undefined} onClick={onStartPlanning}>
                {planningPending
                  ? <><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Start Planning</>
                  : <><Play className="size-3.5" aria-hidden="true" />Start Planning</>}
              </Button>
            </>
          ) : (
            <Button variant="default" disabled={brainstormingPending}
              aria-busy={brainstormingPending ? "true" : undefined} onClick={onStartBrainstorming}>
              {brainstormingPending
                ? <><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Start Brainstorming</>
                : <><Play className="size-3.5" aria-hidden="true" />Start Brainstorming</>}
            </Button>
          )}
        </div>

        {errorMessage && (
          <p className="mt-3 text-sm text-destructive" role="alert">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
