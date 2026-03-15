---
project: "STATE-TRANSITION-SCRIPTS"
phase: 3
task: 3
title: "Triage Engine Test Suite"
status: "pending"
skills_required: ["coding"]
skills_optional: ["run-tests"]
estimated_files: 1
---

# Triage Engine Test Suite

## Objective

Create `tests/triage-engine.test.js` — a comprehensive test suite verifying all 16 decision table rows (11 task-level + 5 phase-level) in `src/lib/triage-engine.js`, plus `checkRetryBudget` unit tests and error cases (`DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`). Uses `node:test` framework with mock `readDocument` callbacks — zero filesystem access.

## Context

`src/lib/triage-engine.js` exports two functions: `executeTriage(state, level, readDocument)` and `checkRetryBudget(task, limits)`. The engine is a pure-function module that evaluates first-match-wins decision tables. It imports only from `./constants` and accepts a dependency-injected `readDocument` callback. Tests must exercise every row by constructing minimal state objects and mock document readers. The existing test suites (`constants.test.js`, `state-validator.test.js`, `resolver.test.js`, `next-action.test.js`) total 138 tests — this suite adds 30+ tests.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `tests/triage-engine.test.js` | Comprehensive triage engine test suite |

## Implementation Steps

1. Create `tests/triage-engine.test.js` with `'use strict'`, import `describe`/`it` from `node:test`, `assert` from `node:assert`.
2. Import `executeTriage` and `checkRetryBudget` from `../src/lib/triage-engine.js`.
3. Import constants: `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `TRIAGE_LEVELS` from `../src/lib/constants.js`.
4. Create a `makeBaseState()` helper that returns a minimal valid state object with execution tier, one phase (in_progress), and one task (complete with report_doc set). Use the same pattern as `tests/resolver.test.js` and `tests/state-validator.test.js`.
5. Create a `mockReadDocument(docMap)` helper that returns a function: given a path, return `docMap[path]` or `null`. Each doc in the map has shape `{ frontmatter: {...}, body: '...' }`.
6. Implement the `describe('Task-Level Decision Table')` block with 11 tests — one per row:
   - Row 1: state has task with `report_doc` set, no `review_doc`. Mock returns report with `{ status: 'complete', has_deviations: false }`. Assert `success: true`, `verdict: null`, `action: null`, `row_matched: 1`.
   - Row 2: task complete, no deviations, review_doc set. Mock report `{ status: 'complete', has_deviations: false }`, mock review `{ verdict: 'approved' }`. Assert verdict `'approved'`, action `'advanced'`, row 2.
   - Row 3: task complete, minor deviations, approved. Mock report `{ status: 'complete', has_deviations: true, deviation_type: 'minor' }`, review `{ verdict: 'approved' }`. Assert row 3.
   - Row 4: task complete, architectural deviations, approved. Mock report `{ status: 'complete', has_deviations: true, deviation_type: 'architectural' }`, review `{ verdict: 'approved' }`. Assert row 4.
   - Row 5: task complete, review changes_requested. Mock report `{ status: 'complete' }`, review `{ verdict: 'changes_requested' }`. Assert action `'corrective_task_issued'`, row 5.
   - Row 6: task complete, review rejected. Mock report `{ status: 'complete' }`, review `{ verdict: 'rejected' }`. Assert action `'halted'`, row 6.
   - Row 7: task partial, no review_doc. Mock report `{ status: 'partial' }`. Assert verdict null, action null, row 7.
   - Row 8: task partial, review changes_requested. Mock report `{ status: 'partial' }`, review `{ verdict: 'changes_requested' }`. Assert action `'corrective_task_issued'`, row 8.
   - Row 9: task partial, review rejected. Mock report `{ status: 'partial' }`, review `{ verdict: 'rejected' }`. Assert action `'halted'`, row 9.
   - Row 10: task failed, minor severity, retries=0 (below max=2). Mock report `{ status: 'failed' }`. Assert action `'corrective_task_issued'`, row 10.
   - Row 11: task failed, critical severity. Mock report `{ status: 'failed' }`. Assert action `'halted'`, row 11.
7. Implement `describe('checkRetryBudget')` with 5+ direct unit tests:
   - minor severity, retries 0, max 2 → `'corrective_task_issued'`
   - minor severity, retries 2, max 2 → `'halted'` (at max)
   - minor severity, retries 3, max 2 → `'halted'` (above max)
   - critical severity, retries 0, max 2 → `'halted'`
   - severity null, retries 0, max 2 → `'halted'`
8. Implement `describe('Phase-Level Decision Table')` with 5 tests:
   - Row 1: `phase_review` is null → verdict null, action null, row 1.
   - Row 2: phase review approved, `exit_criteria_met: true` → `'approved'`/`'advanced'`, row 2.
   - Row 3: phase review approved, `exit_criteria_met: 'partial'` → `'approved'`/`'advanced'`, row 3.
   - Row 4: phase review changes_requested → `'changes_requested'`/`'corrective_tasks_issued'` (plural), row 4.
   - Row 5: phase review rejected → `'rejected'`/`'halted'`, row 5.
9. Implement `describe('Error Cases')` with tests for:
   - `DOCUMENT_NOT_FOUND`: task level, `report_doc` path set but mock returns null. Assert `success: false`, `error_code: 'DOCUMENT_NOT_FOUND'`.
   - `DOCUMENT_NOT_FOUND`: task level, `review_doc` path set but mock returns null. Assert `error_code: 'DOCUMENT_NOT_FOUND'`.
   - `DOCUMENT_NOT_FOUND`: phase level, `phase_review` path set but mock returns null. Assert `error_code: 'DOCUMENT_NOT_FOUND'`.
   - `INVALID_VERDICT`: task level, review doc has `{ verdict: 'bogus' }`. Assert `error_code: 'INVALID_VERDICT'`.
   - `INVALID_VERDICT`: phase level, phase review has `{ verdict: 'bogus' }`. Assert `error_code: 'INVALID_VERDICT'`.
   - `IMMUTABILITY_VIOLATION`: task level, task already has `review_verdict: 'approved'`. Assert `error_code: 'IMMUTABILITY_VIOLATION'`.
   - `IMMUTABILITY_VIOLATION`: phase level, phase already has `phase_review_verdict: 'approved'`. Assert `error_code: 'IMMUTABILITY_VIOLATION'`.
   - `INVALID_LEVEL`: level is `'bogus'`. Assert `error_code: 'INVALID_LEVEL'`.
   - `INVALID_STATE`: state is `null`. Assert `error_code: 'INVALID_STATE'`.
   - `INVALID_STATE`: state has no `execution.phases`. Assert `error_code: 'INVALID_STATE'`.
10. Add edge-case tests documented in the Code Review recommendations:
    - `deviations` frontmatter field (truthy fallback for `has_deviations`)
    - `exit_criteria_met` variants: `true`, `'all'`, `undefined`, `null` → Row 2; `false`, `'partial'` → Row 3
    - Row 10 with review doc present → verdict sourced from review; Row 10 without review doc → verdict null

## Contracts & Interfaces

```javascript
// src/lib/triage-engine.js — exported functions

/**
 * @param {StateJson} state - Parsed state.json object
 * @param {'task'|'phase'} level - Which decision table to evaluate
 * @param {ReadDocumentFn} readDocument - Injected callback
 * @returns {TriageResult}
 */
function executeTriage(state, level, readDocument) { /* ... */ }

/**
 * @param {Task} task - The current task object from state.json
 * @param {{ max_retries_per_task: number }} limits
 * @returns {'corrective_task_issued'|'halted'}
 */
function checkRetryBudget(task, limits) { /* ... */ }
```

**ReadDocumentFn callback signature:**
```javascript
/**
 * @callback ReadDocumentFn
 * @param {string} docPath
 * @returns {{ frontmatter: Record<string, any> | null, body: string } | null}
 */
```

**TriageSuccess shape:**
```javascript
{ success: true, level, verdict, action, phase_index, task_index, row_matched, details }
```

**TriageError shape:**
```javascript
{ success: false, level, error, error_code, phase_index, task_index }
```

**Error codes:** `'DOCUMENT_NOT_FOUND'`, `'INVALID_VERDICT'`, `'IMMUTABILITY_VIOLATION'`, `'INVALID_STATE'`, `'INVALID_LEVEL'`

**Constants needed:**
```javascript
const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',  // singular — task-level
  HALTED: 'halted'
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',  // plural — phase-level
  HALTED: 'halted'
});

const SEVERITY_LEVELS = Object.freeze({
  MINOR: 'minor',
  CRITICAL: 'critical'
});

const TRIAGE_LEVELS = Object.freeze({
  TASK: 'task',
  PHASE: 'phase'
});
```

## Styles & Design Tokens

N/A — pure test file with no UI.

## Test Requirements

- [ ] All 11 task-level decision table rows tested (Rows 1–11)
- [ ] All 5 phase-level decision table rows tested (Phase Rows 1–5)
- [ ] `checkRetryBudget()` tested directly with 5 input combinations: minor+available, minor+at-max, minor+above-max, critical+available, null+available
- [ ] Row 10 tested with review doc present (verdict sourced from review) AND without review doc (verdict null)
- [ ] `DOCUMENT_NOT_FOUND` tested for: missing task report, missing code review, missing phase review
- [ ] `INVALID_VERDICT` tested for: unrecognized task-level verdict, unrecognized phase-level verdict
- [ ] `IMMUTABILITY_VIOLATION` tested for: task-level (non-null review_verdict), phase-level (non-null phase_review_verdict)
- [ ] `INVALID_LEVEL` tested: bad level string
- [ ] `INVALID_STATE` tested: null state, missing execution.phases
- [ ] `deviations` frontmatter fallback tested (truthy field instead of `has_deviations`)
- [ ] `exit_criteria_met` variants tested: `true`/`'all'`/`undefined`/`null` → Row 2; `false`/`'partial'` → Row 3
- [ ] Phase Row 4 action is `'corrective_tasks_issued'` (plural), not singular
- [ ] Task Row 5/8/10 action is `'corrective_task_issued'` (singular), not plural

## Acceptance Criteria

- [ ] File `tests/triage-engine.test.js` exists with `'use strict'` at the top
- [ ] Uses `node:test` framework (`describe`/`it` from `require('node:test')`, `assert` from `require('node:assert')`)
- [ ] Imports `executeTriage` and `checkRetryBudget` directly from `../src/lib/triage-engine.js` (no subprocess spawning)
- [ ] All 11 task-level rows have at least one test case each
- [ ] All 5 phase-level rows have at least one test case each
- [ ] `checkRetryBudget()` has 5+ dedicated unit tests covering severity × retry combinations
- [ ] Error cases tested: `DOCUMENT_NOT_FOUND` (3 variants), `INVALID_VERDICT` (2 variants), `IMMUTABILITY_VIOLATION` (2 variants), `INVALID_LEVEL`, `INVALID_STATE` (2 variants)
- [ ] Edge cases from Code Review tested: `deviations` fallback field, `exit_criteria_met` variants
- [ ] Uses `makeBaseState()` helper consistent with Phase 1/2 test conventions
- [ ] Uses mock `readDocument` callback — zero filesystem access
- [ ] `node tests/triage-engine.test.js` exits with code `0` (all tests pass)
- [ ] All existing test suites still pass — no regressions (138 tests)
- [ ] No lint errors, no syntax errors (`node -c tests/triage-engine.test.js` passes)

## Constraints

- Do NOT modify `src/lib/triage-engine.js` — this is a test-only task
- Do NOT modify `src/lib/constants.js` — use existing enums as-is
- Do NOT access the filesystem in tests — all document reads are via mock `readDocument` callbacks
- Do NOT use subprocess spawning to test — import functions directly via `require()`
- Do NOT create or modify any file other than `tests/triage-engine.test.js`
- Test file must use `node:test` (`describe`/`it`), NOT the older manual test harness pattern
