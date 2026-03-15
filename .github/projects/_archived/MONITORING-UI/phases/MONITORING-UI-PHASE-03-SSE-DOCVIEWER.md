---
project: "MONITORING-UI"
phase: 3
title: "SSE Real-Time Updates + Document Viewer"
status: "active"
total_tasks: 5
author: "tactical-planner-agent"
created: "2026-03-10T01:00:00Z"
---

# Phase 3: SSE Real-Time Updates + Document Viewer

## Phase Goal

Make the dashboard update live in the browser when `state.json` changes on disk (via SSE + chokidar file watching) and enable users to view any project document inline through a slide-over drawer — completing the real-time monitoring and document browsing experience.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../MONITORING-UI-MASTER-PLAN.md) | Phase 3 scope, exit criteria, risk mitigations (R-2, R-3, R-4, R-8) |
| [Architecture](../MONITORING-UI-ARCHITECTURE.md) | SSE endpoint spec, `useSSE` hook contract, SSE event wire format, chokidar config, document viewer components in module map, `useDocumentDrawer` hook, `DocumentDrawer`/`DocumentMetadata`/`MarkdownRenderer`/`DocumentLink` specs |
| [Design](../MONITORING-UI-DESIGN.md) | View 3 (Inline Document Viewer), Flow 5 (SSE Disconnection), `ConnectionIndicator` states, document drawer layout (640px), `DocumentMetadata` card, component props table |
| [PRD](../MONITORING-UI-PRD.md) | FR-16, FR-17, FR-19, FR-20, FR-22, FR-24, NFR-4, NFR-15 |
| [Phase 2 Report](../reports/MONITORING-UI-PHASE-REPORT-P02.md) | Carry-forward items: wire `onDocClick` to drawer, wire `ConnectionIndicator` to SSE, hook location decision, a11y polish items |
| [Phase 2 Review](../reports/MONITORING-UI-PHASE-REVIEW-P02.md) | Approved — 8 minor cross-task issues, recommendations for Phase 3 doc wiring and hook placement |

## Carry-Forward Items from Phase 2

| # | Item | Addressed In |
|---|------|-------------|
| CF-1 | Wire `onDocClick` to document drawer (currently logs to console) | T05 |
| CF-2 | Wire `ConnectionIndicator` to SSE status (currently static `"disconnected"`) | T03 |
| CF-3 | Hook location reconciliation (`ui/hooks/` vs `ui/lib/hooks/`) — decide canonical placement when creating `useSSE` | T02 |
| CF-4 | Accessibility polish pass (decorative `aria-hidden`, contextual `aria-label`, progressbar restructure, empty `GateHistorySection` state) | Deferred to Phase 4 |
| CF-5 | No unit test framework | Continues as carry-forward |
| CF-6 | Design doc title reconciliation ("Monitor" vs "Dashboard") | Deferred to Phase 4 |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | SSE API Endpoint | — | `create-task-handoff` | 2 | *(created at execution time)* |
| T02 | SSE Client Hook | T01 | `create-task-handoff` | 2 | *(created at execution time)* |
| T03 | Real-Time State Integration + Connection Status | T02 | `create-task-handoff` | 3 | *(created at execution time)* |
| T04 | Document Viewer Components | — | `create-task-handoff` | 6 | *(created at execution time)* |
| T05 | Document Viewer Hook + Dashboard Wiring | T03, T04 | `create-task-handoff` | 8 | *(created at execution time)* |

### T01 — SSE API Endpoint

**Objective**: Create the `GET /api/events` SSE endpoint that watches all `state.json` files with chokidar and pushes `SSEEvent` objects to connected clients.

**Key deliverables**:
- `ui/app/api/events/route.ts` — SSE route handler with streaming `ReadableStream` response
- chokidar watcher for `{basePath}/**/state.json` with `awaitWriteFinish({ stabilityThreshold: 200 })` and `ignored` for `*.proposed` / `*.empty` files
- Per-project debounce (300ms) before pushing `state_change` events
- `connected` event on initial connection with project list
- `project_added` / `project_removed` events on `add` / `unlink`
- Watcher cleanup (`watcher.close()`) on client disconnect via `close` event on the request signal
- Events formatted per SSE wire format: `event: {type}\ndata: {JSON}\n\n`

**Files**: `ui/app/api/events/route.ts` (CREATE), possibly `ui/lib/sse-utils.ts` (CREATE — debounce + event formatting helpers)

**References**: Architecture § SSE Endpoint Internal Behavior, `types/events.ts` (`SSEEvent`, `SSEPayloadMap`), `lib/path-resolver.ts`, `lib/fs-reader.ts`, `lib/normalizer.ts`

---

### T02 — SSE Client Hook

**Objective**: Create the `useSSE` React hook that manages an `EventSource` connection to `/api/events`, tracks connection status, and exposes a manual reconnect function.

**Key deliverables**:
- `ui/hooks/use-sse.ts` — hook implementing `UseSSEReturn { status, reconnect }` contract
- `EventSource` lifecycle management: open, error, close
- Connection status tracking: `connected` → `reconnecting` → `disconnected`
- Automatic reconnection via native `EventSource` retry
- Manual `reconnect()` function that tears down and re-creates the `EventSource`
- Cleanup on unmount (close `EventSource`)
- Callback props: `onEvent`, `onError`, `onOpen`

**Hook placement decision (CF-3)**: Place `useSSE` at `ui/hooks/use-sse.ts` following the established convention from `use-projects.ts` and `use-mobile.ts`. This resolves the location reconciliation carry-forward — `ui/hooks/` is the canonical location.

**Files**: `ui/hooks/use-sse.ts` (CREATE)

**References**: Architecture § SSE Client Hook contract, `types/events.ts` (`SSEEvent`, `SSEEventType`)

---

### T03 — Real-Time State Integration + Connection Status

**Objective**: Wire `useSSE` into the existing `useProjects` hook so that incoming `state_change` events update the selected project's dashboard in real time, and connect the `ConnectionIndicator` in `AppHeader` to the live SSE connection status.

**Key deliverables**:
- Modify `ui/hooks/use-projects.ts`:
  - Add `sseStatus` field to `UseProjectsReturn`
  - Add `reconnect` function to `UseProjectsReturn`
  - Call `useSSE` internally, subscribing to `/api/events`
  - Handle `state_change` events: if `projectName` matches `selectedProject`, update `projectState`
  - Handle `connected` events: refresh project list from payload
  - Handle `project_added` / `project_removed` events: update project list
- Modify `ui/components/layout/app-header.tsx`:
  - Accept `sseStatus` and `onReconnect` props
  - Pass `status` prop to `ConnectionIndicator` from `sseStatus` (replacing hardcoded `"disconnected"`)
- Modify `ui/app/page.tsx` (or wherever `AppHeader` is rendered):
  - Pass `sseStatus` and `reconnect` from `useProjects` to `AppHeader`

**Files**: `ui/hooks/use-projects.ts` (MODIFY), `ui/components/layout/app-header.tsx` (MODIFY), `ui/app/page.tsx` (MODIFY)

**References**: Architecture § Projects State Hook, FR-16, FR-17, NFR-4, Design § Flow 5

---

### T04 — Document Viewer Components

**Objective**: Build the document viewer component library: a right-side drawer with frontmatter metadata display, markdown rendering, and reusable document links.

**Key deliverables**:
- `ui/components/documents/DocumentDrawer.tsx` — shadcn `Sheet` (right side, 640px max), loads document content on open via `/api/projects/[name]/document?path=...`, shows loading skeleton while fetching
- `ui/components/documents/DocumentMetadata.tsx` — key-value card rendering extracted frontmatter fields (author, status, created, verdict, phase, etc.)
- `ui/components/documents/MarkdownRenderer.tsx` — `react-markdown` + `remark-gfm` + `rehype-sanitize`, Tailwind `prose` classes, supports tables, task lists, fenced code blocks
- `ui/components/documents/DocumentLink.tsx` — clickable link component; when `path` is `null`, renders as disabled with "Not available" tooltip; when valid, calls `onDocClick(path)` on click
- `ui/components/documents/index.ts` — barrel export for all document components
- Uses existing `types/components.ts` types: `DocumentFrontmatter`, `DocumentResponse`

**Files**: `ui/components/documents/DocumentDrawer.tsx` (CREATE), `ui/components/documents/DocumentMetadata.tsx` (CREATE), `ui/components/documents/MarkdownRenderer.tsx` (CREATE), `ui/components/documents/DocumentLink.tsx` (CREATE), `ui/components/documents/index.ts` (CREATE)

**References**: Design § View 3 (Inline Document Viewer), Architecture § documents module in file structure, `types/components.ts` (`DocumentFrontmatter`, `DocumentResponse`), `lib/markdown-parser.ts` (server-side — client uses `react-markdown` directly)

---

### T05 — Document Viewer Hook + Dashboard Wiring

**Objective**: Create the `useDocumentDrawer` hook and wire every document link throughout the dashboard to open documents in the `DocumentDrawer`.

**Key deliverables**:
- `ui/hooks/use-document-drawer.ts` — manages drawer open/close state, current document path, selected project name context
- Wire `DocumentDrawer` into the root page layout (render it alongside `MainDashboard`)
- Replace all `onDocClick` console.log handlers with `useDocumentDrawer.openDocument(path)`:
  - `PlanningChecklist` — planning step output doc links
  - `PhaseCard` — `phase_doc`, `phase_report`, `phase_review` links
  - `TaskCard` — `handoff_doc`, `report_doc`, `review_doc` links
  - `FinalReviewSection` — `report_doc` link
- Replace existing text-based doc links with `DocumentLink` component where appropriate
- Missing docs (`null` paths) render as disabled `DocumentLink` with tooltip (FR-24)

**Files**: `ui/hooks/use-document-drawer.ts` (CREATE), `ui/app/page.tsx` (MODIFY), `ui/components/planning/planning-checklist.tsx` (MODIFY), `ui/components/execution/phase-card.tsx` (MODIFY), `ui/components/execution/task-card.tsx` (MODIFY), `ui/components/dashboard/final-review-section.tsx` (MODIFY), `ui/components/layout/main-dashboard.tsx` (MODIFY)

**References**: Phase 2 carry-forward CF-1, FR-19, FR-20, FR-24, Design § View 3, Architecture § `useDocumentDrawer`

## Execution Order

```
T01 (SSE API Endpoint)
 └→ T02 (SSE Client Hook — depends on T01)
      └→ T03 (Real-time Integration — depends on T02)
                                                        ↘
T04 (Document Viewer Components — independent)  ←parallel-ready→  T05 (Hook + Wiring — depends on T03, T04)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05

*Note: T04 is parallel-ready with T02 and T03 (no mutual dependency — document components are independent of SSE) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] Editing a `state.json` file on disk causes the dashboard to update within 2 seconds without page refresh (FR-16, NFR-2)
- [ ] SSE connection indicator shows green "Connected" when the stream is active (Design § Flow 5)
- [ ] SSE connection indicator transitions to yellow "Reconnecting" on stream interruption, and recovers to green on reconnect (NFR-4)
- [ ] Closing the browser tab cleans up the chokidar watcher — no memory leak (NFR-15)
- [ ] Clicking a document link opens the drawer with rendered markdown and frontmatter metadata (FR-19, FR-20)
- [ ] Missing documents render as disabled links with a "Not available" tooltip (FR-24)
- [ ] The markdown renderer correctly handles GFM tables, task lists, and fenced code blocks (FR-22)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Known Risks for This Phase

| # | Risk | Mitigation |
|---|------|-----------|
| R-2 | SSE connection instability on Windows filesystem watchers | chokidar `awaitWriteFinish({ stabilityThreshold: 200 })`, auto-reconnect in `useSSE`, manual `reconnect()` fallback |
| R-3 | Large markdown documents cause slow drawer rendering | Lazy-load document content only when drawer opens (fetch on click, not on dashboard load) |
| R-4 | Rapid file writes during pipeline execution overwhelm client | 300ms per-project debounce before SSE push; debounce keyed by project name |
| R-8 | Memory leak from uncleaned chokidar watchers on disconnect | Explicit `watcher.close()` on response `close` event; log watcher lifecycle |
