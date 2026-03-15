---
project: "MONITORING-UI"
phase: 2
task: "P02-T06"
title: "Layout Shell + Edge-Case Views + Page Wiring"
status: "complete"
files_changed: 7
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Layout Shell + Edge-Case Views + Page Wiring

## Summary

Created four layout components (`AppHeader`, `MainDashboard`, `NotInitializedView`, `MalformedStateView`) with barrel export, wired the root `page.tsx` to use the `useProjects` hook with `SidebarProvider` for the full application shell, and fixed the `error.tsx` emoji accessibility. All TypeScript, build, and lint checks pass with zero errors.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `ui/components/layout/app-header.tsx` | 37 | Top header bar with title, ConnectionIndicator, disabled Config and Theme placeholders |
| CREATED | `ui/components/layout/not-initialized-view.tsx` | 43 | Centered card for projects without state.json, optional brainstorming doc link |
| CREATED | `ui/components/layout/malformed-state-view.tsx` | 35 | Amber-tinted warning card with WarningBadge for unparseable state |
| CREATED | `ui/components/layout/main-dashboard.tsx` | 127 | Dashboard container with conditional rendering and all section components in ScrollArea |
| CREATED | `ui/components/layout/index.ts` | 4 | Barrel export for all layout components |
| MODIFIED | `ui/app/page.tsx` | +74 | Converted to "use client", wired useProjects hook, SidebarProvider, AppHeader, MainDashboard |
| MODIFIED | `ui/app/error.tsx` | +1 | Added role="img" aria-label="Warning" to emoji div |

## Tests

No unit tests were specified in the task handoff. Validation was performed via build, lint, and type checking.

| Test | File | Status |
|------|------|--------|
| TypeScript type check (`npx tsc --noEmit`) | All files | ✅ Pass |
| Production build (`npm run build`) | All files | ✅ Pass |
| ESLint (`npm run lint`) | All files | ✅ Pass |

**Test summary**: 3/3 verification checks passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `AppHeader` renders title "Orchestration Monitor", a static `ConnectionIndicator` with `status="disconnected"`, a disabled Config button placeholder, and a disabled Theme Toggle placeholder | ✅ Met |
| 2 | `MainDashboard` renders all dashboard sections in order when given a valid `NormalizedProjectState`: `ErrorSummaryBanner`, `ProjectHeader`, `PlanningSection`, `ExecutionSection`, `FinalReviewSection`, `ErrorLogSection`, `GateHistorySection`, `LimitsSection` | ✅ Met |
| 3 | `MainDashboard` renders `NotInitializedView` when `projectState` is null and `project.hasState` is false | ✅ Met |
| 4 | `MainDashboard` renders `MalformedStateView` when `projectState` is null and `project.hasMalformedState` is true | ✅ Met |
| 5 | `NotInitializedView` displays the project name, a "Not Initialized" heading, descriptive text, and a clickable brainstorming doc link when `brainstormingDoc` is provided | ✅ Met |
| 6 | `MalformedStateView` displays the project name, a `WarningBadge`, and the error message | ✅ Met |
| 7 | Root `page.tsx` is `"use client"`, uses `useProjects` hook, renders `SidebarProvider` wrapping `ProjectSidebar` + `SidebarInset` with `MainDashboard` | ✅ Met |
| 8 | Selecting a project in the sidebar renders its dashboard; no-project-selected state shows a centered placeholder | ✅ Met |
| 9 | `error.tsx` emoji div has `role="img" aria-label="Warning"` (Phase 1 carry-forward fix) | ✅ Met |
| 10 | All new components are `"use client"` components | ✅ Met |
| 11 | All layout components export from `ui/components/layout/index.ts` | ✅ Met |
| 12 | `npm run build` passes with zero TypeScript errors | ✅ Met |
| 13 | No hardcoded colors — all colors use CSS custom properties | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: ✅ Pass
