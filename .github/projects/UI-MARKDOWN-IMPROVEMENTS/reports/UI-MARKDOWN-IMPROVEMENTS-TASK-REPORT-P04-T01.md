---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 4
task: 1
title: "TYPES-AND-ORDERING"
status: "complete"
files_changed: 3
tests_written: 8
tests_passing: 8
build_status: "pass"
has_deviations: false
deviation_type: null
---

# Task Report: TYPES-AND-ORDERING

## Summary

Added the `OrderedDoc` and `FilesResponse` interfaces to `ui/types/components.ts` and created the `ui/lib/document-ordering.ts` utility implementing `getOrderedDocs` and `getAdjacentDocs`. All functions follow the canonical ordering algorithm specified in the handoff. All 8 tests pass, TypeScript compiles cleanly, build succeeds, and lint reports zero errors.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `ui/types/components.ts` | +13 | Appended `OrderedDoc` and `FilesResponse` interfaces |
| CREATED | `ui/lib/document-ordering.ts` | 108 | `getOrderedDocs` and `getAdjacentDocs` exported functions |
| CREATED | `ui/lib/document-ordering.test.ts` | 179 | 8 test cases covering both functions |

## Tests

| Test | File | Status |
|------|------|--------|
| returns planning + phase docs in canonical order | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| skips null paths | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| appends error log from allFiles after final review | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| appends other docs sorted alphabetically | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| returns prev: null at index 0 | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| returns next: null at last index | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| returns both prev and next at a middle index | `ui/lib/document-ordering.test.ts` | ✅ Pass |
| returns currentIndex -1 when path not found | `ui/lib/document-ordering.test.ts` | ✅ Pass |

**Test summary**: 8/8 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `OrderedDoc` interface exported from `ui/types/components.ts` with `path: string`, `title: string`, `category` union type | ✅ Met |
| 2 | `FilesResponse` interface exported from `ui/types/components.ts` with `files: string[]` | ✅ Met |
| 3 | `getOrderedDocs` exported from `ui/lib/document-ordering.ts` — accepts `NormalizedProjectState`, `projectName`, optional `allFiles` | ✅ Met |
| 4 | `getOrderedDocs` returns planning docs in `PLANNING_STEP_ORDER` sequence, only including non-null outputs | ✅ Met |
| 5 | `getOrderedDocs` returns per-phase docs in order: phase plan → (per-task: handoff → report → review) → phase report → phase review | ✅ Met |
| 6 | `getOrderedDocs` appends final review doc when non-null | ✅ Met |
| 7 | `getOrderedDocs` appends error log (detected via `{projectName}-ERROR-LOG.md` pattern in `allFiles`) when found | ✅ Met |
| 8 | `getOrderedDocs` appends remaining "other docs" from `allFiles` not in the pipeline, sorted alphabetically | ✅ Met |
| 9 | `getAdjacentDocs` exported from `ui/lib/document-ordering.ts` — returns `{ prev, next, currentIndex, total }` | ✅ Met |
| 10 | `getAdjacentDocs` returns `null` for `prev` at first doc and `null` for `next` at last doc | ✅ Met |
| 11 | All types compile without errors (`npx tsc --noEmit`) | ✅ Met |
| 12 | Build succeeds (`npm run build` with zero errors) | ✅ Met |
| 13 | No lint errors | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: ✅ Pass
