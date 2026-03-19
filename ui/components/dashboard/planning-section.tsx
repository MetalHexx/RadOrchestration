"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlanningChecklist } from "@/components/planning";
import { ApproveGateButton } from "@/components/dashboard/approve-gate-button";
import type { PlanningState } from "@/types/state";

interface PlanningSectionProps {
  planning: PlanningState;
  projectName: string;
  onDocClick: (path: string) => void;
}

export function PlanningSection({ planning, projectName, onDocClick }: PlanningSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <PlanningChecklist
          steps={planning.steps}
          humanApproved={planning.human_approved}
          onDocClick={onDocClick}
        />
        {planning.status === "complete" && !planning.human_approved && (
          <ApproveGateButton
            gateEvent="plan_approved"
            projectName={projectName}
            documentName={`${projectName}-MASTER-PLAN.md`}
            label="Approve Plan"
            className="mt-4 flex justify-end"
          />
        )}
      </CardContent>
    </Card>
  );
}
