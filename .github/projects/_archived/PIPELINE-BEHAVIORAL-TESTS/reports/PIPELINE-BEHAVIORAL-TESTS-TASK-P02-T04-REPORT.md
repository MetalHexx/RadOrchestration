---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 2
task: 4
title: "Triage Engine Fallback Removal & Required-Field Validation"
status: "complete"
files_changed: 2
tests_written: 3
tests_passing: 44
build_status: "pass"
has_deviations: false
deviation_type: null
---

# Task Report: Triage Engine Fallback Removal & Required-Field Validation

## Summary

Removed all fallback chains in `triage-engine.js` for `has_deviations`, `deviation_type`, and `exit_criteria_met`. Added required-field validation for `exit_criteria_met` in `triagePhase` that returns a structured `MISSING_REQUIRED_FIELD` error when the field is absent. Updated corresponding tests in `triage-engine.test.js` to reflect the new strict behavior.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/orchestration/scripts/lib/triage-engine.js` | +8 -6 | Removed `hasDeviations` ternary fallback chain, removed `deviationType` `\|\| null` default, replaced `exit_criteria_met` fallback block with required-field validation + strict boolean check |
| MODIFIED | `.github/orchestration/scripts/tests/triage-engine.test.js` | +45 -28 | Updated deviations fallback test to use `has_deviations: true`; replaced `exit_criteria_met: undefined/null → Row 2` tests with `MISSING_REQUIRED_FIELD` error tests; moved `"all"` to Row 3; added `exit_criteria_met: true` to Phase Row 4/5 fixtures |

## Tests

| Test | File | Status |
|------|------|--------|
| has_deviations: true with deviation_type minor triggers Row 3 | `triage-engine.test.js` | ✅ Pass |
| exit_criteria_met: true → Row 2 | `triage-engine.test.js` | ✅ Pass |
| exit_criteria_met: undefined → MISSING_REQUIRED_FIELD error | `triage-engine.test.js` | ✅ Pass |
| exit_criteria_met: null → MISSING_REQUIRED_FIELD error | `triage-engine.test.js` | ✅ Pass |
| exit_criteria_met: "all" → Row 3 | `triage-engine.test.js` | ✅ Pass |
| exit_criteria_met: false → Row 3 | `triage-engine.test.js` | ✅ Pass |
| exit_criteria_met: "partial" → Row 3 | `triage-engine.test.js` | ✅ Pass |
| Phase Row 4: changes requested (with exit_criteria_met) | `triage-engine.test.js` | ✅ Pass |
| Phase Row 5: rejected (with exit_criteria_met) | `triage-engine.test.js` | ✅ Pass |
| Phase Row 4 action is plural corrective_tasks_issued | `triage-engine.test.js` | ✅ Pass |
| All 14 task-level Row 1–11 tests | `triage-engine.test.js` | ✅ Pass |
| All 6 checkRetryBudget tests | `triage-engine.test.js` | ✅ Pass |
| All 10 error-case tests | `triage-engine.test.js` | ✅ Pass |

**Test summary**: 44/44 passing (triage-engine), 63/63 passing (pipeline-engine), 18/18 passing (state-io), 496/496 passing (all suites combined)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `triageTask` contains no reference to `reportFm.deviations` (the legacy field) | ✅ Met |
| 2 | `triageTask` `hasDeviations` assignment is `Boolean(reportFm.has_deviations)` — single expression, no ternary/fallback | ✅ Met |
| 3 | `triageTask` `deviationType` assignment is `reportFm.deviation_type` — no `\|\| null` | ✅ Met |
| 4 | `triagePhase` returns a structured error (`success: false`, `error_code: 'MISSING_REQUIRED_FIELD'`) when `exit_criteria_met` is `undefined` or `null` | ✅ Met |
| 5 | `triagePhase` `allExitCriteriaMet` uses strict boolean check: `reviewFm.exit_criteria_met === true` | ✅ Met |
| 6 | No remaining fallback logic for `has_deviations`, `deviation_type`, or `exit_criteria_met` in triage-engine.js | ✅ Met |
| 7 | All triage-engine tests pass (including updated edge case tests) | ✅ Met |
| 8 | All other existing tests pass (zero regressions) | ✅ Met |
| 9 | Build succeeds | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass
- **Type check**: N/A (JavaScript project)

## Implementation Notes

Phase Row 4 (changes_requested), Phase Row 5 (rejected), and the Phase Row 4 edge case test all supplied phase review frontmatter without `exit_criteria_met`. Because the new required-field validation fires before any row-matching logic, these tests hit the `MISSING_REQUIRED_FIELD` error path. Added `exit_criteria_met: true` to these three test fixtures to reflect the new requirement that all phase reviews must include the field. This is purely a test fixture update — no triage decision logic was changed.
