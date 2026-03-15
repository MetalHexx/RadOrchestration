---
project: "V3-FIXES"
phase: 1
task: 2
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-15T00:00:00Z"
---

# Code Review: Phase 1, Task 2 — pre-reads.js handlePlanApproved fix

## Verdict: APPROVED

## Summary

The `handlePlanApproved` function in `pre-reads.js` has been correctly updated to derive the master plan document path from `state.planning.steps[4].doc_path` when `context.doc_path` is absent, while preserving full backward compatibility when `context.doc_path` is present. The implementation exactly matches the task handoff specification. All three failure branches return structured `failure()` results with descriptive messages — the function never throws. All 218 existing tests pass unchanged.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ✅ | Uses the same `readFile` import from `fs-helpers` as `state-io.js`; follows existing `failure()`/`success()` return patterns; does not modify the `preRead` dispatch, handler lookup table, or any other handler |
| Design consistency | ✅ | Implements the exact hybrid approach specified in Design Area 4 and Architecture Goal 4: context-supplied `doc_path` is honored first, state-derivation is the fallback |
| Code quality | ✅ | Clean, linear control flow; proper use of optional chaining (`state?.planning?.steps?.[4]?.doc_path`); descriptive error messages in all three failure branches; no dead code |
| Test coverage | ⚠️ | No new unit tests were added for `handlePlanApproved` itself — but the task handoff explicitly scoped this out ("do not create or modify test files"). Existing tests cover the original path. Dedicated tests should be added in a future task |
| Error handling | ✅ | Three distinct error paths: (1) state.json unreadable, (2) state.json invalid JSON (try/catch around `JSON.parse`), (3) `steps[4].doc_path` not set. All return `failure()` — no exceptions escape |
| Accessibility | ✅ | N/A — backend script, no UI |
| Security | ✅ | `projectDir` is a trusted internal value from the pipeline engine; `path.join` normalizes paths; no user-controlled input reaches file system operations without validation |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|------------|
| — | — | — | — | No issues found | — |

## Positive Observations

- **Exact spec compliance**: The implementation matches the task handoff's "New `handlePlanApproved`" code block character-for-character, including error message text, variable names, and comment wording.
- **Robust fallback chain**: The three-tier guard (unreadable → invalid JSON → missing field) ensures every derivation failure produces a descriptive, structured error rather than an exception — consistent with PRD risk R-1 mitigation.
- **Minimal blast radius**: Only the `handlePlanApproved` function body was modified; all other handlers, the lookup table, and the `preRead` entry point remain untouched.
- **Import consistency**: The `readFile` import uses the identical path already established in `state-io.js`, avoiding a new dependency.
- **Correct path handling**: `path.isAbsolute(derived) ? derived : path.join(projectDir, derived)` correctly handles both absolute and workspace-relative paths that may be stored in state.

## Acceptance Criteria Assessment

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `handlePlanApproved` with `context = {}` and valid state returns `{ context: { total_phases: N }, error: undefined }` | ✅ Met — state-derivation fallback constructs `docPath` from `state.planning.steps[4].doc_path`, then proceeds to the existing `readOrFail` + `total_phases` extraction logic |
| 2 | `handlePlanApproved` with `context = { doc_path: "..." }` returns same result as before (backward compatible) | ✅ Met — line 34 assigns `context.doc_path` to `docPath`; when truthy, the entire fallback block is skipped |
| 3 | Missing `context.doc_path` AND missing `steps[4].doc_path` returns descriptive failure | ✅ Met — returns `failure('Cannot derive master plan path: state.planning.steps[4].doc_path is not set', ...)` |
| 4 | Missing `context.doc_path` AND unreadable state.json returns descriptive failure, never throws | ✅ Met — `readFile` returns `null` (never throws per contract); handler returns `failure(...)` |
| 5 | Missing `context.doc_path` AND malformed state.json returns descriptive failure, never throws | ✅ Met — `JSON.parse` is wrapped in try/catch; handler returns `failure(...)` |
| 6 | All existing tests pass unchanged | ✅ Met — 218/218 pass, 0 failures |
| 7 | No changes to any file other than `pre-reads.js` | ✅ Met — verified via git diff; mutations.js and mutations.test.js changes are from T01, not this task |
| 8 | Imports placed after `'use strict';` and before `STATUS_MAP` | ✅ Met — lines 3-4 of the file |
| 9 | No other handler functions modified | ✅ Met — `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhasePlanCreated`, `handlePhaseReviewCompleted` are identical to their pre-change state |

## Recommendations

- Add dedicated unit tests for the new `handlePlanApproved` state-derivation paths (state-derivation happy path, unreadable state, invalid JSON, missing steps[4]) in a future task or as part of the phase test coverage review.
