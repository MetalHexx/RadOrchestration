---
project: "UI-LIVE-PROJECTS"
phase: 1
phase_id: "P01"
phase_index: 0
title: "Live Project Detection"
verdict: "approved"
severity: "none"
exit_criteria_met: true
author: "reviewer-agent"
created: "2026-03-15"
---

# Phase Review: Phase 1 — Live Project Detection

## Verdict: APPROVED

## Summary

Phase 1 delivered all functional requirements in two surgical, purely-additive changes to exactly two files. The shallow chokidar directory watcher (`dirWatcher`) in `ui/app/api/events/route.ts` integrates correctly with the cache-fix in `ui/hooks/use-projects.ts`: directory events flow from `addDir`/`unlinkDir` → SSE `project_added`/`project_removed` → hook's `handleSSEEvent` → `fetchProjectList()` with `{ cache: "no-store" }` — the complete end-to-end live update path is sound. All 11 phase exit criteria are verified against the source code, the build passes cleanly, and all tests pass (7/7 path-resolver, 36/36 sample-app). No cross-task conflicts, no orphaned code, no regressions.

---

## Integration Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Modules integrate correctly | ✅ | T01 emits `project_added`/`project_removed` via SSE; T02's `fetchProjectList()` with `no-store` is called by the `project_added` handler — the two changes compose cleanly through the existing SSE event dispatch path |
| No conflicting patterns | ✅ | Both tasks follow pre-existing code patterns exactly: T01 mirrors the existing `watcher` pattern; T02 uses the same `RequestInit` shape already present in the file |
| Contracts honored across tasks | ✅ | SSE payload shape (`{ projectName: string }`) is unchanged; `fetchProjectList` useCallback interface is unchanged; Architecture's `dirWatcher` contract is honored verbatim |
| No orphaned code | ✅ | Zero dead code, no unused imports, no leftover scaffolding; both diffs are strictly additive |

### End-to-End Integration Flow (verified)

**Directory creation path**:
1. `dirWatcher.on('addDir', (dirPath))` fires → root guard passes → `debouncedEmit(path.basename(dirPath), ...)` called with 300 ms window
2. After 300 ms (or coalesced with `watcher.on('add')` for the same project name within the window) → `enqueue(createSSEEvent('project_added', { projectName }))` writes to stream
3. Client `handleSSEEvent` receives `project_added` → hits the `case "project_added"` branch → calls `fetchProjectList()`
4. `fetchProjectList` calls `fetch("/api/projects", { cache: "no-store" })` — bypasses browser cache, returns current filesystem state including the new directory-only project
5. `setProjects(data.projects)` updates sidebar

**Directory deletion path**:
1. `dirWatcher.on('unlinkDir', (dirPath))` fires → root guard passes → `debouncedEmit(projectName, ...)` (coalesces with `watcher.on('unlink')` for state.json removal if within 300 ms)
2. `enqueue(createSSEEvent('project_removed', { projectName }))` writes to stream
3. Client `handleSSEEvent` receives `project_removed` → removes project from local state directly (no re-fetch needed)

**Debounce coalescing** (FR-5 verification): Both `dirWatcher.on('addDir')` (T01) and the pre-existing `watcher.on('add')` use `path.basename(dirPath)` and `extractProjectName(filePath, absoluteProjectsDir)` respectively — both resolve to the same project folder name, so they share the same debounce timer slot. A near-simultaneous `addDir` + `add` (state.json) pair within 300 ms is guaranteed to coalesce into a single `project_added` event.

---

## Exit Criteria Verification

| # | Criterion | Verified | Evidence |
|---|-----------|----------|---------|
| 1 | New directory triggers `project_added` SSE and appears in sidebar within 500 ms (no rebuild) | ✅ | `dirWatcher.on('addDir')` at `depth: 0`, 300 ms debounce; `ignoreInitial: true` prevents startup noise |
| 2 | Deleted directory triggers `project_removed` SSE and disappears within 500 ms | ✅ | `dirWatcher.on('unlinkDir')` with 300 ms debounce confirmed in code |
| 3 | Directory-only project (no `state.json`) appears with `not_initialized` tier | ✅ | `project_added` → `fetchProjectList()` → `GET /api/projects` → `discoverProjects()` already returns `{ hasState: false, tier: 'not_initialized' }` for state-less dirs; `PipelineTierBadge` unchanged |
| 4 | `addDir` + `add`(state.json) within 300 ms → exactly one `project_added` | ✅ | Shared debounce key `projectName` (= `path.basename(dirPath)`) confirmed in both `dirWatcher.on('addDir')` and existing `watcher.on('add')` handlers |
| 5 | Manual page refresh returns current list without stale cache hit | ✅ | `{ cache: "no-store" }` present at both fetch sites: `fetchProjectList` useCallback (line 43) and `fetchProjects` inner function inside mount `useEffect` (line 141) |
| 6 | SSE disconnect closes both `watcher` and `dirWatcher` | ✅ | `cleanup()` calls both `watcher.close().catch(...)` and `dirWatcher.close().catch(...)` sequentially; `closed` flag prevents double-cleanup |
| 7 | All pre-existing state-change live-update behavior unaffected | ✅ | `change`, `add`, `unlink`, `heartbeat`, `connected` handlers and all pre-existing hook logic are untouched; both diffs are purely additive |
| 8 | All tasks complete with status `complete` | ✅ | T01 status: complete; T02 status: complete (task reports confirmed) |
| 9 | Phase review passed | ✅ | T01 code review: `approved`; T02 code review: `approved`; no issues in either |
| 10 | Build passes (`next build` exits 0) | ✅ | Freshly verified — `next build` completes with zero TypeScript errors; all routes compile cleanly |
| 11 | All existing tests pass (`npm test` exits 0) | ✅ | `path-resolver.test.mjs`: 7/7 passing; `rainbow-hello` suite: 36/36 passing; no regressions |

---

## Cross-Task Issues

_No cross-task issues found._ The two tasks target independent files (`ui/app/api/events/route.ts` and `ui/hooks/use-projects.ts`) with zero shared code paths. Integration occurs strictly through the SSE wire protocol and the existing `handleSSEEvent` dispatch table — no modification to shared infrastructure.

---

## PRD Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| FR-1 | SSE route detects new directory under `projects.base_path` → emits `project_added` | ✅ `dirWatcher.on('addDir')` |
| FR-2 | SSE route detects directory deletion → emits `project_removed` | ✅ `dirWatcher.on('unlinkDir')` |
| FR-3 | Both `fetch("/api/projects")` call sites bypass browser cache | ✅ `{ cache: "no-store" }` on both sites |
| FR-4 | All new watcher resources released on SSE disconnect | ✅ `dirWatcher.close()` in `cleanup()` via `request.signal` abort |
| FR-5 | Near-simultaneous `addDir` + `add`(state.json) → single `project_added` | ✅ Shared debounce key and 300 ms window |

---

## Security Assessment

No new attack surface introduced:
- **No user-controlled input** in new code paths; both handlers receive filesystem paths from the chokidar OS layer
- **`path.basename()`** strips path components — even if chokidar reported a malformed path, only the final segment (project folder name) propagates to the SSE payload
- **`cache: "no-store"`** is a client-side fetch cache directive on a read-only `GET` endpoint — no security implications
- **Resource cleanup** is complete — no fd leaks possible; the `closed` guard in `cleanup()` prevents double-close

One non-blocking observation (carried forward from T01 code review): on Windows, chokidar may normalize paths to forward slashes while `absoluteProjectsDir` retains backslashes from `path.resolve()`. The root path guard uses string equality (`dirPath === absoluteProjectsDir`). In practice this is a non-issue because `ignoreInitial: true` suppresses the root `addDir` at startup and the root is never re-created at runtime. A `path.normalize()` comparison would be more robust if this ever needs hardening.

---

## Test & Build Summary

- **Build**: ✅ Pass — `next build` exits 0, zero TypeScript errors
- **path-resolver tests**: 7 / 7 passing
- **rainbow-hello sample-app tests**: 36 / 36 passing
- **Coverage**: No automated unit tests for the modified files (handoffs scoped verification to build + runtime); existing test suite is unaffected

---

## Recommendations for Next Phase

This is the only phase in the project (single-phase plan). No carry-forward items for subsequent phases.

**Non-blocking hardening opportunity** (future consideration, not required): Replace the `unlinkDir`/`addDir` root path guard's string equality check with `path.normalize(dirPath) === path.normalize(absoluteProjectsDir)` to be fully robust on Windows where chokidar may normalize path separators differently from `path.resolve()`. Current behavior is safe in practice but a future Node.js or chokidar upgrade could expose the edge case.
