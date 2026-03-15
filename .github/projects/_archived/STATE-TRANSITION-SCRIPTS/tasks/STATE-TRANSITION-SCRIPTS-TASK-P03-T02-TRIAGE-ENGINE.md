---
project: "STATE-TRANSITION-SCRIPTS"
phase: 3
task: 2
title: "Triage Engine Core"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# Triage Engine Core

## Objective

Create `src/lib/triage-engine.js` — the pure-function domain module that encodes both the 11-row task-level and 5-row phase-level decision tables. Export `executeTriage(state, level, readDocument)` and the named helper `checkRetryBudget(task, limits)`. This module uses dependency-injected document reading and imports only from `./constants`.

## Context

The orchestration pipeline's triage logic decides what happens after a task report or phase review is produced — advance, issue a corrective task, or halt. This module is the deterministic engine that evaluates those decisions. It is a pure function with zero I/O: all document access is via an injected `readDocument` callback, so tests can supply mock documents. The CLI wrapper (`src/triage.js`, a later task) will wire real filesystem access. The constants module at `src/lib/constants.js` already exports all required enums: `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `TRIAGE_LEVELS`, `TASK_STATUSES`, `PHASE_STATUSES`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/lib/triage-engine.js` | Triage engine domain module — pure functions only |

## Implementation Steps

1. Add `'use strict'` and require `./constants` — import `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `TRIAGE_LEVELS`.

2. Implement `checkRetryBudget(task, limits)` — the named helper for Row 10 branching logic:
   - If `task.retries < limits.max_retries_per_task` AND `task.severity === 'minor'` → return `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED` (`'corrective_task_issued'`)
   - Otherwise → return `REVIEW_ACTIONS.HALTED` (`'halted'`)
   - Critical severity always returns `'halted'` regardless of retry budget.

3. Implement input validation at the top of `executeTriage()`:
   - If `level` is not `'task'` or `'phase'` → return `TriageError` with `error_code: 'INVALID_LEVEL'`
   - If `state` is falsy or missing `execution.phases` → return `TriageError` with `error_code: 'INVALID_STATE'`
   - Resolve current phase from `state.execution.phases[state.execution.current_phase]`. If not found → `INVALID_STATE`.

4. Implement the immutability check:
   - For task-level: check that `task.review_verdict` and `task.review_action` are both `null`. If either is non-null → return `TriageError` with `error_code: 'IMMUTABILITY_VIOLATION'`.
   - For phase-level: check that `phase.phase_review_verdict` and `phase.phase_review_action` are both `null`. If either is non-null → return `TriageError` with `error_code: 'IMMUTABILITY_VIOLATION'`.

5. Implement `triageTask(state, phase, task, readDocument)` — the 11-row task-level decision table. Evaluate rows sequentially; first match wins. Read the task report via `readDocument(task.report_doc)`. If `task.review_doc` is non-null, read the code review via `readDocument(task.review_doc)`. Extract `report_status` from the task report frontmatter `status` field. Extract deviations info from the task report. Extract `verdict` from the code review frontmatter `verdict` field.

6. Implement `triagePhase(state, phase, readDocument)` — the 5-row phase-level decision table. Evaluate rows sequentially; first match wins. If `phase.phase_review` is null → Row 1 (skip). Otherwise read the phase review via `readDocument(phase.phase_review)`. Extract `verdict` from the phase review frontmatter `verdict` field.

7. Validate verdict values: if a verdict from a review document is not in the allowed set (`'approved'`, `'changes_requested'`, `'rejected'`) → return `TriageError` with `error_code: 'INVALID_VERDICT'`.

8. Validate document existence: if `readDocument()` returns `null` for a required document → return `TriageError` with `error_code: 'DOCUMENT_NOT_FOUND'`.

9. Export `executeTriage` and `checkRetryBudget` via `module.exports`.

10. Add JSDoc `@param` and `@returns` annotations on all exported functions.

## Contracts & Interfaces

### Return Types

```javascript
/**
 * @typedef {Object} TriageSuccess
 * @property {true} success
 * @property {'task'|'phase'} level
 * @property {'approved'|'changes_requested'|'rejected'|null} verdict
 * @property {'advanced'|'corrective_task_issued'|'halted'|null} action - Task-level uses REVIEW_ACTIONS enum
 * @property {number} phase_index - 0-based
 * @property {number|null} task_index - 0-based, null for phase-level
 * @property {number} row_matched - 1-indexed decision table row number
 * @property {string} details - Human-readable explanation of why this row matched
 */

/**
 * @typedef {Object} TriageError
 * @property {false} success
 * @property {'task'|'phase'} level
 * @property {string} error - Structured error message
 * @property {'DOCUMENT_NOT_FOUND'|'INVALID_VERDICT'|'IMMUTABILITY_VIOLATION'|'INVALID_STATE'|'INVALID_LEVEL'} error_code
 * @property {number} phase_index - 0-based
 * @property {number|null} task_index - 0-based, null for phase-level
 */

/**
 * @typedef {TriageSuccess|TriageError} TriageResult
 */
```

### Phase-Level TriageSuccess Action Field

For phase-level triage, the `action` field uses `PHASE_REVIEW_ACTIONS` enum values (plural):

```javascript
// Phase-level action values:
// 'advanced' | 'corrective_tasks_issued' | 'halted' | null
//
// CRITICAL: phase-level uses "corrective_tasks_issued" (PLURAL)
// Task-level uses "corrective_task_issued" (SINGULAR)
// These are intentionally different — do NOT normalize.
```

### readDocument Callback Signature

```javascript
/**
 * @callback ReadDocumentFn
 * @param {string} docPath - Absolute or project-relative path to the document
 * @returns {{ frontmatter: Record<string, any> | null, body: string } | null}
 *   Returns parsed document with frontmatter and body, or null if not found.
 */
```

The caller (CLI wrapper in a later task) will wire this to real filesystem + frontmatter extraction. For this module, treat it as an opaque callback: call it with a path, get back `{ frontmatter, body }` or `null`.

### Function Signatures

```javascript
/**
 * Execute triage for the current task or phase.
 * Pure function with dependency injection for document reading.
 * Does NOT write to state.json — returns the resolved verdict/action.
 *
 * @param {StateJson} state - Parsed state.json object
 * @param {'task'|'phase'} level - Which decision table to evaluate
 * @param {ReadDocumentFn} readDocument - Injected callback for reading documents
 * @returns {TriageResult}
 */
function executeTriage(state, level, readDocument) { /* ... */ }

/**
 * Check retry budget for Row 10 logic.
 * Named function for readability and targeted testability.
 *
 * @param {Task} task - The current task object from state.json
 * @param {Object} limits - The limits object from state.json
 * @param {number} limits.max_retries_per_task
 * @returns {'corrective_task_issued'|'halted'} The resolved action
 */
function checkRetryBudget(task, limits) { /* ... */ }
```

### Constants Available from `./constants`

```javascript
const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',  // SINGULAR — task-level
  HALTED: 'halted'
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',  // PLURAL — phase-level
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

## Decision Tables

### Task-Level Decision Table (11 Rows) — First-Match-Wins

Evaluate rows in order. Return the first row whose conditions match.

All conditions reference fields from state.json and document frontmatter:
- `report_status` = task report frontmatter `status` field (from `readDocument(task.report_doc)`)
- `has_deviations` = task report frontmatter contains deviations (boolean)
- `deviation_type` = `'minor'` or `'architectural'` from task report frontmatter
- `review_doc` = `task.review_doc` from state.json (null if no code review exists)
- `verdict` = code review frontmatter `verdict` field (from `readDocument(task.review_doc)`)
- `severity` = `task.severity` from state.json
- `retries` = `task.retries` from state.json
- `max_retries` = `state.limits.max_retries_per_task`

| Row | Conditions | → verdict | → action | details |
|-----|-----------|-----------|----------|---------|
| 1 | `report_status == 'complete'` AND `!has_deviations` AND `review_doc == null` | `null` (skip) | `null` (skip) | `"Row 1: complete, no deviations, no review — skip triage"` |
| 2 | `report_status == 'complete'` AND `!has_deviations` AND `review_doc != null` AND `verdict == 'approved'` | `'approved'` | `'advanced'` | `"Row 2: complete, no deviations, approved — advance"` |
| 3 | `report_status == 'complete'` AND `has_deviations` AND `deviation_type == 'minor'` AND `verdict == 'approved'` | `'approved'` | `'advanced'` | `"Row 3: complete, minor deviations, approved — advance"` |
| 4 | `report_status == 'complete'` AND `has_deviations` AND `deviation_type == 'architectural'` AND `verdict == 'approved'` | `'approved'` | `'advanced'` | `"Row 4: complete, architectural deviations, approved — advance"` |
| 5 | `report_status == 'complete'` AND `review_doc != null` AND `verdict == 'changes_requested'` | `'changes_requested'` | `'corrective_task_issued'` | `"Row 5: complete, changes requested — corrective task"` |
| 6 | `report_status == 'complete'` AND `review_doc != null` AND `verdict == 'rejected'` | `'rejected'` | `'halted'` | `"Row 6: complete, rejected — halt"` |
| 7 | `report_status == 'partial'` AND `review_doc == null` | `null` (skip) | `null` (skip) | `"Row 7: partial, no review — skip triage"` |
| 8 | `report_status == 'partial'` AND `review_doc != null` AND `verdict == 'changes_requested'` | `'changes_requested'` | `'corrective_task_issued'` | `"Row 8: partial, changes requested — corrective task"` |
| 9 | `report_status == 'partial'` AND `review_doc != null` AND `verdict == 'rejected'` | `'rejected'` | `'halted'` | `"Row 9: partial, rejected — halt"` |
| 10 | `report_status == 'failed'` AND `severity == 'minor'` AND `retries < max_retries` | verdict from review if `review_doc` exists, else `null` | `'corrective_task_issued'` | `"Row 10: failed, minor severity, retries available — corrective task"` |
| 11 | `report_status == 'failed'` AND (`severity == 'critical'` OR `retries >= max_retries`) | verdict from review if `review_doc` exists, else `null` | `'halted'` | `"Row 11: failed, critical severity or retries exhausted — halt"` |

**Row 10 implementation**: Use the `checkRetryBudget(task, limits)` helper. This helper encapsulates the retry-budget × severity cross-check:
- `task.retries < limits.max_retries_per_task` AND `task.severity === 'minor'` → `'corrective_task_issued'`
- All other cases (critical severity, retries at/above max, null severity) → `'halted'`

**Rows 10–11 verdict sourcing**: If `task.review_doc` is non-null, read the code review and transcribe the `verdict` from its frontmatter. If `task.review_doc` is null, set verdict to `null`.

**Rows 1 and 7 (skip rows)**: When `review_doc` is null, do NOT write verdict/action. Return `TriageSuccess` with `verdict: null` and `action: null`. This is correct because the Orchestrator's invariant (V8: `review_doc != null AND review_verdict == null`) only triggers when `review_doc` is present.

### Phase-Level Decision Table (5 Rows) — First-Match-Wins

All conditions reference phase-level state fields and phase review frontmatter:
- `phase_review` = `phase.phase_review` from state.json (null if no phase review exists)
- `phase_review_verdict` = phase review frontmatter `verdict` field (from `readDocument(phase.phase_review)`)
- Exit criteria assessment comes from the phase review frontmatter (field: `exit_criteria_met`, boolean or `'all'`/`'partial'`)

| Row | Conditions | → verdict | → action | details |
|-----|-----------|-----------|----------|---------|
| 1 | `phase_review == null` | `null` (skip) | `null` (skip) | `"Phase Row 1: no phase review — skip triage"` |
| 2 | `phase_review_verdict == 'approved'` AND all exit criteria met | `'approved'` | `'advanced'` | `"Phase Row 2: approved, all exit criteria met — advance"` |
| 3 | `phase_review_verdict == 'approved'` AND some exit criteria unmet | `'approved'` | `'advanced'` | `"Phase Row 3: approved, some exit criteria unmet — advance with carry-forward"` |
| 4 | `phase_review_verdict == 'changes_requested'` | `'changes_requested'` | `'corrective_tasks_issued'` | `"Phase Row 4: changes requested — corrective tasks"` |
| 5 | `phase_review_verdict == 'rejected'` | `'rejected'` | `'halted'` | `"Phase Row 5: rejected — halt"` |

**CRITICAL — Singular vs. Plural**:
- Task-level Row 5/8 action: `'corrective_task_issued'` (SINGULAR) — from `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED`
- Phase-level Row 4 action: `'corrective_tasks_issued'` (PLURAL) — from `PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED`

**Phase Rows 2 vs. 3 distinction**: Both produce the same verdict/action (`'approved'`/`'advanced'`). The distinction is in the `details` message and is for traceability. Implementation: check the phase review frontmatter for exit criteria assessment. If exit criteria info is unavailable or ambiguous, default to Row 2 (all met) behavior — the action is identical.

## Styles & Design Tokens

Not applicable — this is a pure JavaScript domain module with no UI.

## Test Requirements

Tests are created in a separate task (T3). This task creates only the module. However, the module must be structured for testability:

- [ ] `executeTriage` and `checkRetryBudget` are exported via `module.exports`
- [ ] All logic is exercisable via the two exported functions (no hidden internal-only code paths)
- [ ] The `readDocument` injection point allows mock callbacks without filesystem access
- [ ] Each decision table row is reachable via specific input combinations

## Acceptance Criteria

- [ ] File `src/lib/triage-engine.js` exists and has `'use strict'` at the top
- [ ] Exports `executeTriage(state, level, readDocument)` via `module.exports`
- [ ] Exports `checkRetryBudget(task, limits)` via `module.exports`
- [ ] `executeTriage` handles all 11 task-level rows (first-match-wins evaluation)
- [ ] `executeTriage` handles all 5 phase-level rows (first-match-wins evaluation)
- [ ] Row 10 uses `checkRetryBudget()` for the retry-budget × severity branching
- [ ] Returns `TriageError` with `error_code: 'INVALID_LEVEL'` for invalid level values
- [ ] Returns `TriageError` with `error_code: 'INVALID_STATE'` for malformed state objects
- [ ] Returns `TriageError` with `error_code: 'DOCUMENT_NOT_FOUND'` when `readDocument()` returns `null` for a required document
- [ ] Returns `TriageError` with `error_code: 'INVALID_VERDICT'` when review frontmatter contains unrecognized verdict value
- [ ] Returns `TriageError` with `error_code: 'IMMUTABILITY_VIOLATION'` when target verdict/action fields are not `null`
- [ ] Task-level actions use `REVIEW_ACTIONS` enum values (singular `'corrective_task_issued'`)
- [ ] Phase-level actions use `PHASE_REVIEW_ACTIONS` enum values (plural `'corrective_tasks_issued'`)
- [ ] Imports only from `./constants` — zero infrastructure imports (no `fs`, no `path`, no `process`)
- [ ] Pure function: no `fs`, no `process`, no `Date.now()`, no `Math.random()`
- [ ] JSDoc `@param` and `@returns` on all exported functions
- [ ] `node -c src/lib/triage-engine.js` passes (no syntax errors)
- [ ] All existing test suites pass — no regressions (`tests/constants.test.js`, `tests/resolver.test.js`, `tests/state-validator.test.js`)

## Constraints

- Do NOT read files from disk — all document access is via the injected `readDocument` callback
- Do NOT import `fs`, `path`, `process`, or any Node.js built-in except what's needed for logic
- Do NOT import from `fs-helpers`, `frontmatter`, or any infrastructure utilities — those are for the CLI wrapper only
- Import ONLY from `./constants`
- Do NOT write to `state.json` — return the result and let the CLI wrapper handle writes
- Do NOT normalize verdict values — transcribe verbatim from frontmatter
- Do NOT combine singular/plural action enums — use `REVIEW_ACTIONS` for task-level, `PHASE_REVIEW_ACTIONS` for phase-level
- Do NOT create test files — those are Task 3 scope
- Do NOT create the CLI entry point — that is Task 4 scope
