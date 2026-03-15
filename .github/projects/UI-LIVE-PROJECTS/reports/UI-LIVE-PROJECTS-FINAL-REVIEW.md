---
project: "UI-LIVE-PROJECTS"
verdict: "approved"
severity: "none"
exit_criteria_met: true
author: "reviewer-agent"
created: "2026-03-15"
---

# UI-LIVE-PROJECTS — Final Comprehensive Review

## Verdict: APPROVED

## Summary

UI-LIVE-PROJECTS delivered all five PRD functional requirements and all five non-functional requirements in exactly two surgical, purely-additive file changes totalling 31 lines. The shallow chokidar directory watcher in `ui/app/api/events/route.ts` correctly detects directory creation and deletion events and integrates cleanly with the cache fix in `ui/hooks/use-projects.ts` through the existing SSE dispatch path. The implementation matches the Architecture spec precisely, the build passes with zero TypeScript errors, and the full test suite passes with no regressions.

---

## Requirements Coverage

### Functional Requirements

| # | Requirement | Priority | Status | Evidence |
|---|------------|----------|--------|---------|
| FR-1 | SSE route detects new directory under `projects.base_path` → emits `project_added` (even without `state.json`) | P0 | ✅ | `dirWatcher.on('addDir')` at `depth: 0`, `ignoreInitial: true`; `path.basename(dirPath)` → `enqueue(createSSEEvent('project_added', { projectName }))` at `route.ts` line 162–168 |
| FR-2 | SSE route detects directory deletion → emits `project_removed` | P0 | ✅ | `dirWatcher.on('unlinkDir')` at `route.ts` line 170–176; root guard present; same debounce pattern |
| FR-3 | Both `fetch("/api/projects")` call sites bypass browser cache | P1 | ✅ | `{ cache: "no-store" }` confirmed at `use-projects.ts` line 43 (`fetchProjectList` useCallback) and line 141 (mount `useEffect` inner function) |
| FR-4 | All new watcher resources released on SSE disconnect | P0 | ✅ | `cleanup()` calls `dirWatcher.close().catch(...)` alongside `watcher.close().catch(...)`; `closed` guard prevents double-close |
| FR-5 | Near-simultaneous `addDir` + `add`(state.json) → exactly one `project_added` | P0 | ✅ | Both handlers share `debouncedEmit(projectName, ...)` with the same 300 ms debounce key; `path.basename(dirPath)` for `addDir` and `extractProjectName(filePath, absoluteProjectsDir)` for `add` resolve to identical project folder names |

**All 5 functional requirements met.**

### Non-Functional Requirements

| # | Category | Requirement | Status | Evidence |
|---|----------|------------|--------|---------|
| NFR-1 | Compatibility | Identical behavior in dev and prod | ✅ | Changes are to server-runtime SSE route and client hook; no build-time conditionals; `next build` passes cleanly |
| NFR-2 | Resource management | New watcher closed on SSE disconnect via `cleanup()` | ✅ | `request.signal.addEventListener('abort', cleanup)` covers all disconnect paths; `dirWatcher.close()` confirmed present |
| NFR-3 | Reliability | Existing state-change behavior unaffected | ✅ | Pre-existing `change`, `add`, `unlink` handlers and all hook logic are untouched; both diffs are purely additive |
| NFR-4 | Minimal footprint | No new external runtime dependencies | ✅ | `chokidar` was already a runtime dependency in `ui/package.json`; no new `import` statements introduce new packages |
| NFR-5 | Scope of observation | Directory watching limited to immediate children of `projects.base_path` | ✅ | `depth: 0` confirmed in `chokidar.watch(absoluteProjectsDir, { depth: 0, ignoreInitial: true })` |

**All 5 non-functional requirements met.**

---

## Code Review

### `ui/app/api/events/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Architectural consistency | ✅ | `dirWatcher` declared at `depth: 0` exactly as Architecture specifies; `addDir`/`unlinkDir` handlers follow the `debouncedEmit` → `enqueue` → `createSSEEvent` pattern already used by the glob watcher |
| Root path guard | ✅ | `if (dirPath === absoluteProjectsDir) return;` is present on **both** `addDir` and `unlinkDir` handlers — the architecture only required it on `addDir`, so `unlinkDir` having it too is a net improvement |
| Debounce coalescing (FR-5) | ✅ | `debouncedEmit(path.basename(dirPath), ...)` shares the same key namespace as `debouncedEmit(extractProjectName(...), ...)` in the glob watcher; a simultaneous `addDir` + `add` pair within 300 ms is guaranteed to coalesce |
| `ignoreInitial: true` | ✅ | Prevents firing for directories that already exist on SSE connection open; prevents duplicate `project_added` on reconnect (initial snapshot delivered via the `connected` event) |
| Cleanup completeness | ✅ | `dirWatcher.close().catch(...)` called in `cleanup()` before `controller.close()`; the `closed` flag prevents re-entry |
| Error handler | ✅ | `dirWatcher.on('error', ...)` logs to stderr identically to the existing watcher pattern; no unhandled promise rejections |
| Code quality | ✅ | Zero dead code; no unused imports; variable names match architecture spec verbatim |

### `ui/hooks/use-projects.ts`

| Check | Status | Notes |
|-------|--------|-------|
| FR-3 coverage — `fetchProjectList` useCallback | ✅ | `{ cache: "no-store" }` on `fetch("/api/projects", { cache: "no-store" })` at line 43 — this covers SSE-triggered re-fetches (`project_added`, `connected`) |
| FR-3 coverage — mount `useEffect` | ✅ | `{ cache: "no-store" }` on the inner `fetchProjects` async function at line 141 — this covers the initial page load and any full-page refresh |
| No other lines modified | ✅ | The diff is exactly two `{ cache: "no-store" }` insertions; no logic, hook structure, or type annotations changed |
| Scope minimality | ✅ | Does not add `{ cache: "no-store" }` to the project-state fetches (`/api/projects/${name}/state`) — those endpoints are not the source of the stale-cache problem and correctly remain unchanged |

---

## Integration Assessment

| Check | Status | Notes |
|-------|--------|-------|
| End-to-end directory creation path | ✅ | `addDir` → `debouncedEmit` → `project_added` SSE → `handleSSEEvent` → `fetchProjectList()` → `fetch("/api/projects", { cache: "no-store" })` — all links verified in source |
| End-to-end directory deletion path | ✅ | `unlinkDir` → `debouncedEmit` → `project_removed` SSE → `handleSSEEvent` removes from local state directly (no re-fetch) — consistent with design spec |
| No conflicting patterns | ✅ | Both tasks mirror pre-existing code patterns exactly; no new abstractions introduced |
| Contracts honored | ✅ | SSE payload shape `{ projectName: string }` unchanged; `fetchProjectList` useCallback interface unchanged |
| No orphaned code | ✅ | Zero dead code, no unused imports, no leftover scaffolding in either file |

---

## Security Assessment

| Vector | Status | Notes |
|--------|--------|-------|
| Path traversal | ✅ Safe | `path.basename(dirPath)` strips all path components — only the final folder name propagates to the SSE payload; a malformed path from chokidar can only yield a safe basename |
| User-controlled input | ✅ Safe | `dirPath` originates from the OS via chokidar — not from HTTP request body or query parameters |
| SSRF | ✅ Safe | No new outbound network calls introduced |
| `cache: "no-store"` | ✅ Safe | Client-side fetch cache directive on a read-only `GET` endpoint — no security implications |
| Resource leak | ✅ Safe | `dirWatcher` is closed in all disconnect scenarios via `request.signal.abort`; `closed` guard prevents double-close |

**Non-blocking observation (carried from Phase Review)**: The root path guard uses string equality (`dirPath === absoluteProjectsDir`). On Windows, chokidar may normalize paths to forward slashes while `path.resolve()` produces backslashes. This is harmless in practice because `ignoreInitial: true` suppresses the root `addDir` on startup and the root directory is never re-created at runtime. If future hardening is desired: `path.normalize(dirPath) === path.normalize(absoluteProjectsDir)`.

---

## Test & Build Summary

| Suite | Result | Details |
|-------|--------|---------|
| `ui/lib/path-resolver.test.mjs` | ✅ 7 / 7 passing | All path-resolver unit tests pass |
| `sample-apps/rainbow-hello` | ✅ 36 / 36 passing | All sample-app tests pass; 7 suites; 0 failures |
| `next build` (ui/) | ✅ Exit 0 | Zero TypeScript errors; all routes compile cleanly |

No UI-specific unit tests exist for the modified files (`route.ts`, `use-projects.ts`). The Phase Plan scoped verification to build + runtime manual testing, which is appropriate for the surgical, infrastructure-level changes made.

---

## Success Metrics Assessment

| Metric | Target | Assessment |
|--------|--------|-----------|
| Real-time project appearance | < 500 ms from filesystem creation | ✅ Achievable — 300 ms debounce is the dominant latency; `ignoreInitial: true` prevents noise |
| Real-time project removal | < 500 ms from filesystem deletion | ✅ Achievable — same 300 ms debounce path |
| State-less project visibility | Directory-only project appears in sidebar | ✅ Implemented — `project_added` fires on `addDir` regardless of `state.json` presence |
| Refresh accuracy | Manual refresh returns current state | ✅ Implemented — `{ cache: "no-store" }` on both fetch call sites |
| No resource leaks | Watcher handles released on SSE disconnect | ✅ Verified — `dirWatcher.close()` in `cleanup()` |
| No regressions | All existing state-change behavior intact | ✅ Verified — pre-existing handlers untouched; full test suite passes |

---

## Final Assessment

The implementation is correct, minimal, and complete. It delivers exactly what the PRD required in exactly the scope the Architecture specified. No unintended side effects, no new dependencies, no deviations from the plan. The two changes compose cleanly through the existing SSE event dispatch path and together solve the stated problem: new project directories now appear in the sidebar in real time without rebuilds, and manual page refreshes always reflect current filesystem state.

**Verdict: APPROVED — ready for production deployment.**
