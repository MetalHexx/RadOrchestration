---
project: "UI-LIVE-PROJECTS"
phase: 1
phase_id: "P01"
task_id: "P01-T01"
task: 1
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-15T00:00:00.000Z"
---

# Code Review: Phase 1, Task 1 — SSE Route — Shallow Directory Watcher

## Verdict: APPROVED

## Summary

The implementation exactly matches the Task Handoff specification. A second chokidar watcher (`dirWatcher`) is declared at `depth: 0` with `ignoreInitial: true`, root path guards are present on both `addDir` and `unlinkDir`, the debounce key is `path.basename(dirPath)`, and `dirWatcher.close()` is correctly called in `cleanup()`. All pre-existing watcher behavior is untouched. The build and TypeScript type-check pass with no errors or warnings attributable to this change.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | `dirWatcher` added exactly as specified in the Architecture's module map for `app/api/events/route.ts`; no new modules, types, or dependencies introduced |
| Design consistency | ✅ | N/A — server-side only change; no UI components touched |
| Code quality | ✅ | Follows existing code style precisely: `// ──` section comments, `(error: Error)` typing, `.catch()` error logging pattern, section numbering renumbered correctly (3 → 4 → 5) |
| Test coverage | ⚠️ | No automated unit tests added; the handoff explicitly scoped coverage to `next build` + manual/runtime verification — acceptable for this task |
| Error handling | ✅ | `dirWatcher.on('error', ...)` mirrors the existing `watcher` error handler; `cleanup()` closes both watchers; `closed` flag guard prevents double-cleanup |
| Accessibility | ✅ | N/A — server-side route change only |
| Security | ✅ | No user input, no path traversal, no exposed secrets; `path.basename()` safely extracts the project name from chokidar-provided paths |

## Issues Found

_No issues found._

## Positive Observations

- **Specification fidelity**: All 9 acceptance criteria from the Task Handoff are met verbatim — `depth: 0`, `ignoreInitial: true`, root path guards on both event types, `path.basename(dirPath)` as debounce key, `dirWatcher.close()` in `cleanup()`.
- **Debounce coalescing is correct**: Using `path.basename(dirPath)` as the debounce key means a near-simultaneous `addDir` + file-watcher `add` (for `state.json`) within 300 ms on the same project name will coalesce into a single `project_added` emission — exactly the intended behaviour.
- **Minimal footprint**: Only `ui/app/api/events/route.ts` was modified (+29 lines), with no collateral changes anywhere else in the codebase.
- **Cleanup is complete**: Both `watcher` and `dirWatcher` are always closed together in the single `cleanup()` call, tied to `request.signal.abort` — no resource leak path exists.
- **Error handler added**: A `dirWatcher.on('error', ...)` handler was included (matching the existing `watcher` pattern), providing observability for OS-level filesystem watch errors on the directory watcher.

## Recommendations

- **For the Planner**: Task P01-T01 is complete. Advance to P01-T02 (the `use-projects.ts` `cache: 'no-store'` change) as planned.
- **Future consideration (non-blocking)**: On Windows, chokidar may normalize watched paths to forward slashes while `absoluteProjectsDir` retains backslashes from `path.resolve`. The root path guard (`dirPath === absoluteProjectsDir`) relies on string equality. In practice this is mitigated by `ignoreInitial: true` (the root `addDir` is suppressed at startup) and the fact that the root directory is never re-created at runtime. Should this ever become an issue, a `path.normalize(dirPath) === path.normalize(absoluteProjectsDir)` comparison would be more robust.
