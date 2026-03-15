---
project: "MONITORING-UI"
status: "draft"
author: "architect-agent"
created: "2026-03-09T00:00:00Z"
inputs:
  brainstorming: "MONITORING-UI-BRAINSTORMING.md"
  research: "MONITORING-UI-RESEARCH-FINDINGS.md"
  prd: "MONITORING-UI-PRD.md"
  design: "MONITORING-UI-DESIGN.md"
  architecture: "MONITORING-UI-ARCHITECTURE.md"
---

# MONITORING-UI — Master Plan

## Executive Summary

MONITORING-UI is a real-time, read-only Next.js 14 dashboard that gives developers and colleagues an instant visual window into the orchestration pipeline's project state. It watches the local filesystem with chokidar, pushes state changes to the browser via Server-Sent Events, and renders `state.json` data as a polished two-panel interface with a project switcher sidebar, phase/task progress views, inline markdown document viewer, and configuration summary. The stack is Next.js App Router with TypeScript, shadcn/ui, and Tailwind CSS v4 — professional, maintainable, and entirely additive to the existing orchestration system with zero write access to any orchestration file.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [MONITORING-UI-BRAINSTORMING.md](MONITORING-UI-BRAINSTORMING.md) | ✅ |
| Research Findings | [MONITORING-UI-RESEARCH-FINDINGS.md](MONITORING-UI-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [MONITORING-UI-PRD.md](MONITORING-UI-PRD.md) | ✅ |
| Design | [MONITORING-UI-DESIGN.md](MONITORING-UI-DESIGN.md) | ✅ |
| Architecture | [MONITORING-UI-ARCHITECTURE.md](MONITORING-UI-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

Curated P0 functional and critical non-functional requirements that drive phasing decisions. Full requirements in [MONITORING-UI-PRD.md](MONITORING-UI-PRD.md).

- **FR-1**: Display the current pipeline tier (planning, execution, review, complete, halted) as a prominently styled badge
- **FR-2**: Render a planning steps checklist with each step's individual status
- **FR-4**: Render a phase progress view showing all phases with status, title, task count, and completion ratio
- **FR-5**: Render an expandable task list within each phase showing task status, title, retry count, error info, and severity
- **FR-9**: Display an error summary section with total retries, total halts, and active blockers
- **FR-11**: Display a project sidebar listing all projects under the configured base path
- **FR-15**: Selecting a project in the sidebar loads that project's dashboard
- **FR-16**: Push real-time state updates to the browser via filesystem watching — no manual refresh
- **FR-19**: Render all state-referenced documents as clickable links in the dashboard
- **FR-20**: Clicking a document link opens an inline viewer with rendered markdown
- **FR-27**: Support both v1 and v2 `state.json` schemas with transparent field normalization
- **FR-28**: Read workspace root from an environment variable configuration
- **NFR-2**: Real-time state updates appear in the browser within 2 seconds of file write
- **NFR-6**: Handle malformed state data gracefully — never crash, always show a degraded view
- **NFR-10**: The application never writes to, modifies, or deletes any filesystem file
- **NFR-15**: File watchers are cleaned up immediately on client disconnect

## Key Technical Decisions (from Architecture)

Curated architectural decisions that constrain implementation. Full details in [MONITORING-UI-ARCHITECTURE.md](MONITORING-UI-ARCHITECTURE.md).

- **Next.js 14 App Router with TypeScript**: Server Components handle filesystem reads; API Routes handle the SSE stream. The `/ui` directory is isolated at the workspace root with its own `package.json` — zero coupling to the existing orchestration codebase.
- **SSE + chokidar for real-time updates**: Server-Sent Events are unidirectional, work over plain HTTP, and require no WebSocket upgrade. chokidar watches `{basePath}/**/state.json` with `awaitWriteFinish` (200ms stability threshold) and per-project debounce (300ms) to prevent partial reads and rapid re-renders.
- **v1/v2 state normalization via `normalizer.ts`**: A single normalization module maps v1 field names to v2 (`phase.name → title`, `plan_doc → phase_doc`, `task.name → title`) and defaults absent v2 fields to `null`. All UI components consume only normalized types.
- **shadcn/ui + Tailwind CSS v4**: Components are copied into the project (not a dependency), styled with Tailwind utility classes, and themed via CSS custom properties. Dark mode uses the Tailwind `class` strategy on `<html>`.
- **Read-only infrastructure layer**: Only `fs.readFile`, `fs.readdir`, and `fs.stat` are imported. No write, unlink, or rename operations exist. Markdown is sanitized via `rehype-sanitize` to prevent script injection.
- **Centralized path resolution via `path-resolver.ts`**: Workspace root from `WORKSPACE_ROOT` env var, base path from `orchestration.yml`, document paths resolved relative to project directory. No other module constructs filesystem paths.
- **Four-layer architecture**: Presentation (React components) → Application (hooks, SSE client) → Domain (types, normalizer) → Infrastructure (filesystem reader, API routes, watchers). Raw state types never cross into Presentation or Application layers.
- **`gray-matter` for frontmatter + `react-markdown` with `remark-gfm` for rendering**: The document viewer extracts YAML frontmatter as structured metadata and renders the markdown body with GitHub-Flavored Markdown support (tables, task lists, fenced code blocks).

## Key Design Constraints (from Design)

Curated design decisions that affect implementation. Full details in [MONITORING-UI-DESIGN.md](MONITORING-UI-DESIGN.md).

- **Two-panel layout**: Fixed 260px collapsible sidebar + fluid main dashboard. Minimum viewport 1024px (desktop-first). Sidebar auto-collapses to 48px icon-only at <1280px.
- **Right-side drawer pattern**: Both the document viewer (640px max) and config viewer (560px max) use the shadcn `Sheet` component as a slide-over drawer. Focus is trapped inside; `Escape` closes.
- **Pipeline tier color system**: Five distinct hue-coded tiers (blue/amber/purple/green/red) plus a slate "not initialized" state. Badges use 15% opacity backgrounds with full-color text. Every color-coded indicator has a paired text label for accessibility.
- **Status icon mapping**: Lucide icons map 1:1 to orchestration status values — `CheckCircle2` (complete), `Loader2` animated (in-progress), `Circle` outline (not started), `XCircle` (failed), `OctagonX` (halted), `MinusCircle` (skipped).
- **Dark mode default with system toggle**: Three-way toggle (System/Dark/Light) persisted to `localStorage`. Inline `<script>` in root layout prevents flash-of-wrong-theme.
- **Degraded views for edge cases**: `NotInitializedView` for projects without `state.json`; `MalformedStateView` with amber warning for unparseable state; disabled `DocumentLink` with tooltip for missing files.
- **Accessibility requirements**: WCAG 2.1 AA contrast, keyboard navigation throughout (sidebar listbox, phase expansion, drawer focus trap, skip-to-content), ARIA attributes on all status indicators and interactive elements, `prefers-reduced-motion` respected.
- **Connection status indicator**: Green/yellow/red dot in `AppHeader` reflecting SSE stream state. `aria-live="polite"` region for screen reader announcements.

## Phase Outline

### Phase 1: Project Scaffold + Data Layer

**Goal**: A working Next.js application with TypeScript types, filesystem reading, state normalization, and API routes serving real project data — the complete server-side foundation.

**Scope**:
- Initialize `/ui` with `create-next-app` (App Router, TypeScript, Tailwind, ESLint) — refs: [Architecture: File Structure](MONITORING-UI-ARCHITECTURE.md#file-structure)
- Install all npm dependencies (Next.js 14, chokidar, gray-matter, react-markdown, remark-gfm, rehype-sanitize, yaml, lucide-react, shadcn/ui utilities) — refs: [Architecture: Dependencies](MONITORING-UI-ARCHITECTURE.md#dependencies)
- Configure shadcn/ui (`components.json`, install base components: Badge, Card, Sheet, ScrollArea, Sidebar, Accordion, Input, Tooltip, Skeleton, ToggleGroup, Separator, Alert)
- Define all TypeScript types: `types/state.ts`, `types/config.ts`, `types/events.ts`, `types/components.ts` — refs: [Architecture: Contracts](MONITORING-UI-ARCHITECTURE.md#contracts--interfaces)
- Implement domain utilities: `lib/normalizer.ts` (v1/v2 normalization), `lib/path-resolver.ts`, `lib/yaml-parser.ts`, `lib/fs-reader.ts`, `lib/markdown-parser.ts`, `lib/config-transformer.ts`, `lib/utils.ts` — refs: [FR-27](MONITORING-UI-PRD.md#fr-27), [FR-28](MONITORING-UI-PRD.md#fr-28)
- Implement API routes: `GET /api/projects`, `GET /api/projects/[name]/state`, `GET /api/projects/[name]/document`, `GET /api/config` — refs: [Architecture: API Endpoints](MONITORING-UI-ARCHITECTURE.md#api-endpoints)
- Set up `.env.local` with `WORKSPACE_ROOT` and root layout with `globals.css` (CSS custom properties from Design doc) — refs: [Design: Design Tokens](MONITORING-UI-DESIGN.md#design-tokens)

**Task Outline**:
1. Next.js project initialization + dependency installation + shadcn/ui setup
2. TypeScript type definitions (all four type files)
3. Infrastructure utilities (path resolver, YAML parser, filesystem reader, markdown parser)
4. Domain utilities (state normalizer, config transformer)
5. API routes (projects list, project state, document, config)
6. Root layout, globals.css, custom properties, error/loading boundaries

**Exit Criteria**:
- [ ] `npm run build` succeeds with zero TypeScript errors
- [ ] `GET /api/projects` returns a JSON array reflecting actual workspace projects
- [ ] `GET /api/projects/VALIDATOR/state` returns a normalized state object for an existing project
- [ ] `GET /api/projects/VALIDATOR/document?path=VALIDATOR-PRD.md` returns frontmatter + markdown body
- [ ] `GET /api/config` returns the parsed `orchestration.yml` in grouped format
- [ ] v1 and v2 `state.json` files are normalized identically (field mapping tests pass)
- [ ] Projects without `state.json` appear in the project list with `hasState: false`

**Dependencies**: None (first phase)

**Key Risks**:
- Incorrect v1/v2 normalization logic misses edge cases for absent fields → mitigate with test cases against real workspace `state.json` files
- `WORKSPACE_ROOT` misconfiguration at startup → mitigate with clear error message on missing env var

**Phase Doc**: [phases/MONITORING-UI-PHASE-01-SCAFFOLD-DATA-LAYER.md](phases/MONITORING-UI-PHASE-01-SCAFFOLD-DATA-LAYER.md) *(created at execution time)*

---

### Phase 2: Dashboard Components + Sidebar

**Goal**: A fully rendered static dashboard — all sections display real project state, sidebar navigation works across all workspace projects — using data from Phase 1's API routes (no real-time updates yet).

**Scope**:
- Implement all badge components: `PipelineTierBadge`, `StatusIcon`, `ReviewVerdictBadge`, `SeverityBadge`, `RetryBadge`, `WarningBadge`, `ConnectionIndicator`, `LockBadge` — refs: [Design: New Components](MONITORING-UI-DESIGN.md#new-components), [Architecture: badges module](MONITORING-UI-ARCHITECTURE.md#module-map)
- Implement sidebar: `ProjectSidebar`, `ProjectListItem`, `SidebarSearch` with project selection and localStorage persistence — refs: [Design: View 1](MONITORING-UI-DESIGN.md#view-1-project-switcher-sidebar), [FR-11](MONITORING-UI-PRD.md#fr-11), [FR-12](MONITORING-UI-PRD.md#fr-12), [FR-15](MONITORING-UI-PRD.md#fr-15)
- Implement dashboard sections: `ProjectHeader`, `PlanningSection` + `PlanningChecklist`, `ExecutionSection`, `PhaseCard`, `TaskCard`, `ProgressBar`, `ErrorSummaryBanner`, `ErrorLogSection`, `FinalReviewSection`, `GateHistorySection`, `LimitsSection` — refs: [Design: View 2](MONITORING-UI-DESIGN.md#view-2-main-dashboard), [FR-1](MONITORING-UI-PRD.md#fr-1) through [FR-10](MONITORING-UI-PRD.md#fr-10)
- Implement layout: `AppHeader`, `MainDashboard`, `NotInitializedView`, `MalformedStateView` — refs: [Design: Application Shell](MONITORING-UI-DESIGN.md#application-shell), [FR-13](MONITORING-UI-PRD.md#fr-13), [FR-14](MONITORING-UI-PRD.md#fr-14)
- Implement `useProjects` hook for initial data fetch via API (no SSE yet) — refs: [Architecture: hooks](MONITORING-UI-ARCHITECTURE.md#projects-state-hook)
- Wire the root page to render the complete app shell: sidebar + main dashboard

**Task Outline**:
1. Badge component library (all 8 badge/indicator components)
2. Sidebar components (ProjectSidebar, ProjectListItem, SidebarSearch, useProjects hook)
3. Dashboard header + planning section (ProjectHeader, PlanningChecklist, ErrorSummaryBanner)
4. Execution section (PhaseCard, TaskCard, ProgressBar, ExecutionSection)
5. Remaining dashboard sections (FinalReviewSection, ErrorLogSection, GateHistorySection, LimitsSection)
6. Layout shell + edge-case views (AppHeader, MainDashboard, NotInitializedView, MalformedStateView, root page wiring)

**Exit Criteria**:
- [ ] Sidebar lists all workspace projects with correct pipeline tier badges
- [ ] Selecting a project renders its complete dashboard (all sections populated from real state data)
- [ ] Not-initialized projects display `NotInitializedView` when selected
- [ ] Malformed state projects display `MalformedStateView` with error message
- [ ] Planning checklist shows correct status icons and document links
- [ ] Phase cards show progress bars with accurate task counts
- [ ] Task cards display status, title, retry count, error info, and severity where present
- [ ] Error summary banner appears when active blockers exist and is hidden when there are none

**Dependencies**: Phase 1 (API routes, types, normalizer, design tokens, base shadcn/ui components)

**Key Risks**:
- Component count is high (20+ components) — risk of incomplete wiring → mitigate by testing each section against a real project with full execution history (e.g., VALIDATOR)
- Design token mismatch between CSS custom properties and component styles → mitigate by implementing globals.css first and referencing tokens consistently

**Phase Doc**: [phases/MONITORING-UI-PHASE-02-DASHBOARD-SIDEBAR.md](phases/MONITORING-UI-PHASE-02-DASHBOARD-SIDEBAR.md) *(created at execution time)*

---

### Phase 3: SSE Real-Time Updates + Document Viewer

**Goal**: The dashboard updates live in the browser when `state.json` changes on disk, and users can view any project document inline via a slide-over drawer.

**Scope**:
- Implement SSE endpoint (`/api/events/route.ts`) with chokidar watcher, `awaitWriteFinish`, per-project debounce (300ms), and watcher cleanup on disconnect — refs: [Architecture: SSE Endpoint](MONITORING-UI-ARCHITECTURE.md#api-endpoints), [FR-16](MONITORING-UI-PRD.md#fr-16), [NFR-15](MONITORING-UI-PRD.md#nfr-15)
- Implement `useSSE` hook with `EventSource`, connection status tracking (`connected` / `reconnecting` / `disconnected`), and manual reconnect — refs: [Architecture: SSE Client Hook](MONITORING-UI-ARCHITECTURE.md#sse-client-hook), [NFR-4](MONITORING-UI-PRD.md#nfr-4)
- Wire `useSSE` into `useProjects` so incoming `state_change` events update the selected project's dashboard in real time — refs: [FR-17](MONITORING-UI-PRD.md#fr-17)
- Activate `ConnectionIndicator` in `AppHeader` with live status — refs: [Design: Flow 5](MONITORING-UI-DESIGN.md#flow-5-handling-sse-disconnection)
- Implement document viewer: `DocumentDrawer`, `DocumentMetadata`, `MarkdownRenderer`, `DocumentLink`, `useDocumentDrawer` hook — refs: [Design: View 3](MONITORING-UI-DESIGN.md#view-3-inline-document-viewer), [FR-19](MONITORING-UI-PRD.md#fr-19), [FR-20](MONITORING-UI-PRD.md#fr-20), [FR-22](MONITORING-UI-PRD.md#fr-22)
- Wire document links throughout the dashboard: planning step outputs, phase docs, task handoffs, task reports, code reviews, phase reports, phase reviews — refs: [FR-19](MONITORING-UI-PRD.md#fr-19), [FR-24](MONITORING-UI-PRD.md#fr-24)

**Task Outline**:
1. SSE API endpoint (chokidar watcher, event formatting, debounce, cleanup)
2. SSE client hook (useSSE with EventSource, connection tracking, reconnection)
3. Real-time state integration (wire useSSE into useProjects, update dashboard on state_change events)
4. Document viewer components (DocumentDrawer, DocumentMetadata, MarkdownRenderer, DocumentLink)
5. Document viewer hook + wiring (useDocumentDrawer, wire all document links throughout dashboard)

**Exit Criteria**:
- [ ] Editing a `state.json` file on disk causes the dashboard to update within 2 seconds without page refresh
- [ ] SSE connection indicator shows green "Connected" when the stream is active
- [ ] SSE connection indicator transitions to yellow "Reconnecting" on stream interruption, and recovers to green on reconnect
- [ ] Closing the browser tab cleans up the chokidar watcher (no memory leak)
- [ ] Clicking a document link opens the drawer with rendered markdown and frontmatter metadata
- [ ] Missing documents render as disabled links with a "Not available" tooltip
- [ ] The markdown renderer correctly handles GFM tables, task lists, and fenced code blocks

**Dependencies**: Phase 2 (all dashboard components, sidebar, useProjects hook)

**Key Risks**:
- SSE connection instability on Windows filesystem watchers → mitigate with `awaitWriteFinish` config and auto-reconnect in `useSSE`
- Large markdown documents cause slow drawer rendering → mitigate with lazy content loading (fetch on drawer open, not on dashboard load)
- Rapid file writes during pipeline execution overwhelm the client → mitigate with 300ms per-project debounce before SSE push

**Phase Doc**: [phases/MONITORING-UI-PHASE-03-SSE-DOCUMENTS.md](phases/MONITORING-UI-PHASE-03-SSE-DOCUMENTS.md) *(created at execution time)*

---

### Phase 4: Config Viewer + Theme + Polish

**Goal**: Feature-complete dashboard with configuration viewer, theme toggle, full accessibility compliance, error resilience, and production polish.

**Scope**:
- Implement config viewer: `ConfigDrawer`, `ConfigSection`, `LockBadge`, `useConfigDrawer` hook — refs: [Design: View 4](MONITORING-UI-DESIGN.md#view-4-config-viewer-drawer), [FR-25](MONITORING-UI-PRD.md#fr-25), [FR-26](MONITORING-UI-PRD.md#fr-26)
- Implement `ThemeToggle` with `useTheme` hook, `localStorage` persistence, inline script for flash prevention — refs: [Design: View 5](MONITORING-UI-DESIGN.md#view-5-theme-toggle), [FR-29](MONITORING-UI-PRD.md#fr-29)
- Keyboard navigation: sidebar listbox (`role="listbox"`), phase card expansion (`aria-expanded`), drawer focus trap, skip-to-content link — refs: [Design: Accessibility](MONITORING-UI-DESIGN.md#accessibility), [NFR-7](MONITORING-UI-PRD.md#nfr-7)
- ARIA attributes: `aria-label`, `aria-expanded`, `aria-live`, `aria-modal`, `aria-selected`, `role="progressbar"` with value attributes — refs: [NFR-8](MONITORING-UI-PRD.md#nfr-8)
- Loading skeletons for sidebar and main dashboard — refs: [Design: Application-Level States](MONITORING-UI-DESIGN.md#application-level-states)
- Error boundaries at section level to prevent full-page crashes — refs: [NFR-6](MONITORING-UI-PRD.md#nfr-6)
- `prefers-reduced-motion` support for animations — refs: [Design: Motion & Animation](MONITORING-UI-DESIGN.md#motion--animation)
- WCAG 2.1 AA contrast validation for both light and dark themes — refs: [NFR-9](MONITORING-UI-PRD.md#nfr-9)

**Task Outline**:
1. Config viewer (ConfigDrawer, ConfigSection, LockBadge, useConfigDrawer hook, wiring to AppHeader)
2. Theme toggle (ThemeToggle, useTheme, localStorage persistence, flash-prevention script)
3. Keyboard navigation + ARIA attributes (sidebar listbox, phase expansion, drawer focus trap, skip link, progressbar roles)
4. Loading states + error boundaries (skeleton components, section-level error boundaries, reduced-motion support)
5. Accessibility audit + contrast validation (WCAG 2.1 AA pass for both themes, screen reader testing)

**Exit Criteria**:
- [ ] Config drawer displays all five `orchestration.yml` sections with correct grouping and values
- [ ] Hard-default gates (`after_planning`, `after_final_review`) show lock icons
- [ ] Theme toggle cycles System → Dark → Light with immediate visual update and localStorage persistence
- [ ] No flash-of-wrong-theme on page load
- [ ] All interactive elements are keyboard-navigable (Tab, Arrow keys, Enter, Escape)
- [ ] Focus is trapped inside open drawers; Escape closes them; focus returns to trigger
- [ ] Screen reader announces pipeline tier, status changes, and error banners correctly
- [ ] Section-level errors render an error boundary fallback without crashing the full page
- [ ] Loading skeletons display during initial data fetch
- [ ] Both light and dark themes pass WCAG 2.1 AA contrast ratio checks

**Dependencies**: Phase 3 (SSE integration, document viewer, ConnectionIndicator active)

**Key Risks**:
- Accessibility audit reveals contrast failures in custom design tokens → mitigate by validating token pairs during implementation, not just at audit
- Focus trap implementation conflicts with shadcn Sheet's built-in focus management → mitigate by leveraging Sheet's native focus trap rather than adding a custom one

**Phase Doc**: [phases/MONITORING-UI-PHASE-04-CONFIG-THEME-POLISH.md](phases/MONITORING-UI-PHASE-04-CONFIG-THEME-POLISH.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml) — this plan uses 4
- **Max tasks per phase**: 8 (from orchestration.yml) — largest phase has 6 task outlines
- **Max retries per task**: 2
- **Max consecutive review rejections**: 3
- **Git strategy**: Single feature branch (`orch/` prefix), sequential commits, `[orch]` commit prefix, auto-commit enabled
- **Human gates**: After planning (hard default, always gated) → execution mode: "ask" at start → after final review (hard default, always gated)
- **Error handling**: Critical errors (build_failure, security_vulnerability, architectural_violation, data_loss_risk) → halt pipeline. Minor errors (test_failure, lint_error, review_suggestion, missing_test_coverage, style_violation) → auto-retry.

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|-----------|-------|
| R-1 | State schema changes in a future orchestration version break the dashboard's data model | High | The normalization layer (`normalizer.ts`) is version-aware and fails gracefully. Unrecognized fields are ignored; missing fields default to `null`. Add a schema version assertion test | Architect / Coder |
| R-2 | File watcher events are unreliable or delayed on Windows (especially with antivirus or indexing) | Medium | Use chokidar's `awaitWriteFinish` (200ms stability), `usePolling: false` default with `usePolling: true` fallback documented. The SSE auto-reconnect resends full state on reconnect. Provide a manual refresh fallback | Coder |
| R-3 | Large documents (architecture docs, final reviews) cause slow rendering in the inline viewer | Medium | Lazy-load document content only when the drawer opens. Render markdown asynchronously. Do not prefetch documents on dashboard load | Coder |
| R-4 | Rapid successive file writes during active pipeline execution cause excessive SSE pushes and re-renders | Medium | Per-project debounce at 300ms in the SSE endpoint. Only the last state within the debounce window is pushed. Client updates are batched per-project | Coder |
| R-5 | Malformed `state.json` causes dashboard crash instead of graceful degradation | High | Validate all state data at the parsing boundary in `fs-reader.ts`. Wrap all sections in React error boundaries. Surface malformed data as `MalformedStateView` with error details. Automated test cases with corrupt JSON | Coder / Reviewer |
| R-6 | High component count in Phase 2 causes incomplete wiring or missing edge-case views | Medium | Test each section against a real project with full execution history (VALIDATOR project has complete lifecycle data). Verify all `state.json` fields are represented in the UI | Coder / Reviewer |
| R-7 | shadcn/ui component conflicts with custom design tokens | Low | Custom CSS properties layer on top of shadcn defaults. Use the `cn()` utility (clsx + tailwind-merge) consistently. Test both themes after each badge/component implementation | Coder |
| R-8 | SSE memory leak from uncleaned chokidar watchers on client disconnect | High | Explicit `watcher.close()` on response `close` event. Add a heartbeat interval that detects stale connections. Log watcher lifecycle events for debugging | Coder |

## Success Criteria

The project is complete and successful when all of the following are met:

1. **Time to status comprehension**: A user can determine a project's pipeline tier, active step, and any blockers within 5 seconds of opening the dashboard
2. **State update latency**: Changes to `state.json` on disk appear in the browser within 2 seconds, with no manual refresh
3. **Document viewer load time**: Clicking a document link loads and renders the markdown content within 1 second
4. **Project switching speed**: Selecting a different project in the sidebar loads its dashboard within 500ms
5. **Error resilience**: Zero unhandled crashes when encountering malformed state, missing files, or disconnected SSE streams
6. **Feature coverage**: 100% of `state.json` fields are visible somewhere in the dashboard (verified by audit against the state schema)
7. **Accessibility compliance**: All interactive elements are keyboard-navigable; all status indicators have text labels; both themes pass WCAG 2.1 AA contrast ratios
8. **Zero write operations**: The application never writes to, modifies, or deletes any file — confirmed by infrastructure layer audit
