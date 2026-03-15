---
project: "STATE-TRANSITION-SCRIPTS"
phase: 2
task: 1
title: "Phase 1 Carry-Forward Cleanup"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 2
---

# Phase 1 Carry-Forward Cleanup

## Objective

Fix the 3 carry-forward items from the Phase 1 Review: reorder V10 to run before V1–V9 and short-circuit on structural failure, add null guards to V11–V15 for the `current` parameter, and remove 4 unused imports from `state-validator.js`. Update the test suite to verify the new behavior.

## Context

`src/lib/state-validator.js` exports `validateTransition(current, proposed)` with 15 invariants (V1–V15). Currently V10 (structural validation) runs after V1–V9, so `proposed.execution === null` causes TypeError in V1 instead of a structured error. V11–V15 compare `current` vs `proposed` but assume `current.execution`, `current.project`, etc. are non-null. Four imports (`PHASE_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`) are unused dead code. The test file `tests/state-validator.test.js` has 43 passing tests using `node:test` (`describe`/`it`) and `node:assert`. Two V10 tests currently use `assert.throws(TypeError)` as a workaround for the ordering issue.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `src/lib/state-validator.js` | Remove unused imports, reorder V10, add current-state null guards |
| MODIFY | `tests/state-validator.test.js` | Replace TypeError tests with structured-error tests, add null-guard tests |

## Implementation Steps

1. **Remove unused imports** — In `src/lib/state-validator.js`, change the `require('./constants.js')` destructure from:
   ```javascript
   const {
     PIPELINE_TIERS,
     TASK_STATUSES,
     PHASE_STATUSES,
     REVIEW_VERDICTS,
     REVIEW_ACTIONS,
     PHASE_REVIEW_ACTIONS,
     SEVERITY_LEVELS
   } = require('./constants.js');
   ```
   to:
   ```javascript
   const {
     PIPELINE_TIERS,
     TASK_STATUSES,
     SEVERITY_LEVELS
   } = require('./constants.js');
   ```

2. **Reorder V10 in `validateTransition()`** — Move `checkV10(proposed)` to run FIRST, before V1–V9. If V10 returns any errors, short-circuit immediately: return `{ valid: false, invariants_checked: 15, errors: [...v10Errors] }` without running V1–V15. Replace the current `validateTransition` body:
   ```javascript
   function validateTransition(current, proposed) {
     // V10 — structural validation (must run first)
     const v10Errors = checkV10(proposed);
     if (v10Errors.length > 0) {
       return { valid: false, invariants_checked: 15, errors: v10Errors };
     }

     const allErrors = [];

     // Proposed-only checks (V1–V9)
     allErrors.push(...checkV1(proposed));
     allErrors.push(...checkV2(proposed));
     allErrors.push(...checkV3(proposed));
     allErrors.push(...checkV4(proposed));
     allErrors.push(...checkV5(proposed));
     allErrors.push(...checkV6(proposed));
     allErrors.push(...checkV7(proposed));
     allErrors.push(...checkV8(proposed));
     allErrors.push(...checkV9(proposed));

     // Current-state structural guard (must pass before V11–V15)
     const currentGuardErrors = checkCurrentStructure(current);
     if (currentGuardErrors.length > 0) {
       allErrors.push(...currentGuardErrors);
       if (allErrors.length === 0) {
         return { valid: true, invariants_checked: 15 };
       }
       return { valid: false, invariants_checked: 15, errors: allErrors };
     }

     // Current→Proposed checks (V11–V15)
     allErrors.push(...checkV11(current, proposed));
     allErrors.push(...checkV12(current, proposed));
     allErrors.push(...checkV13(current, proposed));
     allErrors.push(...checkV14(current, proposed));
     allErrors.push(...checkV15(current, proposed));

     if (allErrors.length === 0) {
       return { valid: true, invariants_checked: 15 };
     }

     return { valid: false, invariants_checked: 15, errors: allErrors };
   }
   ```

3. **Add `checkCurrentStructure()` guard function** — Create a new helper function that validates `current` has the required structure for V11–V15. Place it after `checkV10` and before `checkV11`:
   ```javascript
   /**
    * Current-state structural guard for V11–V15.
    * Validates that `current` has the required nested objects before V11–V15 access them.
    * @param {Object} current
    * @returns {InvariantError[]}
    */
   function checkCurrentStructure(current) {
     const errors = [];
     if (current == null) {
       errors.push(makeError('V11', 'current state is null or undefined'));
       return errors;
     }
     if (current.execution == null) {
       errors.push(makeError('V11', "current.execution is null or undefined — cannot evaluate V11–V15"));
     }
     if (current.project == null) {
       errors.push(makeError('V13', "current.project is null or undefined — cannot evaluate V13"));
     }
     return errors;
   }
   ```
   The invariant labels in errors correspond to the first invariant that would fail: V11 needs `current.execution`, V13 needs `current.project`. This guard prevents V11–V15 from throwing TypeError.

4. **Update V10 tests** — In `tests/state-validator.test.js`, replace the two V10 tests that use `assert.throws(TypeError)` with tests that assert structured `ValidationResult` errors:
   - Test: `proposed.limits = null` → expect `result.valid === false`, `result.errors` contains V10 error with `invariant: 'V10'` and message mentioning `'limits'`
   - Test: `delete proposed.execution` → expect `result.valid === false`, `result.errors` contains V10 error with `invariant: 'V10'` and message mentioning `'execution'`
   - Keep the positive V10 test unchanged

5. **Add V10 short-circuit verification test** — Add a test that confirms when V10 fails, NO V1–V9 errors appear in the result (proving short-circuit behavior):
   ```javascript
   it('short-circuits — V1–V9 errors do not appear when V10 fails', () => {
     const { current, proposed } = makeBaseStatePair();
     proposed.execution = null;
     const result = validateTransition(current, proposed);
     assert.strictEqual(result.valid, false);
     const invariants = result.errors.map(e => e.invariant);
     assert.ok(invariants.includes('V10'), 'Expected V10 error');
     assert.ok(!invariants.includes('V1'), 'V1 should not appear when V10 short-circuits');
     assert.ok(!invariants.includes('V3'), 'V3 should not appear when V10 short-circuits');
   });
   ```

6. **Add current-state null guard tests** — Add a new `describe` block for V11–V15 null guards:
   ```javascript
   describe('V11–V15 current-state null guards', () => {
     it('returns structured error when current.execution is null', () => {
       const { current, proposed } = makeBaseStatePair();
       current.execution = null;
       const result = validateTransition(current, proposed);
       assert.strictEqual(result.valid, false);
       const guardError = result.errors.find(e => e.invariant === 'V11');
       assert.ok(guardError, 'Expected V11 guard error for null current.execution');
       assert.ok(guardError.message.includes('current.execution'), 'Message should reference current.execution');
     });

     it('returns structured error when current.project is null', () => {
       const { current, proposed } = makeBaseStatePair();
       current.project = null;
       const result = validateTransition(current, proposed);
       assert.strictEqual(result.valid, false);
       const guardError = result.errors.find(e => e.invariant === 'V13');
       assert.ok(guardError, 'Expected V13 guard error for null current.project');
       assert.ok(guardError.message.includes('current.project'), 'Message should reference current.project');
     });

     it('returns structured error when current is null', () => {
       const proposed = makeBaseState();
       proposed.project.updated = '2026-01-01T13:00:00Z';
       const result = validateTransition(null, proposed);
       assert.strictEqual(result.valid, false);
       const guardError = result.errors.find(e => e.invariant === 'V11');
       assert.ok(guardError, 'Expected V11 guard error for null current');
       assert.ok(guardError.message.includes('null'), 'Message should mention null');
     });

     it('does not throw TypeError when current.execution.phases is missing', () => {
       const { current, proposed } = makeBaseStatePair();
       current.execution = { status: 'in_progress', current_phase: 0, total_phases: 0 };
       // current.execution exists but has no .phases — V11 should handle gracefully
       // checkV11 uses `current.execution.phases || []` so it already handles this
       const result = validateTransition(current, proposed);
       // Should not throw — structured result expected
       assert.strictEqual(typeof result.valid, 'boolean');
     });
   });
   ```

7. **Verify no regressions** — After all changes, run `node tests/state-validator.test.js` and `node tests/constants.test.js`. All existing 43 tests must still pass alongside the new tests.

## Contracts & Interfaces

```javascript
// src/lib/state-validator.js — ValidationResult (return type of validateTransition)

/** @typedef {Object} ValidationPass
 *  @property {true} valid
 *  @property {15} invariants_checked */

/** @typedef {Object} ValidationFail
 *  @property {false} valid
 *  @property {15} invariants_checked
 *  @property {InvariantError[]} errors */

/** @typedef {ValidationPass|ValidationFail} ValidationResult */

/** @typedef {Object} InvariantError
 *  @property {string} invariant - "V1" through "V15"
 *  @property {string} message - Human-readable description
 *  @property {'critical'} severity - Always SEVERITY_LEVELS.CRITICAL ("critical") */
```

```javascript
// src/lib/state-validator.js — export signature (unchanged)
module.exports = { validateTransition };

// validateTransition(current: StateJson, proposed: StateJson) → ValidationResult
```

```javascript
// src/lib/constants.js — relevant enums used by state-validator.js
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning', EXECUTION: 'execution', REVIEW: 'review',
  COMPLETE: 'complete', HALTED: 'halted'
});
const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'
});
const SEVERITY_LEVELS = Object.freeze({ MINOR: 'minor', CRITICAL: 'critical' });
```

## Styles & Design Tokens

N/A — backend logic module, no UI.

## Test Requirements

- [ ] V10 positive test: all required keys present → passes (existing test, unchanged)
- [ ] V10 `proposed.limits = null` → returns `{ valid: false, errors: [{invariant: 'V10', ...}] }` (not TypeError)
- [ ] V10 `proposed.execution` deleted → returns `{ valid: false, errors: [{invariant: 'V10', ...}] }` (not TypeError)
- [ ] V10 short-circuit: when V10 fails, result contains NO V1/V3/etc. errors
- [ ] Current-state guard: `current.execution = null` → returns structured error with `invariant: 'V11'`
- [ ] Current-state guard: `current.project = null` → returns structured error with `invariant: 'V13'`
- [ ] Current-state guard: `current = null` → returns structured error (not TypeError)
- [ ] Current-state guard: `current.execution` exists but missing `.phases` → no TypeError, structured result
- [ ] All 43 existing tests still pass after restructuring
- [ ] `node tests/constants.test.js` still passes (no regressions)

## Acceptance Criteria

- [ ] No unused imports remain in `src/lib/state-validator.js` — only `PIPELINE_TIERS`, `TASK_STATUSES`, `SEVERITY_LEVELS` imported from `constants.js`
- [ ] `proposed.execution = null` returns `{ valid: false, errors: [{invariant: 'V10', ...}] }` — no TypeError thrown
- [ ] `proposed.limits = null` returns `{ valid: false, errors: [{invariant: 'V10', ...}] }` — no TypeError thrown
- [ ] V10 short-circuits: when V10 fails, V1–V9 errors do NOT appear in the result
- [ ] V11–V15 with `current.execution = null` return structured errors — no TypeError thrown
- [ ] V13 with `current.project = null` returns structured error — no TypeError thrown
- [ ] `validateTransition(null, validProposed)` returns structured error — no TypeError thrown
- [ ] `node tests/state-validator.test.js` passes — all existing 43 tests plus new null-guard and V10 tests
- [ ] `node tests/constants.test.js` still passes (no regressions)
- [ ] Build succeeds — `node -c src/lib/state-validator.js` exits 0

## Constraints

- Do NOT add new invariants (V16, etc.) — only fix ordering and guards for existing V1–V15
- Do NOT modify `src/lib/constants.js` — it is stable and finalized
- Do NOT modify `src/validate-state.js` — the CLI entry point is unchanged
- Do NOT change the `module.exports = { validateTransition }` export signature
- Do NOT change the `ValidationResult` return shape — `{ valid, invariants_checked: 15, errors? }`
- Do NOT throw exceptions from `validateTransition` — all error paths must return structured `ValidationResult`
- Do NOT use `console.log` or `console.error` in library code
- Do NOT add filesystem imports (`fs`, `path`) — this is a pure domain module
- Keep `'use strict'` as the first line
- Keep JSDoc on all functions
- Use `makeBaseStatePair()` helper pattern for new tests (consistent with existing 43 tests)
