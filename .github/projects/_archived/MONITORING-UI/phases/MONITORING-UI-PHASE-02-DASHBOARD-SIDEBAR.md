---
project: "MONITORING-UI"
phase: 2
title: "Dashboard Components + Sidebar"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-10T08:00:00Z"
---

# Phase 2: Dashboard Components + Sidebar

## Phase Goal

Deliver a fully rendered static dashboard — all sections display real project state fetched from Phase 1's API routes, sidebar navigation works across all workspace projects with selection persistence — but no real-time SSE updates yet.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../MONITORING-UI-MASTER-PLAN.md) | Phase 2 scope, task outline, exit criteria (lines 119–165) |
| [Architecture](../MONITORING-UI-ARCHITECTURE.md) | Module map (badges, sidebar, dashboard, phases, planning, layout), component file paths, contracts for `useProjects` hook, internal dependency graph |
| [Design](../MONITORING-UI-DESIGN.md) | View 1 (sidebar), View 2 (main dashboard), New Components table, Design Tokens, States & Interactions, Accessibility requirements |
| [PRD](../MONITORING-UI-PRD.md) | FR-1 through FR-15, FR-24, FR-27, FR-30, FR-31, FR-32; NFR-1, NFR-6, NFR-7, NFR-8, NFR-16 |
| [Phase 1 Report](../reports/MONITORING-UI-PHASE-REPORT-P01.md) | Carry-forward: theme key coordination (`monitoring-ui-theme`), error boundary emoji a11y, Tailwind theme in `@theme inline`, unit test recommendation, `@tailwindcss/typography` v4 compat |
| [Phase 1 Review](../reports/MONITORING-UI-PHASE-REVIEW-P01.md) | All exit criteria verified; recommendations for: normalizer unit tests, theme toggle localStorage key, error boundary a11y, theme extensions in CSS |

## Carry-Forward Items from Phase 1

These Phase 1 observations affect Phase 2 work:

1. **Error boundary emoji a11y** — `error.tsx` emoji (`⚠️`) lacks `role="img" aria-label="Warning"`. Address in T6 when touching layout files.
2. **Tailwind theme extensions** — All new CSS utility-class registrations must go in the `@theme inline` block in `globals.css`, not in `tailwind.config.ts`.
3. **Theme key coordination** — The flash-prevention script in `layout.tsx` reads from `localStorage` key `monitoring-ui-theme`. The `ThemeToggle` component (Phase 4) must write to this same key. Phase 2's `ConnectionIndicator` should render a static "disconnected" placeholder (no SSE yet).
4. **No unit test framework** — Phase 1 created no unit tests. Phase 2 focuses on component development; a test framework may be deferred to a later phase but should not block.

## Task Outline

| # | Task | Dependencies | Key Components | Est. Files | Handoff Doc |
|---|------|-------------|----------------|-----------|-------------|
| P02-T01 | Badge Component Library | — | `PipelineTierBadge`, `StatusIcon`, `ReviewVerdictBadge`, `SeverityBadge`, `RetryBadge`, `WarningBadge`, `ConnectionIndicator`, `LockBadge` | 9 | *(created at execution time)* |
| P02-T02 | Sidebar Components + useProjects Hook | P02-T01 | `ProjectSidebar`, `ProjectListItem`, `SidebarSearch`, `useProjects` hook | 5 | *(created at execution time)* |
| P02-T03 | Dashboard Header + Planning Section | P02-T01 | `ProjectHeader`, `PlanningChecklist`, `ErrorSummaryBanner`, `PlanningSection` | 5 | *(created at execution time)* |
| P02-T04 | Execution Section | P02-T01, P02-T03 | `PhaseCard`, `TaskCard`, `ProgressBar`, `ExecutionSection` | 5 | *(created at execution time)* |
| P02-T05 | Remaining Dashboard Sections | P02-T01 | `FinalReviewSection`, `ErrorLogSection`, `GateHistorySection`, `LimitsSection`, dashboard `index.ts` | 6 | *(created at execution time)* |
| P02-T06 | Layout Shell + Edge-Case Views + Page Wiring | P02-T01 through P02-T05 | `AppHeader`, `MainDashboard`, `NotInitializedView`, `MalformedStateView`, layout `index.ts`, root `page.tsx` | 7 | *(created at execution time)* |

## Execution Order

```
P02-T01 (Badge Component Library — foundation for all other tasks)
 ├→ P02-T02 (Sidebar — uses PipelineTierBadge, WarningBadge)
 ├→ P02-T03 (Header + Planning — uses PipelineTierBadge, StatusIcon)  ← parallel-ready with T02
 ├→ P02-T04 (Execution — uses StatusIcon, ReviewVerdictBadge, SeverityBadge, RetryBadge; also uses section pattern from T03)
 └→ P02-T05 (Remaining Sections — uses StatusIcon, ReviewVerdictBadge)  ← parallel-ready with T04
P02-T06 (Layout Shell — depends on ALL previous tasks: wires everything into the page)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05 → T06

*Note: T02 and T03 are parallel-ready (no mutual dependency). T04 and T05 are parallel-ready (T04 depends on T01+T03, T05 depends on T01 only). All execute sequentially in v1.*

## Task Details

### P02-T01: Badge Component Library

**Objective**: Implement all 8 badge/indicator components used throughout the dashboard and sidebar.

**File Targets**:
| Action | Path |
|--------|------|
| CREATE | `ui/components/badges/PipelineTierBadge.tsx` |
| CREATE | `ui/components/badges/StatusIcon.tsx` |
| CREATE | `ui/components/badges/ReviewVerdictBadge.tsx` |
| CREATE | `ui/components/badges/SeverityBadge.tsx` |
| CREATE | `ui/components/badges/RetryBadge.tsx` |
| CREATE | `ui/components/badges/WarningBadge.tsx` |
| CREATE | `ui/components/badges/ConnectionIndicator.tsx` |
| CREATE | `ui/components/badges/LockBadge.tsx` |
| CREATE | `ui/components/badges/index.ts` |

**Key Specs**:
- `PipelineTierBadge`: Accepts `tier: PipelineTier | 'not_initialized'`. Uses shadcn `Badge` with 15% opacity background + full-color text + colored dot. Maps to `--tier-*` CSS variables. Includes `aria-label="Pipeline tier: {tier}"`.
- `StatusIcon`: Accepts `status: PlanningStepStatus | PhaseStatus | TaskStatus`. Maps to Lucide icons (`CheckCircle2`, `Loader2` animated, `Circle`, `XCircle`, `OctagonX`, `MinusCircle`). Uses `--status-*` CSS variables. Always renders with a text label (via `aria-label`).
- `ReviewVerdictBadge`: Accepts `verdict: ReviewVerdict | null`. Renders nothing when `null`. Color-coded via `--verdict-*` tokens.
- `SeverityBadge`: Accepts `severity: Severity | null`. `critical` = red, `minor` = amber. Renders nothing when `null`.
- `RetryBadge`: Accepts `retries: number, max: number`. Format: "Retries: 1/2". Highlighted when at max. Uses `--color-warning`.
- `WarningBadge`: Accepts `message: string`. Amber triangle icon + message text. Uses `--color-warning`.
- `ConnectionIndicator`: Accepts `status: "connected" | "reconnecting" | "disconnected"`. Dot + label. Uses `--connection-*` tokens. Phase 2 default: render with `"disconnected"` (SSE not wired until Phase 3).
- `LockBadge`: No props. Small lock icon (`Lock` from Lucide) for hard-default gates. Uses `--color-muted`.

**Acceptance Criteria**:
- [ ] All 8 components export from `ui/components/badges/index.ts`
- [ ] Each badge renders correct colors from the CSS design tokens (no hardcoded colors)
- [ ] `StatusIcon` renders the correct Lucide icon for each of the 6 status values
- [ ] `PipelineTierBadge` renders all 6 tier values (including `not_initialized`) with correct styling
- [ ] `ReviewVerdictBadge` and `SeverityBadge` render nothing when passed `null`
- [ ] All badges include accessible text labels (not color-only)
- [ ] `npm run build` passes with zero TypeScript errors

---

### P02-T02: Sidebar Components + useProjects Hook

**Objective**: Implement the project sidebar with search filtering, project selection via API fetch, and localStorage persistence.

**File Targets**:
| Action | Path |
|--------|------|
| CREATE | `ui/components/sidebar/ProjectSidebar.tsx` |
| CREATE | `ui/components/sidebar/ProjectListItem.tsx` |
| CREATE | `ui/components/sidebar/SidebarSearch.tsx` |
| CREATE | `ui/components/sidebar/index.ts` |
| CREATE | `ui/lib/hooks/useProjects.ts` |

**Key Specs**:
- `useProjects` hook: Fetches project list from `GET /api/projects`, fetches selected project state from `GET /api/projects/[name]/state`. Exposes: `{ projects, selectedProject, projectState, selectProject, isLoading, error }`. Persists selected project to `localStorage` (key: `monitoring-ui-selected-project`). Restores selection on mount.
- `ProjectSidebar`: Uses shadcn `Sidebar` as base. Fixed width 260px. Contains `SidebarSearch`, scrollable `ProjectListItem` list, and footer with project count.
- `ProjectListItem`: Displays project name + `PipelineTierBadge`. Selected state has accent background + left border. Malformed state shows `WarningBadge` instead of tier badge.
- `SidebarSearch`: Filter input based on shadcn `Input`. Filters project list by name (case-insensitive).

**Acceptance Criteria**:
- [ ] `useProjects` fetches project list on mount and a project's state on selection
- [ ] Selected project persists in localStorage across page reloads
- [ ] Sidebar renders all workspace projects with correct tier badges
- [ ] Search input filters the project list by name (case-insensitive substring match)
- [ ] Malformed-state projects show `WarningBadge` instead of tier badge
- [ ] Not-initialized projects show tier badge reading "Not Started" in slate color
- [ ] Selected project item has visual differentiation (accent background + left border)
- [ ] `npm run build` passes with zero TypeScript errors

---

### P02-T03: Dashboard Header + Planning Section

**Objective**: Implement the project header, planning checklist, and error summary banner for the top portion of the main dashboard.

**File Targets**:
| Action | Path |
|--------|------|
| CREATE | `ui/components/dashboard/ProjectHeader.tsx` |
| CREATE | `ui/components/planning/PlanningChecklist.tsx` |
| CREATE | `ui/components/planning/ErrorSummaryBanner.tsx` |
| CREATE | `ui/components/planning/index.ts` |
| CREATE | `ui/components/dashboard/PlanningSection.tsx` |

**Key Specs**:
- `ProjectHeader`: Displays project name (`text-lg`), description, `PipelineTierBadge`, human gate mode badge, created/updated timestamps, and "Read-only monitoring" label. Props: project meta, tier, gate mode from `NormalizedProjectState`.
- `PlanningChecklist`: Vertical list of 5 planning steps + human approval row. Each row: `StatusIcon`, step name (formatted), document link (clickable if output exists, disabled if null). Accepts `onDocClick` callback for opening the document drawer (Phase 3).
- `ErrorSummaryBanner`: Prominent red-tinted banner shown ONLY when `active_blockers.length > 0`. Uses shadcn `Alert` variant. Lists blockers as bullets. Shows total retries and total halts. Hidden via conditional rendering when no blockers.
- `PlanningSection`: Wrapper that renders section header "Planning Pipeline" + `PlanningChecklist`. Uses shadcn `Card`.

**Acceptance Criteria**:
- [ ] `ProjectHeader` renders project name, description, tier badge, gate mode, timestamps, and "Read-only monitoring" label
- [ ] `PlanningChecklist` renders all 5 planning steps with correct status icons
- [ ] Planning steps with an output document render a clickable link (calls `onDocClick`)
- [ ] Planning steps with null output render a disabled/muted indicator
- [ ] Human approval row shows approved (checkmark) or pending (circle) state
- [ ] `ErrorSummaryBanner` renders when blockers exist and is absent when there are none
- [ ] `npm run build` passes with zero TypeScript errors

---

### P02-T04: Execution Section

**Objective**: Implement the phase/task card hierarchy and execution section that displays all phases and their tasks.

**File Targets**:
| Action | Path |
|--------|------|
| CREATE | `ui/components/phases/PhaseCard.tsx` |
| CREATE | `ui/components/phases/TaskCard.tsx` |
| CREATE | `ui/components/phases/ProgressBar.tsx` |
| CREATE | `ui/components/phases/index.ts` |
| CREATE | `ui/components/dashboard/ExecutionSection.tsx` |

**Key Specs**:
- `ProgressBar`: Horizontal bar showing task completion ratio. Props: `completed: number`, `total: number`, `status?: PhaseStatus`. Label: "3/5 tasks". Uses `--color-progress-fill` and `--color-progress-track` CSS variables. Includes `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, and `aria-label`.
- `TaskCard`: Compact row for a single task. Shows: `StatusIcon`, task title, document links (handoff, report, review — each as a link label), `RetryBadge` (if retries > 0), error text in destructive color with `SeverityBadge` (if last_error exists), `ReviewVerdictBadge` (if review_verdict exists). Accepts `onDocClick` callback.
- `PhaseCard`: Expandable card (shadcn `Accordion`) for a phase. Header: phase status badge, title ("Phase {N}: {title}"), `ProgressBar`, phase doc link. Expanded: list of `TaskCard` components. Footer: phase review verdict/action (if exists), phase report link. Active phase gets a subtle left border accent.
- `ExecutionSection`: Section wrapper. Header: "Execution Progress". Renders array of `PhaseCard` components from `NormalizedExecution.phases`. Only renders when `execution.status !== 'not_started'`.

**Acceptance Criteria**:
- [ ] `ProgressBar` renders correct fill ratio and "N/M tasks" label
- [ ] `ProgressBar` includes `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] `TaskCard` shows status icon, title, and document link labels for handoff/report/review
- [ ] `TaskCard` shows `RetryBadge` when retries > 0 and `SeverityBadge` when severity is present
- [ ] `TaskCard` shows `ReviewVerdictBadge` when review_verdict is present
- [ ] `PhaseCard` expands/collapses to show/hide task list
- [ ] `PhaseCard` shows progress bar with correct task count
- [ ] `ExecutionSection` renders one `PhaseCard` per phase
- [ ] `npm run build` passes with zero TypeScript errors

---

### P02-T05: Remaining Dashboard Sections

**Objective**: Implement the final review, error log, gate history, and limits sections to complete all dashboard content areas.

**File Targets**:
| Action | Path |
|--------|------|
| CREATE | `ui/components/dashboard/FinalReviewSection.tsx` |
| CREATE | `ui/components/dashboard/ErrorLogSection.tsx` |
| CREATE | `ui/components/dashboard/GateHistorySection.tsx` |
| CREATE | `ui/components/dashboard/LimitsSection.tsx` |
| CREATE | `ui/components/dashboard/index.ts` |

**Key Specs**:
- `FinalReviewSection`: Conditional — only shown when `final_review.status !== 'not_started'`. Shows: status badge (via `StatusIcon`), report doc link, human approved indicator. Uses shadcn `Card`.
- `ErrorLogSection`: Always rendered. Shows: total retries stat, total halts stat, active blockers list (if any). Stats displayed as compact metric cards. Uses shadcn `Card`.
- `GateHistorySection`: Vertical timeline derived from state data. Entries: post-planning approval, per-phase approvals, final review approval. Each entry: gate name, approved/pending icon, timestamp if available. Uses semantic `<ol>`. Accepts array of `GateEntry` items.
- `LimitsSection`: Collapsible section (shadcn `Accordion`, collapsed by default). Shows: max phases, max tasks per phase, max retries per task. Uses `font-mono` for values.
- `index.ts`: Re-exports all dashboard section components.

**Acceptance Criteria**:
- [ ] `FinalReviewSection` renders only when final_review status is not `not_started`
- [ ] `FinalReviewSection` shows status badge, report link, and human approval indicator
- [ ] `ErrorLogSection` renders total retries and total halts as stats
- [ ] `ErrorLogSection` renders active blockers as a list (or shows "No active blockers" when empty)
- [ ] `GateHistorySection` renders a timeline entry for post-planning gate
- [ ] `GateHistorySection` renders a timeline entry for each phase's human_approved flag
- [ ] `LimitsSection` is collapsed by default and expands to show limit values
- [ ] All components export from `ui/components/dashboard/index.ts`
- [ ] `npm run build` passes with zero TypeScript errors

---

### P02-T06: Layout Shell + Edge-Case Views + Page Wiring

**Objective**: Implement the app shell components, edge-case views, and wire everything into the root page so the full dashboard renders from API data.

**File Targets**:
| Action | Path |
|--------|------|
| CREATE | `ui/components/layout/AppHeader.tsx` |
| CREATE | `ui/components/layout/MainDashboard.tsx` |
| CREATE | `ui/components/layout/NotInitializedView.tsx` |
| CREATE | `ui/components/layout/MalformedStateView.tsx` |
| CREATE | `ui/components/layout/index.ts` |
| MODIFY | `ui/app/page.tsx` |
| MODIFY | `ui/app/error.tsx` |

**Key Specs**:
- `AppHeader`: Fixed top bar (height 56px). Contains: app title "Orchestration Dashboard", `ConnectionIndicator` (Phase 2: render as static `"disconnected"`), config button placeholder (disabled — Phase 4), theme toggle placeholder (disabled — Phase 4). Uses CSS variables `--header-bg`, `--header-border`.
- `MainDashboard`: Container component. Accepts `NormalizedProjectState | null` and project summary. Conditionally renders: if state is null and project has `hasMalformedState` → `MalformedStateView`; if state is null and `!hasState` → `NotInitializedView`; otherwise → renders all dashboard sections (`ProjectHeader`, `ErrorSummaryBanner`, `PlanningSection`, `ExecutionSection`, `FinalReviewSection`, `ErrorLogSection`, `GateHistorySection`, `LimitsSection`). Wrapped in shadcn `ScrollArea`.
- `NotInitializedView`: Placeholder for projects without state. Shows project name, "Not Initialized" heading, descriptive text, and brainstorming doc link if available (calls `onDocClick`).
- `MalformedStateView`: Warning view. Shows project name, amber `WarningBadge`, error message. Prominent warning styling.
- Root `page.tsx` (MODIFY): Convert to `"use client"`. Use `useProjects` hook. Render: `AppHeader` + sidebar layout with `ProjectSidebar` on the left and `MainDashboard` on the right. Wire `selectProject` to sidebar, pass `projectState` to dashboard.
- `error.tsx` (MODIFY): Add `role="img" aria-label="Warning"` to the emoji div (Phase 1 carry-forward fix).

**Acceptance Criteria**:
- [ ] `AppHeader` renders title, static connection indicator, disabled config button, and disabled theme toggle placeholder
- [ ] `MainDashboard` renders all dashboard sections when given a valid `NormalizedProjectState`
- [ ] `MainDashboard` renders `NotInitializedView` when project has no state
- [ ] `MainDashboard` renders `MalformedStateView` when project has malformed state
- [ ] Root page loads and renders sidebar + dashboard from API data without errors
- [ ] Selecting a project in the sidebar renders its dashboard in the main area
- [ ] Not-initialized projects show `NotInitializedView` when selected
- [ ] Malformed-state projects show `MalformedStateView` when selected
- [ ] `error.tsx` emoji div includes `role="img" aria-label="Warning"` (Phase 1 carry-forward fix)
- [ ] `npm run build` passes with zero TypeScript errors

## Phase Exit Criteria

- [ ] Sidebar lists all workspace projects with correct pipeline tier badges
- [ ] Selecting a project renders its complete dashboard (all sections populated from real state data)
- [ ] Not-initialized projects display `NotInitializedView` when selected
- [ ] Malformed state projects display `MalformedStateView` with error message
- [ ] Planning checklist shows correct status icons and document links
- [ ] Phase cards show progress bars with accurate task counts
- [ ] Task cards display status, title, retry count, error info, and severity where present
- [ ] Error summary banner appears when active blockers exist and is hidden when there are none
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] All components use CSS custom properties from `globals.css` (no hardcoded colors)

## Known Risks for This Phase

- **Component count is high (20+ components)**: Risk of incomplete wiring or missing props. Mitigate by testing each section against a real project with full execution history (e.g., VALIDATOR or MONITORING-UI itself).
- **Design token mismatch**: CSS custom property names may not match between `globals.css` and component implementations. Mitigate by referencing `globals.css` token names directly in handoffs.
- **shadcn `Sidebar` component complexity**: The shadcn Sidebar component has complex internals (provider, context, state management). Mitigate by using it as the base but keeping custom logic minimal in T02.
- **`useProjects` hook data fetching**: Client-side fetching from API routes needs error handling for network failures, 404s, and 422s. Mitigate by including error states in the hook's return type.
- **Gate history derivation**: Gate entries must be derived from multiple state fields (planning.human_approved, phase.human_approved, final_review.human_approved). Mitigate by specifying the derivation logic clearly in the T05 handoff.
