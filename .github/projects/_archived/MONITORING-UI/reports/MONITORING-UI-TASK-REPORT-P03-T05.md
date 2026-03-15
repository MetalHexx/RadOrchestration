---
project: "MONITORING-UI"
phase: 3
task: 5
title: "Document Viewer Hook + Dashboard Wiring"
status: "complete"
files_changed: 8
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Document Viewer Hook + Dashboard Wiring

## Summary

Created the `useDocumentDrawer` hook to manage drawer open/close state and document fetching with `AbortController` cleanup. Converted `DocumentDrawer` from an internally-fetching component to a controlled component that receives `loading`, `error`, and `data` as props. Wired the hook into `page.tsx` and replaced all inline document link buttons across 5 dashboard components with the reusable `DocumentLink` component.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `ui/hooks/use-document-drawer.ts` | 93 | Hook with AbortController fetch lifecycle |
| MODIFIED | `ui/components/documents/document-drawer.tsx` | 98 | Removed internal fetch; accepts loading/error/data props |
| MODIFIED | `ui/app/page.tsx` | 91 | Integrated useDocumentDrawer + renders DocumentDrawer at root |
| MODIFIED | `ui/components/planning/planning-checklist.tsx` | 59 | Replaced inline button with DocumentLink |
| MODIFIED | `ui/components/execution/phase-card.tsx` | 106 | Replaced Button doc links with DocumentLink; added phase_review link |
| MODIFIED | `ui/components/execution/task-card.tsx` | 45 | Replaced DocLinkButton with DocumentLink; removed helper function |
| MODIFIED | `ui/components/dashboard/final-review-section.tsx` | 54 | Replaced Button variant="link" with DocumentLink |
| MODIFIED | `ui/components/layout/not-initialized-view.tsx` | 35 | Replaced inline button with DocumentLink |

## Tests

No test files were in scope per handoff constraints ("Do NOT create test files — no test file paths are in scope").

**Test summary**: N/A — no test files specified

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `ui/hooks/use-document-drawer.ts` exists as a `"use client"` module exporting `useDocumentDrawer` | ✅ Met |
| 2 | `useDocumentDrawer` manages `isOpen`, `docPath`, `loading`, `error`, `data` state | ✅ Met |
| 3 | `useDocumentDrawer` creates an `AbortController` per fetch and calls `abort()` on cleanup | ✅ Met |
| 4 | `DocumentDrawer` no longer fetches internally — accepts `loading`, `error`, `data` as props | ✅ Met |
| 5 | `DocumentDrawer` no longer accepts `projectName` prop | ✅ Met |
| 6 | `page.tsx` calls `useDocumentDrawer` and renders `DocumentDrawer` at root level | ✅ Met |
| 7 | `page.tsx` `handleDocClick` calls `openDocument(path)` instead of `console.log` | ✅ Met |
| 8 | `PlanningChecklist` uses `DocumentLink` for step output links | ✅ Met |
| 9 | `PhaseCard` uses `DocumentLink` for phase_doc, phase_report, and phase_review links | ✅ Met |
| 10 | `TaskCard` uses `DocumentLink` instead of `DocLinkButton` for handoff/report/review links | ✅ Met |
| 11 | `FinalReviewSection` uses `DocumentLink` for the review report link | ✅ Met |
| 12 | `NotInitializedView` uses `DocumentLink` for the brainstorming doc link | ✅ Met |
| 13 | Null document paths render as disabled links with "Not available" tooltip (FR-24) | ✅ Met |
| 14 | `npm run build` passes with zero TypeScript errors | ✅ Met |
| 15 | `npm run lint` passes with zero ESLint warnings | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: ✅ Pass (`npx tsc --noEmit` — zero errors)
