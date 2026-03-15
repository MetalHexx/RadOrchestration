---
project: "MONITORING-UI"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-09T00:00:00Z"
inputs:
  prd: "MONITORING-UI-PRD.md"
  research: "MONITORING-UI-RESEARCH-FINDINGS.md"
  brainstorming: "MONITORING-UI-BRAINSTORMING.md"
---

# MONITORING-UI — Design

## Design Overview

MONITORING-UI is a real-time, read-only monitoring dashboard that visualizes the orchestration pipeline's project state. The experience is a two-panel application — a collapsible project switcher sidebar on the left and a scrollable main dashboard on the right — with slide-over drawers for document viewing and configuration inspection. The interaction model is passive observation: users browse projects, scan status at a glance via color-coded badges and progress indicators, click document links to read rendered markdown, and receive live updates via SSE without any manual refresh. Dark mode is the default theme, with a system-preference toggle available.

---

## User Flows

### Flow 1: Viewing Project Status (US-1, US-2, US-3, US-4)

```
Open dashboard → Sidebar loads project list →
  Default: last-viewed project selected (or first project) →
  Main area renders: Pipeline Tier Badge → Planning Checklist → Phase/Task Progress → Error Summary → Gate History →
  User scans status in under 5 seconds
```

The user opens the dashboard at `localhost:3000`. The sidebar populates with all discovered projects, each showing a name and tier badge. The main area immediately renders the selected project's full dashboard. The pipeline tier badge at the top gives the highest-level status. Below it, the planning checklist shows each step's completion. The phase/task progress section shows all phases with expandable task lists. The error summary section highlights active blockers and aggregate counts. Gate history shows human approval decisions.

### Flow 2: Switching Projects (US-5, US-6)

```
User views Project A dashboard → Clicks Project B in sidebar →
  Sidebar highlights Project B → Main area transitions to Project B dashboard →
  Load completes in under 500ms
```

Clicking a project in the sidebar immediately loads that project's dashboard. The previously selected project is deselected. Not-initialized projects (no `state.json`) display a placeholder dashboard with a "Not Initialized" message and the brainstorming doc link if available. Malformed-state projects show a degraded card with a warning banner.

### Flow 3: Viewing a Document (US-8, US-9)

```
User sees document link in dashboard (e.g., PRD link in planning checklist) →
  Clicks link → Document drawer slides in from right →
  Frontmatter metadata header renders above markdown body →
  User reads content → Clicks close button or presses Escape →
  Drawer closes, dashboard is unchanged
```

Document links appear throughout the dashboard: planning step outputs, phase plan docs, task handoffs, task reports, code reviews, phase reports, and phase reviews. Clicking any document link opens a right-side drawer overlay. The drawer header shows extracted frontmatter metadata (author, status, verdict, dates). The body renders the markdown content with GFM support (tables, task lists, fenced code blocks). Documents that don't exist on disk render their link as disabled with a "Not available" tooltip.

### Flow 4: Viewing Configuration (US-10)

```
User clicks "Config" button in the app header →
  Config drawer slides in from right →
  Parsed orchestration.yml displayed in categorized sections →
  User reads configuration → Closes drawer
```

The configuration viewer is accessed via a button in the application header. It opens as a drawer (same pattern as the document viewer) and displays the parsed `orchestration.yml` in five logical sections: Project Storage, Pipeline Limits, Error Handling, Git Strategy, and Human Gates. Hard-default gates are visually marked with a lock icon.

### Flow 5: Handling SSE Disconnection (NFR-4, NFR-5)

```
Dashboard is live → SSE connection drops →
  Connection indicator changes to "Disconnected" (yellow warning) →
  Auto-reconnect attempts begin (exponential backoff) →
  On reconnect: full state re-sent, indicator returns to "Connected" (green) →
  If server is down for extended period: indicator changes to "Server Unavailable" (red)
```

A small connection status indicator in the app header shows the SSE stream state. On disconnect, it immediately shows a yellow "Reconnecting…" state. The browser's native `EventSource` handles automatic reconnection. On successful reconnect, full project state is re-pushed and the indicator returns to green. If the server process exits entirely, the indicator shows red "Disconnected" with a manual retry option.

### Flow 6: Toggling Theme (US-13)

```
User clicks theme toggle in app header →
  Cycles: System → Dark → Light → System →
  Theme applies immediately via Tailwind class strategy →
  Preference persisted to localStorage
```

---

## Layout & Components

### Application Shell

**Minimum viewport**: 1024px width (desktop-first, per NG-6)

```
┌─────────────────────────────────────────────────────────────┐
│  AppHeader  [Logo/Title]  [Connection Status]  [Config] [Theme Toggle]  │
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│  Project   │              Main Dashboard                    │
│  Sidebar   │                                                │
│  (260px)   │              (fluid, remaining width)          │
│            │                                                │
│            │                                                │
│            │                                                │
│            │                                                │
│            │                                                │
│            │                                                │
├────────────┴────────────────────────────────────────────────┤
│  (Document Drawer — slides over from right when open)       │
└─────────────────────────────────────────────────────────────┘
```

| Region | Component | shadcn/ui Base | Notes |
|--------|-----------|---------------|-------|
| Top bar | `AppHeader` | — | Fixed height 56px. Contains logo, connection indicator, config button, theme toggle |
| Left panel | `ProjectSidebar` | `Sidebar` | Fixed width 260px, scrollable, collapsible to icon-only (48px) |
| Center | `MainDashboard` | `ScrollArea` | Fluid width, vertical scroll. Renders selected project |
| Overlay | `DocumentDrawer` | `Sheet` | Right-side drawer, width 640px max. Opens on document link click |
| Overlay | `ConfigDrawer` | `Sheet` | Right-side drawer, width 560px max. Opens on config button click |

### View 1: Project Switcher Sidebar

**Width**: 260px expanded, 48px collapsed  
**Behavior**: Scrollable list, single-selection, persists selection across page reloads (localStorage)

| Region | Component | Description |
|--------|-----------|-------------|
| Header | `SidebarHeader` | "Projects" label + collapse toggle button |
| Search | `SidebarSearch` | Filter input to narrow project list by name |
| List | `ProjectList` | Scrollable list of `ProjectListItem` components |
| Item | `ProjectListItem` | Project name + `PipelineTierBadge`. Selected state has accent background |
| Footer | `SidebarFooter` | Project count label (e.g., "7 projects") |

**Project List Item states:**

| State | Visual |
|-------|--------|
| Default | `text-muted-foreground`, no background |
| Hover | `bg-accent/50` background |
| Selected | `bg-accent` background, `text-accent-foreground`, left border accent |
| Not Initialized | Name shown, tier badge reads "Not Started" in `slate` color |
| Malformed State | Name shown, `WarningBadge` with amber triangle icon |

### View 2: Main Dashboard

**Layout**: Single-column scrollable content area with card-based sections

```
┌──────────────────────────────────────────────┐
│  ProjectHeader                                │
│  [Name] [Description] [Tier Badge] [Gate Mode]│
│  [Created] [Updated] [Read-only label]        │
├──────────────────────────────────────────────┤
│  ErrorSummaryBanner  (conditional — only if   │
│  active blockers exist)                       │
├──────────────────────────────────────────────┤
│  PlanningSection                              │
│  ┌─ PlanningChecklist ─────────────────────┐ │
│  │ ✅ Research    → [doc link]             │ │
│  │ ✅ PRD         → [doc link]             │ │
│  │ 🔄 Design      → —                     │ │
│  │ ⬜ Architecture → —                     │ │
│  │ ⬜ Master Plan  → —                     │ │
│  │ ── Human Approval: ⬜ Pending ──        │ │
│  └─────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│  ExecutionSection                             │
│  ┌─ PhaseCard (Phase 1) ───────────────────┐ │
│  │ [PhaseStatusBadge] Phase 1: Title       │ │
│  │ [ProgressBar 3/5] [PhaseDoc link]       │ │
│  │ ┌─ TaskCard T1 ──────────────────────┐  │ │
│  │ │ ✅ Task 1: Title [handoff] [report] │  │ │
│  │ │   Review: approved ✅               │  │ │
│  │ └────────────────────────────────────┘  │ │
│  │ ┌─ TaskCard T2 ──────────────────────┐  │ │
│  │ │ ❌ Task 2: Title  Retries: 1       │  │ │
│  │ │   Error: "Build failure" [critical] │  │ │
│  │ └────────────────────────────────────┘  │ │
│  │ Phase Review: changes_requested         │ │
│  │ Phase Report: [link]                    │ │
│  └─────────────────────────────────────────┘ │
│  ┌─ PhaseCard (Phase 2) ───────────────────┐ │
│  │ ...                                     │ │
│  └─────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│  FinalReviewSection (conditional)             │
│  Status: [badge]  Report: [link]  Approved: ✅│
├──────────────────────────────────────────────┤
│  ErrorLogSection                              │
│  [Total retries] [Total halts]                │
│  Active Blockers: [list]                      │
├──────────────────────────────────────────────┤
│  GateHistorySection                           │
│  [Post-Planning gate] [Phase gates]           │
│  [Final Review gate]                          │
├──────────────────────────────────────────────┤
│  LimitsSection (collapsed by default)         │
│  Max phases: 10  Max tasks: 8  Max retries: 2│
└──────────────────────────────────────────────┘
```

| Section | Component | Priority | Description |
|---------|-----------|----------|-------------|
| Header | `ProjectHeader` | P0 | Project name, description, tier badge, gate mode badge, timestamps, "Read-only" label |
| Errors | `ErrorSummaryBanner` | P0 | Prominent banner when `active_blockers.length > 0`. Red background, blocker list. Hidden when no blockers |
| Planning | `PlanningSection` | P0 | Contains `PlanningChecklist` and human approval status |
| Execution | `ExecutionSection` | P0 | Contains array of `PhaseCard` components |
| Phase | `PhaseCard` | P0 | Phase header with status badge, progress bar, doc link, expandable task list, phase review info |
| Task | `TaskCard` | P0 | Task status icon, title, document links (handoff, report, review), retry count, error info |
| Final Review | `FinalReviewSection` | P1 | Status badge, report doc link, human approved indicator |
| Error Log | `ErrorLogSection` | P0 | Aggregate stats (total retries, total halts) + active blockers list |
| Gate History | `GateHistorySection` | P1 | Timeline of human approval decisions |
| Limits | `LimitsSection` | P2 | Collapsible section showing pipeline limits from state |

### View 3: Inline Document Viewer (Drawer)

**Width**: 640px max, slides from right  
**Trigger**: Any document link click in the dashboard

```
┌──────────────────────────────────────┐
│  DrawerHeader                        │
│  [Document Title]        [X Close]   │
├──────────────────────────────────────┤
│  DocumentMetadata                    │
│  ┌────────────────────────────────┐  │
│  │ Author: research-agent         │  │
│  │ Status: complete               │  │
│  │ Created: 2026-03-09            │  │
│  │ Verdict: approved (if present) │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  RenderedMarkdown                    │
│  (scrollable, full GFM support)      │
│                                      │
│                                      │
│                                      │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

| Region | Component | Description |
|--------|-----------|-------------|
| Header | `DrawerHeader` | Document type label, inferred title from frontmatter or filename, close button |
| Metadata | `DocumentMetadata` | Extracted frontmatter fields rendered as a key-value card. Fields vary by document type |
| Body | `MarkdownRenderer` | Rendered markdown with GFM support: tables, task lists, fenced code blocks, headings, links |

### View 4: Config Viewer (Drawer)

**Width**: 560px max, slides from right  
**Trigger**: Config button in `AppHeader`

```
┌──────────────────────────────────────┐
│  DrawerHeader                        │
│  "Pipeline Configuration"  [X Close] │
├──────────────────────────────────────┤
│  ConfigSection: Project Storage      │
│  ┌────────────────────────────────┐  │
│  │ Base Path: .github/projects    │  │
│  │ Naming: SCREAMING_CASE         │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ConfigSection: Pipeline Limits      │
│  ┌────────────────────────────────┐  │
│  │ Max Phases: 10                 │  │
│  │ Max Tasks/Phase: 8             │  │
│  │ Max Retries/Task: 2            │  │
│  │ Max Consecutive Rejections: 3  │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ConfigSection: Error Handling       │
│  ┌────────────────────────────────┐  │
│  │ Critical (→ halt):             │  │
│  │   build_failure, security_...  │  │
│  │ Minor (→ retry):               │  │
│  │   test_failure, lint_error...  │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ConfigSection: Git Strategy         │
│  ┌────────────────────────────────┐  │
│  │ Strategy: single_branch        │  │
│  │ Branch Prefix: orch/           │  │
│  │ Commit Prefix: [orch]          │  │
│  │ Auto Commit: ✅                │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ConfigSection: Human Gates          │
│  ┌────────────────────────────────┐  │
│  │ After Planning: true 🔒        │  │
│  │ Execution Mode: ask            │  │
│  │ After Final Review: true 🔒    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

| Region | Component | Description |
|--------|-----------|-------------|
| Header | `DrawerHeader` | "Pipeline Configuration" title, close button |
| Sections | `ConfigSection` (×5) | Collapsible card per config category. Key-value pairs inside |
| Lock indicator | `LockBadge` | Small lock icon next to hard-default gates (`after_planning`, `after_final_review`) |

### View 5: Theme Toggle

**Location**: `AppHeader`, rightmost position  
**Component**: `ThemeToggle`

The toggle is a segmented button group with three options: System (monitor icon), Dark (moon icon), Light (sun icon). The active option is highlighted. Preference is persisted to `localStorage` and applied on page load before first paint (to prevent flash).

---

## New Components

### Core UI Components

| Component | Props | Design Tokens | Description |
|-----------|-------|--------------|-------------|
| `PipelineTierBadge` | `tier: PipelineTier` | `--tier-planning`, `--tier-execution`, `--tier-review`, `--tier-complete`, `--tier-halted` | Color-coded badge showing the pipeline tier. Includes text label + colored dot. Based on shadcn `Badge` variant |
| `StatusIcon` | `status: StepStatus \| PhaseStatus \| TaskStatus` | `--status-complete`, `--status-in-progress`, `--status-not-started`, `--status-failed`, `--status-halted`, `--status-skipped` | Icon component mapping status to icon + color. Uses Lucide icons. Always paired with text label (accessibility) |
| `ProgressBar` | `completed: number, total: number, status?: PhaseStatus` | `--color-progress-fill`, `--color-progress-track` | Horizontal bar showing task completion ratio. Label format: "3/5 tasks". Color varies by phase status |
| `TaskCard` | `task: NormalizedTask, onDocClick: (path) => void` | `--card-bg`, `--card-border` | Card displaying a single task: status icon, title, document links (handoff/report/review), retry badge, error info, review verdict |
| `PhaseCard` | `phase: NormalizedPhase, onDocClick: (path) => void` | `--card-bg`, `--card-border` | Expandable card for a phase: status badge, title, progress bar, phase doc link, task list, phase review info |
| `DocumentLink` | `path: string \| null, label: string, onDocClick: (path) => void` | `--color-link`, `--color-link-disabled` | Clickable link to open a document in the drawer. Renders as disabled with tooltip when `path` is `null` or file doesn't exist |
| `PlanningChecklist` | `steps: PlanningSteps, humanApproved: boolean, onDocClick: (path) => void` | — | Vertical checklist of 5 planning steps + human approval row. Each row: status icon, step name, doc link (if output exists) |
| `ErrorSummaryBanner` | `blockers: string[], totalRetries: number, totalHalts: number` | `--color-error-bg`, `--color-error-border` | Prominent banner at top of dashboard when blockers are active. Red-tinted background. Lists each blocker as a bullet |
| `GateHistoryTimeline` | `gates: GateEntry[]` | — | Vertical timeline of human gate decisions: post-planning, per-phase, final review. Each entry: gate name, decision icon, timestamp |
| `ReviewVerdictBadge` | `verdict: ReviewVerdict \| null` | `--verdict-approved`, `--verdict-changes-requested`, `--verdict-rejected` | Small badge showing review outcome. Color-coded: green/amber/red. `null` renders nothing |
| `SeverityBadge` | `severity: Severity \| null` | `--severity-critical`, `--severity-minor` | Small badge for error severity. `critical` = red, `minor` = amber |
| `RetryBadge` | `retries: number, max: number` | `--color-warning` | Small pill showing retry count. Format: "Retries: 1/2". Highlighted when at max |
| `ConnectionIndicator` | `status: "connected" \| "reconnecting" \| "disconnected"` | `--connection-ok`, `--connection-warning`, `--connection-error` | Small dot + label in the app header. Green/yellow/red states |
| `ThemeToggle` | — | — | Segmented three-way toggle (System/Dark/Light) using Lucide icons (Monitor/Moon/Sun). Based on shadcn `ToggleGroup` |
| `WarningBadge` | `message: string` | `--color-warning` | Amber warning triangle badge for malformed state projects |

### Layout Components

| Component | Props | Design Tokens | Description |
|-----------|-------|--------------|-------------|
| `AppHeader` | — | `--header-bg`, `--header-border` | Fixed top bar. Contains app title ("Orchestration Dashboard"), `ConnectionIndicator`, config button, `ThemeToggle` |
| `ProjectSidebar` | `projects: ProjectSummary[], selectedId: string, onSelect: (id) => void` | `--sidebar-bg`, `--sidebar-width` | Left sidebar with project list. Collapsible. Based on shadcn `Sidebar` |
| `ProjectListItem` | `project: ProjectSummary, selected: boolean, onClick: () => void` | `--sidebar-item-hover`, `--sidebar-item-active` | Single row in the sidebar: project name + tier badge |
| `SidebarSearch` | `value: string, onChange: (value) => void` | — | Filter input at top of sidebar. Based on shadcn `Input` |
| `MainDashboard` | `project: NormalizedProjectState \| null` | — | Container that renders all dashboard sections for the selected project |
| `ProjectHeader` | `project: ProjectMeta, tier: PipelineTier, gateMode: HumanGateMode` | — | Top section of dashboard: name, description, tier badge, gate mode badge, timestamps, "Read-only monitoring" label |
| `DocumentDrawer` | `open: boolean, docPath: string \| null, onClose: () => void` | `--drawer-width` | Right-side sheet overlay for rendering documents. Loads content on open |
| `ConfigDrawer` | `open: boolean, config: ParsedConfig, onClose: () => void` | `--drawer-width` | Right-side sheet overlay for config viewer |
| `ConfigSection` | `title: string, children: ReactNode, defaultOpen?: boolean` | — | Collapsible card section within the config drawer. Based on shadcn `Collapsible` or `Accordion` |
| `DocumentMetadata` | `frontmatter: Record<string, unknown>` | `--metadata-bg` | Key-value display of extracted frontmatter fields. Renders in a muted card above the markdown body |
| `MarkdownRenderer` | `content: string` | `--prose-*` (Tailwind typography) | Renders markdown with `react-markdown` + `remark-gfm`. Uses Tailwind `prose` classes for typography. Sanitized output |
| `LockBadge` | — | `--color-muted` | Small lock icon indicating a non-configurable hard default |

### Composite Sections

| Component | Props | Description |
|-----------|-------|-------------|
| `PlanningSection` | `planning: NormalizedPlanning, onDocClick` | Wraps `PlanningChecklist` with a section header "Planning Pipeline" |
| `ExecutionSection` | `execution: NormalizedExecution, onDocClick` | Wraps array of `PhaseCard` with a section header "Execution Progress" |
| `FinalReviewSection` | `finalReview: NormalizedFinalReview, onDocClick` | Status badge, report doc link, human approved indicator. Only shown when `final_review.status !== "not_started"` |
| `ErrorLogSection` | `errors: NormalizedErrors` | Aggregate stats (total retries, total halts) as stat cards + active blockers list |
| `GateHistorySection` | `gates: GateEntry[]` | Timeline of gate decisions derived from planning approval + phase approvals + final review approval |
| `LimitsSection` | `limits: NormalizedLimits` | Collapsible section showing pipeline limits. Collapsed by default |
| `NotInitializedView` | `projectName: string, brainstormingDoc?: string, onDocClick` | Placeholder for projects without state. Shows project name, "Not Initialized" message, and brainstorming doc link if available |
| `MalformedStateView` | `projectName: string, error: string` | Warning view for projects with unparseable state. Shows project name, warning icon, and error message |

---

## Design Tokens

### Pipeline Tier Colors

| Token (CSS Variable) | Light Mode | Dark Mode | Usage |
|---------------------|------------|-----------|-------|
| `--tier-planning` | `hsl(217, 91%, 60%)` / blue-500 | `hsl(217, 91%, 60%)` | Planning tier badge background |
| `--tier-execution` | `hsl(38, 92%, 50%)` / amber-500 | `hsl(38, 92%, 50%)` | Execution tier badge background |
| `--tier-review` | `hsl(271, 91%, 65%)` / purple-400 | `hsl(271, 91%, 65%)` | Review tier badge background |
| `--tier-complete` | `hsl(142, 71%, 45%)` / green-500 | `hsl(142, 71%, 45%)` | Complete tier badge background |
| `--tier-halted` | `hsl(0, 84%, 60%)` / red-500 | `hsl(0, 84%, 60%)` | Halted tier badge background |
| `--tier-not-initialized` | `hsl(215, 14%, 57%)` / slate-400 | `hsl(215, 14%, 57%)` | Not initialized / neutral state |

### Status Colors

| Token (CSS Variable) | Value | Icon (Lucide) | Usage |
|---------------------|-------|------|-------|
| `--status-complete` | `hsl(142, 71%, 45%)` / green-500 | `CheckCircle2` | Complete steps, tasks, phases |
| `--status-in-progress` | `hsl(217, 91%, 60%)` / blue-500 | `Loader2` (animated spin) | Active/running items |
| `--status-not-started` | `hsl(215, 14%, 57%)` / slate-400 | `Circle` (outline) | Pending items |
| `--status-failed` | `hsl(0, 84%, 60%)` / red-500 | `XCircle` | Failed items |
| `--status-halted` | `hsl(0, 84%, 60%)` / red-500 | `OctagonX` | Halted items |
| `--status-skipped` | `hsl(215, 14%, 57%)` / slate-400 | `MinusCircle` | Skipped planning steps |

### Review Verdict Colors

| Token (CSS Variable) | Value | Usage |
|---------------------|-------|-------|
| `--verdict-approved` | `hsl(142, 71%, 45%)` / green-500 | Approved review badge |
| `--verdict-changes-requested` | `hsl(38, 92%, 50%)` / amber-500 | Changes requested badge |
| `--verdict-rejected` | `hsl(0, 84%, 60%)` / red-500 | Rejected review badge |

### Severity Colors

| Token (CSS Variable) | Value | Usage |
|---------------------|-------|-------|
| `--severity-critical` | `hsl(0, 84%, 60%)` / red-500 | Critical error severity badge |
| `--severity-minor` | `hsl(38, 92%, 50%)` / amber-500 | Minor error severity badge |

### Connection Status Colors

| Token (CSS Variable) | Value | Usage |
|---------------------|-------|-------|
| `--connection-ok` | `hsl(142, 71%, 45%)` / green-500 | Connected indicator dot |
| `--connection-warning` | `hsl(38, 92%, 50%)` / amber-500 | Reconnecting indicator dot |
| `--connection-error` | `hsl(0, 84%, 60%)` / red-500 | Disconnected indicator dot |

### Surface & Layout Tokens

| Token (CSS Variable) | Light Mode | Dark Mode | Usage |
|---------------------|------------|-----------|-------|
| `--color-background` | `hsl(0, 0%, 100%)` | `hsl(224, 71%, 4%)` | App background (shadcn `background`) |
| `--color-foreground` | `hsl(224, 71%, 4%)` | `hsl(210, 20%, 98%)` | Primary text (shadcn `foreground`) |
| `--color-card` | `hsl(0, 0%, 100%)` | `hsl(224, 71%, 4%)` | Card backgrounds (shadcn `card`) |
| `--color-card-foreground` | `hsl(224, 71%, 4%)` | `hsl(210, 20%, 98%)` | Card text (shadcn `card-foreground`) |
| `--color-muted` | `hsl(220, 14%, 96%)` | `hsl(215, 28%, 17%)` | Muted backgrounds (shadcn `muted`) |
| `--color-muted-foreground` | `hsl(220, 9%, 46%)` | `hsl(217, 10%, 64%)` | Secondary text (shadcn `muted-foreground`) |
| `--color-accent` | `hsl(220, 14%, 96%)` | `hsl(215, 28%, 17%)` | Sidebar selection, hover states (shadcn `accent`) |
| `--color-accent-foreground` | `hsl(224, 71%, 4%)` | `hsl(210, 20%, 98%)` | Accent text (shadcn `accent-foreground`) |
| `--color-border` | `hsl(220, 13%, 91%)` | `hsl(215, 28%, 17%)` | Borders (shadcn `border`) |
| `--color-destructive` | `hsl(0, 84%, 60%)` | `hsl(0, 63%, 31%)` | Error/destructive backgrounds (shadcn `destructive`) |
| `--header-bg` | `--color-card` | `--color-card` | App header background |
| `--header-border` | `--color-border` | `--color-border` | App header bottom border |
| `--sidebar-bg` | `--color-card` | `--color-card` | Sidebar background |
| `--sidebar-width` | `260px` | `260px` | Sidebar expanded width |
| `--sidebar-collapsed-width` | `48px` | `48px` | Sidebar collapsed width |
| `--drawer-width` | `640px` | `640px` | Document/Config drawer max-width |
| `--metadata-bg` | `--color-muted` | `--color-muted` | Frontmatter metadata card background |
| `--color-error-bg` | `hsl(0, 84%, 97%)` | `hsl(0, 63%, 15%)` | Error summary banner background |
| `--color-error-border` | `hsl(0, 84%, 80%)` | `hsl(0, 63%, 31%)` | Error summary banner border |
| `--color-link` | `hsl(217, 91%, 60%)` | `hsl(217, 91%, 65%)` | Document link text color |
| `--color-link-disabled` | `hsl(215, 14%, 57%)` | `hsl(215, 14%, 40%)` | Disabled document link text |
| `--color-warning` | `hsl(38, 92%, 50%)` | `hsl(38, 92%, 50%)` | Warning indicators |
| `--color-progress-fill` | `hsl(217, 91%, 60%)` | `hsl(217, 91%, 60%)` | Progress bar filled portion |
| `--color-progress-track` | `hsl(220, 14%, 96%)` | `hsl(215, 28%, 17%)` | Progress bar track |

### Spacing Scale (Tailwind defaults)

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-1` | `4px` | Tight gaps (icon-to-text) |
| `spacing-2` | `8px` | Compact spacing (badge padding, small gaps) |
| `spacing-3` | `12px` | List item vertical padding |
| `spacing-4` | `16px` | Card internal padding, section gaps |
| `spacing-6` | `24px` | Section spacing, card margins |
| `spacing-8` | `32px` | Major section separators |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | `Inter, system-ui, sans-serif` | All UI text |
| `font-mono` | `JetBrains Mono, monospace` | Code blocks, config values, paths |
| `text-xs` | `12px / 16px` | Badges, timestamps, metadata labels |
| `text-sm` | `14px / 20px` | Body text, list items, card content |
| `text-base` | `16px / 24px` | Section headers, sidebar items |
| `text-lg` | `18px / 28px` | Project name in dashboard header |
| `text-xl` | `20px / 28px` | App title in header |

---

## States & Interactions

### Application-Level States

| State | Visual Treatment |
|-------|-----------------|
| Loading (initial) | Skeleton placeholders in sidebar and main area. Sidebar shows shimmer rectangles. Main area shows card-shaped skeletons |
| Connected | Green dot in `ConnectionIndicator`, label "Connected" |
| Reconnecting | Yellow dot in `ConnectionIndicator`, label "Reconnecting…", pulsing animation |
| Disconnected | Red dot in `ConnectionIndicator`, label "Disconnected", "Retry" button appears |
| No projects found | Sidebar shows empty state: "No projects found" message with path to `base_path` |

### ProjectListItem States

| State | Visual Treatment |
|-------|-----------------|
| Default | `text-muted-foreground`, transparent background |
| Hover | `bg-accent/50` background, pointer cursor |
| Selected | `bg-accent` background, `text-accent-foreground`, 2px left border in `--color-link` |
| Focused (keyboard) | Visible focus ring (`ring-2 ring-ring ring-offset-2`) |
| Not Initialized | Tier badge shows "Not Started" in slate, italic project name |
| Malformed | Amber `WarningBadge` replaces tier badge |

### PipelineTierBadge States

| Tier | Background | Text | Dot Color |
|------|-----------|------|-----------|
| `planning` | `--tier-planning` at 15% opacity | `--tier-planning` | `--tier-planning` |
| `execution` | `--tier-execution` at 15% opacity | `--tier-execution` | `--tier-execution` |
| `review` | `--tier-review` at 15% opacity | `--tier-review` | `--tier-review` |
| `complete` | `--tier-complete` at 15% opacity | `--tier-complete` | `--tier-complete` |
| `halted` | `--tier-halted` at 15% opacity | `--tier-halted` | `--tier-halted` |

### StatusIcon States

| Status | Icon | Color | Accessible Label |
|--------|------|-------|-----------------|
| `complete` | `CheckCircle2` (filled) | `--status-complete` | "Complete" |
| `in_progress` | `Loader2` (spinning) | `--status-in-progress` | "In Progress" |
| `not_started` | `Circle` (outline) | `--status-not-started` | "Not Started" |
| `failed` | `XCircle` (filled) | `--status-failed` | "Failed" |
| `halted` | `OctagonX` | `--status-halted` | "Halted" |
| `skipped` | `MinusCircle` | `--status-skipped` | "Skipped" |

### DocumentLink States

| State | Visual Treatment |
|-------|-----------------|
| Available | Blue link text (`--color-link`), underline on hover, pointer cursor, file icon |
| Hover | Underlined, slightly brighter |
| Disabled (null path) | Muted text (`--color-link-disabled`), no underline, `not-allowed` cursor, tooltip: "Document not yet available" |
| Disabled (file missing) | Same as null path but tooltip: "Document file not found" |
| Loading (drawer opening) | Brief loading spinner inline before drawer appears |

### PhaseCard States

| State | Visual Treatment |
|-------|-----------------|
| Collapsed | Shows phase header only: status badge, title, progress bar, doc link. Tasks hidden |
| Expanded | Full task list visible below header. Toggle chevron rotated |
| Active phase (`in_progress`) | Subtle left border accent in `--status-in-progress` |
| Complete phase | Muted styling, progress bar fully green |
| Failed/Halted phase | Red left border accent, prominent status badge |

### TaskCard States

| State | Visual Treatment |
|-------|-----------------|
| Default | Status icon + title + document links in a compact row |
| With error | Error text shown below title in `--color-destructive` text. Severity badge shown |
| With retries | `RetryBadge` shown next to title (e.g., "⟳ 1/2") |
| With review | Review verdict badge shown as additional metadata row |
| Hover | Subtle background highlight (`bg-accent/30`) |

### ErrorSummaryBanner States

| State | Visual Treatment |
|-------|-----------------|
| Hidden (no blockers) | Component not rendered |
| Active | Red-tinted background (`--color-error-bg`), border (`--color-error-border`), alert icon, blocker list as bullets |
| Dismissable | No — banner stays visible as long as blockers exist in state |

### DocumentDrawer States

| State | Visual Treatment |
|-------|-----------------|
| Closed | Not visible, no DOM overlay |
| Opening | Slide-in animation from right (200ms ease-out) |
| Loading content | Skeleton lines in body area while markdown is being fetched and rendered |
| Loaded | Metadata card + rendered markdown body. Scrollable |
| Error (file unreadable) | Error message in body: "Could not load document: {reason}" |
| Closing | Slide-out animation (150ms ease-in) |

### ThemeToggle States

| State | Active Option | Visual |
|-------|--------------|--------|
| System (default) | Monitor icon highlighted | Follows OS preference |
| Dark | Moon icon highlighted | Dark theme applied |
| Light | Sun icon highlighted | Light theme applied |

---

## Accessibility

### Keyboard Navigation

| Requirement | Implementation |
|-------------|---------------|
| Sidebar navigation | `Tab` to sidebar, `Arrow Up/Down` to navigate items, `Enter` to select. Sidebar implements `role="listbox"` with `role="option"` items |
| Dashboard scrolling | Standard scroll behavior. `Tab` navigates between interactive elements (links, buttons, expandable sections) |
| Document links | All doc links are `<a>` or `<button>` elements, focusable via `Tab`, activated via `Enter` |
| Phase card expansion | `Enter` or `Space` toggles expansion. Chevron icon has `aria-expanded` attribute |
| Document drawer | `Escape` closes drawer. Focus trapped inside drawer when open. Focus returns to triggering element on close |
| Config drawer | Same focus trap and `Escape` behavior as document drawer |
| Theme toggle | `Tab` to toggle group, `Arrow Left/Right` to cycle options, `Enter/Space` to select |
| Sidebar collapse | Toggle button accessible via `Tab`, `Enter` to collapse/expand |
| Skip link | Hidden "Skip to main content" link at top of page, visible on focus, jumps past sidebar |

### Screen Reader Support

| Requirement | Implementation |
|-------------|---------------|
| Pipeline tier | Badge includes `aria-label="Pipeline tier: {tier}"` |
| Status icons | Each icon has `aria-label="{status}"` — never rely on icon alone |
| Progress bars | `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="{total}"`, `aria-label="Phase {n} progress: {completed} of {total} tasks"` |
| Connection status | `aria-live="polite"` region for connection state changes |
| Error banner | `role="alert"`, `aria-live="assertive"` for active blocker announcements |
| Document drawer | `role="dialog"`, `aria-label="Document viewer: {doc title}"`, `aria-modal="true"` |
| Config drawer | `role="dialog"`, `aria-label="Pipeline configuration"`, `aria-modal="true"` |
| Project list | `role="listbox"`, `aria-label="Project list"`. Each item: `role="option"`, `aria-selected` |
| Gate history | Timeline entries use semantic list (`<ol>`) with descriptive text per entry |
| Planning checklist | Semantic list (`<ol>`) with status text per step, not just icons |
| Sidebar collapse state | Toggle button has `aria-expanded` and `aria-label="Collapse sidebar"/"Expand sidebar"` |

### Color Contrast

| Requirement | Implementation |
|-------------|---------------|
| Text on backgrounds | All text meets WCAG 2.1 Level AA: 4.5:1 for normal text, 3:1 for large text (≥18px or ≥14px bold) |
| Badge text | Badge text uses high-contrast foreground against the tinted background (tier badges use 15% opacity BG with full-color text) |
| Status communication | Every status conveyed by color is also conveyed by icon + text label. No color-only indicators |
| Focus indicators | Visible focus ring (2px solid, offset 2px) using shadcn `ring` convention. Contrast ratio ≥ 3:1 against adjacent backgrounds |
| Dark mode contrast | All dark mode token pairs validated for AA compliance. Muted text (`--color-muted-foreground`) is ≥ 4.5:1 against `--color-background` |

### Motion & Animation

| Requirement | Implementation |
|-------------|---------------|
| Reduced motion | Respect `prefers-reduced-motion`: disable drawer slide animations, spinner animations, and progress bar transitions. Use instant state changes instead |
| Loading spinners | `Loader2` spin animation disabled when `prefers-reduced-motion: reduce`. Replace with static "loading" text |

---

## Responsive Behavior

This is a **desktop-first** application. Per NG-6, mobile-responsive layout is a non-goal. The minimum supported viewport is 1024px wide.

| Breakpoint | Layout Change |
|-----------|--------------|
| ≥1280px (default) | Full layout: 260px sidebar + fluid main area + 640px drawer |
| ≥1024px, <1280px | Sidebar auto-collapses to 48px icon-only mode. Main area takes full width minus 48px. Drawer overlays at 560px max width |
| <1024px (unsupported) | Banner message: "This dashboard is designed for desktop viewports (≥1024px). Please resize your browser window." No layout adaptation |

### Drawer Responsive Behavior

| Viewport Width | Drawer Behavior |
|---------------|----------------|
| ≥1280px | Drawer width 640px, overlays main content with backdrop |
| ≥1024px, <1280px | Drawer width 100% of viewport minus sidebar (48px), overlays fully |

### Sidebar Responsive Behavior

| Viewport Width | Sidebar Behavior |
|---------------|-----------------|
| ≥1280px | Default expanded (260px). User can collapse manually |
| ≥1024px, <1280px | Default collapsed (48px icon-only). User can expand on hover or click |

---

## Design System Additions

New tokens and components that extend the base shadcn/ui + Tailwind system for this project.

### New CSS Custom Properties

| Type | Name | Value | Rationale |
|------|------|-------|-----------|
| Token | `--tier-planning` | `hsl(217, 91%, 60%)` | Pipeline tier color not in default shadcn palette |
| Token | `--tier-execution` | `hsl(38, 92%, 50%)` | Pipeline tier color not in default shadcn palette |
| Token | `--tier-review` | `hsl(271, 91%, 65%)` | Pipeline tier color not in default shadcn palette |
| Token | `--tier-complete` | `hsl(142, 71%, 45%)` | Pipeline tier color not in default shadcn palette |
| Token | `--tier-halted` | `hsl(0, 84%, 60%)` | Pipeline tier color not in default shadcn palette |
| Token | `--tier-not-initialized` | `hsl(215, 14%, 57%)` | Neutral state for uninitialized projects |
| Token | `--status-complete` | `hsl(142, 71%, 45%)` | Matches tier-complete for consistency |
| Token | `--status-in-progress` | `hsl(217, 91%, 60%)` | Matches tier-planning for consistency |
| Token | `--status-not-started` | `hsl(215, 14%, 57%)` | Neutral/muted for pending items |
| Token | `--status-failed` | `hsl(0, 84%, 60%)` | Matches tier-halted for consistency |
| Token | `--status-halted` | `hsl(0, 84%, 60%)` | Same as failed — both are blocking states |
| Token | `--status-skipped` | `hsl(215, 14%, 57%)` | Neutral, same as not-started |
| Token | `--verdict-approved` | `hsl(142, 71%, 45%)` | Green for positive review outcome |
| Token | `--verdict-changes-requested` | `hsl(38, 92%, 50%)` | Amber for actionable review outcome |
| Token | `--verdict-rejected` | `hsl(0, 84%, 60%)` | Red for negative review outcome |
| Token | `--severity-critical` | `hsl(0, 84%, 60%)` | Red for critical errors |
| Token | `--severity-minor` | `hsl(38, 92%, 50%)` | Amber for minor errors |
| Token | `--connection-ok` | `hsl(142, 71%, 45%)` | Green for connected state |
| Token | `--connection-warning` | `hsl(38, 92%, 50%)` | Amber for reconnecting state |
| Token | `--connection-error` | `hsl(0, 84%, 60%)` | Red for disconnected state |
| Token | `--color-error-bg` | `hsl(0, 84%, 97%)` / `hsl(0, 63%, 15%)` | Error banner background (light/dark) |
| Token | `--color-error-border` | `hsl(0, 84%, 80%)` / `hsl(0, 63%, 31%)` | Error banner border (light/dark) |
| Token | `--color-link` | `hsl(217, 91%, 60%)` / `hsl(217, 91%, 65%)` | Document link color (light/dark) |
| Token | `--color-link-disabled` | `hsl(215, 14%, 57%)` / `hsl(215, 14%, 40%)` | Disabled link color (light/dark) |
| Token | `--color-progress-fill` | `hsl(217, 91%, 60%)` | Progress bar fill |
| Token | `--color-progress-track` | `hsl(220, 14%, 96%)` / `hsl(215, 28%, 17%)` | Progress bar background track (light/dark) |
| Token | `--color-warning` | `hsl(38, 92%, 50%)` | Warning indicators, amber badges |
| Token | `--sidebar-width` | `260px` | Sidebar expanded width |
| Token | `--sidebar-collapsed-width` | `48px` | Sidebar collapsed width |
| Token | `--drawer-width` | `640px` | Document/config drawer max width |
| Token | `--metadata-bg` | `var(--color-muted)` | Frontmatter metadata card background |
| Token | `--header-bg` | `var(--color-card)` | App header background |
| Token | `--header-border` | `var(--color-border)` | App header bottom border |
| Token | `--sidebar-bg` | `var(--color-card)` | Sidebar background |

### New shadcn/ui Components Required

| Component | shadcn Name | Usage |
|-----------|------------|-------|
| Badge | `badge` | `PipelineTierBadge`, `ReviewVerdictBadge`, `SeverityBadge`, `RetryBadge`, `WarningBadge` |
| Sheet | `sheet` | `DocumentDrawer`, `ConfigDrawer` |
| ScrollArea | `scroll-area` | Sidebar project list, main dashboard, drawer content |
| Sidebar | `sidebar` | `ProjectSidebar` |
| Accordion | `accordion` | `PhaseCard` expansion, `ConfigSection` collapsibles |
| Card | `card` | `TaskCard`, `DocumentMetadata`, section containers |
| Input | `input` | `SidebarSearch` |
| Tooltip | `tooltip` | Disabled document links, timestamps, abbreviations |
| Skeleton | `skeleton` | Loading states for all views |
| Toggle Group | `toggle-group` | `ThemeToggle` |
| Separator | `separator` | Section dividers in dashboard |
| Alert | `alert` | `ErrorSummaryBanner` |

---

## Open Question Decisions Addressed

| # | Question | Design Decision |
|---|----------|----------------|
| OQ-1 | Workspace root configuration | Environment variable (`WORKSPACE_ROOT` in `.env.local`). Not visible in UI — purely server-side configuration. No settings page needed |
| OQ-2 | Malformed or incomplete state data | Degraded project card with `MalformedStateView` component: amber warning icon, project name, error message. Appears in sidebar with `WarningBadge` instead of tier badge |
| OQ-3 | Mermaid diagram support | P2 stretch goal. Initial implementation renders Mermaid code blocks as fenced code (styled, readable). A future enhancement adds `mermaid` rendering via a lazy-loaded client component |
| OQ-4 | Theme preference | `ThemeToggle` with three modes: System (default) → Dark → Light. Dark mode is applied when system preference is dark or when user explicitly selects dark. Toggle uses `class` strategy for Tailwind dark mode. Preference in `localStorage` |

---

## Status Icon Reference

Adopting the existing orchestration convention from `STATUS.md` and mapping to Lucide icons for consistency between the raw files and the dashboard:

| Emoji (STATUS.md) | Lucide Icon | Status | CSS Variable |
|-------------------|-------------|--------|-------------|
| ✅ | `CheckCircle2` | Complete / Approved | `--status-complete` |
| ⬜ | `Circle` | Not Started / Pending | `--status-not-started` |
| 🔄 | `Loader2` | In Progress | `--status-in-progress` |
| ❌ | `XCircle` | Failed / Blocked | `--status-failed` |
| ⚠️ | `AlertTriangle` | Warning / Partial | `--color-warning` |
