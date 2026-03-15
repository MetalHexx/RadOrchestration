---
project: "PIPELINE-SIMPLIFICATION"
phase: 1
task: 4
title: "VALIDATOR"
status: "pending"
skills_required: ["execute_task"]
skills_optional: []
estimated_files: 2
---

# Validator Module

## Objective

Create `lib-v3/validator.js` implementing ~11 structural and transition invariant checks (V1–V7, V10–V13) with structured error output, and `tests-v3/validator.test.js` with per-invariant tests confirming V8/V9/V14/V15 are absent.

## Context

The v3 validator replaces the current 15-invariant `lib/state-validator.js` with ~11 invariants by removing four split-write guards (V8, V9, V14, V15) that are impossible to violate under atomic one-event-one-write semantics. The function signature adds a `config` parameter (third argument) so V5 and V7 can access pipeline limits and human gate settings without embedding config into the state object. The validator imports frozen enum objects and allowed transition maps from `constants.js` (already implemented in T01). It runs once per event — the engine calls `validateTransition(currentState, proposedState, config)` after mutation and before write.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/validator.js` | ~150 lines, ~11 invariant checks |
| CREATE | `.github/orchestration/scripts/tests-v3/validator.test.js` | Per-invariant tests + removed-invariant absence tests |

## Implementation Steps

1. Create `validator.js` — add `'use strict'` and import from `constants.js`: `PIPELINE_TIERS`, `PHASE_STATUSES`, `TASK_STATUSES`, `ALLOWED_TASK_TRANSITIONS`, `ALLOWED_PHASE_TRANSITIONS`.

2. Define a `makeError(invariant, message, field, current, proposed)` helper that returns a `ValidationError` object. The `current` and `proposed` params are optional (used only for transition checks V11–V13).

3. Implement proposed-only structural checks (V1–V5) — each as a standalone function returning `ValidationError[]`:
   - `checkV1(proposed)` — `execution.current_phase` within `[0, phases.length)`. Allow `current_phase === 0` when `phases.length === 0` (init state).
   - `checkV2(proposed)` — For the active phase only (at `current_phase` index): `current_task` within `[0, tasks.length)`. Allow `current_task === 0` when `tasks.length === 0`. Also allow `current_task === tasks.length` when all tasks are complete (pointer past end).
   - `checkV3(proposed)` — `execution.total_phases === execution.phases.length`.
   - `checkV4(proposed)` — For each phase: `phase.total_tasks === phase.tasks.length`.
   - `checkV5(proposed, config)` — `execution.phases.length <= config.limits.max_phases` AND for each phase: `phase.tasks.length <= config.limits.max_tasks_per_phase`.

4. Implement proposed-only gate checks (V6–V7):
   - `checkV6(proposed)` — If `execution.current_tier === 'execution'`, then `planning.human_approved` must be `true`.
   - `checkV7(proposed, config)` — If `execution.current_tier === 'complete'` AND `config.human_gates.after_final_review === true`, then `planning.human_approved` must be `true`. (Guards premature completion when human gate is enabled.)

5. Implement proposed-only structural check (V10):
   - `checkV10(proposed)` — When `execution.current_tier` is `'execution'`, the active phase (at `current_phase` index) must have `status` that is one of `'not_started'`, `'in_progress'`. When tier is `'planning'`, no phase should be `'in_progress'`. When tier is `'review'` or `'complete'`, all phases should be `'complete'` or `'halted'`.

6. Implement transition checks (V11–V13) — each takes `(current, proposed)`:
   - `checkV11(current, proposed)` — For each overlapping task pair across phases: `proposed.retries >= current.retries` (monotonically non-decreasing).
   - `checkV12(current, proposed)` — For each overlapping task pair: if status changed, verify `ALLOWED_TASK_TRANSITIONS[from].includes(to)`. For each overlapping phase pair: if status changed, verify `ALLOWED_PHASE_TRANSITIONS[from].includes(to)`.
   - `checkV13(current, proposed)` — `proposed.project.updated > current.project.updated` (string comparison on ISO timestamps).

7. Implement the main `validateTransition(current, proposed, config)` function:
   - Collect errors from V1–V7, V10 (proposed-only), then V11–V13 (transition checks, only if `current` is not `null`).
   - If `current` is `null` (init path), skip V11–V13.
   - Return the flat array of all `ValidationError` objects (empty array = valid).

8. Export `validateTransition` as the sole public export via `module.exports`.

9. Create `validator.test.js` — import `node:test` (`describe`, `it`) and `node:assert/strict`. Write per-invariant tests (details in Test Requirements below).

10. Verify all tests pass: `node --test tests-v3/validator.test.js`.

## Contracts & Interfaces

### ValidationError (output type)

```javascript
/**
 * @typedef {Object} ValidationError
 * @property {string} invariant - invariant ID (e.g., 'V1', 'V12')
 * @property {string} message - human-readable description
 * @property {string} field - dotpath to the violating field (e.g., 'execution.current_phase')
 * @property {*} [current] - current value (for transition checks V11–V13 only)
 * @property {*} [proposed] - proposed value (for transition checks V11–V13 only)
 */
```

### validateTransition (public API)

```javascript
/**
 * Validate a state transition. Runs structural and transition guards.
 * Returns empty array if valid.
 *
 * @param {StateJson | null} current - state before mutation (null on init)
 * @param {StateJson} proposed - state after mutation
 * @param {Config} config - parsed orchestration config (for V5, V7)
 * @returns {ValidationError[]}
 */
function validateTransition(current, proposed, config) { /* ... */ }
```

### Imports from constants.js (already implemented)

```javascript
const {
  PIPELINE_TIERS,
  PHASE_STATUSES,
  TASK_STATUSES,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
} = require('./constants.js');
```

### ALLOWED_TASK_TRANSITIONS (from constants.js — do not redefine)

```javascript
const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    [],
  'halted':      [],
});
```

### ALLOWED_PHASE_TRANSITIONS (from constants.js — do not redefine)

```javascript
const ALLOWED_PHASE_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'halted'],
  'complete':    [],
  'halted':      [],
});
```

### StateJson shape (for reference — imported types from constants.js)

```javascript
// StateJson structure the validator operates on:
{
  $schema: 'orchestration-state-v3',
  project: { name, created, updated },          // updated: ISO string
  planning: { status, human_approved, steps, current_step },
  execution: {
    status,                                      // 'not_started' | 'in_progress' | 'complete'
    current_tier,                                // one of PIPELINE_TIERS
    current_phase,                               // 0-indexed
    total_phases,                                // integer
    phases: [{
      name, status,                              // one of PHASE_STATUSES
      current_task,                              // 0-indexed
      total_tasks,                               // integer
      tasks: [{
        name, status,                            // one of TASK_STATUSES
        retries,                                 // non-negative integer
        handoff_doc, report_doc, review_doc,
        review_verdict, review_action,
        has_deviations, deviation_type
      }],
      phase_plan_doc, phase_report_doc, phase_review_doc,
      phase_review_verdict, phase_review_action
    }]
  }
}
```

### Config shape (subset needed by validator)

```javascript
// Config fields used by the validator:
{
  limits: {
    max_phases: number,              // e.g., 10
    max_tasks_per_phase: number,     // e.g., 10
  },
  human_gates: {
    after_final_review: boolean,     // e.g., true
  }
}
```

## Test Requirements

- [ ] **V1 — current_phase bounds**: Test that `current_phase = -1` and `current_phase >= phases.length` each produce a `ValidationError` with `invariant: 'V1'`. Test that `current_phase = 0` with empty phases array passes.
- [ ] **V2 — current_task bounds**: Test that `current_task = -1` and `current_task > tasks.length` each produce an error with `invariant: 'V2'` for the active phase. Test that `current_task === tasks.length` when all tasks are complete passes (pointer past end).
- [ ] **V3 — total_phases mismatch**: Test that `total_phases !== phases.length` produces `invariant: 'V3'`.
- [ ] **V4 — total_tasks mismatch**: Test that `total_tasks !== tasks.length` for any phase produces `invariant: 'V4'`.
- [ ] **V5 — config limits exceeded**: Test that `phases.length > config.limits.max_phases` produces `invariant: 'V5'`. Test that `tasks.length > config.limits.max_tasks_per_phase` produces `invariant: 'V5'`.
- [ ] **V6 — human approval gate (execution)**: Test that `current_tier = 'execution'` with `human_approved = false` produces `invariant: 'V6'`.
- [ ] **V7 — human approval gate (completion)**: Test that `current_tier = 'complete'` with `after_final_review = true` and `human_approved = false` produces `invariant: 'V7'`. Test that it passes when `after_final_review = false`.
- [ ] **V10 — phase status vs tier**: Test that active phase with `status: 'complete'` while tier is `'execution'` produces `invariant: 'V10'`. Test that a phase `'in_progress'` during `'planning'` tier produces V10.
- [ ] **V11 — retry monotonicity**: Test that a task's `retries` decreasing (e.g., 3 → 2) produces `invariant: 'V11'` with `current` and `proposed` values. Test that retries increasing or staying same passes.
- [ ] **V12 — status transitions**: Test that `not_started → complete` for a task produces `invariant: 'V12'`. Test that `not_started → in_progress` passes. Test phase transition `in_progress → not_started` produces V12. Test phase transition `in_progress → complete` passes.
- [ ] **V13 — timestamp monotonicity**: Test that `proposed.project.updated <= current.project.updated` produces `invariant: 'V13'` with both timestamps. Test that a strictly newer timestamp passes.
- [ ] **V8 absent**: Create a state where `review_doc` is set but `review_verdict` is null — confirm `validateTransition` returns NO error with `invariant: 'V8'`.
- [ ] **V9 absent**: Create a state where `phase_review_doc` is set but `phase_review_verdict` is null — confirm NO error with `invariant: 'V9'`.
- [ ] **V14 absent**: Create a transition where `review_doc` and `review_verdict` both change in the same write — confirm NO error with `invariant: 'V14'`.
- [ ] **V15 absent**: Create a transition where two tasks have `review_verdict` changes in the same write — confirm NO error with `invariant: 'V15'`.
- [ ] **Valid state passes**: Test that a fully valid state pair returns an empty error array.
- [ ] **Init path (current = null)**: Test that calling `validateTransition(null, validProposed, config)` skips V11–V13 and checks only structural invariants.
- [ ] All tests pass via `node --test tests-v3/validator.test.js`

## Acceptance Criteria

- [ ] `validateTransition(current, proposed, config)` is the sole export of `validator.js`
- [ ] Returns empty array `[]` for valid transitions
- [ ] Each of the ~11 invariants (V1–V7, V10–V13) has a dedicated test triggering a violation
- [ ] Each `ValidationError` includes `invariant` ID (e.g., `'V1'`), `message` string, and `field` dotpath
- [ ] Transition invariants (V11, V12, V13) include `current` and `proposed` values in the error
- [ ] V8, V9, V14, V15 are NOT checked — tests confirm these conditions produce zero errors
- [ ] `current = null` skips transition checks (V11–V13) without error
- [ ] All tests pass via `node --test tests-v3/validator.test.js`
- [ ] No lint errors, no syntax errors
- [ ] Module is importable: `require('./lib-v3/validator.js')` succeeds

## Constraints

- Do NOT redefine `ALLOWED_TASK_TRANSITIONS` or `ALLOWED_PHASE_TRANSITIONS` — import from `./constants.js`
- Do NOT implement V8, V9, V14, or V15 — these are intentionally removed
- Do NOT mutate the `current` or `proposed` state objects — the validator is a pure function
- Do NOT add filesystem I/O or side effects — the validator receives state objects, not file paths
- Do NOT import from `./state-io.js` or any other module except `./constants.js`
- Do NOT return a `{ valid, invariants_checked }` wrapper — return a flat `ValidationError[]` array (empty = valid)
- Use `node:test` and `node:assert/strict` only — zero external test dependencies
- Each test file self-contains its state factory helpers — do not import factories from other test files
- Target ~150 lines for `validator.js` (excluding JSDoc comments)
