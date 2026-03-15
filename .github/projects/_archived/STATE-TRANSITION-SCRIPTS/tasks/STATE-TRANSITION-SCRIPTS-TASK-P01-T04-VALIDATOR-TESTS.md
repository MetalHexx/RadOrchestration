---
project: "STATE-TRANSITION-SCRIPTS"
phase: 1
task: 4
title: "State Validator Test Suite"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# State Validator Test Suite

## Objective

Create `tests/state-validator.test.js` — a comprehensive test suite for the `validateTransition(current, proposed)` function that covers all 15 invariants (V1–V15) with at least one positive (valid transition) and one negative (violation) test case per invariant, totaling 30+ test cases. Uses the `node:test` runner and `node:assert`.

## Context

The state-validator module (`src/lib/state-validator.js`) exports a single pure function `validateTransition(current, proposed)` that checks 15 invariants against a pair of state.json objects and returns a structured `ValidationResult`. The function imports only from `src/lib/constants.js` (shared enums). This task writes tests only — no production code changes. The test file must be runnable with `node tests/state-validator.test.js` and exit with code `0`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `tests/state-validator.test.js` | Test suite — sole file for this task |

## Implementation Steps

1. Add `'use strict';` at top. Import `{ describe, it } from 'node:test'` and `assert from 'node:assert'`.
2. Import `{ validateTransition } from '../src/lib/state-validator.js'`.
3. Create a `makeBaseState()` factory function that returns a minimal valid state.json object (see Base State Factory below). Every test clones and mutates this base rather than building state from scratch.
4. Create a `makeBaseStatePair()` helper that returns `{ current: makeBaseState(), proposed: makeBaseState() }` with `proposed.project.updated` set to a timestamp newer than `current.project.updated` (satisfies V13 by default).
5. For each invariant V1–V15, create a `describe('V{N} — {name}')` block containing at minimum one `it('passes when ...')` (positive) and one `it('fails when ...')` (negative) test case.
6. In positive tests: call `validateTransition(current, proposed)`, assert `result.valid === true` and `result.invariants_checked === 15`.
7. In negative tests: mutate the proposed (or current for V11–V15) state to violate exactly one invariant, call `validateTransition(current, proposed)`, assert `result.valid === false`, `result.invariants_checked === 15`, and verify `result.errors` contains an entry with the expected `invariant` string (e.g., `'V6'`) and `severity === 'critical'`.
8. For V12 (task status transitions), include multiple sub-tests covering valid transitions (`not_started→in_progress`, `in_progress→complete`, `in_progress→failed`, `failed→in_progress`) and invalid transitions (`not_started→complete`, `complete→in_progress`, `not_started→failed`).
9. For V14 and V15, test both the violation case and the allowed case to confirm write-ordering and immutability logic.
10. Verify the total test count is ≥ 30 (15 positive + 15 negative minimum).

## Contracts & Interfaces

### `validateTransition` Signature

```javascript
/**
 * @param {StateJson} current - The current (committed) state.json object
 * @param {StateJson} proposed - The proposed (uncommitted) state.json object
 * @returns {ValidationResult}
 */
function validateTransition(current, proposed) { /* ... */ }
```

### `ValidationResult` Return Shape

```javascript
// On success (all invariants pass):
{
  valid: true,
  invariants_checked: 15
}

// On failure (one or more invariants violated):
{
  valid: false,
  invariants_checked: 15,
  errors: [
    {
      invariant: 'V6',               // "V1" through "V15"
      message: 'Human-readable...',   // String describing the violation
      severity: 'critical'            // Always "critical"
    }
  ]
}
```

### `InvariantError` Shape

```javascript
/**
 * @typedef {Object} InvariantError
 * @property {string} invariant - "V1" through "V15"
 * @property {string} message - Human-readable description with field paths and values
 * @property {'critical'} severity - Always "critical"
 */
```

### Allowed Task Status Transitions (used by V12)

```javascript
const ALLOWED_TASK_TRANSITIONS = {
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'complete':    [],                // terminal
  'failed':      ['in_progress'],   // retry path
  'halted':      []                 // terminal
};
```

### Invariant Definitions (V1–V15)

| # | Invariant | Inputs | What It Checks |
|---|-----------|--------|----------------|
| V1 | `current_phase` index bounds | Proposed only | `execution.current_phase` is a valid 0-based index into `execution.phases[]`, or `0` if `phases[]` is empty |
| V2 | `current_task` index bounds | Proposed only | Each phase's `current_task` is a valid 0-based index into that phase's `tasks[]`, or `0` if `tasks[]` is empty |
| V3 | Retry limit | Proposed only | No task's `retries` exceeds `limits.max_retries_per_task` |
| V4 | Max phases | Proposed only | `phases.length` ≤ `limits.max_phases` |
| V5 | Max tasks per phase | Proposed only | Each phase's `tasks.length` ≤ `limits.max_tasks_per_phase` |
| V6 | Single in_progress task | Proposed only | At most one task across the entire project has `status: "in_progress"` |
| V7 | Human approval before execution | Proposed only | If `pipeline.current_tier === "execution"` then `planning.human_approved` must be `true` |
| V8 | Task triage consistency | Proposed only | No task has `review_doc != null` while `review_verdict == null` (would mean triage was skipped) |
| V9 | Phase triage consistency | Proposed only | No phase has `phase_review != null` while `phase_review_verdict == null` |
| V10 | Null treatment / structural validation | Proposed only | Required top-level keys (`execution`, `pipeline`, `planning`, `limits`) exist and are not null |
| V11 | Retry monotonicity | Current → Proposed | No task's `retries` count decreased compared to current state |
| V12 | Task status transitions | Current → Proposed | All task status changes follow allowed paths: `not_started→in_progress`, `in_progress→complete\|failed\|halted`, `failed→in_progress` |
| V13 | Timestamp monotonicity | Current → Proposed | `proposed.project.updated` is strictly newer than `current.project.updated` |
| V14 | Write ordering | Current → Proposed | If `review_doc` changed from `null` to non-null, then `review_verdict` and `review_action` must NOT also change in the same write |
| V15 | Cross-task immutability | Current → Proposed | At most one task's `review_verdict`/`review_action` may change in a single write |

### Base State Factory

Use this as the `makeBaseState()` return value — a minimal valid state that passes all 15 invariants when used as both current and proposed (with proposed having a newer timestamp):

```javascript
function makeBaseState() {
  return {
    project: {
      name: 'TEST-PROJECT',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T12:00:00Z'
    },
    pipeline: {
      current_tier: 'execution',
      human_gate_mode: 'autonomous'
    },
    planning: {
      status: 'complete',
      steps: {
        research:      { status: 'complete', output: 'RESEARCH.md' },
        prd:           { status: 'complete', output: 'PRD.md' },
        design:        { status: 'complete', output: 'DESIGN.md' },
        architecture:  { status: 'complete', output: 'ARCHITECTURE.md' },
        master_plan:   { status: 'complete', output: 'MASTER-PLAN.md' }
      },
      human_approved: true
    },
    execution: {
      status: 'in_progress',
      current_phase: 0,
      total_phases: 1,
      phases: [
        {
          phase_number: 1,
          title: 'Phase One',
          status: 'in_progress',
          phase_doc: 'phases/PHASE-01.md',
          current_task: 0,
          total_tasks: 2,
          tasks: [
            {
              task_number: 1,
              title: 'Task One',
              status: 'complete',
              handoff_doc: 'tasks/TASK-P01-T01.md',
              report_doc: 'reports/REPORT-P01-T01.md',
              retries: 0,
              last_error: null,
              severity: null,
              review_doc: 'tasks/REVIEW-P01-T01.md',
              review_verdict: 'approved',
              review_action: 'advanced'
            },
            {
              task_number: 2,
              title: 'Task Two',
              status: 'not_started',
              handoff_doc: null,
              report_doc: null,
              retries: 0,
              last_error: null,
              severity: null,
              review_doc: null,
              review_verdict: null,
              review_action: null
            }
          ],
          phase_report: null,
          human_approved: false,
          phase_review: null,
          phase_review_verdict: null,
          phase_review_action: null
        }
      ]
    },
    final_review: {
      status: 'not_started',
      report_doc: null,
      human_approved: false
    },
    errors: {
      total_retries: 0,
      total_halts: 0,
      active_blockers: []
    },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2
    }
  };
}
```

### `makeBaseStatePair()` Helper

```javascript
function makeBaseStatePair() {
  const current = makeBaseState();
  const proposed = makeBaseState();
  proposed.project.updated = '2026-01-01T13:00:00Z'; // newer than current
  return { current, proposed };
}
```

Use `structuredClone()` or `JSON.parse(JSON.stringify(...))` if you need independent deep clones of nested objects for mutation in individual tests.

## Test Requirements

### Structure

- One top-level `describe('state-validator')` block
- Inside: 15 `describe('V{N} — {description}')` blocks, one per invariant
- Each `describe` block has at minimum:
  - One `it('passes when ...')` — positive test
  - One `it('fails when ...')` — negative test
- V12 must have additional sub-tests for multiple transition types

### Minimum Test Cases (30+)

| Invariant | Positive Tests | Negative Tests | Notes |
|-----------|---------------|----------------|-------|
| V1 | 1 — valid `current_phase` index | 1 — `current_phase` out of bounds | |
| V2 | 1 — valid `current_task` index per phase | 1 — `current_task` out of bounds | |
| V3 | 1 — retries within limit | 1 — retries exceed limit | |
| V4 | 1 — phases within limit | 1 — phases exceed limit | |
| V5 | 1 — tasks within limit per phase | 1 — tasks exceed limit | |
| V6 | 1 — zero or one in_progress task | 1 — two tasks in_progress | |
| V7 | 1 — execution tier with human_approved=true | 1 — execution tier with human_approved=false | |
| V8 | 1 — review_doc+verdict both set, or both null | 1 — review_doc set but verdict null | |
| V9 | 1 — phase_review+verdict both set, or both null | 1 — phase_review set but verdict null | |
| V10 | 1 — all required keys present | 1 — missing required key (e.g., `limits`) | |
| V11 | 1 — retries same or increased | 1 — retries decreased | |
| V12 | 4+ — valid transitions | 3+ — invalid transitions | Multiple transition paths |
| V13 | 1 — proposed.updated newer | 1 — proposed.updated same or older | |
| V14 | 1 — review_doc change without verdict change | 1 — review_doc AND verdict changed together | |
| V15 | 1 — only one task's verdict changed | 1 — two tasks' verdicts changed | |

### Assertion Patterns

**Positive test pattern:**
```javascript
it('passes when current_phase is valid index', () => {
  const { current, proposed } = makeBaseStatePair();
  // proposed already has valid current_phase=0 with 1 phase
  const result = validateTransition(current, proposed);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.invariants_checked, 15);
});
```

**Negative test pattern:**
```javascript
it('fails when current_phase is out of bounds', () => {
  const { current, proposed } = makeBaseStatePair();
  proposed.execution.current_phase = 5; // only 1 phase exists
  const result = validateTransition(current, proposed);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.invariants_checked, 15);
  const v1Error = result.errors.find(e => e.invariant === 'V1');
  assert.ok(v1Error, 'Expected V1 error');
  assert.strictEqual(v1Error.severity, 'critical');
});
```

## Acceptance Criteria

- [ ] `node tests/state-validator.test.js` exits with code `0`
- [ ] At least 15 positive test cases (one per invariant V1–V15)
- [ ] At least 15 negative test cases (one per invariant V1–V15)
- [ ] Total test count ≥ 30
- [ ] V12 has tests for at least 4 valid transitions and 3 invalid transitions
- [ ] V14 has both a passing (doc-only change) and failing (doc+verdict change) test
- [ ] V15 has both a passing (single-task change) and failing (multi-task change) test
- [ ] All tests import `validateTransition` directly via `require('../src/lib/state-validator.js')`
- [ ] `makeBaseState()` factory produces a state that passes validation when used as both sides
- [ ] Every negative test asserts `result.valid === false`, finds the expected `invariant` string in `errors`, and checks `severity === 'critical'`
- [ ] No lint errors, no syntax errors
- [ ] File uses `'use strict'`, CommonJS, `node:test` (`describe`/`it`), `node:assert`

## Constraints

- Do NOT modify `src/lib/state-validator.js` or `src/lib/constants.js` — test-only task
- Do NOT use any npm packages — `node:test` and `node:assert` only
- Do NOT spawn subprocesses to run the validator — import and call `validateTransition` directly
- Do NOT use `beforeEach` to share mutable state between tests — each test creates its own state pair via `makeBaseStatePair()`
- Do NOT add `async` to test callbacks unless the test requires it (all validator calls are synchronous)
- Keep each test focused on exactly one invariant — do not create "integration" tests that check multiple violations at once
