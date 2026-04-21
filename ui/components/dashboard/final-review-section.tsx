"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SpinnerBadge } from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import { ApproveGateButton } from "@/components/dashboard/approve-gate-button";
import type { FinalReview, FinalReviewStatus, PipelineTier } from "@/types/state";

interface FinalReviewSectionProps {
  finalReview: FinalReview;
  projectName: string;
  pipelineTier: PipelineTier;
  onDocClick: (path: string) => void;
}

const FINAL_REVIEW_BADGE: Record<
  Exclude<FinalReviewStatus, "not_started">,
  { label: string; cssVar: string; isSpinning: boolean; ariaLabel: string; isComplete?: boolean }
> = {
  in_progress: { label: "In Progress", cssVar: "--status-in-progress", isSpinning: true,  ariaLabel: "Final review: In Progress, active" },
  complete:    { label: "Complete",    cssVar: "--status-complete",     isSpinning: false, ariaLabel: "Final review: Complete", isComplete: true },
};

export function FinalReviewSection({ finalReview, projectName, pipelineTier, onDocClick }: FinalReviewSectionProps) {
  if (finalReview.status === "not_started") {
    return null;
  }

  const status = finalReview.status;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <SpinnerBadge {...FINAL_REVIEW_BADGE[status]} />
        </div>

        <div>
          <DocumentLink
            path={finalReview.doc_path}
            label="Review Report"
            onDocClick={onDocClick}
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          {finalReview.human_approved ? (
            <>
              <CheckCircle2
                className="h-4 w-4"
                style={{ color: "var(--status-complete)" }}
              />
              <span>Human Approved</span>
            </>
          ) : pipelineTier === "review" ? (
            <ApproveGateButton
              gateEvent="final_approved"
              projectName={projectName}
              // Iter-12: Final-review documents moved from project root to
              // `reports/{NAME}-FINAL-REVIEW.md`. Rebuild the document name
              // from node state's doc_path (basename only — ApproveGateButton
              // expects a filename, not a full path). Fall back to the
              // legacy filename shape if doc_path is null so the approve
              // button stays functional when state hasn't been mutated yet
              // (e.g., during in-progress render before the completion event).
              documentName={
                finalReview.doc_path
                  // doc_path is always POSIX-style (engine-produced) — no Windows-separator normalization needed.
                  ? finalReview.doc_path.split("/").pop() ?? `${projectName}-FINAL-REVIEW.md`
                  : `${projectName}-FINAL-REVIEW.md`
              }
              label="Approve Final Review"
              className="mt-1"
            />
          ) : (
            <>
              <Circle
                className="h-4 w-4"
                style={{ color: "var(--status-not-started)" }}
              />
              <span>Pending Approval</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
