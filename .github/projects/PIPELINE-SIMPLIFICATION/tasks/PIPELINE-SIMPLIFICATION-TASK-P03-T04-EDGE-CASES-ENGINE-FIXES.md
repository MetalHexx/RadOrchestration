---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
task: 4
title: "EDGE-CASES-ENGINE-FIXES"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: ["run-tests"]
estimated_files: 3
---

# EDGE-CASES-ENGINE-FIXES

## Objective

Fix two engine deviations in `mutations.js` (`handleTaskCompleted` status gap and `handlePhaseReviewCompleted` phase-advance prematurity), update the allowed task transition map in `constants.js`, remove all DEVIATION workarounds from existing Categories 1–5 tests, and extend the behavioral test suite with Categories 6–10 covering halt paths, pre-read failure flows, review tier, CF-1 review tier end-to-end, and edge cases.

## Context

The pipeline engine processes events through a linear recipe: load → pre-read → mutate → validate → write → resolve → return. Two bugs in `mutations.js` cause incorrect resolver routing: (1) `handleTaskCompleted` sets `report_doc` and deviation fields but does NOT update `task.status` from `in_progress` to `complete`, so the resolver falls through to `display_halted` instead of matching the `COMPLETE && !review_doc → spawn_code_reviewer` branch; (2) `handlePhaseReviewCompleted` prematurely sets the next phase to `in_progress` with 0 tasks, so the resolver sees `taskIndex(0) >= total_tasks(0)` and returns `generate_phase_report` instead of matching the `NOT_STARTED → create_phase_plan` branch. The existing behavioral tests (Categories 1–5, 535 lines, 44 tests) contain `// DEVIATION:` comments asserting the incorrect behavior — these must be flipped to assert correct behavior. Default config: `max_retries_per_task: 2`, `execution_mode: 'ask'`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib-v3/mutations.js` | Fix `handleTaskCompleted` (add `task.status = TASK_STATUSES.COMPLETE`); fix `handlePhaseReviewCompleted` (remove premature `nextPhase.status = IN_PROGRESS`) |
| MODIFY | `.github/orchestration/scripts/lib-v3/constants.js` | Update `ALLOWED_TASK_TRANSITIONS`: `'complete': []` → `'complete': ['failed', 'halted']` |
| MODIFY | `.github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js` | Fix DEVIATION workarounds in Categories 1, 2, 5; add Categories 6–10 |

## Implementation Steps

### Step 1 — Fix `handleTaskCompleted` in `mutations.js`

After the four existing field assignments (`report_doc`, `has_deviations`, `deviation_type`, `report_status`), add:

```javascript
task.status = TASK_STATUSES.COMPLETE;
```

Add to the `mutations_applied` array:

```javascript
`Set task.status to "${TASK_STATUSES.COMPLETE}"`,
```

The fixed function:

```javascript
function handleTaskCompleted(state, context, config) {
  const task = currentTask(state);
  task.report_doc = context.doc_path;
  task.has_deviations = context.has_deviations;
  task.deviation_type = context.deviation_type;
  task.report_status = context.report_status || 'complete';
  task.status = TASK_STATUSES.COMPLETE;
  return {
    state,
    mutations_applied: [
      `Set task.report_doc to "${context.doc_path}"`,
      `Set task.has_deviations to ${context.has_deviations}`,
      `Set task.deviation_type to ${context.deviation_type}`,
      `Set task.report_status to "${task.report_status}"`,
      `Set task.status to "${TASK_STATUSES.COMPLETE}"`,
    ],
  };
}
```

### Step 2 — Fix `handlePhaseReviewCompleted` in `mutations.js`

In the `ADVANCED` branch, when more phases remain (`current_phase < total_phases - 1`), **remove** the two lines that set the next phase to `in_progress`:

```javascript
// REMOVE these two lines:
const nextPhase = currentPhase(state);
nextPhase.status = PHASE_STATUSES.IN_PROGRESS;
// REMOVE the corresponding mutations_applied push:
mutations.push(`Set next phase status to "${PHASE_STATUSES.IN_PROGRESS}"`);
```

The fixed ADVANCED branch:

```javascript
if (phaseReviewAction === PHASE_REVIEW_ACTIONS.ADVANCED) {
  if (state.execution.current_phase < state.execution.total_phases - 1) {
    state.execution.current_phase += 1;
    mutations.push(`Bumped execution.current_phase to ${state.execution.current_phase}`);
  } else {
    state.execution.status = 'complete';
    state.execution.current_tier = PIPELINE_TIERS.REVIEW;
    mutations.push('Set execution.status to "complete"');
    mutations.push(`Set execution.current_tier to "${PIPELINE_TIERS.REVIEW}"`);
  }
}
```

### Step 3 — Update `ALLOWED_TASK_TRANSITIONS` in `constants.js`

Change `'complete': []` to `'complete': ['failed', 'halted']`:

```javascript
const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    ['failed', 'halted'],
  'halted':      [],
});
```

This allows `code_review_completed` to transition a completed task to `failed` (corrective) or `halted` (rejected / retry-exhausted). V12 only fires when `fromStatus !== toStatus`, so `complete → complete` (approved verdict) is never checked.

### Step 4 — Update Category 1 DEVIATION (Step 10)

In the `describe('Category 1: Full happy path')` block:

- **Remove** the `// DEVIATION:` comment block above the Step 10 `it()`.
- **Change** the `it` description to: `'Step 10: task_completed → spawn_code_reviewer'`
- **Change** the assertion: `assert.equal(result.action, 'spawn_code_reviewer')`

### Step 5 — Restructure Category 2 to fix all DEVIATIONs

**5a — Fix Steps 3 and 6** (task_completed for T01 and T02):
- Remove `// DEVIATION:` comments
- Change `it` descriptions to remove `(DEVIATION)`
- Change expected action from `'display_halted'` to `'spawn_code_reviewer'`

**5b — Fix Step 9** (phase_review_completed for Phase 1):
- Remove `// DEVIATION:` comment
- Change expected action from `'generate_phase_report'` to `'create_phase_plan'`
- Change Phase 2 status assertion: `assert.equal(state.execution.phases[1].status, 'not_started')`

**5c — Add Phase 2 documents** to the `documents` map:
```javascript
'c2-pp2.md': makeDoc({ tasks: ['T01'] }),
'c2-tr-p2.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
'c2-cr-p2.md': makeDoc({ verdict: 'approved' }),
```

**5d — Replace old Phase 2 steps** (10–13) with full Phase 2 lifecycle (steps 10–17):

| Step | Event | Context doc | Expected action | Key assertion |
|------|-------|-------------|-----------------|---------------|
| 10 | `phase_plan_created` | `c2-pp2.md` | `create_task_handoff` | Phase 2 status → `in_progress` |
| 11 | `task_handoff_created` | `c2-th-p2.md` | `execute_task` | — |
| 12 | `task_completed` | `c2-tr-p2.md` | `spawn_code_reviewer` | — |
| 13 | `code_review_completed` | `c2-cr-p2.md` | `generate_phase_report` | — |
| 14 | `phase_report_created` | `c2-pr2.md` | `spawn_phase_reviewer` | — |
| 15 | `phase_review_completed` | `c2-prv2.md` | `spawn_final_reviewer` | tier → `review`, execution.status → `complete` |
| 16 | `final_review_completed` | `c2-fr.md` | `request_final_approval` | — |
| 17 | `final_approved` | `{}` | `display_complete` | tier → `complete` |

Each step increments `writeCount` and asserts `io.getWrites().length === writeCount`.

### Step 6 — Update Category 5 DEVIATIONs

**6a** — Fix the `task_completed` test: change action from `'display_halted'` to `'spawn_code_reviewer'`, remove DEVIATION comment.

**6b** — Fix the `phase_review_completed` test (last `it` in Category 5): change action from `'generate_phase_report'` to `'create_phase_plan'`, change Phase 2 status assertion from `'in_progress'` to `'not_started'`, remove DEVIATION comment.

### Step 7 — Add Category 6: Halt paths

Add `describe('Category 6: Halt paths')` after Category 5.

**(a) Task halt — rejected verdict:**

State setup: execution tier, Phase 1 `in_progress`, 1 task with `status: 'in_progress'` and `handoff_doc` set. Documents: task report (complete, no deviations) + code review (verdict: `rejected`). Timestamp deleted for V13.

Events:
1. `task_completed` with task report doc → assert `spawn_code_reviewer`, 1 write
2. `code_review_completed` with review doc → assert `display_halted`, 2 writes

Final state assertions: `task.status === 'halted'`, `task.review_action === 'halted'`, `task.review_verdict === 'rejected'`.

**(b) Task halt — retry budget exhausted:**

State setup: same as (a), but task has `retries: 2` (equals `max_retries_per_task`). Documents: task report (complete) + code review (verdict: `changes_requested`).

Events:
1. `task_completed` → `spawn_code_reviewer`, 1 write
2. `code_review_completed` → `display_halted`, 2 writes

Final state: `task.status === 'halted'`, `task.review_action === 'halted'`.

**(c) Phase halt — rejected:**

State setup: execution tier, Phase 1 `in_progress`, 1 task complete (pointer past end: `current_task: 1, total_tasks: 1`), `phase_report_doc` set. Document: phase review (verdict: `rejected`, exit_criteria_met: false). Timestamp deleted.

Event: `phase_review_completed` → assert `display_halted`, 1 write.

Final state: `phase.status === 'halted'`, `phase.phase_review_action === 'halted'`.

### Step 8 — Add Category 7: Pre-read failure flows

Add `describe('Category 7: Pre-read failure flows')`.

**(a) Missing document (readDocument returns null):**

State: any valid execution state with task `in_progress`. Documents map does NOT contain the referenced doc path. Fire `task_completed` with `{ doc_path: 'nonexistent.md' }`.

Assert: `result.success === false`, `result.action === null`, `io.getWrites().length === 0`.

**(b) Null frontmatter:**

State: any valid state. Documents map contains the path but with `{ frontmatter: null, body: '' }`. Fire a pre-read event (e.g., `plan_approved` with `{ doc_path: 'null-fm.md' }`).

Assert: `result.success === false`, `result.action === null`, `io.getWrites().length === 0`.

### Step 9 — Add Categories 8 + 9: Review tier + CF-1

**Category 8:** `describe('Category 8: Review tier')`

**(a) `final_review_completed`:**

State: `createReviewState()` with `project.updated` deleted. Document: `{ frontmatter: {}, body: '' }` at `'fr.md'`. Fire `final_review_completed` with `{ doc_path: 'fr.md' }`.

Assert: `result.success === true`, `result.action === 'request_final_approval'`, `io.getWrites().length === 1`, `io.getState().execution.final_review_doc === 'fr.md'`.

**(b) `final_approved`:**

State: review-tier state with `final_review_doc` already set, `final_review_approved` absent/false. Timestamp deleted. Fire `final_approved` with `{}`.

Assert: `result.success === true`, `result.action === 'display_complete'`, `io.getWrites().length === 1`, `io.getState().execution.final_review_approved === true`, `io.getState().execution.current_tier === 'complete'`.

**Category 9:** `describe('Category 9: CF-1 review tier end-to-end')`

Single multi-event test using a shared `io` from `createReviewState()`:

1. `final_review_completed` with doc_path → verify `state.execution.final_review_doc` is set, action = `request_final_approval`, 1 write.
2. `final_approved` → verify `state.execution.final_review_approved === true`, `current_tier === 'complete'`, action = `display_complete`, 2 writes total.

### Step 10 — Add Category 10: Edge cases

Add `describe('Category 10: Edge cases')`.

**(a) Unknown event:**

State: `createBaseState()` with timestamp deleted. Fire `processEvent('nonexistent_event', PROJECT_DIR, {}, io)`.

Assert: `result.success === false`, `result.action === null`, `io.getWrites().length === 0`, `result.context.error` includes `'Unknown event'`.

**(b) Non-start event with no state:**

`io = createMockIO({ state: null })`. Fire `processEvent('research_completed', PROJECT_DIR, { doc_path: 'r.md' }, io)`.

Assert: `result.success === false`, `io.getWrites().length === 0`, `result.context.error` includes `'No state.json found'`.

**(c) Cold-start on halted pipeline:**

State: `createBaseState()` with `execution.current_tier: 'halted'`. Fire `processEvent('start', PROJECT_DIR, {}, io)`.

Assert: `result.success === true`, `result.action === 'display_halted'`, `io.getWrites().length === 0` (cold-start path, no writes), `result.mutations_applied.length === 0`.

## Contracts & Interfaces

### handleTaskCompleted — Current (broken)

```javascript
// .github/orchestration/scripts/lib-v3/mutations.js
function handleTaskCompleted(state, context, config) {
  const task = currentTask(state);
  task.report_doc = context.doc_path;
  task.has_deviations = context.has_deviations;
  task.deviation_type = context.deviation_type;
  task.report_status = context.report_status || 'complete';
  // BUG: task.status is NOT updated — remains 'in_progress'
  return { state, mutations_applied: [ /* ... */ ] };
}
```

### handlePhaseReviewCompleted — ADVANCED branch current (broken)

```javascript
// .github/orchestration/scripts/lib-v3/mutations.js — inside handlePhaseReviewCompleted
if (phaseReviewAction === PHASE_REVIEW_ACTIONS.ADVANCED) {
  if (state.execution.current_phase < state.execution.total_phases - 1) {
    state.execution.current_phase += 1;
    const nextPhase = currentPhase(state);
    nextPhase.status = PHASE_STATUSES.IN_PROGRESS; // BUG: premature — 0 tasks, no plan
    mutations.push(`Bumped execution.current_phase to ${state.execution.current_phase}`);
    mutations.push(`Set next phase status to "${PHASE_STATUSES.IN_PROGRESS}"`); // BUG
  } else {
    state.execution.status = 'complete';
    state.execution.current_tier = PIPELINE_TIERS.REVIEW;
    mutations.push('Set execution.status to "complete"');
    mutations.push(`Set execution.current_tier to "${PIPELINE_TIERS.REVIEW}"`);
  }
}
```

### ALLOWED_TASK_TRANSITIONS — Current

```javascript
// .github/orchestration/scripts/lib-v3/constants.js
const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    [],      // Must become ['failed', 'halted']
  'halted':      [],
});
```

### Resolver — key branches (read-only reference)

```javascript
// .github/orchestration/scripts/lib-v3/resolver.js — resolveTask()

// After task_completed fix (task.status = 'complete'), THIS branch matches:
if (task.status === TASK_STATUSES.COMPLETE && !task.review_doc) {
  return { action: NEXT_ACTIONS.SPAWN_CODE_REVIEWER, context: { /* ... */ } };
}

// After phase advance fix (next phase stays 'not_started'), THIS branch matches:
if (phase.status === PHASE_STATUSES.NOT_STARTED) {
  return { action: NEXT_ACTIONS.CREATE_PHASE_PLAN, context: { /* ... */ } };
}
```

### V12 — Transition check behavior

```javascript
// .github/orchestration/scripts/lib-v3/validator.js — checkV12()
// V12 only fires when fromStatus !== toStatus:
if (fromTask !== toTask) {
  const allowed = ALLOWED_TASK_TRANSITIONS[fromTask];
  if (!allowed || !allowed.includes(toTask)) { /* error */ }
}
// Consequence: 'complete' → 'complete' (approved) = skip (same status)
//              'complete' → 'failed' (corrective)  = checked → needs 'failed' in map
//              'complete' → 'halted' (rejected)     = checked → needs 'halted' in map
```

### Task Decision Table — halt-relevant rows

```
Row 5: changes_requested + complete + retries >= max → { taskStatus: 'halted', reviewAction: 'halted' }
Row 7: changes_requested + failed  + retries >= max → { taskStatus: 'halted', reviewAction: 'halted' }
Row 8: rejected (any)                               → { taskStatus: 'halted', reviewAction: 'halted' }
```

### Phase Decision Table — halt-relevant rows

```
Row 4: rejected + true  → { phaseStatus: 'halted', phaseReviewAction: 'halted' }
Row 5: rejected + false → { phaseStatus: 'halted', phaseReviewAction: 'halted' }
```

### PipelineResult

```javascript
{
  success: boolean,        // true = event processed; false = pre-read / validation / unknown failure
  action: string | null,   // one of ~19 NEXT_ACTIONS values, or null on failure
  context: Object,         // action-specific routing data, or { error, event?, field? } on failure
  mutations_applied: string[]  // human-readable mutation descriptions; empty on failure
}
```

### MockIO Factory (imported from test-helpers.js)

```javascript
const {
  createMockIO, createBaseState, createExecutionState,
  createReviewState, createDefaultConfig, deepClone,
} = require('./helpers/test-helpers');

// createMockIO({ state, documents, config })
//   .readState(dir)       → deep clone of state or null
//   .writeState(dir, st)  → captures snapshot into writes array, updates currentState
//   .readDocument(path)   → looks up in documents map; returns deep clone or null
//   .getState()           → current state after all writes
//   .getWrites()          → array of all state snapshots written
//   .getEnsureDirsCalled()→ call count

// createBaseState(overrides?)     → minimal v3 state, planning tier
// createExecutionState(overrides?)→ execution tier, 1 phase in_progress, 2 tasks not_started
// createReviewState(overrides?)   → review tier, 1 phase complete, all docs set
// createDefaultConfig()           → { limits: { max_retries_per_task: 2, ... }, human_gates: { execution_mode: 'ask', ... } }
```

### Local helpers (already in behavioral test file)

```javascript
function backdateTimestamp(state) { delete state.project.updated; return state; }
function makeDoc(frontmatter)     { return { frontmatter, body: '' }; }
function makeExecutionStartState(totalPhases) { /* builds post-plan_approved state with N empty phases, timestamp deleted */ }
```

### Task object template (for state setup)

```javascript
{
  name: 'T01',
  status: 'not_started',     // or 'in_progress' for active task
  handoff_doc: null,          // set to path string when handoff exists
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null,
  has_deviations: false,
  deviation_type: null,
  retries: 0,                 // set to 2 for retry-exhaustion tests
  report_status: null,
}
```

### Enum values (for test assertions)

```javascript
// TASK_STATUSES: 'not_started', 'in_progress', 'complete', 'failed', 'halted'
// PHASE_STATUSES: 'not_started', 'in_progress', 'complete', 'halted'
// REVIEW_VERDICTS: 'approved', 'changes_requested', 'rejected'
// REVIEW_ACTIONS: 'advanced', 'corrective_task_issued', 'halted'
// PHASE_REVIEW_ACTIONS: 'advanced', 'corrective_tasks_issued', 'halted'
// PIPELINE_TIERS: 'planning', 'execution', 'review', 'complete', 'halted'
```

## Styles & Design Tokens

N/A — CLI test suite, no UI components.

## Test Requirements

### Engine Fix Verification

- [ ] After `task_completed`, `task.status` is `'complete'` (not `'in_progress'`)
- [ ] After `task_completed`, resolver returns `spawn_code_reviewer` (not `display_halted`)
- [ ] After `phase_review_completed` (advanced, not last phase), next phase status is `'not_started'` (not `'in_progress'`)
- [ ] After `phase_review_completed` (advanced, not last phase), resolver returns `create_phase_plan` (not `generate_phase_report`)

### DEVIATION Cleanup

- [ ] Zero `// DEVIATION:` comments remain in the entire file
- [ ] Category 1 Step 10 asserts `spawn_code_reviewer`
- [ ] Category 2 Steps 3, 6 assert `spawn_code_reviewer`
- [ ] Category 2 Step 9 asserts `create_phase_plan` with Phase 2 status `'not_started'`
- [ ] Category 2 Phase 2 has full lifecycle (phase plan → task handoff → task complete → code review → phase report → phase review → final review → complete)
- [ ] Category 5 `task_completed` asserts `spawn_code_reviewer`
- [ ] Category 5 `phase_review_completed` asserts `create_phase_plan` with Phase 2 status `'not_started'`

### New Category Tests

- [ ] Category 6: ≥3 halt-path tests (rejected verdict, retry exhausted, phase rejected)
- [ ] Category 7: ≥2 pre-read failure-flow tests (missing document, null frontmatter)
- [ ] Category 8: ≥2 review-tier tests (`final_review_completed`, `final_approved`)
- [ ] Category 9: ≥1 CF-1 end-to-end review-tier test (multi-event with state field verification for `final_review_doc` and `final_review_approved`)
- [ ] Category 10: ≥3 edge-case tests (unknown event, no state, halted cold-start)

## Acceptance Criteria

- [ ] `handleTaskCompleted` in `mutations.js` sets `task.status = 'complete'` and includes the change in `mutations_applied`
- [ ] `handlePhaseReviewCompleted` in `mutations.js` does NOT set next phase to `in_progress` when more phases remain (leaves it at `not_started`)
- [ ] `ALLOWED_TASK_TRANSITIONS['complete']` in `constants.js` is `['failed', 'halted']`
- [ ] Zero `// DEVIATION:` comments remain in `pipeline-behavioral.test.js`
- [ ] All previously-passing Categories 1–5 tests still pass with updated assertions (no regressions)
- [ ] Category 6: ≥3 halt-path tests pass
- [ ] Category 7: ≥2 pre-read failure-flow tests pass
- [ ] Category 8: ≥2 review-tier tests pass
- [ ] Category 9: ≥1 CF-1 end-to-end review-tier test passes (verifies `execution.final_review_doc` set and `execution.final_review_approved === true`)
- [ ] Category 10: ≥3 edge-case tests pass
- [ ] Every successful standard-event test verifies exactly 1 additional write (`io.getWrites().length === writeCount`)
- [ ] Every failure-path / cold-start test verifies 0 (additional) writes
- [ ] All tests pass: `node --test tests-v3/pipeline-behavioral.test.js` exits with 0 failures
- [ ] Full test suite passes: `node --test tests-v3/` — zero regressions across all test files
- [ ] Build succeeds: all lib-v3 modules loadable via `require()`

## Constraints

- Do NOT modify `resolver.js` — the engine fixes are in `mutations.js` and `constants.js` only
- Do NOT modify any test files other than `pipeline-behavioral.test.js`
- Do NOT modify any lib-v3 modules besides `mutations.js` and `constants.js`
- Do NOT remove existing Categories 1–5 `describe` / `it` blocks — only update their assertions and comments
- Do NOT modify the `createMockIO`, `createBaseState`, `createExecutionState`, or `createReviewState` factory functions in `test-helpers.js`
- Continue using the existing `backdateTimestamp` / `delete state.project.updated` pattern for V13 safety
- One `processEvent` call per `it` block (behavioral test convention)
- Use `'use strict'` — already present at file top
- Import `processEvent` from `'../lib-v3/pipeline-engine'` and helpers from `'./helpers/test-helpers'` (existing pattern)
