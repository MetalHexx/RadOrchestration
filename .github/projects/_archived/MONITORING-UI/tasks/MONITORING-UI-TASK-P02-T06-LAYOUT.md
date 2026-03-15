---
project: "MONITORING-UI"
phase: 2
task: 6
title: "Layout Shell + Edge-Case Views + Page Wiring"
status: "pending"
skills_required: ["nextjs", "react", "shadcn-ui"]
skills_optional: []
estimated_files: 7
---

# Layout Shell + Edge-Case Views + Page Wiring

## Objective

Create the `AppHeader`, `MainDashboard`, `NotInitializedView`, and `MalformedStateView` layout components, then wire the root `page.tsx` to use the `useProjects` hook and render the full application shell with sidebar, header, and conditional dashboard content. Also fix the `error.tsx` emoji accessibility (Phase 1 carry-forward).

## Context

All dashboard section components are complete: `ProjectHeader`, `ErrorSummaryBanner`, `PlanningSection`, `ExecutionSection`, `FinalReviewSection`, `ErrorLogSection`, `GateHistorySection`, `LimitsSection`. Sidebar components (`ProjectSidebar`, `ProjectListItem`, `SidebarSearch`) and all badge components are also complete. The `useProjects` hook fetches the project list and selected project state from API routes. This task wires everything into a working page. The shadcn `SidebarProvider` must wrap the sidebar and content area for collapse/expand to work.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/layout/app-header.tsx` | Top header bar |
| CREATE | `ui/components/layout/main-dashboard.tsx` | Dashboard container rendering all sections |
| CREATE | `ui/components/layout/not-initialized-view.tsx` | View for projects with no state.json |
| CREATE | `ui/components/layout/malformed-state-view.tsx` | View for projects with unparseable state |
| CREATE | `ui/components/layout/index.ts` | Barrel export for layout module |
| MODIFY | `ui/app/page.tsx` | Wire root page with useProjects, SidebarProvider, AppHeader, ProjectSidebar, MainDashboard |
| MODIFY | `ui/app/error.tsx` | Add `role="img" aria-label="Warning"` to emoji div (Phase 1 carry-forward) |

## Implementation Steps

1. **Create `ui/components/layout/app-header.tsx`** — A fixed 56px top bar containing: the app title "Orchestration Monitor", a `ConnectionIndicator` rendered with `status="disconnected"` (static placeholder — SSE wiring is Phase 3), a disabled Config button placeholder (Phase 4), and a disabled Theme Toggle placeholder (Phase 4). Uses CSS variables `--header-bg` and `--header-border` for background and bottom border.

2. **Create `ui/components/layout/not-initialized-view.tsx`** — Accepts `projectName` and optional `brainstormingDoc` string plus `onDocClick` callback. Renders a centered card with the project name, a "Not Initialized" heading, descriptive text explaining the project has no `state.json`, and a clickable brainstorming doc link (if `brainstormingDoc` is provided, calls `onDocClick` with it).

3. **Create `ui/components/layout/malformed-state-view.tsx`** — Accepts `projectName` and `errorMessage` string. Renders a centered warning card with the project name, a `WarningBadge` showing the error, and prominent amber-tinted styling.

4. **Create `ui/components/layout/main-dashboard.tsx`** — Container component that accepts `NormalizedProjectState | null`, a `ProjectSummary`, and an `onDocClick` callback. Conditional logic: if `projectState` is null and `project.hasMalformedState` → render `MalformedStateView`; if `projectState` is null and `!project.hasState` → render `NotInitializedView`; otherwise render all dashboard sections in order inside a `ScrollArea`. Derive `GateEntry[]` for `GateHistorySection` from state data.

5. **Create `ui/components/layout/index.ts`** — Barrel export: `AppHeader`, `MainDashboard`, `NotInitializedView`, `MalformedStateView`.

6. **Modify `ui/app/page.tsx`** — Convert to `"use client"`. Import and use `useProjects` hook. Wrap UI in `SidebarProvider`. Render: `AppHeader` fixed at top, then a flex row of `ProjectSidebar` (left) + `SidebarInset` containing `MainDashboard` (right). Handle states: loading (show skeleton/spinner), error (show error message), no project selected (show placeholder), project selected (find matching `ProjectSummary` and pass it + `projectState` to `MainDashboard`).

7. **Modify `ui/app/error.tsx`** — Change the emoji `<div>` from `<div className="mb-4 text-4xl">⚠️</div>` to `<div className="mb-4 text-4xl" role="img" aria-label="Warning">⚠️</div>`.

## Contracts & Interfaces

### Types from `ui/types/state.ts`

```typescript
export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';
export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';
export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'skipped';
export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';
export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';
export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';
export type Severity = 'minor' | 'critical';
export type HumanGateMode = 'ask' | 'phase' | 'task' | 'autonomous';
export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';
export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: { current_tier: PipelineTier; human_gate_mode: HumanGateMode; };
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

export interface NormalizedPlanning {
  status: PlanningStatus;
  steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null; }>;
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
  phase_doc: string | null;
  current_task: number;
  total_tasks: number;
  tasks: NormalizedTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review: string | null;
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: string | null;
}

export interface NormalizedTask {
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
  review_action: string | null;
}

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;
  human_approved: boolean;
}

export interface NormalizedErrors {
  total_retries: number;
  total_halts: number;
  active_blockers: string[];
}

export interface NormalizedLimits {
  max_phases: number;
  max_tasks_per_phase: number;
  max_retries_per_task: number;
}
```

### Types from `ui/types/components.ts`

```typescript
export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
}

export interface GateEntry {
  gate: string;           // e.g., "Post-Planning", "Phase 1", "Final Review"
  approved: boolean;
  timestamp?: string;     // ISO 8601 if available
}
```

### `useProjects` hook return type (from `ui/hooks/use-projects.ts`)

```typescript
interface UseProjectsReturn {
  /** List of all discovered projects */
  projects: ProjectSummary[];
  /** Name of the currently selected project, or null */
  selectedProject: string | null;
  /** Normalized state for the selected project, or null if not available */
  projectState: NormalizedProjectState | null;
  /** Function to select a project by name */
  selectProject: (name: string) => void;
  /** True while any fetch is in progress */
  isLoading: boolean;
  /** Error message string, or null */
  error: string | null;
}
```

### Component Props Contracts

```typescript
// AppHeader — no required props (all content is internal or static placeholders)
interface AppHeaderProps {}

// MainDashboard
interface MainDashboardProps {
  projectState: NormalizedProjectState | null;
  project: ProjectSummary;
  onDocClick: (path: string) => void;
}

// NotInitializedView
interface NotInitializedViewProps {
  projectName: string;
  brainstormingDoc?: string | null;
  onDocClick: (path: string) => void;
}

// MalformedStateView
interface MalformedStateViewProps {
  projectName: string;
  errorMessage: string;
}
```

### Existing Component Imports Available

```typescript
// From @/components/badges
import {
  PipelineTierBadge,
  StatusIcon,
  ReviewVerdictBadge,
  SeverityBadge,
  RetryBadge,
  WarningBadge,
  ConnectionIndicator,
  LockBadge,
} from "@/components/badges";

// From @/components/sidebar
import {
  ProjectSidebar,
  ProjectListItem,
  SidebarSearch,
} from "@/components/sidebar";

// From @/components/dashboard
import {
  ProjectHeader,
  PlanningSection,
  FinalReviewSection,
  ErrorLogSection,
  GateHistorySection,
  LimitsSection,
} from "@/components/dashboard";

// From @/components/execution
import {
  ProgressBar,
  TaskCard,
  PhaseCard,
  ExecutionSection,
} from "@/components/execution";

// From @/components/planning
import {
  PlanningChecklist,
  ErrorSummaryBanner,
} from "@/components/planning";

// From @/components/layout (to be created in this task)
import {
  AppHeader,
  MainDashboard,
  NotInitializedView,
  MalformedStateView,
} from "@/components/layout";
```

### shadcn/ui Sidebar Provider Pattern

The `SidebarProvider` from `@/components/ui/sidebar` wraps both sidebar and main content. `SidebarInset` is used for the main content area adjacent to the sidebar. Usage pattern:

```tsx
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// In JSX:
<SidebarProvider>
  <ProjectSidebar {...sidebarProps} />
  <SidebarInset>
    {/* main content here */}
  </SidebarInset>
</SidebarProvider>
```

`SidebarProvider` manages collapse/expand state internally. It renders a `<div>` with sidebar context. `SidebarInset` renders a `<main>` element that flexes to fill remaining width.

### ScrollArea Pattern

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";

// Wrap scrollable content:
<ScrollArea className="h-[calc(100vh-56px)]">
  {/* dashboard sections */}
</ScrollArea>
```

### ProjectSidebar Props (Existing)

```typescript
interface ProjectSidebarProps {
  projects: ProjectSummary[];
  selectedProject: string | null;
  onSelectProject: (name: string) => void;
  isLoading: boolean;
}
```

### Existing Section Props (Summary)

```typescript
// ProjectHeader
interface ProjectHeaderProps {
  project: { name: string; description: string | null; created: string; updated: string; };
  tier: PipelineTier;
  gateMode: HumanGateMode;
}

// ErrorSummaryBanner
interface ErrorSummaryBannerProps {
  blockers: string[];
  totalRetries: number;
  totalHalts: number;
}

// PlanningSection
interface PlanningSectionProps {
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, { status: PlanningStepStatus; output: string | null; }>;
    human_approved: boolean;
  };
  onDocClick: (path: string) => void;
}

// ExecutionSection
interface ExecutionSectionProps {
  execution: NormalizedExecution;
  limits: NormalizedLimits;
  onDocClick: (path: string) => void;
}

// FinalReviewSection
interface FinalReviewSectionProps {
  finalReview: NormalizedFinalReview;
  onDocClick: (path: string) => void;
}

// ErrorLogSection
interface ErrorLogSectionProps {
  errors: NormalizedErrors;
}

// GateHistorySection
interface GateHistorySectionProps {
  gates: GateEntry[];
}

// LimitsSection
interface LimitsSectionProps {
  limits: NormalizedLimits;
}
```

### GateEntry Derivation Logic

Derive `GateEntry[]` from `NormalizedProjectState` for the `GateHistorySection`:

```typescript
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
```

## Styles & Design Tokens

- `--header-bg`: `var(--card)` — header background color
- `--header-border`: `var(--border)` — header bottom border color
- `--sidebar-bg`: `var(--card)` — sidebar background (handled by shadcn Sidebar internally)
- `--sidebar-width`: `260px` — sidebar expanded width
- `--color-warning`: `hsl(38, 92%, 50%)` — amber warning color for MalformedStateView
- `--color-error-bg`: `hsl(0, 84%, 97%)` light / `hsl(0, 63%, 15%)` dark — error background
- `--color-error-border`: `hsl(0, 84%, 80%)` light / `hsl(0, 63%, 31%)` dark — error border
- `--color-link`: `hsl(217, 91%, 60%)` light / `hsl(217, 91%, 65%)` dark — clickable links
- `--color-link-disabled`: `hsl(215, 14%, 57%)` light / `hsl(215, 14%, 40%)` dark — disabled links
- `--connection-error`: `hsl(0, 84%, 60%)` — disconnected indicator (used in Phase 2 placeholder)
- Header height: `56px` (use `h-14` which is 3.5rem = 56px)
- All color values come from CSS custom properties in `globals.css` — never hardcode colors

## Test Requirements

- [ ] `npm run build` completes with zero TypeScript errors
- [ ] Visiting `localhost:3000` renders the full application shell (header + sidebar + main content area)
- [ ] Selecting a project with valid state renders all dashboard sections (ProjectHeader, ErrorSummaryBanner, PlanningSection, ExecutionSection, FinalReviewSection, ErrorLogSection, GateHistorySection, LimitsSection)
- [ ] Selecting a project with `hasState: false` renders `NotInitializedView`
- [ ] Selecting a project with `hasMalformedState: true` renders `MalformedStateView`
- [ ] `error.tsx` emoji div has `role="img"` and `aria-label="Warning"` attributes
- [ ] `AppHeader` renders "Orchestration Monitor" title and a `ConnectionIndicator` showing "Disconnected"

## Acceptance Criteria

- [ ] `AppHeader` renders title "Orchestration Monitor", a static `ConnectionIndicator` with `status="disconnected"`, a disabled Config button placeholder, and a disabled Theme Toggle placeholder
- [ ] `MainDashboard` renders all dashboard sections in order when given a valid `NormalizedProjectState`: `ErrorSummaryBanner`, `ProjectHeader`, `PlanningSection`, `ExecutionSection`, `FinalReviewSection`, `ErrorLogSection`, `GateHistorySection`, `LimitsSection`
- [ ] `MainDashboard` renders `NotInitializedView` when `projectState` is null and `project.hasState` is false
- [ ] `MainDashboard` renders `MalformedStateView` when `projectState` is null and `project.hasMalformedState` is true
- [ ] `NotInitializedView` displays the project name, a "Not Initialized" heading, descriptive text, and a clickable brainstorming doc link when `brainstormingDoc` is provided
- [ ] `MalformedStateView` displays the project name, a `WarningBadge`, and the error message
- [ ] Root `page.tsx` is `"use client"`, uses `useProjects` hook, renders `SidebarProvider` wrapping `ProjectSidebar` + `SidebarInset` with `MainDashboard`
- [ ] Selecting a project in the sidebar renders its dashboard; no-project-selected state shows a centered placeholder
- [ ] `error.tsx` emoji div has `role="img" aria-label="Warning"` (Phase 1 carry-forward fix)
- [ ] All new components are `"use client"` components
- [ ] All layout components export from `ui/components/layout/index.ts`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No hardcoded colors — all colors use CSS custom properties

## Constraints

- Do NOT implement the `DocumentDrawer` or `ConfigDrawer` — those are Phase 3 and Phase 4 tasks. The `onDocClick` callback should be passed down but can be a no-op `console.log` at the page level for now.
- Do NOT implement the `ThemeToggle` — Phase 4. Render a disabled placeholder button with a Moon icon.
- Do NOT implement live SSE connection logic — the `ConnectionIndicator` must render with `status="disconnected"` as a static placeholder.
- Do NOT modify any existing component files in `badges/`, `sidebar/`, `dashboard/`, `execution/`, or `planning/` — only import from them.
- Do NOT add any npm dependencies — all required packages are already installed.
- Do NOT modify `ui/app/layout.tsx` — the root layout is complete from Phase 1.
- Use kebab-case file names (e.g., `app-header.tsx`, not `AppHeader.tsx`) to match existing project conventions.
