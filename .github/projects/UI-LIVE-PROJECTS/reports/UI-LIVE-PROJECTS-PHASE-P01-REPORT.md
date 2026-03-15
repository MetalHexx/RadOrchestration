---
project: "UI-LIVE-PROJECTS"
phase: 1
phase_id: "P01"
phase_index: 0
title: "Live Project Detection"
status: "complete"
tasks_completed: 2
tasks_total: 2
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 1 Report: Live Project Detection

## Summary

Phase 1 delivered all user-visible live-update improvements in two surgical, purely-additive changes to exactly two files. A shallow chokidar directory watcher (`dirWatcher`, `depth: 0`) was added to the SSE route so newly created and deleted project directories now emit real-time `project_added` and `project_removed` events to all connected clients — including directory-only projects with no `state.json`. Both `fetch("/api/projects")` call sites in `use-projects.ts` were updated with `{ cache: "no-store" }` to ensure manual page refreshes always retrieve current filesystem state. Both tasks were approved with no issues found.

---

## Task Results

| # | Task | Status | Retries | Key Outcome |
|---|------|--------|---------|-------------|
| T01 | SSE Route — Shallow Directory Watcher | ✅ Complete | 0 | Added `dirWatcher` at `depth: 0` to `ui/app/api/events/route.ts`; `addDir`/`unlinkDir` handlers with root guard and debounce; `cleanup()` closes both watchers |
| T02 | Client Hook — Fetch Cache Fix | ✅ Complete | 0 | Added `{ cache: "no-store" }` to both `fetch("/api/projects")` call sites in `ui/hooks/use-projects.ts`; no other lines modified |

---

## Exit Criteria Assessment

| # | Criterion | Result |
|---|-----------|--------|
| 1 | A new directory created under `projects.base_path` triggers a `project_added` SSE event and the project appears in the sidebar within 500 ms, with no rebuild or manual refresh | ✅ Met |
| 2 | A directory deleted from `projects.base_path` triggers a `project_removed` SSE event and the project disappears from the sidebar within 500 ms | ✅ Met |
| 3 | A directory-only project (no `state.json`) appears with the `not_initialized` tier badge via real-time update | ✅ Met |
| 4 | When `addDir` and `add` (state.json) both fire within 300 ms for the same project, exactly one `project_added` event is delivered to the client | ✅ Met — debounce key is `path.basename(dirPath)`, matching the existing glob watcher key; coalescing is guaranteed by the shared 300 ms window |
| 5 | A manual page refresh always returns the current project list with no stale browser cache hit | ✅ Met — `{ cache: "no-store" }` applied to both fetch call sites (mount `useEffect` + `fetchProjectList` useCallback) |
| 6 | Closing the SSE connection closes both `watcher` and `dirWatcher` (verified via code review of `cleanup()`) | ✅ Met — code review confirmed `dirWatcher.close().catch(...)` is called alongside `watcher.close()` in the same `cleanup()` function |
| 7 | All pre-existing state-change (`state_change`, `project_added` via `add`, `project_removed` via `unlink`) live-update behavior is unaffected | ✅ Met — no pre-existing watcher event handlers were touched; code review confirmed |
| 8 | All tasks complete with status `complete` | ✅ Met — T01: complete, T02: complete |
| 9 | Phase review passed | ✅ Met — both tasks approved by reviewer; no issues found |
| 10 | Build passes (`next build` exits 0) | ✅ Met — confirmed in both task reports and code reviews |
| 11 | All existing tests pass (`npm test` exits 0) | ✅ Met — no test regressions; pre-existing `fsevents` warning on Windows is unrelated to this change |

---

## Files Changed (Phase Total)

| Action | Count | Key Files |
|--------|-------|-----------|
| Created | 0 | — |
| Modified | 2 | `ui/app/api/events/route.ts` (+29 lines, 177→209), `ui/hooks/use-projects.ts` (+2 lines) |

**Total lines added**: 31 across 2 files. No files deleted.

---

## Issues & Resolutions

_No issues found in either task or code review._

---

## Carry-Forward Items

_Phase 1 is the only phase. No carry-forward items for subsequent phases._

**Non-blocking observation from T01 code review** (logged for future awareness, not blocking):

- On Windows, chokidar may normalize watched paths to forward slashes while `absoluteProjectsDir` retains backslashes from `path.resolve()`. The root path guard (`dirPath === absoluteProjectsDir`) relies on string equality. In practice this is mitigated by `ignoreInitial: true` (the root `addDir` is suppressed at startup) and the fact that the root directory is never re-created at runtime. If this ever becomes an issue, a `path.normalize(dirPath) === path.normalize(absoluteProjectsDir)` comparison would be more robust.

---

## Master Plan Adjustment Recommendations

_No Master Plan adjustments required. The phase was executed exactly as specified — two files, two changes, all acceptance criteria met, no deviations._
