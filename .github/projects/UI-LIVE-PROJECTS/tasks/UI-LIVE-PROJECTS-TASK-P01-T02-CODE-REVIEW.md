---
project: "UI-LIVE-PROJECTS"
phase: 1
phase_id: "P01"
task: 2
task_id: "P01-T02"
title: "Client Hook — Fetch Cache Fix"
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-15"
---

# Code Review: Phase 1, Task 2 — Client Hook — Fetch Cache Fix

## Verdict: APPROVED

## Summary

Both `fetch("/api/projects")` call sites in `ui/hooks/use-projects.ts` are correctly updated with `{ cache: "no-store" }` — line 43 (`fetchProjectList` useCallback) and line 141 (`fetchProjects` inside the mount `useEffect`). The change is strictly scoped to those two lines; all other fetch calls, including the two `/api/projects/${name}/state` calls at lines 97 and 174, are untouched. The `no-store` option is the correct semantic for Next.js App Router fetch cache bypassing. No issues found.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | No module boundaries crossed; hook correctly calls the Next.js API route layer |
| Design consistency | ✅ | N/A — data-fetching hook with no UI changes |
| Code quality | ✅ | Minimal surgical change (2 lines); idiomatic `RequestInit` usage; no dead code introduced |
| Test coverage | ⚠️ | No automated unit tests for this hook; handoff explicitly scopes verification to browser manual test + build pass — acceptable given task scope |
| Error handling | ✅ | Existing error handling unchanged; `no-store` does not affect error path behavior |
| Accessibility | ✅ | N/A — no UI changes |
| Security | ✅ | No secrets exposed; read-only optimization; input validation on state endpoints (`encodeURIComponent`) unchanged |

## Issues Found

_None._

## Positive Observations

- **Correct cache semantic**: `cache: "no-store"` fully bypasses the Next.js fetch cache on every request, which is semantically correct for this use case. `no-cache` would still send conditional requests (If-None-Match / If-Modified-Since) and could return a 304-backed stale response — `no-store` avoids that entirely.
- **Surgical scope**: Exactly 2 lines changed, matching the handoff's "no other lines" contract. The diff is minimal and reviewable.
- **Both code paths covered**: The project list can be refreshed via two distinct paths — SSE-triggered (`fetchProjectList` at line 43) and mount-triggered (`fetchProjects` at line 141). Both are updated, so the fix is complete regardless of which path executes.
- **State endpoints correctly excluded**: The `/api/projects/${name}/state` fetch calls (lines 97 and 174) intentionally retain default caching behavior, which is appropriate — they are individually keyed by project name and do not suffer the same stale-list problem.
- **Build verified clean**: Task Report confirms `next build` passes with zero TypeScript errors; the `no-store` option is valid `RequestInit` and does not introduce any type error.

## Recommendations

No corrective action required. Task is complete and ready to advance.
