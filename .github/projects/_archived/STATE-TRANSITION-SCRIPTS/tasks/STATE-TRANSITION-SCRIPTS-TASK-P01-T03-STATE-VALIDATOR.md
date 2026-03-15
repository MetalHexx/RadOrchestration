---
project: "STATE-TRANSITION-SCRIPTS"
phase: 1
task: 3
title: "State Transition Validator"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# State Transition Validator

## Objective

Create `src/lib/state-validator.js` — a pure function `validateTransition(current, proposed)` that checks all 15 documented state.json invariants (V1–V15) and returns a structured `ValidationResult`. This is the core validation engine used by the Tactical Planner before every state.json write.

## Context

The orchestration system manages project state via `state.json`. Before any write, the proposed state must be validated against 15 invariants covering structural bounds, monotonicity, state-machine transitions, write ordering, and immutability. This module is a pure domain-logic function — it performs zero filesystem I/O. It imports only from `./constants.js` (the shared enums created in Task 1). The CLI wrapper (`src/validate-state.js`, Task 5) will call this function; this task creates only the library module.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/lib/state-validator.js` | Pure validation function — sole export is `validateTransition` |

## Implementation Steps

1. Add `#!/usr/bin/env node` is NOT needed (library module). Start with `'use strict';` and a JSDoc file header comment.
2. Import constants: `const { PIPELINE_TIERS, TASK_STATUSES, PHASE_STATUSES, REVIEW_VERDICTS, REVIEW_ACTIONS, PHASE_REVIEW_ACTIONS, SEVERITY_LEVELS } = require('./constants.js');`
3. Define the `ALLOWED_TASK_TRANSITIONS` map (see Contracts section below).
4. Implement 15 individual check functions, one per invariant (`checkV1` through `checkV15`). Each returns an array of `InvariantError` objects (empty array if the check passes).
5. Implement `validateTransition(current, proposed)` that calls all 15 check functions, collects all errors, and returns the `ValidationResult`.
6. For proposed-only checks (V1–V10): the function receives only `proposed` into the check.
7. For current→proposed checks (V11–V15): the function receives both `current` and `proposed`.
8. Export `validateTransition` via `module.exports`.
9. Add JSDoc `@typedef` annotations for `InvariantError`, `ValidationPass`, `ValidationFail`, and `ValidationResult` at the top of the file.
10. Ensure defensive null handling throughout — absent fields are treated as `null` per V10.

## Contracts & Interfaces

### ValidationResult (return type)

```javascript
/**
 * @typedef {Object} InvariantError
 * @property {string} invariant - "V1" through "V15"
 * @property {string} message - Human-readable description with field paths and values
 * @property {'critical'} severity - Always "critical"
 */

/**
 * @typedef {Object} ValidationPass
 * @property {true} valid
 * @property {15} invariants_checked - Always 15
 */

/**
 * @typedef {Object} ValidationFail
 * @property {false} valid
 * @property {15} invariants_checked - Always 15
 * @property {InvariantError[]} errors - One entry per violated invariant
 */

/**
 * @typedef {ValidationPass|ValidationFail} ValidationResult
 */
```

### Function Signature

```javascript
/**
 * Validate a proposed state.json transition against all 15 documented invariants.
 * Pure function: compares current and proposed state objects.
 *
 * @param {StateJson} current - The current (committed) state.json object
 * @param {StateJson} proposed - The proposed (uncommitted) state.json object
 * @returns {ValidationResult}
 */
function validateTransition(current, proposed) { /* ... */ }
```

### StateJson Shape (consumed — do NOT redefine, import awareness only)

The `StateJson` typedef is already defined in `./constants.js` via JSDoc. The validator receives parsed objects matching this shape:

```javascript
// Top-level keys: project, pipeline, planning, execution, final_review, errors, limits
// execution.phases is an array of Phase objects.
// Each Phase has: phase_number, title, status, phase_doc, current_task, total_tasks,
//   tasks[], phase_report, human_approved, phase_review, phase_review_verdict, phase_review_action
// Each Task has: task_number, title, status, handoff_doc, report_doc, retries,
//   last_error, severity, review_doc, review_verdict, review_action
// limits: { max_phases, max_tasks_per_phase, max_retries_per_task }
```

### Allowed Task Status Transitions

```javascript
const ALLOWED_TASK_TRANSITIONS = {
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'complete':    [],   // terminal
  'failed':      ['in_progress'],  // retry path
  'halted':      []    // terminal
};
```

**Note on `failed → in_progress`**: When a task is retried after failure, its status transitions back to `in_progress`. This is the only "backwards" transition allowed.

### Constants Import

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

Enum values used in validation:
- `PIPELINE_TIERS.EXECUTION` = `'execution'` (V7)
- `TASK_STATUSES.IN_PROGRESS` = `'in_progress'` (V6)
- `SEVERITY_LEVELS.CRITICAL` = `'critical'` (error severity field)

## Invariant Specifications

Each invariant below must be implemented as a named function. The function receives `proposed` (and `current` where noted) and returns `InvariantError[]`.

### V1 — current_phase index bounds

**Input**: Proposed only  
**Check**: `proposed.execution.current_phase` must be a valid 0-based index into `proposed.execution.phases[]`. If `phases` is empty, `current_phase` must be `0`.  
**Logic**:
```javascript
const phases = proposed.execution.phases || [];
const cp = proposed.execution.current_phase;
if (phases.length === 0 && cp !== 0) → error
if (phases.length > 0 && (cp < 0 || cp >= phases.length)) → error
```
**Error message format**: `"current_phase (${cp}) is out of bounds for phases array of length ${phases.length}"`

### V2 — current_task index bounds

**Input**: Proposed only  
**Check**: For EACH phase in `proposed.execution.phases[]`, `phase.current_task` must be a valid 0-based index into `phase.tasks[]`. If `tasks` is empty, `current_task` must be `0`.  
**Logic**:
```javascript
for each phase (index i):
  const tasks = phase.tasks || [];
  const ct = phase.current_task;
  if (tasks.length === 0 && ct !== 0) → error
  if (tasks.length > 0 && (ct < 0 || ct >= tasks.length)) → error
```
**Error message format**: `"Phase ${i} current_task (${ct}) is out of bounds for tasks array of length ${tasks.length}"`

### V3 — retry limit

**Input**: Proposed only  
**Check**: For EVERY task across ALL phases, `task.retries` must not exceed `proposed.limits.max_retries_per_task`.  
**Logic**:
```javascript
const max = proposed.limits.max_retries_per_task;
for each phase (index pi), for each task (index ti):
  if (task.retries > max) → error
```
**Error message format**: `"Task P${pi+1}-T${ti+1} retries (${task.retries}) exceeds max_retries_per_task (${max})"`

### V4 — max phases

**Input**: Proposed only  
**Check**: `proposed.execution.phases.length` must not exceed `proposed.limits.max_phases`.  
**Logic**:
```javascript
if (proposed.execution.phases.length > proposed.limits.max_phases) → error
```
**Error message format**: `"phases.length (${len}) exceeds max_phases (${max})"`

### V5 — max tasks per phase

**Input**: Proposed only  
**Check**: For EACH phase, `phase.tasks.length` must not exceed `proposed.limits.max_tasks_per_phase`.  
**Logic**:
```javascript
const max = proposed.limits.max_tasks_per_phase;
for each phase (index i):
  if (phase.tasks.length > max) → error
```
**Error message format**: `"Phase ${i} tasks.length (${len}) exceeds max_tasks_per_phase (${max})"`

### V6 — single in_progress task

**Input**: Proposed only  
**Check**: At most ONE task across the ENTIRE project has `status === 'in_progress'`.  
**Logic**:
```javascript
const inProgress = [];
for each phase (index pi), for each task (index ti):
  if (task.status === 'in_progress') inProgress.push(`P${pi+1}-T${ti+1}`);
if (inProgress.length > 1) → error
```
**Error message format**: `"Multiple tasks have status 'in_progress': ${inProgress.join(', ')}"`

### V7 — human approval before execution

**Input**: Proposed only  
**Check**: If `proposed.pipeline.current_tier === 'execution'`, then `proposed.planning.human_approved` must be `true`.  
**Logic**:
```javascript
if (proposed.pipeline.current_tier === PIPELINE_TIERS.EXECUTION && proposed.planning.human_approved !== true) → error
```
**Error message format**: `"current_tier is 'execution' but planning.human_approved is not true"`

### V8 — task triage consistency

**Input**: Proposed only  
**Check**: No task may have `review_doc != null` while `review_verdict == null`. This detects skipped triage.  
**Logic**:
```javascript
for each phase (index pi), for each task (index ti):
  if ((task.review_doc ?? null) !== null && (task.review_verdict ?? null) === null) → error
```
**Error message format**: `"Task P${pi+1}-T${ti+1} has review_doc but review_verdict is null (triage skipped)"`

### V9 — phase triage consistency

**Input**: Proposed only  
**Check**: No phase may have `phase_review != null` while `phase_review_verdict == null`.  
**Logic**:
```javascript
for each phase (index i):
  if ((phase.phase_review ?? null) !== null && (phase.phase_review_verdict ?? null) === null) → error
```
**Error message format**: `"Phase ${i} has phase_review but phase_review_verdict is null (triage skipped)"`

### V10 — null treatment

**Input**: Proposed only  
**Check**: This is a defensive-coding invariant, not a boolean check. Ensure all field accesses use `?? null` rather than truthy checks. Implemented by using `(field ?? null) !== null` pattern throughout the validator.  
**Implementation**: V10 is enforced by the coding pattern used in all other checks. There is no standalone check function — instead, validate that the proposed state has the required top-level structure (has `execution`, `pipeline`, `planning`, `limits` keys). Return an error if any required top-level key is missing.  
**Logic**:
```javascript
const required = ['execution', 'pipeline', 'planning', 'limits'];
for (const key of required):
  if (proposed[key] == null) → error
```
**Error message format**: `"Required top-level key '${key}' is missing or null in proposed state"`

### V11 — retry monotonicity

**Input**: Current → Proposed  
**Check**: No task's `retries` count may decrease compared to the current state. Match tasks by phase index + task index.  
**Logic**:
```javascript
const currentPhases = current.execution.phases || [];
const proposedPhases = proposed.execution.phases || [];
for (let pi = 0; pi < Math.min(currentPhases.length, proposedPhases.length); pi++):
  const currentTasks = currentPhases[pi].tasks || [];
  const proposedTasks = proposedPhases[pi].tasks || [];
  for (let ti = 0; ti < Math.min(currentTasks.length, proposedTasks.length); ti++):
    if (proposedTasks[ti].retries < currentTasks[ti].retries) → error
```
**Error message format**: `"Task P${pi+1}-T${ti+1} retries decreased from ${cur} to ${prop}"`

### V12 — task status transitions

**Input**: Current → Proposed  
**Check**: Each task's status transition must follow the allowed paths. Use the `ALLOWED_TASK_TRANSITIONS` map.  
**Allowed transitions**:
- `not_started` → `in_progress`
- `in_progress` → `complete`, `failed`, `halted`
- `failed` → `in_progress` (retry)
- `complete` → (terminal, no transitions)
- `halted` → (terminal, no transitions)

**Logic**:
```javascript
for each matching (pi, ti) pair in current and proposed:
  const from = currentTasks[ti].status;
  const to = proposedTasks[ti].status;
  if (from === to) → skip (no transition)
  if (!ALLOWED_TASK_TRANSITIONS[from].includes(to)) → error
```
**Error message format**: `"Task P${pi+1}-T${ti+1} invalid status transition: '${from}' → '${to}'"`

### V13 — timestamp monotonicity

**Input**: Current → Proposed  
**Check**: `proposed.project.updated` must be strictly newer than `current.project.updated`. Compare as ISO 8601 strings (lexicographic comparison works for ISO timestamps).  
**Logic**:
```javascript
const curTime = current.project.updated;
const propTime = proposed.project.updated;
if (propTime <= curTime) → error
```
**Error message format**: `"project.updated ('${propTime}') is not newer than current ('${curTime}')"`

### V14 — write ordering (review_doc vs verdict/action)

**Input**: Current → Proposed  
**Check**: If a task's `review_doc` changed from `null` to non-null in this transition, then `review_verdict` and `review_action` must NOT have also changed in the same write. (Ordering rule: set review_doc first, then triage sets verdict/action in a separate write.)  
**Logic**:
```javascript
for each matching (pi, ti) pair in current and proposed:
  const curTask = currentTasks[ti];
  const propTask = proposedTasks[ti];
  const docChanged = (curTask.review_doc ?? null) === null && (propTask.review_doc ?? null) !== null;
  const verdictChanged = (curTask.review_verdict ?? null) !== (propTask.review_verdict ?? null);
  const actionChanged = (curTask.review_action ?? null) !== (propTask.review_action ?? null);
  if (docChanged && (verdictChanged || actionChanged)) → error
```
**Error message format**: `"Task P${pi+1}-T${ti+1} review_doc and review_verdict/review_action changed in same write (write ordering violation)"`

### V15 — cross-task immutability

**Input**: Current → Proposed  
**Check**: If verdict/action changed for any task, no OTHER task's verdict/action may have changed in the same write. This prevents triage of task N from accidentally overwriting task M.  
**Logic**:
```javascript
const changedTasks = [];
for each matching (pi, ti) pair across all phases:
  const curTask = currentTasks[ti];
  const propTask = proposedTasks[ti];
  const verdictChanged = (curTask.review_verdict ?? null) !== (propTask.review_verdict ?? null);
  const actionChanged = (curTask.review_action ?? null) !== (propTask.review_action ?? null);
  if (verdictChanged || actionChanged) changedTasks.push(`P${pi+1}-T${ti+1}`);
if (changedTasks.length > 1) → error
```
**Error message format**: `"Multiple tasks had verdict/action changed in same write: ${changedTasks.join(', ')} (cross-task immutability violation)"`

## Styles & Design Tokens

Not applicable — this is a backend logic module with no UI.

## Test Requirements

Tests are NOT part of this task (they are Task 4). However, the module must be structured for testability:

- [ ] `validateTransition` is exported and callable via `require('./state-validator')`
- [ ] Function is pure: no `Date.now()`, no `Math.random()`, no `process.*`, no `require('fs')`
- [ ] Function returns `{ valid: true, invariants_checked: 15 }` for a valid transition
- [ ] Function returns `{ valid: false, invariants_checked: 15, errors: [...] }` for invalid transitions
- [ ] Each error is `{ invariant: "V{N}", message: "...", severity: "critical" }`

## Acceptance Criteria

- [ ] `src/lib/state-validator.js` exists and is valid JavaScript (`node -c src/lib/state-validator.js` exits 0)
- [ ] Exports exactly one function: `validateTransition`
- [ ] `validateTransition(current, proposed)` returns `ValidationResult` per the contract above
- [ ] All 15 invariants (V1–V15) are checked — `invariants_checked` is always `15`
- [ ] Proposed-only checks (V1–V10) work with only the `proposed` parameter
- [ ] Current→Proposed checks (V11–V15) compare both parameters
- [ ] Error objects have shape `{ invariant: string, message: string, severity: 'critical' }`
- [ ] `severity` is always `'critical'` for all invariant violations
- [ ] Imports only `./constants.js` — no other imports (especially no `fs`, `path`, or `process`)
- [ ] `'use strict'` is the first statement
- [ ] CommonJS module (`module.exports = { validateTransition }`)
- [ ] JSDoc `@typedef` for `InvariantError`, `ValidationPass`, `ValidationFail`, `ValidationResult`
- [ ] Defensive null handling: uses `?? null` pattern, never truthy checks
- [ ] `ALLOWED_TASK_TRANSITIONS` map includes `failed → in_progress` (retry path)
- [ ] V6 collects ALL in_progress tasks for the error message (not just first two)
- [ ] V15 scans ALL tasks across ALL phases for cross-task immutability
- [ ] No lint errors
- [ ] Build passes (no syntax errors)

## Constraints

- Do NOT create a CLI entry point — that is Task 5
- Do NOT create test files — that is Task 4
- Do NOT import `fs`, `path`, `process`, or any Node.js built-in modules — this is a pure domain module
- Do NOT import `./constants.js` using an absolute path — use the relative path `./constants.js`
- Do NOT throw exceptions — return structured error results in the `ValidationResult`
- Do NOT use `console.log` or `console.error` — pure function, no side effects
- Do NOT add invariants beyond V1–V15 — the spec is fixed
- Do NOT modify `src/lib/constants.js` (Task 1 output)
