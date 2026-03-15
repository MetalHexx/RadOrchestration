---
project: "UI-LIVE-PROJECTS"
total_phases: 1
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Master Plan

## Executive Summary

The orchestration monitoring UI currently requires a full application rebuild (`next build && next start`) to display newly created project folders in the sidebar. This occurs because the existing chokidar watcher only observes `state.json` files — it is blind to directory creation and deletion events, leaving directory-only projects (common at the brainstorming stage) permanently invisible until a rebuild. The fix is two surgical, purely-additive changes to exactly two files: a shallow `chokidar` directory watcher is added to the SSE route (`ui/app/api/events/route.ts`) to emit `project_added` and `project_removed` events when project folders appear or disappear under `projects.base_path`, and `{ cache: 'no-store' }` is added to both `fetch("/api/projects")` call sites in `ui/hooks/use-projects.ts` to guarantee a manual page refresh always returns current filesystem state. No new dependencies, modules, types, or UI components are introduced.

---

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [UI-LIVE-PROJECTS-BRAINSTORMING.md](.github/projects/UI-LIVE-PROJECTS/UI-LIVE-PROJECTS-BRAINSTORMING.md) | ✅ |
| Research | [UI-LIVE-PROJECTS-RESEARCH-FINDINGS.md](.github/projects/UI-LIVE-PROJECTS/UI-LIVE-PROJECTS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [UI-LIVE-PROJECTS-PRD.md](.github/projects/UI-LIVE-PROJECTS/UI-LIVE-PROJECTS-PRD.md) | ✅ |
| Design | [UI-LIVE-PROJECTS-DESIGN.md](.github/projects/UI-LIVE-PROJECTS/UI-LIVE-PROJECTS-DESIGN.md) | ✅ |
| Architecture | [UI-LIVE-PROJECTS-ARCHITECTURE.md](.github/projects/UI-LIVE-PROJECTS/UI-LIVE-PROJECTS-ARCHITECTURE.md) | ✅ |

---

## Key Requirements (from PRD)

Critical P0 functional requirements that drive execution:

- **FR-1**: The SSE route must detect new project directory creation under `projects.base_path` and emit `project_added { projectName }` to all connected clients — even when the directory contains no `state.json`
- **FR-2**: The SSE route must detect project directory deletion and emit `project_removed { projectName }` — including directories that never had a `state.json`
- **FR-4**: All new filesystem watcher resources must be fully released when the SSE client disconnects — no handles may persist beyond their client session
- **FR-5**: When a new directory and its `state.json` appear within close temporal proximity, exactly one `project_added` notification must reach the client — no duplicates

Critical P1 functional requirement:

- **FR-3**: Both `fetch("/api/projects")` call sites in `use-projects.ts` must bypass the browser HTTP cache (`{ cache: 'no-store' }`) so a manual page refresh always reflects the current filesystem

Critical non-functional requirements:

- **NFR-2**: New watchers must be closed in `cleanup()` via the existing `request.signal.addEventListener('abort', cleanup)` pathway — covering all disconnect scenarios
- **NFR-4**: No new external runtime dependencies — the fix must use only `chokidar`, which is already a runtime dependency in `ui/package.json`
- **NFR-5**: Directory watching must be limited to immediate children of `projects.base_path` only (`depth: 0`) — no recursive subdirectory watching

---

## Key Technical Decisions (from Architecture)

Architectural decisions that constrain implementation:

- **Shallow watcher at `depth: 0`**: `chokidar.watch(absoluteProjectsDir, { depth: 0, ignoreInitial: true })` — limits observation to direct subdirectories only, satisfying NFR-5 and preventing event storms from deep project subdirectory activity
- **Shared debounce key (`projectName`)**: Both the existing glob watcher and the new directory watcher use the same `debouncedEmit(projectName, callback)` function with a 300 ms window; when `addDir` and `add` (state.json) both fire within 300 ms for the same project, the debounce coalesces them into a single `project_added` event (FR-5)
- **Root path guard on `addDir`**: The handler skips events where `dirPath === absoluteProjectsDir` since chokidar may emit `addDir` for the watched root itself in edge cases
- **`cleanup()` closes both watchers**: `dirWatcher.close().catch(...)` is added alongside the existing `watcher.close().catch(...)` — both close in the same `cleanup()` call, satisfying FR-4 and NFR-2
- **Two `fetch` call sites, not one**: `use-projects.ts` has two independent `fetch("/api/projects")` calls (mount `useEffect` and `fetchProjectList` useCallback) — both must receive `{ cache: 'no-store' }` to cover all code paths
- **No new files, no new types**: `project_added` and `project_removed` SSE payload types are already defined in `ui/types/events.ts`; the existing `formatSSE()` and `createSSEEvent()` utilities handle the wire format — nothing new is needed

---

## Key Design Constraints (from Design)

Design decisions that constrain implementation:

- **Zero visual changes**: This project is purely behavioral — no new components, layout changes, design tokens, or badge variants are introduced; the sidebar continues to look and function identically
- **`not_initialized` tier already supported**: `discoverProjects()` already returns `{ hasState: false, tier: 'not_initialized' }` for directories without `state.json`; `PipelineTierBadge` already renders this tier — no new states are needed for directory-only project display
- **Client removes on `project_removed` without re-fetch**: The existing `project_removed` handler in `use-projects.ts` removes the project from in-memory state directly — no network round-trip; the fix does not change this behavior
- **Client re-fetches on `project_added`**: The existing `project_added` handler re-fetches `/api/projects` to get the full project summary including `tier` and `hasState` — the `{ cache: 'no-store' }` fix directly benefits this flow
- **SSE reconnect behavior unchanged**: `use-sse.ts` exponential-backoff reconnect and the `connected` event's directory snapshot restore sidebar accuracy on reconnect — no changes to this path
- **`ignoreInitial: true` required**: The directory watcher must not fire for pre-existing directories on SSE connection open; the initial project list is already delivered via the `connected` event payload to prevent duplicate `project_added` events on reconnect

---

## Phase Outline

### Phase 1: Live Project Detection

**Goal**: Deliver all user stories (real-time project appearance, real-time removal, stale-cache fix) in a single atomic phase by modifying exactly two files.

**Scope**:
- Add shallow chokidar directory watcher to SSE route — refs: [FR-1](UI-LIVE-PROJECTS-PRD.md#functional-requirements), [FR-2](UI-LIVE-PROJECTS-PRD.md#functional-requirements), [FR-4](UI-LIVE-PROJECTS-PRD.md#functional-requirements), [FR-5](UI-LIVE-PROJECTS-PRD.md#functional-requirements), [Architecture: dirWatcher contract](UI-LIVE-PROJECTS-ARCHITECTURE.md#contracts--interfaces)
- Add `{ cache: 'no-store' }` to both project list fetch call sites — refs: [FR-3](UI-LIVE-PROJECTS-PRD.md#functional-requirements), [Architecture: Modified fetchProjectList](UI-LIVE-PROJECTS-ARCHITECTURE.md#modified-fetchprojectlist--use-projectsts)

**Tasks**:
- **Task 1** — `ui/app/api/events/route.ts`: Declare `dirWatcher` with `depth: 0`; register `addDir`, `unlinkDir`, and `error` handlers; add `dirWatcher.close()` to `cleanup()`
- **Task 2** — `ui/hooks/use-projects.ts`: Add `{ cache: 'no-store' }` to `fetchProjectList` useCallback fetch and mount `useEffect` fetch

**Exit Criteria**:
- [ ] A new directory created under `projects.base_path` triggers a `project_added` SSE event and the project appears in the sidebar within 500 ms, with no rebuild or manual refresh
- [ ] A directory deleted from `projects.base_path` triggers a `project_removed` SSE event and the project disappears from the sidebar within 500 ms
- [ ] A directory-only project (no `state.json`) appears with the `not_initialized` tier badge via real-time update
- [ ] When `addDir` and `add` (state.json) both fire within 300 ms for the same project, exactly one `project_added` event is delivered to the client
- [ ] A manual page refresh always returns the current project list with no stale browser cache hit
- [ ] Closing the SSE connection closes both `watcher` and `dirWatcher` (verified via code review of `cleanup()`)
- [ ] All pre-existing state-change (`state_change`, `project_added` via `add`, `project_removed` via `unlink`) live-update behavior is unaffected

**Phase Doc**: [phases/UI-LIVE-PROJECTS-PHASE-01-LIVE-PROJECT-DETECTION.md](.github/projects/UI-LIVE-PROJECTS/phases/UI-LIVE-PROJECTS-PHASE-01-LIVE-PROJECT-DETECTION.md) *(created at execution time)*

---

## Execution Constraints

- **Total phases**: 1
- **Total tasks**: 2 (Task 1: SSE route; Task 2: projects hook)
- **Max phases**: 10 (from `orchestration.yml`)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Git strategy**: `single_branch` — sequential commits with `[orch]` prefix (from `orchestration.yml`)
- **Human gates**: Required after planning (this document) and after final review (from `orchestration.yml`)
- **Execution mode**: `ask` — confirm at start of each phase (from `orchestration.yml`)

---

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| `addDir` event fires for the watched root directory itself (`absoluteProjectsDir`) in certain chokidar 3.x edge cases | Low — would emit a spurious `project_added` with an empty or incorrect project name | Guard: `if (dirPath === absoluteProjectsDir) return` in `addDir` handler (already in Architecture) | Coder |
| Directory-watch events fire an excessive number of times when many projects are created in rapid succession | Medium — excessive SSE emissions and client re-fetches | Per-project debounce (300 ms, shared with existing watcher) coalesces multiple events per project into one | Coder |
| Both `unlinkDir` (directory) and `unlink` (state.json) fire for the same project deletion, causing duplicate `project_removed` events | Low — client-side `project_removed` handler is idempotent; debounce coalesces within 300 ms window | Shared debounce key (`projectName`) ensures single emission; client handles duplicates safely | Coder |
| `{ cache: 'no-store' }` fix is insufficient in certain deployment environments where server-side response headers override client intent | Low — `force-dynamic` is already set on the projects route; `cache: 'no-store'` on the client is a belt-and-suspenders defensive measure | Acceptable residual risk — `force-dynamic` + `no-store` together cover all known Next.js 14 cache layers | Coder |
| `dirWatcher.close()` is not called if `cleanup()` execution is short-circuited (e.g., `closed` guard fires before `dirWatcher` is assigned) | Low — `dirWatcher` is declared in the same scope as `watcher`; both are in scope when `cleanup()` is called | Declare `dirWatcher` before registering the abort listener; verify in code review | Reviewer |
