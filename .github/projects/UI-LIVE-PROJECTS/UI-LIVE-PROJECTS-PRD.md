---
project: "UI-LIVE-PROJECTS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Product Requirements

## Problem Statement

The monitoring dashboard requires a full application rebuild to show new project folders in the sidebar. This happens because the live-update system only reacts to changes inside existing project directories, not to the creation or deletion of project directories themselves. Additionally, a manual page refresh may serve a stale project list due to undefended client-side fetch caching. As a result, users working in the pipeline must interrupt their workflow to perform infrastructure operations (stop, rebuild, restart) simply to see new projects they just created.

## Goals

- **Goal 1 — Real-time project appearance**: New project directories appear in the sidebar automatically without any user action (no rebuild, no manual refresh).
- **Goal 2 — Accurate data on page refresh**: A manual browser refresh always reflects the current filesystem state — never a stale snapshot from a previous request.
- **Goal 3 — Real-time project removal**: Deleted project directories disappear from the sidebar automatically, including projects that were never assigned a state file.

## Non-Goals

- Changes to how existing state file modifications are detected (this works correctly today)
- Polling fallback or offline-mode behavior when the live-update connection is unavailable
- Visual distinction in the sidebar between state-less and state-ful projects (out of scope for this fix)
- Support for project folders located outside the configured projects base directory
- Any changes to how individual project state is displayed once a project appears in the sidebar

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Pipeline user | See a newly created project folder appear in the sidebar without rebuilding or refreshing | I can immediately navigate to that project and track its progress | P0 |
| 2 | Pipeline user | See a deleted project folder disappear from the sidebar without rebuilding or refreshing | The sidebar accurately reflects what exists on disk at all times | P0 |
| 3 | Pipeline user | Have a manual page refresh always return the current project list | I can trust that a refresh will correct any discrepancy I observe, without a rebuild | P1 |
| 4 | Pipeline user | See brainstorming-only project folders (which have no state file yet) appear in the sidebar in real time | Early-stage projects are visible from the moment they are created, not only after state is initialized | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The live-update system must detect when a new project directory is created under the configured projects base directory and emit a project-added notification to all connected clients | P0 | Must fire even when the new directory contains no state file |
| FR-2 | The live-update system must detect when a project directory is removed from the configured projects base directory and emit a project-removed notification to all connected clients | P0 | Must fire for directories regardless of whether they contained a state file |
| FR-3 | The project listing endpoint must instruct clients never to serve a cached response | P1 | Ensures a page refresh reflects current filesystem state |
| FR-4 | The live-update connection must clean up all directory-watching resources when the client disconnects | P0 | No resource leaks; watcher handles are released on every disconnect |
| FR-5 | When a new project directory and its state file appear within close temporal proximity, exactly one project-added notification must be delivered to the client — not two | P0 | Prevents duplicate sidebar entries or redundant fetches |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Compatibility | All changes must behave identically in development mode (hot-reload) and production mode (built and started) |
| NFR-2 | Resource management | Any new filesystem watchers introduced must be closed when the SSE connection is terminated; no watchers may persist beyond their client session |
| NFR-3 | Reliability | Existing state-change detection behavior must be unaffected; this change is purely additive |
| NFR-4 | Minimal footprint | No new external runtime dependencies may be introduced; the solution must use only capabilities already present in the application |
| NFR-5 | Scope of observation | Directory-level watching must be limited to the immediate children of the configured projects base directory; recursive subdirectory watching is not required and must be avoided |

## Assumptions

- The configured projects base directory exists on the filesystem when the application starts
- The existing live-update infrastructure (SSE transport, named event types for project-added and project-removed, client-side handlers) is already fully wired and operational — no client-side event-handling changes are needed
- Directory creation events are reliable and timely on both macOS and Linux hosts where this application runs
- Duplicate project-removed events for the same project are safe (idempotent) on the client side

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Directory-watch events fire an excessive number of times (event storm) when many projects are created in rapid succession | Medium | Rely on the existing per-project debounce mechanism, which coalesces multiple events for the same project into one notification |
| 2 | Both a directory-deletion event and a state-file-deletion event fire for the same project, causing redundant project-removed notifications | Low | Client-side handler for project-removed is idempotent; debounce coalesces rapid duplicates |
| 3 | The fetch caching issue is more severe in certain deployment environments and the server-side response headers alone are insufficient | Low | An explicit no-cache directive on the client-side fetch call is a simple, low-risk defensive measure |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Real-time project appearance | New project directory appears in sidebar within 500 ms of filesystem creation, with no user action | Manual test: create a project folder, observe sidebar update |
| Real-time project removal | Deleted project directory disappears from sidebar within 500 ms of filesystem deletion, with no user action | Manual test: delete a project folder, observe sidebar update |
| State-less project visibility | A project folder containing no state file appears in the sidebar via real-time update | Manual test: create an empty project folder, verify it appears |
| Refresh accuracy | A manual page refresh reflects the current filesystem state with no stale entries | Manual test: create a project, refresh the page without an SSE event, verify project appears |
| No resource leaks | Watcher handles are released on SSE disconnect | Verified via code review of cleanup path |
| No regressions | All existing state-change live-update behavior continues to work | Verified by running existing test suite (no new test infrastructure required) |
