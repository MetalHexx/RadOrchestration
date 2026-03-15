---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 2
task: 4
title: "Triage Engine Fallback Removal & Required-Field Validation"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Triage Engine Fallback Removal & Required-Field Validation

## Objective

Remove all fallback chains in `triage-engine.js` for the three newly-required frontmatter fields (`has_deviations`, `deviation_type`, `exit_criteria_met`) and add required-field validation for `exit_criteria_met` in `triagePhase`, so that field absence is treated as an error rather than silently defaulted.

## Context

The pipeline's `task_completed` pre-read (completed in T03) now validates that `has_deviations` and `deviation_type` are present in task report frontmatter before triage runs. This means `triageTask` can safely assume these fields exist and does not need its legacy fallback chain (`reportFm.deviations` → `false`). Similarly, `exit_criteria_met` is now a REQUIRED boolean in the phase review template (from T01), but `triagePhase` still treats `undefined`/`null`/`"all"` as "all met" — that fallback must be replaced with strict validation. The triage engine should read required fields directly and return a structured error if any is unexpectedly absent.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/triage-engine.js` | Remove fallback chains in `triageTask`; add required-field validation in `triagePhase` |
| MODIFY | `.github/orchestration/scripts/tests/triage-engine.test.js` | Update tests that rely on fallback behavior; add test for missing `exit_criteria_met` error |

## Implementation Steps

1. **In `triageTask` (triage-engine.js ~line 127–131)** — replace the `hasDeviations` fallback chain:

   **Current code:**
   ```javascript
   const hasDeviations = Boolean(
     reportFm.has_deviations !== undefined
       ? reportFm.has_deviations
       : reportFm.deviations
   );
   const deviationType = reportFm.deviation_type || null;
   ```

   **Replace with:**
   ```javascript
   const hasDeviations = Boolean(reportFm.has_deviations);
   const deviationType = reportFm.deviation_type;
   ```

   No fallback to `reportFm.deviations`. No `|| null` default for `deviation_type`. Both fields are guaranteed present by the pipeline `task_completed` pre-read.

2. **In `triagePhase` (triage-engine.js ~line 343–349)** — replace the `exit_criteria_met` fallback block:

   **Current code:**
   ```javascript
   // Determine exit criteria status for Row 2 vs Row 3 distinction.
   // If exit_criteria_met is unavailable or ambiguous, default to Row 2 (all met).
   const exitCriteriaMet = reviewFm.exit_criteria_met;
   const allExitCriteriaMet =
     exitCriteriaMet === true ||
     exitCriteriaMet === 'all' ||
     exitCriteriaMet === undefined ||
     exitCriteriaMet === null;
   ```

   **Replace with required-field validation + strict boolean check:**
   ```javascript
   if (reviewFm.exit_criteria_met === undefined || reviewFm.exit_criteria_met === null) {
     return makeError(
       TRIAGE_LEVELS.PHASE,
       `Required frontmatter field 'exit_criteria_met' missing from phase review`,
       'MISSING_REQUIRED_FIELD',
       phaseIndex,
       null
     );
   }
   const allExitCriteriaMet = reviewFm.exit_criteria_met === true;
   ```

   `exit_criteria_met` is strictly boolean. The string `"all"` no longer maps to `true`; `undefined`/`null` no longer default to Row 2.

3. **In `triage-engine.test.js` — update the `deviations` fallback edge case test** (~line 614). The test titled `'deviations frontmatter fallback: truthy "deviations" field triggers has_deviations'` currently expects Row 3 via the legacy `deviations` field. After the fallback is removed, `has_deviations` will be `false` (because `reportFm.has_deviations` is absent → `Boolean(undefined)` → `false`) and the mock also provides a `review_doc`, so the result should now match Row 2 (complete, no deviations, approved). **Update this test** to supply `has_deviations: true` instead of the legacy `deviations: true` field, so it continues to test Row 3 using the correct field name:

   **Replace the mock frontmatter:**
   ```javascript
   frontmatter: { status: 'complete', deviations: true, deviation_type: 'minor' },
   ```
   **With:**
   ```javascript
   frontmatter: { status: 'complete', has_deviations: true, deviation_type: 'minor' },
   ```

   **Also rename the test title** from `'deviations frontmatter fallback: truthy "deviations" field triggers has_deviations'` to something like `'has_deviations: true with deviation_type minor triggers Row 3'`.

4. **In `triage-engine.test.js` — update `exit_criteria_met` variant tests**. Four tests under `'exit_criteria_met variants → Row 2 (all met)'` currently test that `undefined`, `null`, and `"all"` map to Row 2. After the change:
   - `exit_criteria_met: "all"` → should now match **Row 3** (not `true`, so `allExitCriteriaMet === false`).
   - `exit_criteria_met: undefined` (absent) → should return **`{ success: false }` error** with `error_code: 'MISSING_REQUIRED_FIELD'`.
   - `exit_criteria_met: null` → should return **`{ success: false }` error** with `error_code: 'MISSING_REQUIRED_FIELD'`.

   Update or rewrite these four tests:
   - **Keep** `exit_criteria_met: true → Row 2` — unchanged.
   - **Move** `exit_criteria_met: "all"` test into the Row 3 section, asserting `row_matched === 3`.
   - **Replace** `exit_criteria_met: undefined → Row 2` test with a new test: `exit_criteria_met: undefined → MISSING_REQUIRED_FIELD error` — assert `result.success === false` and `result.error_code === 'MISSING_REQUIRED_FIELD'`.
   - **Replace** `exit_criteria_met: null → Row 2` test with a new test: `exit_criteria_met: null → MISSING_REQUIRED_FIELD error` — assert `result.success === false` and `result.error_code === 'MISSING_REQUIRED_FIELD'`.

5. **In `triage-engine.test.js` — update `exit_criteria_met: "partial"` test**. The test currently expects Row 3. After the change, `"partial"` is a string (not `true`), so `allExitCriteriaMet` is `false`, still mapping to Row 3. **This test should remain unchanged and pass as-is.** Verify this is the case.

6. **In `triage-engine.test.js` — audit all task-level tests**. Several Row 5, 6, 7, 8, 9, 10, and 11 tests supply task report frontmatter **without** `has_deviations` or `deviation_type`. After the fallback removal, `Boolean(undefined)` → `false` for `has_deviations` and `undefined` for `deviation_type`. Since these rows don't gate on `has_deviations`/`deviation_type` for their match conditions (they gate on `verdict` or `status`), they should continue to match correctly. **Verify no regressions** — do not add fields unless a test actually breaks.

7. **Run all tests** to confirm zero regressions.

## Contracts & Interfaces

### `makeError` function signature (triage-engine.js)

```javascript
/**
 * @param {'task'|'phase'} level
 * @param {string} error
 * @param {'DOCUMENT_NOT_FOUND'|'INVALID_VERDICT'|'IMMUTABILITY_VIOLATION'|'INVALID_STATE'|'INVALID_LEVEL'|'MISSING_REQUIRED_FIELD'} errorCode
 * @param {number} phaseIndex - 0-based
 * @param {number|null} taskIndex - 0-based, null for phase-level
 * @returns {{ success: false, level, error, error_code, phase_index, task_index }}
 */
function makeError(level, error, errorCode, phaseIndex, taskIndex)
```

The new `'MISSING_REQUIRED_FIELD'` error code is used for the `exit_criteria_met` validation. It follows the same pattern as existing error codes — string literal passed as the `errorCode` argument.

### `triageTask` field access contract (after change)

```javascript
const hasDeviations = Boolean(reportFm.has_deviations);    // Direct read — no fallback
const deviationType = reportFm.deviation_type;              // Direct read — no || null
```

### `triagePhase` required-field validation contract (after change)

```javascript
if (reviewFm.exit_criteria_met === undefined || reviewFm.exit_criteria_met === null) {
  return makeError(
    TRIAGE_LEVELS.PHASE,
    `Required frontmatter field 'exit_criteria_met' missing from phase review`,
    'MISSING_REQUIRED_FIELD',
    phaseIndex,
    null
  );
}
const allExitCriteriaMet = reviewFm.exit_criteria_met === true;
```

### Error result shape

```javascript
{
  success: false,
  level: 'phase',
  error: "Required frontmatter field 'exit_criteria_met' missing from phase review",
  error_code: 'MISSING_REQUIRED_FIELD',
  phase_index: 0,      // 0-based current phase index
  task_index: null      // null for phase-level errors
}
```

## Styles & Design Tokens

Not applicable — infrastructure-only task with no UI.

## Test Requirements

- [ ] `triageTask` reads `reportFm.has_deviations` directly — no fallback to `reportFm.deviations`
- [ ] `triageTask` reads `reportFm.deviation_type` directly — no `|| null` fallback
- [ ] `triagePhase` returns `{ success: false, error_code: 'MISSING_REQUIRED_FIELD' }` when `exit_criteria_met` is `undefined`
- [ ] `triagePhase` returns `{ success: false, error_code: 'MISSING_REQUIRED_FIELD' }` when `exit_criteria_met` is `null`
- [ ] `triagePhase` maps `exit_criteria_met: true` to Row 2 (all met → advance)
- [ ] `triagePhase` maps `exit_criteria_met: false` to Row 3 (partial → advance with carry-forward)
- [ ] `triagePhase` maps `exit_criteria_met: "all"` to Row 3 (string is not `true`, so `allExitCriteriaMet === false`)
- [ ] `triagePhase` maps `exit_criteria_met: "partial"` to Row 3 (string is not `true`)
- [ ] The legacy `deviations` fallback test is updated to use `has_deviations: true` and still triggers Row 3
- [ ] All existing triage tests pass with zero regressions after the changes

## Acceptance Criteria

- [ ] `triageTask` contains no reference to `reportFm.deviations` (the legacy field)
- [ ] `triageTask` `hasDeviations` assignment is `Boolean(reportFm.has_deviations)` — single expression, no ternary/fallback
- [ ] `triageTask` `deviationType` assignment is `reportFm.deviation_type` — no `|| null`
- [ ] `triagePhase` returns a structured error (`success: false`, `error_code: 'MISSING_REQUIRED_FIELD'`) when `exit_criteria_met` is `undefined` or `null`
- [ ] `triagePhase` `allExitCriteriaMet` uses strict boolean check: `reviewFm.exit_criteria_met === true`
- [ ] No remaining fallback logic for `has_deviations`, `deviation_type`, or `exit_criteria_met` in triage-engine.js
- [ ] All triage-engine tests pass (including updated edge case tests)
- [ ] All other existing tests pass (zero regressions)
- [ ] Build succeeds

## Constraints

- Do NOT modify any file other than `triage-engine.js` and `triage-engine.test.js`
- Do NOT change the triage decision table logic (row definitions, match conditions, or semantics) — only the field access patterns and field validation
- Do NOT add `has_deviations` or `deviation_type` validation to the triage engine — that validation lives in the pipeline `task_completed` pre-read (completed in T03). The triage engine simply reads these fields directly.
- Do NOT modify `makeError`'s function signature — pass `'MISSING_REQUIRED_FIELD'` as a new string literal for the `errorCode` parameter
- Do NOT change the `makeSuccess` function or any row-matching logic
- Do NOT introduce any new dependencies or imports
