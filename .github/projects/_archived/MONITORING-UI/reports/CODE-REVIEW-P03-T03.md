---
project: "MONITORING-UI"
phase: 3
task: 3
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-10T00:00:00Z"
---

# Code Review: Phase 3, Task 3 — Real-Time State Integration + Connection Status

## Verdict: APPROVED

## Summary

The implementation correctly wires `useSSE` into `useProjects`, handles all four SSE event types as specified, and connects the `ConnectionIndicator` to live status with a conditional "Retry" button. Code quality is high, the approach is architecturally sound, and the build and lint pass cleanly. One minor observation about the `selectedProjectRef` pattern is noted but does not warrant changes.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | Hooks remain in the Application layer (`ui/hooks/`), no cross-layer violations. `useProjects` composes `useSSE` internally per the Architecture module map. Return interface extended cleanly. |
| Design consistency | ✅ | `ConnectionIndicator` receives live `sseStatus` prop. "Retry" button uses `variant="ghost" size="sm"` with `text-xs` as specified in Design tokens. Only visible when `disconnected`. |
| Code quality | ✅ | Clean separation of concerns. `handleSSEEvent` uses a switch statement with explicit cases. `fetchProjectList` is extracted as a reusable helper. No dead code, no commented-out blocks. |
| Test coverage | ⚠️ | No test files were created. The Task Handoff listed behavioral expectations but did not specify test file creation. The Task Report acknowledges this. Type-safety via build is verified. |
| Error handling | ✅ | `fetchProjectList` silently catches to avoid overwriting primary fetch errors. `project_removed` for the selected project correctly clears both `selectedProject` and `projectState`. |
| Accessibility | ✅ | `ConnectionIndicator` already has `aria-live="polite"` for status announcements. Retry button is a standard `<Button>` element — keyboard accessible. |
| Security | ✅ | No secrets exposed. SSE URL is a relative path (`/api/events`). No user input is unsafely interpolated. |

## Files Reviewed

### `ui/hooks/use-projects.ts` (239 lines)

**SSE Integration** — Lines 42–90 implement the SSE event handling:

- `selectedProjectRef` (line 42): Uses `useCallback(() => selectedProject, [selectedProject])` as a stable getter to avoid stale closures in `handleSSEEvent`. This is an unconventional but functional pattern — it creates a new function reference on each `selectedProject` change, but since `useSSE` stores the `onEvent` callback in a ref (`onEventRef`), the EventSource is **not** re-created. The approach is correct and satisfies the handoff's requirement to keep `handleSSEEvent` stable while accessing the latest selected project.

- `handleSSEEvent` (lines 56–86): Handles all four event types correctly:
  - `state_change`: Updates `projectState` only when `projectName` matches the current selection — correct guard.
  - `connected` / `project_added`: Calls `fetchProjectList()` to refresh the list from `/api/projects` — correct per handoff.
  - `project_removed`: Filters the project from local state and clears selection if it was the removed project — correct, avoids an unnecessary network call.
  - `heartbeat`: Falls through to `default: break` — correctly ignored.

- `useSSE` call (lines 88–91): Passes `url: "/api/events"` and `onEvent: handleSSEEvent`. Destructures `status` as `sseStatus` and `reconnect` — matches handoff specification exactly.

- `fetchProjectList` helper (lines 44–53): Extracted as a `useCallback` with no dependencies. Silently catches errors to avoid overwriting the primary error state — reasonable design choice.

- Return interface (lines 10–30): Correctly extends `UseProjectsReturn` with `sseStatus: SSEConnectionStatus` and `reconnect: () => void`, with JSDoc comments.

### `ui/components/layout/app-header.tsx` (51 lines)

- `AppHeaderProps` interface (lines 8–11): Accepts `sseStatus` and `onReconnect` props typed to the correct union and function signature.
- `ConnectionIndicator` (line 30): Receives `status={sseStatus}` — no longer hardcoded.
- Retry button (lines 31–39): Conditionally rendered when `sseStatus === "disconnected"`, uses `variant="ghost" size="sm" className="text-xs"` — matches design tokens exactly. Calls `onReconnect` on click.

### `ui/app/page.tsx` (73 lines)

- Destructures `sseStatus` and `reconnect` from `useProjects()` (lines 17–18).
- Passes `sseStatus={sseStatus} onReconnect={reconnect}` to `<AppHeader />` (line 33).
- Clean, minimal change — no unnecessary modifications.

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|------------|
| — | — | — | — | No issues found | — |

## Positive Observations

- **Correct use of `useSSE` callback refs**: The `useSSE` hook stores `onEvent` in a ref, so changing `handleSSEEvent` identity does not cause EventSource reconnections. The implementation correctly relies on this behavior.
- **Clean event handler**: The switch statement in `handleSSEEvent` is easy to read and maps 1:1 to the event type contracts in `types/events.ts`.
- **Minimal surface area**: Only three files modified, exactly as scoped. No unnecessary abstractions or files added.
- **`project_removed` handles edge cases**: Filters locally to provide instant UI feedback, and clears selection appropriately when the removed project was selected.
- **Design token compliance**: Retry button styling matches the specification precisely.

## Build & Lint Verification

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Compiled successfully, zero errors |
| `npm run lint` | ✅ No ESLint warnings or errors |
| IDE diagnostics | ✅ Zero TypeScript errors across all three files |

## Recommendations

- **Future phase**: Consider adding integration tests that mock `EventSource` to verify the SSE → state update flow end-to-end. The current task did not require test file creation, but coverage for the event handling logic would strengthen confidence.
