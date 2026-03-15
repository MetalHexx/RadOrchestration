---
project: "PIPELINE-SIMPLIFICATION"
phase: 1
task: 3
title: "PRE-READS"
status: "pending"
skills_required: ["execute_task"]
skills_optional: []
estimated_files: 2
---

# PRE-READS

## Objective

Create `lib-v3/pre-reads.js` implementing artifact extraction and validation for 5 event types via a lookup-table dispatch pattern, and `tests-v3/pre-reads.test.js` with per-event extraction, missing-field, invalid-value, and status normalization tests. This is a NEW module — the logic currently lives inline in `pipeline-engine.js` and must be extracted into a pure-function module.

## Context

The v3 pipeline engine calls `preRead(event, context, readDocument, projectDir)` before mutation to enrich the event context with validated frontmatter from agent output documents. Five events require pre-reads; all other events pass through with unmodified context. The `readDocument` function is dependency-injected from `state-io.js` (T02 — complete) and returns `{ frontmatter, body } | null`. Status normalization constants come from `constants.js` (T01 — complete). The module must be pure — no state mutation, no side effects beyond the injected `readDocument` call.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/pre-reads.js` | ~100 lines; exports `preRead` function |
| CREATE | `.github/orchestration/scripts/tests-v3/pre-reads.test.js` | Unit tests using `node:test` + `node:assert/strict` |

## Implementation Steps

1. **Create `.github/orchestration/scripts/lib-v3/pre-reads.js`** with `'use strict'` and no external dependencies beyond `./constants.js`.

2. **Define the status normalization map** as a frozen lookup object:
   ```javascript
   const STATUS_MAP = Object.freeze({
     'complete': 'complete',
     'pass': 'complete',
     'failed': 'failed',
     'fail': 'failed',
     'partial': 'failed',
   });
   ```

3. **Define a success/failure helper pair** to standardize return shapes:
   ```javascript
   function success(context) { return { context, error: undefined }; }
   function failure(error, event, field) {
     return { context: undefined, error: { error, event, field } };
   }
   ```

4. **Implement 5 per-event handler functions** (each receives `context`, `readDocument`, `projectDir` and returns a success or failure):
   - `handlePlanApproved` — reads document at `context.doc_path`, extracts `total_phases` from frontmatter, validates it is a positive integer (`Number.isInteger(n) && n > 0`). Returns `{ ...context, total_phases }`.
   - `handleTaskCompleted` — reads document at `context.doc_path`, extracts `status`, `has_deviations`, `deviation_type` from frontmatter. Normalizes `status` via `STATUS_MAP` (unknown values → failure). Maps enriched keys: `report_status` (normalized status), `has_deviations` (boolean), `deviation_type`.
   - `handleCodeReviewCompleted` — reads document at `context.doc_path`, extracts `verdict`. Returns `{ ...context, verdict, review_doc_path: context.doc_path }`.
   - `handlePhasePlanCreated` — reads document at `context.doc_path`, extracts `tasks`, validates it is a non-empty array. Returns `{ ...context, tasks }`.
   - `handlePhaseReviewCompleted` — reads document at `context.doc_path`, extracts `verdict` and `exit_criteria_met`. Returns `{ ...context, verdict, exit_criteria_met, review_doc_path: context.doc_path }`.

5. **Build the lookup table** mapping event names to handler functions:
   ```javascript
   const PRE_READ_HANDLERS = {
     'plan_approved': handlePlanApproved,
     'task_completed': handleTaskCompleted,
     'code_review_completed': handleCodeReviewCompleted,
     'phase_plan_created': handlePhasePlanCreated,
     'phase_review_completed': handlePhaseReviewCompleted,
   };
   ```

6. **Implement the `preRead` entry function**:
   - Look up the handler in `PRE_READ_HANDLERS`
   - If no handler found → return `success(context)` (pass-through, unmodified)
   - If handler found → call it and return the result

7. **Common document-read pattern** in each handler: call `readDocument(docPath)`, where `docPath` is resolved from `context.doc_path`. If `readDocument` returns `null`, return a failure with `error: "Document not found at '{docPath}'"` and the event name.

8. **Export only `preRead`** via `module.exports = { preRead }`.

9. **Create `.github/orchestration/scripts/tests-v3/pre-reads.test.js`** using `node:test` (`describe`, `it`) and `node:assert/strict`. Define a local mock `readDocument` factory that returns frontmatter for given paths (or null for missing docs). Do NOT import from other test files — self-contain all factories.

10. **Write test cases** covering the scenarios listed in the Test Requirements section below.

## Contracts & Interfaces

### PreReadSuccess / PreReadFailure — Return Types

```javascript
// .github/orchestration/scripts/lib-v3/pre-reads.js

/**
 * @typedef {Object} PreReadSuccess
 * @property {Object} context - enriched context with extracted frontmatter fields
 * @property {undefined} error
 */

/**
 * @typedef {Object} PreReadFailure
 * @property {undefined} context
 * @property {{ error: string, event: string, field?: string }} error
 */
```

### preRead — Function Signature

```javascript
/**
 * Pre-read agent output documents and extract/validate required frontmatter.
 * Events not in the lookup table pass through with unmodified context.
 *
 * @param {string} event
 * @param {Object} context
 * @param {(docPath: string) => ParsedDocument | null} readDocument
 * @param {string} projectDir
 * @returns {PreReadSuccess | PreReadFailure}
 */
function preRead(event, context, readDocument, projectDir) { /* ... */ }
```

### ParsedDocument — Input from readDocument (provided by state-io.js)

```javascript
/**
 * @typedef {Object} ParsedDocument
 * @property {Object | null} frontmatter
 * @property {string} body
 */
```

### Per-Event Pre-Read Contracts

| Event | Document Source | Required Frontmatter Fields | Enriched Context Keys |
|-------|---------------|----------------------------|----------------------|
| `plan_approved` | Master plan at `context.doc_path` | `total_phases` (positive integer) | `{ total_phases }` |
| `task_completed` | Task report at `context.doc_path` | `status`, `has_deviations`, `deviation_type` | `{ report_status, has_deviations, deviation_type }` |
| `code_review_completed` | Code review at `context.doc_path` | `verdict` | `{ verdict, review_doc_path }` |
| `phase_plan_created` | Phase plan at `context.doc_path` | `tasks` (non-empty array) | `{ tasks }` |
| `phase_review_completed` | Phase review at `context.doc_path` | `verdict`, `exit_criteria_met` | `{ verdict, exit_criteria_met, review_doc_path }` |

### Status Normalization Map (for `task_completed`)

| Raw Value | Normalized To |
|-----------|---------------|
| `complete` | `complete` |
| `pass` | `complete` |
| `failed` | `failed` |
| `fail` | `failed` |
| `partial` | `failed` |

Any value not in this map → return a structured failure error.

### TASK_STATUSES — From constants.js (T01)

```javascript
const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted',
});
```

## Styles & Design Tokens

Not applicable — CLI module, no UI.

## Test Requirements

### `plan_approved` event
- [ ] Extracts `total_phases` from master plan frontmatter into enriched context
- [ ] Returns structured error when document is not found (null from readDocument)
- [ ] Returns structured error with `field: 'total_phases'` when field is missing from frontmatter
- [ ] Returns structured error when `total_phases` is zero
- [ ] Returns structured error when `total_phases` is negative
- [ ] Returns structured error when `total_phases` is a non-integer (e.g., 2.5)
- [ ] Returns structured error when `total_phases` is not a number (e.g., string)

### `task_completed` event
- [ ] Extracts `status`, `has_deviations`, `deviation_type` from task report frontmatter
- [ ] Normalizes `status: 'pass'` → `report_status: 'complete'`
- [ ] Normalizes `status: 'fail'` → `report_status: 'failed'`
- [ ] Normalizes `status: 'partial'` → `report_status: 'failed'`
- [ ] Passes through `status: 'complete'` → `report_status: 'complete'`
- [ ] Passes through `status: 'failed'` → `report_status: 'failed'`
- [ ] Returns structured error when document is not found
- [ ] Returns structured error with `field: 'status'` when `status` is missing
- [ ] Returns structured error with `field: 'has_deviations'` when `has_deviations` is missing
- [ ] Returns structured error with `field: 'deviation_type'` when `deviation_type` is missing (undefined)
- [ ] Returns structured error when `status` value is unrecognized (not in STATUS_MAP)

### `code_review_completed` event
- [ ] Extracts `verdict` from code review frontmatter; enriched context includes `verdict` and `review_doc_path`
- [ ] Returns structured error when document is not found
- [ ] Returns structured error with `field: 'verdict'` when `verdict` is missing

### `phase_plan_created` event
- [ ] Extracts `tasks` array from phase plan frontmatter
- [ ] Returns structured error when document is not found
- [ ] Returns structured error with `field: 'tasks'` when `tasks` is missing
- [ ] Returns structured error when `tasks` is not an array
- [ ] Returns structured error when `tasks` is an empty array

### `phase_review_completed` event
- [ ] Extracts `verdict` and `exit_criteria_met` from phase review frontmatter; enriched context includes `review_doc_path`
- [ ] Returns structured error when document is not found
- [ ] Returns structured error with `field: 'verdict'` when `verdict` is missing
- [ ] Returns structured error with `field: 'exit_criteria_met'` when `exit_criteria_met` is missing

### Pass-through behavior
- [ ] Events not in lookup table (e.g., `'start'`, `'unknown_event'`) return success with unmodified context
- [ ] Pass-through does not call `readDocument`

### Error structure
- [ ] All failure results have `{ context: undefined, error: { error: string, event: string } }`
- [ ] Missing-field failures include `field` property in the error object

## Acceptance Criteria

- [ ] `pre-reads.js` is created at `.github/orchestration/scripts/lib-v3/pre-reads.js`
- [ ] `pre-reads.js` exports exactly one function: `preRead`
- [ ] All 5 events (`plan_approved`, `task_completed`, `code_review_completed`, `phase_plan_created`, `phase_review_completed`) extract correct frontmatter fields into enriched context
- [ ] Status normalization: `partial` → `failed`, `pass` → `complete`, `fail` → `failed`
- [ ] Unrecognized status values produce a structured error (not silent pass-through)
- [ ] Missing document → structured error with event name
- [ ] Missing required field → structured error with field name
- [ ] Invalid `total_phases` (zero, negative, non-integer, non-number) → structured error
- [ ] Empty `tasks` array → structured error
- [ ] Non-pre-read events pass through with unmodified context (no error, no `readDocument` call)
- [ ] Module is pure — no state mutation, no side effects beyond the injected `readDocument` call
- [ ] `pre-reads.test.js` is created at `.github/orchestration/scripts/tests-v3/pre-reads.test.js`
- [ ] Tests use `node:test` and `node:assert/strict` only — zero external dependencies
- [ ] All test factories are self-contained within the test file (no cross-file imports for test utilities)
- [ ] All tests pass via `node --test tests-v3/pre-reads.test.js`
- [ ] Build succeeds (no syntax errors, module importable via `require('./lib-v3/pre-reads')`)

## Constraints

- Do NOT import from `state-io.js` — `readDocument` is passed in as a parameter (DI)
- Do NOT mutate the incoming `context` object — spread into a new object for enrichment
- Do NOT add any state mutation logic — this module is pure extraction and validation only
- Do NOT handle events beyond the 5 listed — unknown events pass through silently
- Do NOT add triage logic, retry logic, or decision-table logic — that belongs in `mutations.js`
- Do NOT reference or import from the old `lib/` directory — this is a clean-room implementation in `lib-v3/`
- Do NOT use external test dependencies — `node:test` and `node:assert/strict` only
- Do NOT import test utilities from other test files — self-contain all mocks and factories
- Keep module under ~100 lines (target from Architecture)
