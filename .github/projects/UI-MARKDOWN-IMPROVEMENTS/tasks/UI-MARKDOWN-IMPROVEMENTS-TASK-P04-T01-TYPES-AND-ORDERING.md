---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
task: 1
title: "TYPES-AND-ORDERING"
status: "pending"
skills_required: ["TypeScript", "domain logic"]
skills_optional: []
estimated_files: 2
---

# OrderedDoc Types and Document Ordering Utility

## Objective

Create the `OrderedDoc` and `FilesResponse` type definitions in the existing component types file and implement the `document-ordering.ts` utility that derives canonical Prev/Next navigation order from the normalized project state.

## Context

The orchestration dashboard displays project documents in a slide-out drawer. This task adds the foundational types and ordering utility that all Phase 4 tasks depend on. The utility flattens `NormalizedProjectState` into an ordered `OrderedDoc[]` array following the canonical sequence: planning docs → per-phase (plan → tasks → report → review) → final review → error log → other docs. Only non-null paths are included. The `PLANNING_STEP_ORDER` constant from `ui/types/state.ts` defines the planning doc order.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/types/components.ts` | Append `OrderedDoc` and `FilesResponse` interfaces |
| CREATE | `ui/lib/document-ordering.ts` | `getOrderedDocs` and `getAdjacentDocs` exported functions |

## Implementation Steps

1. **Add `OrderedDoc` interface** to `ui/types/components.ts` with the exact contract below.
2. **Add `FilesResponse` interface** to `ui/types/components.ts` with the exact contract below.
3. **Create `ui/lib/document-ordering.ts`** — import `PLANNING_STEP_ORDER` from `@/types/state`, `NormalizedProjectState` from `@/types/state`, and `OrderedDoc` from `@/types/components`.
4. **Implement `getOrderedDocs`** following the canonical ordering algorithm:
   - Iterate `PLANNING_STEP_ORDER` → for each step, if `state.planning.steps[step].output` is non-null, push an `OrderedDoc` with `category: 'planning'` and a title derived from the step name (capitalize: `'research'` → `'Research'`, `'prd'` → `'PRD'`, `'design'` → `'Design'`, `'architecture'` → `'Architecture'`, `'master_plan'` → `'Master Plan'`).
   - Iterate `state.execution.phases` in array order → for each phase:
     - If `phase.phase_doc` is non-null, push with `category: 'phase'`, title `'Phase {N} Plan'`.
     - Iterate `phase.tasks` in array order → for each task:
       - If `task.handoff_doc` is non-null, push with `category: 'task'`, title `'P{N}-T{M}: {task.title}'` (handoff).
       - If `task.report_doc` is non-null, push with `category: 'task'`, title `'P{N}-T{M} Report'`.
       - If `task.review_doc` is non-null, push with `category: 'review'`, title `'P{N}-T{M} Review'`.
     - If `phase.phase_report` is non-null, push with `category: 'phase'`, title `'Phase {N} Report'`.
     - If `phase.phase_review` is non-null, push with `category: 'review'`, title `'Phase {N} Review'`.
   - If `state.final_review.report_doc` is non-null, push with `category: 'review'`, title `'Final Review'`.
   - If `allFiles` array is provided:
     - Detect error log: find a file matching pattern `{projectName}-ERROR-LOG.md` (case-sensitive). If found, push with `category: 'error-log'`, title `'Error Log'`.
     - Collect "other docs": filter `allFiles` for `.md` files whose paths do NOT match any path already added. Sort alphabetically. Push each with `category: 'other'`, title derived from filename (strip `.md` extension).
5. **Implement `getAdjacentDocs`** — find `currentPath` in `docs` array, return `{ prev, next, currentIndex, total }`. If `currentPath` is not found, return `{ prev: null, next: null, currentIndex: -1, total: docs.length }`.
6. **Export both functions** as named exports.

## Contracts & Interfaces

```typescript
// ui/types/components.ts — append these interfaces

/** A document in the ordered navigation sequence */
export interface OrderedDoc {
  /** Relative path to the document (same format as state.json paths) */
  path: string;
  /** Display title for the navigation button label */
  title: string;
  /** Category for grouping: planning, phase, task, review, error-log, other */
  category: 'planning' | 'phase' | 'task' | 'review' | 'error-log' | 'other';
}

/** Response from GET /api/projects/[name]/files */
export interface FilesResponse {
  files: string[];
}
```

```typescript
// ui/lib/document-ordering.ts — function signatures

import { PLANNING_STEP_ORDER } from '@/types/state';
import type { NormalizedProjectState } from '@/types/state';
import type { OrderedDoc } from '@/types/components';

/**
 * Derive the canonical document navigation order from project state.
 *
 * Order: planning docs → per-phase (plan → tasks → report → review) →
 *        final review → error log → other docs.
 *
 * Only non-null paths are included.
 */
export function getOrderedDocs(
  state: NormalizedProjectState,
  projectName: string,
  allFiles?: string[]
): OrderedDoc[];

/**
 * Find the previous and next documents relative to the current path.
 */
export function getAdjacentDocs(
  docs: OrderedDoc[],
  currentPath: string
): { prev: OrderedDoc | null; next: OrderedDoc | null; currentIndex: number; total: number };
```

### Relevant Existing Types (read-only — do NOT modify these)

```typescript
// ui/types/state.ts — existing types consumed by document-ordering.ts

export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'master_plan'
] as const;

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: { current_tier: PipelineTier; human_gate_mode: HumanGateMode };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: NormalizedFinalReview;
  errors: NormalizedErrors;
  limits: NormalizedLimits;
}

export interface NormalizedPlanning {
  status: PlanningStatus;
  steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null }>;
  human_approved: boolean;
}

export interface NormalizedExecution {
  status: 'not_started' | 'in_progress' | 'complete' | 'halted';
  current_phase: number;
  total_phases: number;
  phases: NormalizedPhase[];
}

export interface NormalizedPhase {
  phase_number: number;
  title: string;
  status: PhaseStatus;
  phase_doc: string | null;       // Phase Plan path
  current_task: number;
  total_tasks: number;
  tasks: NormalizedTask[];
  phase_report: string | null;    // Phase Report path
  human_approved: boolean;
  phase_review: string | null;    // Phase Review path
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: PhaseReviewAction | null;
}

export interface NormalizedTask {
  task_number: number;
  title: string;
  status: TaskStatus;
  handoff_doc: string | null;     // Task Handoff path
  report_doc: string | null;      // Task Report path
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc: string | null;      // Code Review path
  review_verdict: ReviewVerdict | null;
  review_action: TaskReviewAction | null;
}

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;      // Final Review path
  human_approved: boolean;
}
```

### Canonical Document Ordering Algorithm

```
1. Planning docs (iterate PLANNING_STEP_ORDER):
   - planning.steps.research.output
   - planning.steps.prd.output
   - planning.steps.design.output
   - planning.steps.architecture.output
   - planning.steps.master_plan.output

2. Per phase (execution.phases[], in array order):
   a. phase.phase_doc             → Phase Plan
   b. Per task (phase.tasks[], in array order):
      - task.handoff_doc          → Task Handoff
      - task.report_doc           → Task Report
      - task.review_doc           → Task Review (Code Review)
   c. phase.phase_report          → Phase Report
   d. phase.phase_review          → Phase Review

3. final_review.report_doc        → Final Review

4. Error Log (from allFiles): match "{projectName}-ERROR-LOG.md"

5. Other Docs (from allFiles): remaining .md files not in the above set, sorted alphabetically
```

### Planning Step Title Map

```typescript
const STEP_TITLES: Record<PlanningStepName, string> = {
  research: 'Research',
  prd: 'PRD',
  design: 'Design',
  architecture: 'Architecture',
  master_plan: 'Master Plan',
};
```

## Styles & Design Tokens

Not applicable — this task creates types and a pure logic utility with no UI rendering.

## Test Requirements

- [ ] `getOrderedDocs` with a state containing 2 planning docs (research, prd) and 1 phase with 1 task returns docs in order: Research, PRD, Phase 1 Plan, P1-T1 handoff, P1-T1 Report, P1-T1 Review, Phase 1 Report, Phase 1 Review
- [ ] `getOrderedDocs` skips null paths — if `design` step output is null, it does not appear in the result
- [ ] `getOrderedDocs` with `allFiles` containing an error log file appends it after `final_review`
- [ ] `getOrderedDocs` with `allFiles` containing files not in the state pipeline pushes them as `category: 'other'` at the end, sorted alphabetically
- [ ] `getAdjacentDocs` at index 0 returns `prev: null` and correct `next`
- [ ] `getAdjacentDocs` at last index returns correct `prev` and `next: null`
- [ ] `getAdjacentDocs` at a middle index returns both `prev` and `next`
- [ ] `getAdjacentDocs` with a path not in `docs` returns `{ prev: null, next: null, currentIndex: -1, total }`

## Acceptance Criteria

- [ ] `OrderedDoc` interface exported from `ui/types/components.ts` with `path: string`, `title: string`, `category` union type
- [ ] `FilesResponse` interface exported from `ui/types/components.ts` with `files: string[]`
- [ ] `getOrderedDocs` exported from `ui/lib/document-ordering.ts` — accepts `NormalizedProjectState`, `projectName`, optional `allFiles`
- [ ] `getOrderedDocs` returns planning docs in `PLANNING_STEP_ORDER` sequence, only including non-null outputs
- [ ] `getOrderedDocs` returns per-phase docs in order: phase plan → (per-task: handoff → report → review) → phase report → phase review
- [ ] `getOrderedDocs` appends final review doc when non-null
- [ ] `getOrderedDocs` appends error log (detected via `{projectName}-ERROR-LOG.md` pattern in `allFiles`) when found
- [ ] `getOrderedDocs` appends remaining "other docs" from `allFiles` not in the pipeline, sorted alphabetically
- [ ] `getAdjacentDocs` exported from `ui/lib/document-ordering.ts` — returns `{ prev, next, currentIndex, total }`
- [ ] `getAdjacentDocs` returns `null` for `prev` at first doc and `null` for `next` at last doc
- [ ] All types compile without errors (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build` with zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/types/state.ts` — the existing types and `PLANNING_STEP_ORDER` are used as-is
- Do NOT modify `ui/lib/normalizer.ts` — it is read-only context
- Do NOT create any React components or UI elements — this task is types and pure logic only
- Do NOT add any third-party dependencies — use only existing imports
- Do NOT reference any external planning documents from within the source code
- The `getOrderedDocs` "other docs" detection must compare against all paths already collected (a `Set`), not against a hardcoded pattern list
