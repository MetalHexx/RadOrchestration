---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 2
task: 5
title: "DASHBOARD-INTEGRATION"
status: "pending"
skills: ["generate-task-report", "run-tests"]
estimated_files: 4
---

# DASHBOARD-INTEGRATION

## Objective

Wire the `ApproveGateButton` compound component into the existing `PlanningSection`, `FinalReviewSection`, and `MainDashboard` components so that contextual approve buttons appear when a human gate is pending, and update the barrel export file to re-export the three new Phase 2 dashboard components.

## Context

`ApproveGateButton` (created in T04) is a self-contained compound component that manages the full approval lifecycle — trigger button, confirmation dialog, loading state, and error banner. This task integrates it into two existing dashboard sections by adding new props and conditional rendering, then threads those props from `MainDashboard`. The component accepts a `className` prop that applies to its wrapper `<div>`, not the inner `<Button>` — pass layout/positioning classes (e.g., `mt-4 flex justify-end`) via `className`. Button visibility is derived purely from normalized state props — no additional API calls.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/components/dashboard/planning-section.tsx` | Add `projectName` prop; render `ApproveGateButton` when gate pending |
| MODIFY | `ui/components/dashboard/final-review-section.tsx` | Add `projectName`, `pipelineTier` props; render `ApproveGateButton` when gate pending |
| MODIFY | `ui/components/layout/main-dashboard.tsx` | Thread `projectName` and `pipelineTier` to section components |
| MODIFY | `ui/components/dashboard/index.ts` | Re-export `ApproveGateButton`, `ConfirmApprovalDialog`, `GateErrorBanner` |

## Current File Contents

### `ui/components/dashboard/planning-section.tsx` (FULL)

```tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlanningChecklist } from "@/components/planning";
import type { PlanningStepName, PlanningStepStatus, PlanningStatus } from "@/types/state";

interface PlanningSectionProps {
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, {
      status: PlanningStepStatus;
      output: string | null;
    }>;
    human_approved: boolean;
  };
  onDocClick: (path: string) => void;
}

export function PlanningSection({ planning, onDocClick }: PlanningSectionProps) {
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
      </CardContent>
    </Card>
  );
}
```

### `ui/components/dashboard/final-review-section.tsx` (FULL)

```tsx
"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusIcon } from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import type { NormalizedFinalReview } from "@/types/state";

interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview;
  onDocClick: (path: string) => void;
}

export function FinalReviewSection({ finalReview, onDocClick }: FinalReviewSectionProps) {
  if (finalReview.status === "not_started") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon status={finalReview.status} />
          <span className="capitalize">{finalReview.status.replace("_", " ")}</span>
        </div>

        <div>
          <DocumentLink
            path={finalReview.report_doc}
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
```

### `ui/components/layout/main-dashboard.tsx` (FULL)

```tsx
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectHeader } from "@/components/dashboard/project-header";
import { ErrorSummaryBanner } from "@/components/planning/error-summary-banner";
import { PlanningSection } from "@/components/dashboard/planning-section";
import { ExecutionSection } from "@/components/execution/execution-section";
import { FinalReviewSection } from "@/components/dashboard/final-review-section";
import { ErrorLogSection } from "@/components/dashboard/error-log-section";
import { OtherDocsSection } from "@/components/dashboard";
import { GateHistorySection } from "@/components/dashboard/gate-history-section";
import { LimitsSection } from "@/components/dashboard/limits-section";
import { NotInitializedView } from "./not-initialized-view";
import { MalformedStateView } from "./malformed-state-view";
import type { NormalizedProjectState } from "@/types/state";
import type { ProjectSummary, GateEntry } from "@/types/components";

interface MainDashboardProps {
  projectState: NormalizedProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
  errorLogPath?: string | null;
  otherDocs?: string[];
}

function deriveGateEntries(state: NormalizedProjectState): GateEntry[] {
  const gates: GateEntry[] = [];

  // Post-Planning gate
  gates.push({
    gate: "Post-Planning",
    approved: state.planning.human_approved,
  });

  // Per-phase gates
  for (const phase of state.execution.phases) {
    gates.push({
      gate: `Phase ${phase.phase_number}: ${phase.title}`,
      approved: phase.human_approved,
    });
  }

  // Final Review gate
  if (state.final_review.status !== "not_started") {
    gates.push({
      gate: "Final Review",
      approved: state.final_review.human_approved,
    });
  }

  return gates;
}

export function MainDashboard({
  projectState,
  project,
  onDocClick,
  errorLogPath,
  otherDocs,
}: MainDashboardProps) {
  // Malformed state takes priority
  if (projectState === null && project.hasMalformedState) {
    return (
      <MalformedStateView
        projectName={project.name}
        errorMessage={project.errorMessage ?? "Unable to parse state.json"}
      />
    );
  }

  // Not initialized
  if (projectState === null && !project.hasState) {
    return (
      <NotInitializedView
        projectName={project.name}
        brainstormingDoc={project.brainstormingDoc}
        onDocClick={onDocClick}
      />
    );
  }

  // No state available (fallback)
  if (projectState === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          No project state available.
        </p>
      </div>
    );
  }

  const gates = deriveGateEntries(projectState);

  return (
    <ScrollArea className="h-[calc(100vh-56px)]">
      <div className="space-y-6 p-6">
        <ErrorSummaryBanner
          blockers={projectState.errors.active_blockers}
          totalRetries={projectState.errors.total_retries}
          totalHalts={projectState.errors.total_halts}
        />

        <ProjectHeader
          project={projectState.project}
          tier={projectState.pipeline.current_tier}
          gateMode={projectState.pipeline.human_gate_mode}
        />

        <PlanningSection
          planning={projectState.planning}
          onDocClick={onDocClick}
        />

        <ExecutionSection
          execution={projectState.execution}
          limits={projectState.limits}
          onDocClick={onDocClick}
        />

        <FinalReviewSection
          finalReview={projectState.final_review}
          onDocClick={onDocClick}
        />

        <ErrorLogSection errors={projectState.errors} errorLogPath={errorLogPath} onDocClick={onDocClick} />

        <OtherDocsSection files={otherDocs ?? []} onDocClick={onDocClick} />

        <GateHistorySection gates={gates} />

        <LimitsSection limits={projectState.limits} />
      </div>
    </ScrollArea>
  );
}
```

### `ui/components/dashboard/index.ts` (FULL)

```ts
export { ProjectHeader } from "./project-header";
export { PlanningSection } from "./planning-section";
export { FinalReviewSection } from "./final-review-section";
export { ErrorLogSection } from "./error-log-section";
export { OtherDocsSection } from "./other-docs-section";
export { GateHistorySection } from "./gate-history-section";
export { LimitsSection } from "./limits-section";
```

## Contracts & Interfaces

### `ApproveGateButton` Props (from `ui/components/dashboard/approve-gate-button.tsx`)

```typescript
import type { GateEvent } from '@/types/state';

interface ApproveGateButtonProps {
  /** The pipeline gate event to fire: 'plan_approved' or 'final_approved'. */
  gateEvent: GateEvent;
  /** The project name (used in the API URL path). */
  projectName: string;
  /** Display name of the document being approved (e.g., "UI-HUMAN-GATE-CONTROLS-MASTER-PLAN.md"). */
  documentName: string;
  /** Button label text (e.g., "Approve Plan" or "Approve Final Review"). */
  label: string;
  /** Optional additional CSS classes for the wrapper element (NOT the inner Button). */
  className?: string;
}
```

The `className` prop applies to the wrapper `<div>`, not the inner `<Button>`. Pass layout/positioning classes (e.g., `mt-4 flex justify-end`) via `className`.

### Updated `PlanningSectionProps`

```typescript
interface PlanningSectionProps {
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, {
      status: PlanningStepStatus;
      output: string | null;
    }>;
    human_approved: boolean;
  };
  projectName: string;          // NEW — needed for ApproveGateButton API call
  onDocClick: (path: string) => void;
}
```

### Updated `FinalReviewSectionProps`

```typescript
import type { NormalizedFinalReview, PipelineTier } from '@/types/state';

interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview;
  projectName: string;          // NEW — needed for ApproveGateButton API call
  pipelineTier: PipelineTier;   // NEW — needed for button visibility
  onDocClick: (path: string) => void;
}
```

### Key Types (from `ui/types/state.ts`)

```typescript
export type GateEvent = 'plan_approved' | 'final_approved';
export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';
export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;
  human_approved: boolean;
}

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: {
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: NormalizedFinalReview;
  errors: NormalizedErrors;
  limits: NormalizedLimits;
}

export interface NormalizedProjectMeta {
  name: string;
  description: string | null;
  created: string;
  updated: string;
  brainstorming_doc: string | null;
}
```

### Existing Imports Available

```typescript
// Already available in the project — use these as needed:
import { ApproveGateButton } from "@/components/dashboard/approve-gate-button";
import { ConfirmApprovalDialog } from "@/components/dashboard/confirm-approval-dialog";
import { GateErrorBanner } from "@/components/dashboard/gate-error-banner";
import type { PipelineTier } from "@/types/state";
```

## Implementation Steps

1. **Modify `ui/components/dashboard/planning-section.tsx`**:
   - Add `projectName: string` to the `PlanningSectionProps` interface
   - Add `projectName` to the destructured props in the function signature
   - Import `ApproveGateButton` from `@/components/dashboard/approve-gate-button`
   - After the `<PlanningChecklist>` block (still inside `<CardContent>`), add a conditional render: when `planning.status === 'complete' && !planning.human_approved`, render `<ApproveGateButton>` with:
     - `gateEvent="plan_approved"`
     - `projectName={projectName}`
     - `documentName={\`${projectName}-MASTER-PLAN.md\`}`
     - `label="Approve Plan"`
     - `className="mt-4 flex justify-end"`

2. **Modify `ui/components/dashboard/final-review-section.tsx`**:
   - Add `projectName: string` and `pipelineTier: PipelineTier` to the `FinalReviewSectionProps` interface
   - Import `PipelineTier` type from `@/types/state`
   - Import `ApproveGateButton` from `@/components/dashboard/approve-gate-button`
   - Add `projectName` and `pipelineTier` to the destructured props
   - Replace the existing "Pending Approval" indicator (the `else` branch of `finalReview.human_approved`) with a condition: when `pipelineTier === 'review'`, render `<ApproveGateButton>` with:
     - `gateEvent="final_approved"`
     - `projectName={projectName}`
     - `documentName={\`${projectName}-FINAL-REVIEW.md\`}`
     - `label="Approve Final Review"`
     - `className="mt-1"`
   - When `pipelineTier !== 'review'` AND `!finalReview.human_approved`, keep the existing `Circle` + "Pending Approval" indicator

3. **Modify `ui/components/layout/main-dashboard.tsx`**:
   - Pass `projectName={projectState.project.name}` to the `<PlanningSection>` component
   - Pass `projectName={projectState.project.name}` and `pipelineTier={projectState.pipeline.current_tier}` to the `<FinalReviewSection>` component
   - No new imports needed — all referenced values already exist on `projectState`

4. **Modify `ui/components/dashboard/index.ts`**:
   - Add three new re-export lines:
     ```typescript
     export { ApproveGateButton } from "./approve-gate-button";
     export { ConfirmApprovalDialog } from "./confirm-approval-dialog";
     export { GateErrorBanner } from "./gate-error-banner";
     ```

## Styles & Design Tokens

- **Approve button wrapper in PlanningSection**: `className="mt-4 flex justify-end"` — positions button at the right edge below the checklist
- **Approve button wrapper in FinalReviewSection**: `className="mt-1"` — light spacing in the existing `space-y-3` layout
- **Button itself**: Styling is handled internally by `ApproveGateButton` (`variant="default"`, `size="sm"`, `w-full sm:w-auto`) — do not add button-level classes
- **"Pending Approval" indicator** (retained when gate not actionable): `Circle` icon with `className="h-4 w-4"` and `style={{ color: "var(--status-not-started)" }}`, followed by `<span>Pending Approval</span>`
- **"Human Approved" indicator** (existing, unchanged): `CheckCircle2` icon with `className="h-4 w-4"` and `style={{ color: "var(--status-complete)" }}`

## Button Visibility Rules

| Section | Condition to SHOW button | Condition to HIDE button |
|---------|-------------------------|--------------------------|
| PlanningSection | `planning.status === 'complete' && !planning.human_approved` | Any other combination — button is not rendered |
| FinalReviewSection | `pipelineTier === 'review'` (AND `!finalReview.human_approved` — implicit, because the approved branch renders "Human Approved" instead) | `pipelineTier !== 'review'` — render "Pending Approval" indicator instead |

Note: In `FinalReviewSection`, the entire component returns `null` when `finalReview.status === 'not_started'`, so the button is never rendered in that state regardless.

## Test Requirements

- [ ] `PlanningSection` renders `ApproveGateButton` with `gateEvent="plan_approved"` when `planning.status === 'complete'` and `planning.human_approved === false`
- [ ] `PlanningSection` does NOT render `ApproveGateButton` when `planning.status !== 'complete'`
- [ ] `PlanningSection` does NOT render `ApproveGateButton` when `planning.human_approved === true`
- [ ] `PlanningSection` passes `projectName` to `ApproveGateButton` and derives `documentName` as `${projectName}-MASTER-PLAN.md`
- [ ] `FinalReviewSection` renders `ApproveGateButton` with `gateEvent="final_approved"` when `pipelineTier === 'review'` and `!finalReview.human_approved`
- [ ] `FinalReviewSection` renders "Pending Approval" text with `Circle` icon when `pipelineTier !== 'review'` and `!finalReview.human_approved`
- [ ] `FinalReviewSection` renders "Human Approved" text with `CheckCircle2` icon when `finalReview.human_approved === true` regardless of `pipelineTier`
- [ ] `FinalReviewSection` returns `null` when `finalReview.status === 'not_started'`
- [ ] `MainDashboard` passes `projectName` to `PlanningSection`
- [ ] `MainDashboard` passes `projectName` and `pipelineTier` to `FinalReviewSection`
- [ ] `ApproveGateButton`, `ConfirmApprovalDialog`, and `GateErrorBanner` are re-exported from `ui/components/dashboard/index.ts`
- [ ] Project compiles without type errors (`npx tsc --noEmit`)

## Acceptance Criteria

- [ ] "Approve Plan" button appears only when `planning.status === 'complete'` and `planning.human_approved === false`; hidden in all other states
- [ ] "Approve Final Review" button appears only when `pipelineTier === 'review'` and `!finalReview.human_approved`; hidden in all other states
- [ ] When `pipelineTier !== 'review'` and not approved, "Pending Approval" indicator renders (not the button)
- [ ] `projectName` is correctly threaded from `MainDashboard` → `PlanningSection` (via `projectState.project.name`)
- [ ] `projectName` and `pipelineTier` are correctly threaded from `MainDashboard` → `FinalReviewSection` (via `projectState.project.name` and `projectState.pipeline.current_tier`)
- [ ] `ApproveGateButton`, `ConfirmApprovalDialog`, `GateErrorBanner` are re-exported from `ui/components/dashboard/index.ts`
- [ ] All tests pass
- [ ] Build succeeds (`next build` or `npx tsc --noEmit`)
- [ ] No lint errors

## Constraints

- Do NOT modify `approve-gate-button.tsx`, `confirm-approval-dialog.tsx`, `gate-error-banner.tsx`, or `use-approve-gate.ts` — they are complete from prior tasks
- Do NOT modify `ui/types/state.ts` — all required types already exist
- Do NOT add global state or new hooks — button visibility is derived from existing props
- Do NOT add new dependencies — all imports (`ApproveGateButton`, `PipelineTier`, etc.) already exist in the project
- Do NOT modify the `deriveGateEntries` function or other unrelated logic in `main-dashboard.tsx`
- Pass layout classes via the `className` prop on `ApproveGateButton` (applies to the wrapper div), not as classes on the inner button
- Keep `"use client"` directive at the top of all modified `.tsx` files
