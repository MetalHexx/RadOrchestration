---
project: "MONITORING-UI"
phase: 3
task: 2
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-10T00:00:00Z"
---

# Code Review: Phase 3, Task 2 — SSE Client Hook

## Verdict: APPROVED

## Summary

The `useSSE` hook is a well-structured EventSource lifecycle manager that correctly implements exponential backoff reconnection, memory leak prevention via mounted guards, event buffering with configurable caps, and clean unmount behavior. The code follows React hooks best practices — callback refs prevent unnecessary reconnections, state updates are guarded against post-unmount writes, and the public API is clean. Two minor observations are noted below but neither blocks approval.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ⚠️ | File path `ui/hooks/use-sse.ts` vs Architecture's `ui/lib/hooks/useSSE.ts` — intentional per Task Handoff (resolves CF-3); return type extended with `events`/`lastEventTime` beyond Architecture contract, also per Handoff |
| Design consistency | ✅ | N/A — pure logic hook, no UI rendering; Design's connection indicator description (green/yellow/red) maps to the three `SSEConnectionStatus` values |
| Code quality | ✅ | Clean separation of concerns, callback refs for stable closures, idiomatic React patterns, good JSDoc comments on interfaces |
| Test coverage | ⚠️ | 0 tests — Task Handoff File Targets did not include a test file; test requirements are documented for future verification |
| Error handling | ✅ | JSON parse errors caught and logged; mounted guard on every state setter; onerror triggers graceful backoff; max attempts cap prevents infinite retry loops |
| Accessibility | ✅ | N/A — no UI rendered |
| Security | ✅ | No secrets, no user input passed unsanitized; EventSource connects to relative URL only |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|------------|
| 1 | `ui/hooks/use-sse.ts` | 108-114 | minor | Backoff delay is multiplied _inside_ the timeout callback (after the wait), which means `backoffDelayRef` briefly holds the _previous_ delay value between the timeout being scheduled and firing. Functionally correct since the ref is only read at scheduling time in `onerror`, but multiplying immediately after scheduling (before `createConnection()`) would make the intent clearer. | Move `backoffDelayRef.current = Math.min(...)` to right after `setTimeout` is assigned in `onerror`, rather than inside the timeout callback. No behavioral change — purely a clarity improvement. |
| 2 | `ui/hooks/use-sse.ts` | — | minor | Architecture specifies `onEvent` as required; implementation makes it optional. This is sanctioned by the Task Handoff and is a reasonable enhancement (consumers can use the events buffer instead), but should be reconciled in the Architecture at the next planning update. | No code change needed. Flag for Tactical Planner to update Architecture contract in a future task. |

## Positive Observations

- **Mounted guard discipline**: Every state setter and callback invocation is gated behind `mountedRef.current`, preventing React "state update on unmounted component" warnings.
- **Callback ref pattern**: `onEventRef`, `onErrorRef`, `onOpenRef` prevent the `useEffect` → `createConnection` chain from re-running when consumer callbacks change identity, which would cause unnecessary disconnects/reconnects.
- **Clean reconnect flow**: `reconnect()` properly resets both the backoff counter and delay before creating a fresh connection, ensuring manual reconnect doesn't inherit stale backoff state.
- **Event buffer management**: Newest-first ordering with slice-based cap is simple and efficient; `maxEventsRef` avoids reconnection on buffer size changes.
- **`"use client"` directive**: Correctly present, ensuring the hook is bundled for client-side only.

## Recommendations

- Architecture contract for `useSSE` should be updated to reflect the extended return type (`events`, `lastEventTime`) and the canonical hook path (`ui/hooks/use-sse.ts`). This is a documentation-only update for the next planning cycle.
- Tests should be added in a dedicated task — the hook is non-trivial and the Task Handoff enumerates 17 test requirements. A follow-up task with a mocked `EventSource` would close this gap.
