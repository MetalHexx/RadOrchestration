---
project: "UI-PATH-FIX"
phase: 1
task: 3
title: "UI Normalizer Fallback Chains"
status: "complete"
files_changed: 1
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: UI Normalizer Fallback Chains

## Summary

Added index-based fallback chains to `normalizePhase` and `normalizeTask` in `ui/lib/normalizer.ts`. A `parseIdNumber` helper was created to extract numeric suffixes from id strings. Both functions now accept an `index` parameter and use a three-priority fallback chain for `phase_number`/`task_number`: explicit field → parsed id suffix → array index + 1. The `total_tasks` field also falls back to `raw.tasks?.length ?? 0`.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `ui/lib/normalizer.ts` | +13 | Added `parseIdNumber` helper (7 lines), updated `normalizeTask` and `normalizePhase` signatures to accept `index`, implemented fallback chains for `task_number`, `phase_number`, and `total_tasks`, updated inner `.map()` to pass index |

## Deviations from Handoff

| # | Handoff Said | Agent Did | Reason |
|---|-------------|-----------|--------|
| 1 | Use `(raw as any).id` to access the `id` field | Used `(raw as unknown as Record<string, unknown>).id` | The project's ESLint config enforces `@typescript-eslint/no-explicit-any`. Casting through `unknown` to `Record<string, unknown>` achieves the same result without triggering the lint error. |

## Tests

No automated test infrastructure exists for this file. Verification was manual per the handoff.

| Test | File | Status |
|------|------|--------|
| TypeScript compiles with no errors (`npx tsc --noEmit`) | `ui/lib/normalizer.ts` | ✅ Pass |
| Next.js build passes (`npm run build`) | `ui/lib/normalizer.ts` | ✅ Pass |
| ESLint passes (via `next build` lint step) | `ui/lib/normalizer.ts` | ✅ Pass |

**Test summary**: 3/3 passing (manual verification)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `normalizePhase` accepts `(raw: RawPhase, index: number)` — signature updated | ✅ Met |
| 2 | `normalizeTask` accepts `(raw: RawTask, index: number)` — signature updated | ✅ Met |
| 3 | `phase_number` fallback chain: `raw.phase_number` → parse `raw.id` suffix → `index + 1` | ✅ Met |
| 4 | `task_number` fallback chain: `raw.task_number` → parse `raw.id` suffix → `index + 1` | ✅ Met |
| 5 | `total_tasks` fallback chain: `raw.total_tasks` → `raw.tasks?.length` → `0` | ✅ Met |
| 6 | ID parsing strips leading non-digit characters, parses remainder as base-10 integer, falls through on `NaN` | ✅ Met |
| 7 | Existing phases/tasks with `phase_number` / `task_number` already set use the explicit value (no regression) | ✅ Met |
| 8 | `normalizeState` call site for phases does NOT need modification (`.map()` already provides index) | ✅ Met |
| 9 | `normalizePhase` inner `.map()` for tasks passes `(t, i) => normalizeTask(t, i)` so tasks get their index | ✅ Met |
| 10 | No TypeScript compilation errors (`npx tsc --noEmit` passes) | ✅ Met |
| 11 | No lint errors | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: ✅ Pass
