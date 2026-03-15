---
project: "PIPELINE-SIMPLIFICATION"
phase: 2
task: 2
title: "EXECUTION-HANDLERS"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# EXECUTION-HANDLERS

## Objective

Add 6 execution event handlers to the existing `mutations.js` module — `handlePhasePlanCreated`, `handleTaskHandoffCreated`, `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhaseReportCreated`, and `handlePhaseReviewCompleted` — that contain the core pipeline complexity: decision table integration, pointer advances (`current_task`, `current_phase`), and the execution→review tier transition. Extend the existing test file with per-handler unit tests and pointer/tier boundary verification.

## Context

`mutations.js` already contains the module scaffold from T01: 7 planning/halt handlers registered in the `MUTATIONS` map (frozen at 7 entries), the `resolveTaskOutcome` and `resolvePhaseOutcome` decision table helpers, the `checkRetryBudget` helper, the `currentPhase(state)` and `currentTask(state)` internal navigation helpers, and the `normalizeDocPath` utility. This task adds the 6 execution handlers that use those helpers and registers them in the `MUTATIONS` map (expanding it from 7 to 13 entries). T03 will later add the final 4 gate/review/terminal handlers to reach 17.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib-v3/mutations.js` | Add 6 handler functions; register all 6 in `MUTATIONS` map (7→13 entries) |
| MODIFY | `.github/orchestration/scripts/tests-v3/mutations.test.js` | Add execution handler tests, pointer advance tests, tier transition tests |

## Implementation Steps

1. **Add `handlePhasePlanCreated` handler** — Read `context.tasks` (array of task name strings from pre-read). Set `phase.status` to `in_progress`. Set `phase.phase_plan_doc` to `context.doc_path`. Set `phase.total_tasks` to `context.tasks.length`. Populate `phase.tasks` as an array of fresh task objects (one per entry in `context.tasks`) using the Task template below. Return `MutationResult`.

2. **Add `handleTaskHandoffCreated` handler** — Set `task.handoff_doc` to `context.doc_path` on the current task (via `currentTask(state)`). Set `task.status` to `TASK_STATUSES.IN_PROGRESS`. Return `MutationResult`.

3. **Add `handleTaskCompleted` handler** — Set `task.report_doc` to `context.doc_path` on the current task. Store pre-read fields: `task.has_deviations` = `context.has_deviations`, `task.deviation_type` = `context.deviation_type`. Do NOT change `task.status` here — status is determined later by `handleCodeReviewCompleted` via the decision table. Return `MutationResult`.

4. **Add `handleCodeReviewCompleted` handler** (most complex) — Set `task.review_doc` to `context.doc_path` and `task.review_verdict` to `context.verdict` on the current task. Call `resolveTaskOutcome(context.verdict, task.report_status || 'complete', task.has_deviations, task.deviation_type, task.retries, config.limits.max_retries_per_task)`. Apply the returned `taskStatus` to `task.status` and `reviewAction` to `task.review_action`. Then branch on `reviewAction`:
   - If `'advanced'`: bump `phase.current_task` by 1 (pointer advance within the mutation).
   - If `'corrective_task_issued'`: increment `task.retries` by 1; set `task.status` to `TASK_STATUSES.FAILED`.
   - If `'halted'`: set `task.status` to `TASK_STATUSES.HALTED` (already set by decision table, but explicit).
   Return `MutationResult` with descriptive `mutations_applied` entries.

5. **Add `handlePhaseReportCreated` handler** — Set `phase.phase_report_doc` to `context.doc_path` on the current phase (via `currentPhase(state)`). Return `MutationResult`.

6. **Add `handlePhaseReviewCompleted` handler** (complex) — Set `phase.phase_review_doc` to `context.doc_path` and `phase.phase_review_verdict` to `context.verdict` on the current phase. Call `resolvePhaseOutcome(context.verdict, context.exit_criteria_met)`. Apply the returned `phaseStatus` to `phase.status` and `phaseReviewAction` to `phase.phase_review_action`. Then branch on `phaseReviewAction`:
   - If `'advanced'` AND more phases remain (`execution.current_phase < execution.total_phases - 1`): bump `execution.current_phase` by 1; set the next phase's `status` to `PHASE_STATUSES.IN_PROGRESS`.
   - If `'advanced'` AND this is the last phase (`execution.current_phase >= execution.total_phases - 1`): set `execution.status` to `'complete'`; set `execution.current_tier` to `PIPELINE_TIERS.REVIEW`.
   - If `'corrective_tasks_issued'`: leave `phase.status` as `in_progress` (already set by decision table).
   - If `'halted'`: set `phase.status` to `PHASE_STATUSES.HALTED` (already set by decision table).
   Return `MutationResult`.

7. **Register all 6 handlers in the `MUTATIONS` map** — Replace the T02 comment block in the existing `MUTATIONS` object with the 6 new entries: `phase_plan_created`, `task_handoff_created`, `task_completed`, `code_review_completed`, `phase_report_created`, `phase_review_completed`. Keep the T03 comment. The map should now have 13 entries (7 existing + 6 new).

8. **Add `makeExecutionState()` test helper** — Create a factory function in the test file that returns a valid execution-tier state with 1 phase containing 2 tasks (both `not_started`). This factory is used by all execution handler tests.

9. **Add per-handler unit tests** — For each of the 6 handlers, add a `describe` block with tests that verify: (a) correct state mutations, (b) correct `mutations_applied` entries, (c) edge cases specific to that handler.

10. **Add pointer advance and tier transition boundary tests** — Verify `handleCodeReviewCompleted` bumps `phase.current_task` from 0→1 on advance; verify it does NOT bump the pointer on corrective/halted. Verify `handlePhaseReviewCompleted` bumps `execution.current_phase` from 0→1 when more phases remain. Verify `handlePhaseReviewCompleted` sets `current_tier` to `'review'` and `execution.status` to `'complete'` when last phase advances. Verify pointer values at boundary (last task in phase, last phase in project).

## Contracts & Interfaces

### MutationHandler Signature (all handlers must conform)

```javascript
/**
 * @callback MutationHandler
 * @param {StateJson} state - deep clone of current state (safe to mutate in-place)
 * @param {Object} context - enriched context from pre-read
 * @param {Config} config - parsed orchestration config
 * @returns {MutationResult}
 */
```

### MutationResult (all handlers must return)

```javascript
/**
 * @typedef {Object} MutationResult
 * @property {StateJson} state - the mutated state
 * @property {string[]} mutations_applied - human-readable mutation descriptions
 */
```

### Task Object Template (used by handlePhasePlanCreated to populate tasks)

```javascript
{
  name: taskName,               // string from context.tasks array
  status: TASK_STATUSES.NOT_STARTED,  // 'not_started'
  handoff_doc: null,
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null,
  has_deviations: false,
  deviation_type: null,
  retries: 0,
}
```

### Phase Object Shape (already created by handlePlanApproved in T01)

```javascript
{
  name: 'Phase N',
  status: PHASE_STATUSES.NOT_STARTED,  // or IN_PROGRESS after phase_plan_created
  current_task: 0,                     // 0-indexed
  total_tasks: 0,                      // set by handlePhasePlanCreated
  tasks: [],                           // populated by handlePhasePlanCreated
  phase_plan_doc: null,                // set by handlePhasePlanCreated
  phase_report_doc: null,              // set by handlePhaseReportCreated
  phase_review_doc: null,              // set by handlePhaseReviewCompleted
  phase_review_verdict: null,          // set by handlePhaseReviewCompleted
  phase_review_action: null,           // set by handlePhaseReviewCompleted
}
```

### Execution Object Shape

```javascript
{
  status: 'in_progress',              // or 'complete' after last phase advances
  current_tier: PIPELINE_TIERS.EXECUTION,  // or REVIEW after last phase advances
  current_phase: 0,                   // 0-indexed, bumped by handlePhaseReviewCompleted
  total_phases: N,
  phases: [/* Phase objects */],
}
```

### Existing Internal Helpers (already in mutations.js — use directly)

```javascript
function currentPhase(state) {
  return state.execution.phases[state.execution.current_phase];
}

function currentTask(state) {
  const phase = currentPhase(state);
  return phase.tasks[phase.current_task];
}

function checkRetryBudget(retries, maxRetries) {
  return retries < maxRetries;
}
```

### Decision Table Helpers (already in mutations.js — call from handlers)

```javascript
// Returns { taskStatus: string, reviewAction: string }
function resolveTaskOutcome(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries)

// Returns { phaseStatus: string, phaseReviewAction: string }
function resolvePhaseOutcome(verdict, exitCriteriaMet)
```

### Task Decision Table (8 rows — reference for test assertions)

| Row | Verdict | Report Status | Has Deviations | Deviation Type | Retries Left | → taskStatus | → reviewAction |
|-----|---------|--------------|----------------|----------------|-------------|--------------|----------------|
| 1 | approved | complete | false | — | — | complete | advanced |
| 2 | approved | complete | true | minor | — | complete | advanced |
| 3 | approved | complete | true | critical | — | complete | advanced |
| 4 | changes_requested | complete | — | — | yes | failed | corrective_task_issued |
| 5 | changes_requested | complete | — | — | no | halted | halted |
| 6 | changes_requested | failed | — | — | yes | failed | corrective_task_issued |
| 7 | changes_requested | failed | — | — | no | halted | halted |
| 8 | rejected | — | — | — | — | halted | halted |

### Phase Decision Table (5 rows — reference for test assertions)

| Row | Verdict | Exit Criteria Met | → phaseStatus | → phaseReviewAction |
|-----|---------|-------------------|---------------|---------------------|
| 1 | approved | true | complete | advanced |
| 2 | approved | false | complete | advanced |
| 3 | changes_requested | — | in_progress | corrective_tasks_issued |
| 4 | rejected | true | halted | halted |
| 5 | rejected | false | halted | halted |

### Constants Used (imported from `constants.js`)

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted',
});

const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted',
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted',
});
```

### Config Shape (relevant field for max retries)

```javascript
{
  limits: {
    max_retries_per_task: 2,  // default; used by resolveTaskOutcome
    // ... other limits
  }
}
```

## Styles & Design Tokens

Not applicable — this is a backend pipeline engine module with no UI.

## Test Requirements

- [ ] `handlePhasePlanCreated` sets `phase.status` to `'in_progress'`, `phase.phase_plan_doc` to `context.doc_path`, `phase.total_tasks` to `context.tasks.length`, populates `phase.tasks` with correct task template objects
- [ ] `handleTaskHandoffCreated` sets `task.handoff_doc` to `context.doc_path`, sets `task.status` to `'in_progress'`
- [ ] `handleTaskCompleted` sets `task.report_doc`, `task.has_deviations`, `task.deviation_type` from context; does NOT change `task.status`
- [ ] `handleCodeReviewCompleted` — on approved verdict: sets task `complete`, `review_action` to `'advanced'`, bumps `phase.current_task` by 1
- [ ] `handleCodeReviewCompleted` — on changes_requested with retries left: sets task `failed`, `review_action` to `'corrective_task_issued'`, increments `task.retries` by 1, does NOT bump pointer
- [ ] `handleCodeReviewCompleted` — on changes_requested with no retries: sets task `halted`, `review_action` to `'halted'`, does NOT bump pointer
- [ ] `handleCodeReviewCompleted` — on rejected: sets task `halted`, `review_action` to `'halted'`
- [ ] `handlePhaseReportCreated` sets `phase.phase_report_doc` to `context.doc_path`
- [ ] `handlePhaseReviewCompleted` — on approved + more phases: sets phase `complete`, bumps `execution.current_phase` by 1, sets next phase `status` to `'in_progress'`
- [ ] `handlePhaseReviewCompleted` — on approved + last phase: sets phase `complete`, sets `execution.status` to `'complete'`, sets `current_tier` to `'review'`
- [ ] `handlePhaseReviewCompleted` — on changes_requested: sets `phase.phase_review_action` to `'corrective_tasks_issued'`, phase status stays `'in_progress'`
- [ ] `handlePhaseReviewCompleted` — on rejected: sets phase `halted`, `phase_review_action` to `'halted'`
- [ ] Pointer advance boundary: `current_task` bumps from 0→1 when first task advances (2-task phase)
- [ ] Pointer advance boundary: `current_task` stays at last index when last task advances (no out-of-bounds)
- [ ] Pointer advance boundary: `current_phase` bumps from 0→1 when first phase advances (2-phase project)
- [ ] Tier transition: `current_tier` changes from `'execution'` to `'review'` only when last phase completes
- [ ] Every handler returns a `MutationResult` with non-empty `mutations_applied` array
- [ ] `getMutation` returns a function for all 13 registered events (update existing dispatch test)

## Acceptance Criteria

- [ ] `mutations.js` MUTATIONS map contains exactly 13 entries (7 existing + 6 new)
- [ ] `getMutation` returns a handler function for each of the 6 new events: `phase_plan_created`, `task_handoff_created`, `task_completed`, `code_review_completed`, `phase_report_created`, `phase_review_completed`
- [ ] All 6 handler signatures conform to `(state, context, config) => MutationResult`
- [ ] `handleCodeReviewCompleted` bumps `phase.current_task` by 1 when `reviewAction === 'advanced'`
- [ ] `handleCodeReviewCompleted` increments `task.retries` by 1 when `reviewAction === 'corrective_task_issued'`
- [ ] `handlePhaseReviewCompleted` bumps `execution.current_phase` by 1 when `phaseReviewAction === 'advanced'` and more phases remain
- [ ] `handlePhaseReviewCompleted` sets `execution.current_tier = 'review'` and `execution.status = 'complete'` when `phaseReviewAction === 'advanced'` and it is the last phase
- [ ] All existing T01 tests still pass (no regressions)
- [ ] All new T02 tests pass
- [ ] All tests pass: `node --test tests-v3/mutations.test.js`
- [ ] No syntax errors — module is importable via `require('./lib-v3/mutations')`
- [ ] No lint errors

## Constraints

- Do NOT modify any existing T01 handler implementations (`handleResearchCompleted`, `handlePrdCompleted`, `handleDesignCompleted`, `handleArchitectureCompleted`, `handleMasterPlanCompleted`, `handlePlanApproved`, `handleHalt`)
- Do NOT modify the existing decision table helpers (`resolveTaskOutcome`, `resolvePhaseOutcome`, `checkRetryBudget`) — call them as-is
- Do NOT modify the existing `currentPhase` / `currentTask` / `normalizeDocPath` helpers — use them as-is
- Do NOT change the module exports — `getMutation` and `normalizeDocPath` remain the only public exports; `_test` remains unchanged
- Do NOT add gate, review, or terminal handlers — those are T03's scope (events: `task_approved`, `phase_approved`, `final_review_completed`, `final_approved`)
- Do NOT freeze-finalize the MUTATIONS map at 17 entries — T03 will add 4 more
- Do NOT modify any existing T01 test cases — only add new `describe` blocks
- Use `'use strict'` consistently — the file already uses it
- Use `node:test` and `node:assert/strict` only — zero external test dependencies
- All new task objects created in `handlePhasePlanCreated` must include every field from the Task template (no missing fields)
- The `report_status` field for `resolveTaskOutcome` should be read from the task's stored state or default to `'complete'` — the pre-read enriches `context` with `report_status` for `task_completed`, but `handleCodeReviewCompleted` reads from the task object which stores this information via `handleTaskCompleted`
