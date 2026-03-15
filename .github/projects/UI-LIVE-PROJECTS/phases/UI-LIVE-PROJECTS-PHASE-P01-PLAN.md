---
project: "UI-LIVE-PROJECTS"
phase: 1
phase_id: "P01"
phase_index: 0
title: "Live Project Detection"
status: "active"
total_tasks: 2
tasks:
  - id: "T01-SSE-DIR-WATCHER"
    title: "SSE Route — Shallow Directory Watcher"
  - id: "T02-FETCH-CACHE"
    title: "Client Hook — Fetch Cache Fix"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 1: Live Project Detection

## Phase Goal

Deliver all user-visible live-update improvements by making two surgical, purely-additive modifications to exactly two files: add a shallow chokidar directory watcher to the SSE route so newly created and deleted project directories trigger real-time sidebar updates, and add `{ cache: 'no-store' }` to both fetch call sites in the projects hook so a manual page refresh always returns current filesystem state.

---

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-LIVE-PROJECTS-MASTER-PLAN.md) | Phase 1 scope, task definitions, and all exit criteria |
| [Architecture](../UI-LIVE-PROJECTS-ARCHITECTURE.md) | `dirWatcher` contract, `addDir`/`unlinkDir`/`error` handler signatures, `cleanup()` modification, and `fetchProjectList` fetch call sites |
| [PRD](../UI-LIVE-PROJECTS-PRD.md) | FR-1–FR-5 (functional requirements), NFR-1–NFR-5 (non-functional requirements), user stories, and success metrics |
| [Research Findings](../UI-LIVE-PROJECTS-RESEARCH-FINDINGS.md) | Existing SSE route structure, chokidar usage, debounce implementation, `use-projects.ts` fetch pattern |
| `state.json` | `phase_review_action: null` (first phase — no corrective routing); `limits.max_tasks_per_phase` (2 tasks, within limits) |

---

## Task Outline

| # | Task | File Target | Dependencies | Est. Files | Handoff Doc |
|---|------|------------|--------------|-----------|-------------|
| T01 | SSE Route — Shallow Directory Watcher | `ui/app/api/events/route.ts` | — | 1 | [UI-LIVE-PROJECTS-TASK-P01-T01-SSE-DIR-WATCHER.md](../tasks/UI-LIVE-PROJECTS-TASK-P01-T01-SSE-DIR-WATCHER.md) |
| T02 | Client Hook — Fetch Cache Fix | `ui/hooks/use-projects.ts` | — | 1 | [UI-LIVE-PROJECTS-TASK-P01-T02-FETCH-CACHE.md](../tasks/UI-LIVE-PROJECTS-TASK-P01-T02-FETCH-CACHE.md) |

---

## Task Descriptions

### T01 — SSE Route: Shallow Directory Watcher

**File**: `ui/app/api/events/route.ts`  
**Action**: MODIFY

**What to do**:
- Declare `dirWatcher` using `chokidar.watch(absoluteProjectsDir, { depth: 0, ignoreInitial: true })` inside `start(controller)`, after the existing `watcher.on('error')` handler
- Register an `addDir` handler: guard against `dirPath === absoluteProjectsDir`; call `debouncedEmit(path.basename(dirPath), () => enqueue(createSSEEvent('project_added', { projectName })))`
- Register an `unlinkDir` handler: call `debouncedEmit(path.basename(dirPath), () => enqueue(createSSEEvent('project_removed', { projectName })))`
- Register an `error` handler: `console.error('[SSE] Chokidar dir watcher error:', err)` — mirrors existing watcher pattern
- Add `dirWatcher.close().catch(...)` inside `cleanup()` alongside the existing `watcher.close()` call

**Key constraints**:
- Use `depth: 0` and `ignoreInitial: true` — no deviation
- Debounce key must be `projectName` (same key used by existing `watcher.on('add')` and `watcher.on('unlink')`) to coalesce directory + state.json events into one SSE event
- `dirWatcher` must be declared in scope visible to both `start()` and `cleanup()` — follow the same scoping pattern as the existing `watcher`
- No new imports — `chokidar` and `path` are already imported

**Acceptance criteria** (binary):
- `addDir` fires → `project_added` SSE event emitted for that project name
- `unlinkDir` fires → `project_removed` SSE event emitted for that project name
- `addDir` fires for root (`absoluteProjectsDir`) → no event emitted (root guard)
- `addDir` and `add` (state.json) both fire within 300 ms for the same project → exactly one `project_added` emitted
- SSE disconnect → `cleanup()` closes both `watcher` and `dirWatcher`
- All pre-existing watcher behavior unaffected

---

### T02 — Client Hook: Fetch Cache Fix

**File**: `ui/hooks/use-projects.ts`  
**Action**: MODIFY

**What to do**:
- Add `{ cache: 'no-store' }` as the second argument to the `fetch("/api/projects")` call inside `fetchProjectList` useCallback
- Add `{ cache: 'no-store' }` as the second argument to the `fetch("/api/projects")` call inside the mount `useEffect`'s inner `fetchProjects()` function
- No other changes to this file

**Key constraints**:
- Exactly two `fetch` call sites must be updated — no more, no less
- No logic, state, structure, or other code in this file may be changed

**Acceptance criteria** (binary):
- Both `fetch("/api/projects")` call sites include `{ cache: 'no-store' }`
- No other lines in `use-projects.ts` are modified

---

## Execution Order

```
T01 (SSE Route — Shallow Directory Watcher)
T02 (Client Hook — Fetch Cache Fix)
```

Both tasks are **parallel-ready** — they target different files with zero cross-task dependencies. T01 is listed first by convention; T02 may be executed concurrently in future pipeline versions.

**Sequential execution order**: T01 → T02

*Note: T01 and T02 are parallel-ready (no mutual dependency) but execute sequentially in v1.*

---

## Phase Exit Criteria

From Master Plan Phase 1 exit criteria:

- [ ] A new directory created under `projects.base_path` triggers a `project_added` SSE event and the project appears in the sidebar within 500 ms, with no rebuild or manual refresh
- [ ] A directory deleted from `projects.base_path` triggers a `project_removed` SSE event and the project disappears from the sidebar within 500 ms
- [ ] A directory-only project (no `state.json`) appears with the `not_initialized` tier badge via real-time update
- [ ] When `addDir` and `add` (state.json) both fire within 300 ms for the same project, exactly one `project_added` event is delivered to the client
- [ ] A manual page refresh always returns the current project list with no stale browser cache hit
- [ ] Closing the SSE connection closes both `watcher` and `dirWatcher` (verified via code review of `cleanup()`)
- [ ] All pre-existing state-change (`state_change`, `project_added` via `add`, `project_removed` via `unlink`) live-update behavior is unaffected

Standard criteria:

- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes (`next build` exits 0)
- [ ] All existing tests pass (`npm test` exits 0)

---

## Known Risks for This Phase

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | `dirWatcher` variable scope — if declared inside a block that `cleanup()` cannot reach, `dirWatcher.close()` will fail at runtime | High | Declare `dirWatcher` at the same lexical scope as the existing `watcher` variable — mirror the exact scoping pattern |
| 2 | chokidar emits `addDir` for the watched root directory itself in some filesystem/OS edge cases | Medium | Root path guard (`if (dirPath === absoluteProjectsDir) return`) is required and must not be omitted |
| 3 | Debounce key mismatch — if `dirWatcher` uses a different debounce key from the existing glob watcher, `addDir` + `add` events for the same project will not be coalesced and two `project_added` events will reach the client | High | Use `projectName` (i.e., `path.basename(dirPath)`) as the debounce key — identical to the existing pattern |
| 4 | `fetch` call sites in `use-projects.ts` — only one of the two sites is updated, leaving one code path still cache-vulnerable | Medium | Code review must verify both the `fetchProjectList` useCallback and the mount `useEffect`'s inner `fetchProjects()` function are updated |
