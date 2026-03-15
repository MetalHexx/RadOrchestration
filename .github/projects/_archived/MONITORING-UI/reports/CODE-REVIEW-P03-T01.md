---
project: "MONITORING-UI"
phase: 3
task: "P03-T01"
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-10T00:00:00Z"
---

# Code Review: Phase 3, Task 1 — SSE API Endpoint

## Verdict: APPROVED

## Summary

The SSE endpoint implementation is clean, well-structured, and faithfully follows the Task Handoff contracts and patterns. Both files match the architectural module map, honor the prescribed SSE wire format, and use the correct utility imports. The endpoint correctly uses the App Router `ReadableStream` pattern, implements per-project debounce, handles all three chokidar events, sends heartbeats, and cleans up all resources on disconnect with a double-close guard. TypeScript compilation, ESLint, and build all pass with zero errors.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | `api-events` module at `ui/app/api/events/route.ts` matches Architecture module map (Infrastructure layer). Imports `getWorkspaceRoot`, `resolveBasePath`, `readConfig`, `normalizeState` from the correct modules. |
| Design consistency | ✅ | N/A — server-side API endpoint, no UI rendering. |
| Code quality | ✅ | Clean structure with well-separated concerns: SSE helpers, path helpers, route handler. Proper use of closures, guard flags, and defensive try/catch. Code follows existing project patterns. |
| Test coverage | ⚠️ | 0 unit tests — acknowledged in Task Report. The endpoint requires integration-level testing (running server + filesystem mutations) which is outside the scope of this task. Verified via `tsc --noEmit`, `npm run lint`, and `npm run build`. |
| Error handling | ✅ | File read/parse errors caught and logged in change handler (line 119). `readdir` failure caught with fallback to empty projects array (line 97). Stream close and watcher close errors both guarded. One minor gap: no `watcher.on('error', ...)` handler — see Recommendations. |
| Accessibility | ✅ | N/A — server-side API endpoint. |
| Security | ✅ | No user-controlled paths. File watching scoped to `{basePath}/**/state.json`. `ignored` regex prevents watching `.proposed`/`.empty` variants. `extractProjectName` uses `path.relative` safely. No sensitive data exposed in SSE payloads. |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `ui/app/api/events/route.ts` | 100–108 | minor | No `watcher.on('error', ...)` handler registered. If chokidar encounters an OS-level error (e.g., EACCES, too many watchers), the error event goes unhandled. | Add `watcher.on('error', (err) => { console.error('[SSE] Watcher error:', err); });` after the watcher initialization block. This is defensive — chokidar errors are rare — but prevents silent failures. |
| 2 | `ui/app/api/events/route.ts` | 1–2 | minor | Two separate imports from `'node:fs/promises'` (`readdir` and `readFile`). | Combine into a single import: `import { readdir, readFile } from 'node:fs/promises';`. Purely cosmetic. |

## Positive Observations

- **Faithful contract adherence**: The SSE wire format (`event: {type}\ndata: {json}\n\n`) exactly matches the Task Handoff specification. All five event types (`connected`, `state_change`, `project_added`, `project_removed`, `heartbeat`) are implemented correctly.
- **Robust cleanup**: The `cleanup()` function with `closed` guard flag prevents double-close. All three resource types (watcher, interval, debounce timers) are properly released on abort. `watcher.close()` errors are caught and logged.
- **Defensive `enqueue()` wrapper**: The `enqueue` function checks the `closed` flag *and* wraps `controller.enqueue()` in a try/catch — belt-and-suspenders approach that prevents crashes from writing to a closed stream.
- **Smart debounce with `forEach`**: Using `debounceTimers.forEach()` instead of `for...of` avoids requiring `--downlevelIteration` — a thoughtful TypeScript compilation consideration documented in the Task Report.
- **Graceful degradation on project discovery failure**: If `readdir` fails, a `connected` event with an empty `projects` array is still sent, so the client gets a valid initial frame.
- **Type safety**: Generic `createSSEEvent<T>` enforces that the payload matches the event type at compile time. All types flow correctly from `events.ts` through the route handler.

## Recommendations

- **Add `watcher.on('error', ...)`**: While not a blocking issue, registering a chokidar error handler is a best practice. This can be addressed in a future task or as part of Phase 3 polish.
- **Combine duplicate imports**: Minor style cleanup — merge the two `node:fs/promises` imports into one line.
- **Future: integration tests**: When testing infrastructure is set up, add integration tests that spin up the SSE endpoint and verify event delivery on filesystem changes.
