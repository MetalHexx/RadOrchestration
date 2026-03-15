---
project: "MONITORING-UI"
phase: 2
task: 4
title: "Execution Section"
status: "pending"
skills_required: ["react", "typescript", "tailwindcss"]
skills_optional: ["accessibility"]
estimated_files: 5
---

# Execution Section

## Objective

Create the `ExecutionSection`, `PhaseCard`, `TaskCard`, and `ProgressBar` components that render the execution pipeline — all phases and their tasks — in the monitoring dashboard. These components form the primary execution progress visualization.

## Context

The dashboard renders a `NormalizedProjectState` object fetched from `GET /api/projects/[name]/state`. Phase 2 tasks T01–T03 have already built badge components (`StatusIcon`, `RetryBadge`, `SeverityBadge`, `ReviewVerdictBadge`) in `@/components/badges` and dashboard wrapper patterns (`PlanningSection` using shadcn `Card`). This task follows the same component patterns. The shadcn `Accordion` component (from `@base-ui/react/accordion`) is used for expandable phase cards. All CSS custom properties referenced below are already defined in `globals.css`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/execution/progress-bar.tsx` | Visual progress bar with a11y attributes |
| CREATE | `ui/components/execution/task-card.tsx` | Compact task row with badges and doc links |
| CREATE | `ui/components/execution/phase-card.tsx` | Expandable phase accordion with task list |
| CREATE | `ui/components/execution/execution-section.tsx` | Section wrapper rendering all phase cards |
| CREATE | `ui/components/execution/index.ts` | Barrel export for all execution components |

## Implementation Steps

1. **Create `progress-bar.tsx`**: Build a `ProgressBar` component that accepts `completed`, `total`, and optional `status` props. Render a horizontal track div with an inner fill div. Width of fill = `(completed / total) * 100%`. Display label `"{completed}/{total} tasks"`. Include `role="progressbar"`, `aria-valuenow={completed}`, `aria-valuemin={0}`, `aria-valuemax={total}`, and `aria-label="Phase progress: {completed} of {total} tasks complete"`.

2. **Create `task-card.tsx`**: Build a `TaskCard` component that renders a compact row for a single task. Display `StatusIcon` for status, task title as `"T{task_number}: {title}"`, and document link buttons for `handoff_doc`, `report_doc`, and `review_doc` (each rendered only when the path is non-null, as a clickable button calling `onDocClick(path)`; muted/disabled when null). Show `RetryBadge` when `retries > 0` (pass `max` from `limits.max_retries_per_task` via prop). Show `ReviewVerdictBadge` when `review_verdict` is non-null. Show error info below the task row when `last_error` is present: error text in destructive color + `SeverityBadge`.

3. **Create `phase-card.tsx`**: Build a `PhaseCard` component using shadcn `Accordion`, `AccordionItem`, `AccordionTrigger`, and `AccordionContent`. The trigger (header) shows: `StatusIcon` for phase status, title as `"Phase {phase_number}: {title}"`, `ProgressBar` with completed task count, and a phase doc link button. The content (expanded) renders a list of `TaskCard` components for each task. Below the task list, show phase review info if `phase_review_verdict` is present (`ReviewVerdictBadge`) and a phase report link button if `phase_report` is non-null. Apply a left border accent: `--status-in-progress` color for active phase, `--status-failed` color for failed/halted, transparent otherwise.

4. **Create `execution-section.tsx`**: Build an `ExecutionSection` component that wraps the phase list. Render a section header "Execution Progress" inside a shadcn `Card`. Iterate over `execution.phases` and render a `PhaseCard` for each. Only render the section when `execution.status !== 'not_started'`. Pass `currentPhase` (from `execution.current_phase`) so `PhaseCard` can determine if it's the active phase.

5. **Create `index.ts`**: Barrel-export `ProgressBar`, `TaskCard`, `PhaseCard`, and `ExecutionSection`.

6. **Verify**: Run `npm run build` in the `ui/` directory. Fix any TypeScript errors. Ensure all 5 files are created and exports resolve correctly.

## Contracts & Interfaces

```typescript
// @/types/state — Normalized types consumed by components

type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';
type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';
type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';
type PhaseReviewAction = 'advanced' | 'corrective_tasks_issued' | 'halted';
type Severity = 'minor' | 'critical';

interface NormalizedExecution {
  status: 'not_started' | 'in_progress' | 'complete' | 'halted';
  current_phase: number;
  total_phases: number;
  phases: NormalizedPhase[];
}

interface NormalizedPhase {
  phase_number: number;
  title: string;
  status: PhaseStatus;
  phase_doc: string | null;
  current_task: number;
  total_tasks: number;
  tasks: NormalizedTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review: string | null;
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: PhaseReviewAction | null;
}

interface NormalizedTask {
  task_number: number;
  title: string;
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc: string | null;
  review_verdict: ReviewVerdict | null;
  review_action: TaskReviewAction | null;
}

// TaskReviewAction is also imported from @/types/state
type TaskReviewAction = 'advanced' | 'corrective_task_issued' | 'halted';

interface NormalizedLimits {
  max_phases: number;
  max_tasks_per_phase: number;
  max_retries_per_task: number;
}
```

### Component Props

```typescript
// progress-bar.tsx
interface ProgressBarProps {
  completed: number;
  total: number;
  status?: PhaseStatus;
}

// task-card.tsx
interface TaskCardProps {
  task: NormalizedTask;
  maxRetries: number;          // from limits.max_retries_per_task
  onDocClick: (path: string) => void;
}

// phase-card.tsx
interface PhaseCardProps {
  phase: NormalizedPhase;
  isActive: boolean;           // true when phase_number === execution.current_phase
  maxRetries: number;          // passed through to TaskCard
  onDocClick: (path: string) => void;
}

// execution-section.tsx
interface ExecutionSectionProps {
  execution: NormalizedExecution;
  limits: NormalizedLimits;
  onDocClick: (path: string) => void;
}
```

### Available Imports

```typescript
// Badge components — all from @/components/badges
import {
  StatusIcon,
  RetryBadge,
  SeverityBadge,
  ReviewVerdictBadge,
} from "@/components/badges";

// shadcn UI components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// Lucide icons
import { FileText, ChevronRight } from "lucide-react";

// Utility
import { cn } from "@/lib/utils";
```

## Styles & Design Tokens

- Progress bar fill: `var(--color-progress-fill)` — `hsl(217, 91%, 60%)`
- Progress bar track: `var(--color-progress-track)` — light: `hsl(220, 14%, 96%)`, dark: `hsl(215, 28%, 17%)`
- Card background: `var(--card-bg)` — uses shadcn Card default
- Card border: `var(--card-border)` — uses shadcn Card default ring
- Active phase left border: `var(--status-in-progress)` — `hsl(217, 91%, 60%)`
- Failed/halted phase left border: `var(--status-failed)` — `hsl(0, 84%, 60%)`
- Document link color: `var(--color-link)` — `hsl(217, 91%, 60%)`
- Disabled link color: `var(--color-link-disabled)` — `hsl(215, 14%, 57%)`
- Error text: use Tailwind `text-destructive` class
- Task hover: `bg-accent/30`
- Destructive for errors: standard shadcn `--destructive` token

## Test Requirements

- [ ] `ProgressBar` renders "0/0 tasks" when total is 0 (no division by zero)
- [ ] `ProgressBar` renders "3/5 tasks" and fill width of 60% when completed=3, total=5
- [ ] `TaskCard` renders StatusIcon with correct status value
- [ ] `TaskCard` renders RetryBadge only when retries > 0
- [ ] `TaskCard` renders SeverityBadge and error text only when last_error is non-null
- [ ] `TaskCard` renders ReviewVerdictBadge only when review_verdict is non-null
- [ ] `TaskCard` renders document link buttons only for non-null doc paths
- [ ] `PhaseCard` renders as accordion that expands/collapses
- [ ] `PhaseCard` shows left border accent for active phase (in_progress)
- [ ] `ExecutionSection` renders nothing when execution.status is "not_started"
- [ ] `ExecutionSection` renders one PhaseCard per phase

## Acceptance Criteria

- [ ] `ProgressBar` renders correct fill ratio and "N/M tasks" label
- [ ] `ProgressBar` includes `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] `TaskCard` shows status icon, title, and document link labels for handoff/report/review
- [ ] `TaskCard` shows `RetryBadge` when retries > 0 and `SeverityBadge` when severity is present
- [ ] `TaskCard` shows `ReviewVerdictBadge` when review_verdict is present
- [ ] `PhaseCard` expands/collapses to show/hide task list
- [ ] `PhaseCard` shows progress bar with correct task count
- [ ] Active phase has left border accent in `--status-in-progress` color
- [ ] Failed/halted phase has left border accent in `--status-failed` color
- [ ] `ExecutionSection` renders one `PhaseCard` per phase
- [ ] `ExecutionSection` does not render when `execution.status === 'not_started'`
- [ ] All 5 files created at correct paths
- [ ] All components are `"use client"` components
- [ ] All components export from `@/components/execution/index.ts`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No lint errors

## Constraints

- Do NOT modify any existing files — all files are CREATE actions
- Do NOT implement SSE or real-time updates — this is Phase 3
- Do NOT use hardcoded color values — always use CSS custom properties (`var(--token)`) or Tailwind semantic classes
- Do NOT add a test framework or write unit test files — testing is deferred
- Do NOT reference external planning documents — this handoff is self-contained
- Use `"use client"` directive at the top of every component file
- Do NOT set `defaultValue` to make specific phases open by default — let the Accordion handle its own state (all collapsed initially)
- Keep document links as `<button>` elements calling `onDocClick(path)` — do NOT use `<a href>` tags since documents open in a drawer (Phase 3)
