---
project: "STATE-TRANSITION-SCRIPTS"
phase: 3
task: 1
title: "Phase 2 Carry-Forward Cleanup"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 2
---

# Phase 2 Carry-Forward Cleanup

## Objective

Fix one semantic enum misalignment in `src/lib/resolver.js` and add 4 negative tests to `tests/resolver.test.js` confirming the resolver never emits Orchestrator-managed actions. These are the 2 carry-forward items from the Phase 2 Review.

## Context

`src/lib/resolver.js` exports `resolveNextAction(state, config?)` — a pure function encoding 31 resolution paths. At line 392, `resolveReview()` compares `finalReview.status` against `PLANNING_STEP_STATUSES.COMPLETE`. This is functionally correct (both equal `'complete'`) but semantically wrong — `final_review.status` uses the `'not_started'|'in_progress'|'complete'|'failed'` pattern which aligns with `TASK_STATUSES`, not `PLANNING_STEP_STATUSES`. The test suite (`tests/resolver.test.js`) has 44 passing tests using `node:test` (`describe`/`it`) and `node:assert`. It uses `makeBaseState()`, `makePlanningState()`, and `makePhaseLifecycleState()` helpers.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `src/lib/resolver.js` | Change enum at line 392 from `PLANNING_STEP_STATUSES.COMPLETE` to `TASK_STATUSES.COMPLETE` |
| MODIFY | `tests/resolver.test.js` | Add 4 negative tests in a new `describe` block at end of file |

## Implementation Steps

1. **Open `src/lib/resolver.js`** — locate the `resolveReview()` function (line ~388).

2. **Change line 392** from:
   ```javascript
   if (finalReview.status !== PLANNING_STEP_STATUSES.COMPLETE) {
   ```
   to:
   ```javascript
   if (finalReview.status !== TASK_STATUSES.COMPLETE) {
   ```
   `TASK_STATUSES` is already imported at line 5. `PLANNING_STEP_STATUSES` remains imported — it is still used at line 99 in `resolvePlanning()`. No import changes needed.

3. **Open `tests/resolver.test.js`** — add a new `describe('Orchestrator-managed actions — negative tests', ...)` block after the existing `describe('NextActionResult shape', ...)` block (after the last test at line ~535).

4. **Build a representative state array** inside the new describe block. Construct states covering all major resolution branches:
   - `null` (no state → `INIT_PROJECT`)
   - Halted tier
   - Complete tier
   - Planning tier with incomplete step
   - Planning tier with all steps complete, not approved
   - Execution tier with `not_started` task (no handoff)
   - Execution tier with `not_started` task (has handoff)
   - Execution tier with `in_progress` task
   - Execution tier with `failed` task (critical)
   - Execution tier with `failed` task (minor, retries available)
   - Execution tier with `complete` task (approved)
   - Execution tier with `complete` task (changes_requested)
   - Execution tier with `complete` task (rejected)
   - Execution tier with `complete` task (review_doc set, no verdict)
   - Execution tier with `complete` task (no review_doc, no verdict)
   - Phase lifecycle: no phase_report
   - Phase lifecycle: phase_report, no phase_review
   - Phase lifecycle: phase_review, no verdict
   - Phase lifecycle: approved + advanced
   - Phase lifecycle: halted
   - Phase lifecycle: corrective_tasks_issued
   - Review tier: not complete
   - Review tier: complete, not approved
   - Review tier: complete + approved

5. **Write 4 `it()` tests** — one for each forbidden action. Each test iterates all representative states, calls `resolveNextAction(state)`, and asserts `result.action !== NEXT_ACTIONS.<FORBIDDEN_ACTION>`.

6. **Verify** the 4 forbidden action constants exist (they are already imported in the test file via `NEXT_ACTIONS`):
   - `NEXT_ACTIONS.UPDATE_STATE_FROM_REVIEW` = `'update_state_from_review'`
   - `NEXT_ACTIONS.HALT_TRIAGE_INVARIANT` = `'halt_triage_invariant'`
   - `NEXT_ACTIONS.UPDATE_STATE_FROM_PHASE_REVIEW` = `'update_state_from_phase_review'`
   - `NEXT_ACTIONS.HALT_PHASE_TRIAGE_INVARIANT` = `'halt_phase_triage_invariant'`

7. **Run tests** — `node tests/resolver.test.js` must pass with 48 tests (44 existing + 4 new).

8. **Run regression suites** — `node tests/state-validator.test.js` (48 tests) and `node tests/constants.test.js` (29 tests) must pass with zero failures.

## Contracts & Interfaces

The resolver's existing import block (no changes needed — `TASK_STATUSES` is already imported):

```javascript
// src/lib/resolver.js — lines 3–7
const {
  PIPELINE_TIERS, PLANNING_STATUSES, PLANNING_STEP_STATUSES,
  PHASE_STATUSES, TASK_STATUSES, REVIEW_VERDICTS, REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS, SEVERITY_LEVELS, HUMAN_GATE_MODES, NEXT_ACTIONS
} = require('./constants');
```

Relevant constant values (from `src/lib/constants.js`):

```javascript
const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',      // ← currently used at line 392; same string value
  FAILED: 'failed',
  SKIPPED: 'skipped'
});

const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',      // ← replacement; identical string value
  FAILED: 'failed',
  HALTED: 'halted'
});
```

The 4 Orchestrator-managed actions (never produced by the resolver):

```javascript
// From NEXT_ACTIONS enum in src/lib/constants.js
UPDATE_STATE_FROM_REVIEW: 'update_state_from_review',
HALT_TRIAGE_INVARIANT: 'halt_triage_invariant',
UPDATE_STATE_FROM_PHASE_REVIEW: 'update_state_from_phase_review',
HALT_PHASE_TRIAGE_INVARIANT: 'halt_phase_triage_invariant',
```

The test file's existing imports (no changes needed — `NEXT_ACTIONS` already available):

```javascript
// tests/resolver.test.js — lines 1–10
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { resolveNextAction } = require('../src/lib/resolver.js');
const {
  PIPELINE_TIERS, PLANNING_STEP_STATUSES, PHASE_STATUSES, TASK_STATUSES,
  REVIEW_VERDICTS, REVIEW_ACTIONS, PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS, HUMAN_GATE_MODES, NEXT_ACTIONS
} = require('../src/lib/constants.js');
```

Existing test helper signatures (use these — do NOT create new helpers):

```javascript
function makeBaseState() { /* returns execution-tier state with 1 phase, 2 tasks */ }
function makePlanningState(overrides) { /* returns planning-tier state */ }
function makePhaseLifecycleState() { /* returns state with current_task past end */ }
```

## Styles & Design Tokens

N/A — pure logic module, no UI.

## Test Requirements

- [ ] 4 new negative tests exist in `tests/resolver.test.js` in a `describe('Orchestrator-managed actions — negative tests', ...)` block
- [ ] Each test iterates a comprehensive set of representative states (at least 20 states)
- [ ] Test 1 asserts `resolveNextAction(state).action !== NEXT_ACTIONS.UPDATE_STATE_FROM_REVIEW` for all states
- [ ] Test 2 asserts `resolveNextAction(state).action !== NEXT_ACTIONS.HALT_TRIAGE_INVARIANT` for all states
- [ ] Test 3 asserts `resolveNextAction(state).action !== NEXT_ACTIONS.UPDATE_STATE_FROM_PHASE_REVIEW` for all states
- [ ] Test 4 asserts `resolveNextAction(state).action !== NEXT_ACTIONS.HALT_PHASE_TRIAGE_INVARIANT` for all states
- [ ] All 48 resolver tests pass (`node tests/resolver.test.js` exit 0)
- [ ] All 48 state-validator tests pass (`node tests/state-validator.test.js` exit 0)
- [ ] All 29 constants tests pass (`node tests/constants.test.js` exit 0)

## Acceptance Criteria

- [ ] `resolveReview()` at line 392 uses `TASK_STATUSES.COMPLETE` instead of `PLANNING_STEP_STATUSES.COMPLETE`
- [ ] `PLANNING_STEP_STATUSES` import remains (still used at line 99 in `resolvePlanning()`)
- [ ] No behavioral change — resolver returns identical results for all inputs (both constants resolve to `'complete'`)
- [ ] 4 new negative tests exist confirming the resolver never emits the 4 Orchestrator-managed actions
- [ ] `node tests/resolver.test.js` passes — 48 tests (44 existing + 4 new), 0 failures
- [ ] `node tests/state-validator.test.js` passes — 48 tests, 0 failures
- [ ] `node tests/constants.test.js` passes — 29 tests, 0 failures
- [ ] `node -c src/lib/resolver.js` and `node -c tests/resolver.test.js` pass (no syntax errors)
- [ ] No new files created (both changes are MODIFY only)

## Constraints

- Do NOT modify any file other than `src/lib/resolver.js` and `tests/resolver.test.js`
- Do NOT change the `PLANNING_STEP_STATUSES.COMPLETE` comparison at line 99 — that one is semantically correct for planning steps
- Do NOT remove any existing imports — `PLANNING_STEP_STATUSES` is still needed
- Do NOT add new imports to either file — all required constants are already imported
- Do NOT refactor or restructure existing code beyond the single-line enum change
- Do NOT create new test helper functions — reuse `makeBaseState()`, `makePlanningState()`, and `makePhaseLifecycleState()`
- Do NOT add tests for the enum change itself — it is a readability-only change with no behavioral impact
