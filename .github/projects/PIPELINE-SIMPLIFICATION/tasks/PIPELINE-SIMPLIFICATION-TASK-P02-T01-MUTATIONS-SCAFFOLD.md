---
project: "PIPELINE-SIMPLIFICATION"
phase: 2
task: 1
title: "MUTATIONS-SCAFFOLD"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# Mutations Module — Structure, Decision Tables, and Planning Handlers

## Objective

Create `.github/orchestration/scripts/lib-v3/mutations.js` with the module scaffold, the `MUTATIONS` event→handler lookup (partial — 8 of 17 entries), the two decision table helpers (`resolveTaskOutcome`, `resolvePhaseOutcome`), the retry budget helper, the `normalizeDocPath` utility, and the 7 planning + halt handlers. Create the companion test file with full decision table row coverage (13 named tests), dispatch tests, path normalization tests, planning handler tests, and halt handler tests.

## Context

The v3 pipeline replaces the current triage engine + split mutation layer with a single `mutations.js` module where each event handler produces final state in one operation. Decision table logic (currently in `triage-engine.js`) is absorbed directly into this module as internal helpers. Phase 1 delivered `constants.js` with all v3 enums, types, and status transition maps in `.github/orchestration/scripts/lib-v3/constants.js`. This task establishes the module structure and foundational handlers that T02 (execution handlers) and T03 (gate/review/terminal) will extend.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/mutations.js` | Module scaffold + 8 handlers + decision table helpers |
| CREATE | `.github/orchestration/scripts/tests-v3/mutations.test.js` | Unit tests for all T01 scope |

## Implementation Steps

1. **Create `mutations.js`** — add `'use strict'` header, import enums from `../lib-v3/constants.js` (`PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `TASK_STATUSES`, `PHASE_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`).

2. **Implement `normalizeDocPath(docPath, basePath, projectName)`** — strip the `{basePath}/{projectName}/` prefix if present; return `null`/`undefined` unchanged if input is falsy. Export this function.

3. **Implement `currentPhase(state)` and `currentTask(state)` internal helpers** — `currentPhase` returns `state.execution.phases[state.execution.current_phase]`; `currentTask` returns `phase.tasks[phase.current_task]`.

4. **Implement `checkRetryBudget(retries, maxRetries)`** — return `true` if `retries < maxRetries`, else `false`. Internal only (not exported).

5. **Implement `resolveTaskOutcome(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries)`** — 8-row first-match-wins decision table returning `{ taskStatus, reviewAction }`. Use exact row logic specified in the Contracts section below.

6. **Implement `resolvePhaseOutcome(verdict, exitCriteriaMet)`** — 5-row first-match-wins decision table returning `{ phaseStatus, phaseReviewAction }`. Use exact row logic specified in the Contracts section below.

7. **Implement `completePlanningStep(state, stepName, docPath)`** — shared helper for the 5 planning handlers. Sets `state.planning.steps[stepIndex].status = 'complete'` and `state.planning.steps[stepIndex].doc_path = docPath` where `stepIndex` is found by matching `step.name === stepName`. Returns `{ state, mutations_applied: [...] }`.

8. **Implement 7 handlers**: `handleResearchCompleted`, `handlePrdCompleted`, `handleDesignCompleted`, `handleArchitectureCompleted`, `handleMasterPlanCompleted` (also sets `planning.status = 'complete'`), `handlePlanApproved` (sets `planning.human_approved = true`, transitions `execution.current_tier = 'execution'`, sets `execution.status = 'in_progress'`, initializes `execution.phases` array from `context.total_phases`), `handleHalt` (sets `execution.current_tier = 'halted'`).

9. **Build partial `MUTATIONS` map** — freeze an object mapping the 7 planning event names + `halt` to their handler functions: `research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed`, `plan_approved`, `halt`. T02 and T03 will extend this map to 17 entries.

10. **Create `mutations.test.js`** — organize into `describe` blocks for: `getMutation` dispatch, `normalizeDocPath`, task decision table (8 row tests), phase decision table (5 row tests), each planning handler, and `handleHalt`. Use `node:test` and `node:assert/strict`. Each decision table test is named by row number per convention: `it('task row 1: approved + complete + no deviations → complete/advanced')`.

## Contracts & Interfaces

### MutationResult — Return type for all handlers

```javascript
/**
 * @typedef {Object} MutationResult
 * @property {StateJson} state - the mutated state
 * @property {string[]} mutations_applied - human-readable mutation descriptions
 */
```

### MutationHandler — Uniform handler signature

```javascript
/**
 * @callback MutationHandler
 * @param {StateJson} state - deep clone of current state (safe to mutate)
 * @param {Object} context - enriched context from pre-read
 * @param {Config} config - parsed orchestration config
 * @returns {MutationResult}
 */
```

### getMutation — Exported lookup function

```javascript
/**
 * Look up the mutation handler for a given event.
 * @param {string} event
 * @returns {MutationHandler | undefined}
 */
function getMutation(event) {
  return MUTATIONS[event];
}
```

### normalizeDocPath — Exported path utility

```javascript
/**
 * Normalize a document path to project-relative form.
 * Strips the `{basePath}/{projectName}/` prefix if present.
 * Returns null/undefined unchanged if input is falsy.
 *
 * @param {string} docPath
 * @param {string} basePath - e.g. ".github/projects"
 * @param {string} projectName - e.g. "PIPELINE-SIMPLIFICATION"
 * @returns {string}
 */
function normalizeDocPath(docPath, basePath, projectName) {
  if (!docPath) return docPath;
  const prefix = basePath + '/' + projectName + '/';
  if (docPath.startsWith(prefix)) return docPath.slice(prefix.length);
  return docPath;
}
```

### TaskOutcome — Return type for resolveTaskOutcome

```javascript
/**
 * @typedef {Object} TaskOutcome
 * @property {string} taskStatus - 'complete' | 'failed' | 'halted'
 * @property {string} reviewAction - 'advanced' | 'corrective_task_issued' | 'halted'
 */
```

### resolveTaskOutcome — 8-row task decision table (internal)

```javascript
/**
 * 8-row task decision table. Determines task outcome from code review results.
 *
 * @param {string} verdict - 'approved' | 'changes_requested' | 'rejected'
 * @param {string} reportStatus - 'complete' | 'failed' (normalized by pre-read)
 * @param {boolean} hasDeviations
 * @param {string | null} deviationType - 'minor' | 'critical' | null
 * @param {number} retries - current retry count
 * @param {number} maxRetries - from config
 * @returns {TaskOutcome}
 */
```

**Row logic (first-match-wins):**

| Row | Condition | Returns |
|-----|-----------|---------|
| 1 | `verdict === 'approved' && reportStatus === 'complete' && !hasDeviations` | `{ taskStatus: 'complete', reviewAction: 'advanced' }` |
| 2 | `verdict === 'approved' && reportStatus === 'complete' && hasDeviations && deviationType === 'minor'` | `{ taskStatus: 'complete', reviewAction: 'advanced' }` |
| 3 | `verdict === 'approved' && reportStatus === 'complete' && hasDeviations && deviationType === 'critical'` | `{ taskStatus: 'complete', reviewAction: 'advanced' }` |
| 4 | `verdict === 'changes_requested' && reportStatus === 'complete' && retries < maxRetries` | `{ taskStatus: 'failed', reviewAction: 'corrective_task_issued' }` |
| 5 | `verdict === 'changes_requested' && reportStatus === 'complete' && retries >= maxRetries` | `{ taskStatus: 'halted', reviewAction: 'halted' }` |
| 6 | `verdict === 'changes_requested' && reportStatus === 'failed' && retries < maxRetries` | `{ taskStatus: 'failed', reviewAction: 'corrective_task_issued' }` |
| 7 | `verdict === 'changes_requested' && reportStatus === 'failed' && retries >= maxRetries` | `{ taskStatus: 'halted', reviewAction: 'halted' }` |
| 8 | `verdict === 'rejected'` | `{ taskStatus: 'halted', reviewAction: 'halted' }` |

### PhaseOutcome — Return type for resolvePhaseOutcome

```javascript
/**
 * @typedef {Object} PhaseOutcome
 * @property {string} phaseStatus - 'complete' | 'in_progress' | 'halted'
 * @property {string} phaseReviewAction - 'advanced' | 'corrective_tasks_issued' | 'halted'
 */
```

### resolvePhaseOutcome — 5-row phase decision table (internal)

```javascript
/**
 * 5-row phase decision table. Determines phase outcome from phase review results.
 *
 * @param {string} verdict - 'approved' | 'changes_requested' | 'rejected'
 * @param {boolean} exitCriteriaMet
 * @returns {PhaseOutcome}
 */
```

**Row logic (first-match-wins):**

| Row | Condition | Returns |
|-----|-----------|---------|
| 1 | `verdict === 'approved' && exitCriteriaMet === true` | `{ phaseStatus: 'complete', phaseReviewAction: 'advanced' }` |
| 2 | `verdict === 'approved' && exitCriteriaMet === false` | `{ phaseStatus: 'complete', phaseReviewAction: 'advanced' }` |
| 3 | `verdict === 'changes_requested'` | `{ phaseStatus: 'in_progress', phaseReviewAction: 'corrective_tasks_issued' }` |
| 4 | `verdict === 'rejected' && exitCriteriaMet === true` | `{ phaseStatus: 'halted', phaseReviewAction: 'halted' }` |
| 5 | `verdict === 'rejected' && exitCriteriaMet === false` | `{ phaseStatus: 'halted', phaseReviewAction: 'halted' }` |

### checkRetryBudget — Internal helper

```javascript
/**
 * @param {number} retries
 * @param {number} maxRetries
 * @returns {boolean} true if retries < maxRetries
 */
function checkRetryBudget(retries, maxRetries) {
  return retries < maxRetries;
}
```

### MUTATIONS map — Partial (8 of 17 entries for T01)

```javascript
const MUTATIONS = Object.freeze({
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,
  halt:                     handleHalt,
  // T02 will add: phase_plan_created, task_handoff_created, task_completed,
  //   code_review_completed, phase_report_created, phase_review_completed
  // T03 will add: task_approved, phase_approved, final_review_completed, final_approved
});
```

**Note**: T01 freezes the map with 7 entries. T02 and T03 will unfreeze/rebuild to add their handlers, reaching 17 total entries in T03.

### handlePlanApproved — Phase initialization contract

When `plan_approved` fires, the handler receives `context.total_phases` (positive integer, validated by pre-read). The handler must:

1. Set `state.planning.human_approved = true`
2. Set `state.execution.current_tier = 'execution'` (use `PIPELINE_TIERS.EXECUTION`)
3. Set `state.execution.status = 'in_progress'`
4. Set `state.execution.total_phases = context.total_phases`
5. Initialize `state.execution.phases` as an array of `context.total_phases` phase objects, each with:

```javascript
{
  name: `Phase ${i + 1}`,
  status: 'not_started',       // PHASE_STATUSES.NOT_STARTED
  current_task: 0,
  total_tasks: 0,
  tasks: [],
  phase_plan_doc: null,
  phase_report_doc: null,
  phase_review_doc: null,
  phase_review_verdict: null,
  phase_review_action: null,
}
```

6. Set `state.execution.current_phase = 0`

### handleHalt — Terminal handler contract

Sets `state.execution.current_tier = 'halted'` (use `PIPELINE_TIERS.HALTED`). Returns mutations_applied describing the tier change.

### StateJson — v3 state shape (for reference in handler implementation)

```javascript
/**
 * @typedef {Object} StateJson
 * @property {'orchestration-state-v3'} $schema
 * @property {ProjectMeta} project
 * @property {Planning} planning
 * @property {Execution} execution
 */

/**
 * @typedef {Object} Planning
 * @property {string} status - one of PLANNING_STATUSES
 * @property {boolean} human_approved
 * @property {PlanningStep[]} steps - array of { name, status, doc_path }
 * @property {string} current_step
 */

/**
 * @typedef {Object} Execution
 * @property {string} status - 'not_started' | 'in_progress' | 'complete'
 * @property {string} current_tier - one of PIPELINE_TIERS
 * @property {number} current_phase - 0-indexed
 * @property {number} total_phases
 * @property {Phase[]} phases
 */

/**
 * @typedef {Object} Phase
 * @property {string} name
 * @property {string} status - one of PHASE_STATUSES
 * @property {number} current_task - 0-indexed
 * @property {number} total_tasks
 * @property {Task[]} tasks
 * @property {string | null} phase_plan_doc
 * @property {string | null} phase_report_doc
 * @property {string | null} phase_review_doc
 * @property {string | null} phase_review_verdict
 * @property {string | null} phase_review_action
 */

/**
 * @typedef {Object} Task
 * @property {string} name
 * @property {string} status - one of TASK_STATUSES
 * @property {string | null} handoff_doc
 * @property {string | null} report_doc
 * @property {string | null} review_doc
 * @property {string | null} review_verdict
 * @property {string | null} review_action
 * @property {boolean} has_deviations
 * @property {string | null} deviation_type
 * @property {number} retries
 */
```

### Constants available from `../lib-v3/constants.js`

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const PLANNING_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
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

## Styles & Design Tokens

Not applicable — this is a Node.js logic module with no UI.

## Test Requirements

### `describe('getMutation')`
- [ ] Returns a function for each of the 7 registered event names (`research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed`, `plan_approved`, `halt`)
- [ ] Returns `undefined` for an unknown event name (e.g., `'nonexistent_event'`)

### `describe('normalizeDocPath')`
- [ ] Strips `basePath/projectName/` prefix when present → returns remainder
- [ ] Returns path unchanged when prefix is not present
- [ ] Returns `null` when input is `null`
- [ ] Returns `undefined` when input is `undefined`

### `describe('task decision table')`
- [ ] `it('task row 1: approved + complete + no deviations → complete/advanced')` — verdict `approved`, reportStatus `complete`, hasDeviations `false`, deviationType `null`, retries `0`, maxRetries `3` → `{ taskStatus: 'complete', reviewAction: 'advanced' }`
- [ ] `it('task row 2: approved + complete + minor deviations → complete/advanced')` — verdict `approved`, reportStatus `complete`, hasDeviations `true`, deviationType `minor`, retries `0`, maxRetries `3` → `{ taskStatus: 'complete', reviewAction: 'advanced' }`
- [ ] `it('task row 3: approved + complete + critical deviations → complete/advanced')` — verdict `approved`, reportStatus `complete`, hasDeviations `true`, deviationType `critical`, retries `0`, maxRetries `3` → `{ taskStatus: 'complete', reviewAction: 'advanced' }`
- [ ] `it('task row 4: changes_requested + complete + retries left → failed/corrective')` — verdict `changes_requested`, reportStatus `complete`, hasDeviations `false`, deviationType `null`, retries `0`, maxRetries `3` → `{ taskStatus: 'failed', reviewAction: 'corrective_task_issued' }`
- [ ] `it('task row 5: changes_requested + complete + no retries → halted/halted')` — verdict `changes_requested`, reportStatus `complete`, hasDeviations `false`, deviationType `null`, retries `3`, maxRetries `3` → `{ taskStatus: 'halted', reviewAction: 'halted' }`
- [ ] `it('task row 6: changes_requested + failed + retries left → failed/corrective')` — verdict `changes_requested`, reportStatus `failed`, hasDeviations `false`, deviationType `null`, retries `1`, maxRetries `3` → `{ taskStatus: 'failed', reviewAction: 'corrective_task_issued' }`
- [ ] `it('task row 7: changes_requested + failed + no retries → halted/halted')` — verdict `changes_requested`, reportStatus `failed`, hasDeviations `false`, deviationType `null`, retries `3`, maxRetries `3` → `{ taskStatus: 'halted', reviewAction: 'halted' }`
- [ ] `it('task row 8: rejected → halted/halted')` — verdict `rejected`, reportStatus `complete`, hasDeviations `false`, deviationType `null`, retries `0`, maxRetries `3` → `{ taskStatus: 'halted', reviewAction: 'halted' }`

### `describe('phase decision table')`
- [ ] `it('phase row 1: approved + exit criteria met → complete/advanced')` — verdict `approved`, exitCriteriaMet `true` → `{ phaseStatus: 'complete', phaseReviewAction: 'advanced' }`
- [ ] `it('phase row 2: approved + exit criteria not met → complete/advanced')` — verdict `approved`, exitCriteriaMet `false` → `{ phaseStatus: 'complete', phaseReviewAction: 'advanced' }`
- [ ] `it('phase row 3: changes_requested → in_progress/corrective_tasks_issued')` — verdict `changes_requested`, exitCriteriaMet `true` → `{ phaseStatus: 'in_progress', phaseReviewAction: 'corrective_tasks_issued' }`
- [ ] `it('phase row 4: rejected + exit criteria met → halted/halted')` — verdict `rejected`, exitCriteriaMet `true` → `{ phaseStatus: 'halted', phaseReviewAction: 'halted' }`
- [ ] `it('phase row 5: rejected + exit criteria not met → halted/halted')` — verdict `rejected`, exitCriteriaMet `false` → `{ phaseStatus: 'halted', phaseReviewAction: 'halted' }`

### `describe('checkRetryBudget')`
- [ ] Returns `true` when `retries < maxRetries`
- [ ] Returns `false` when `retries === maxRetries`
- [ ] Returns `false` when `retries > maxRetries`

### `describe('planning handlers')`
- [ ] Each of the 5 step-completion handlers (`handleResearchCompleted`, `handlePrdCompleted`, `handleDesignCompleted`, `handleArchitectureCompleted`, `handleMasterPlanCompleted`) sets the corresponding step's `status` to `'complete'` and `doc_path` to the context value
- [ ] `handleMasterPlanCompleted` additionally sets `planning.status` to `'complete'`
- [ ] Each handler returns `mutations_applied` array with human-readable descriptions
- [ ] Handlers use the step's `name` field for lookup (not hardcoded array index)

### `describe('handlePlanApproved')`
- [ ] Sets `planning.human_approved` to `true`
- [ ] Sets `execution.current_tier` to `'execution'`
- [ ] Sets `execution.status` to `'in_progress'`
- [ ] Sets `execution.total_phases` to `context.total_phases`
- [ ] Initializes `execution.phases` array with correct length and phase template
- [ ] Sets `execution.current_phase` to `0`
- [ ] Each initialized phase has `status: 'not_started'`, `current_task: 0`, `total_tasks: 0`, empty `tasks` array, and all doc fields `null`

### `describe('handleHalt')`
- [ ] Sets `execution.current_tier` to `'halted'`
- [ ] Returns `mutations_applied` array

## Acceptance Criteria

- [ ] `mutations.js` exports `getMutation` and `normalizeDocPath` (and nothing else)
- [ ] `getMutation` returns a handler function for each of the 7 registered events; returns `undefined` for unknown events
- [ ] The `MUTATIONS` map contains exactly 7 entries (to be extended to 17 in T02/T03)
- [ ] `resolveTaskOutcome` covers all 8 rows with identical outcomes to the row table above; each row has a dedicated named test
- [ ] `resolvePhaseOutcome` covers all 5 rows with identical outcomes to the row table above; each row has a dedicated named test
- [ ] `checkRetryBudget` returns `true` when `retries < maxRetries`, `false` otherwise
- [ ] All 7 planning handlers produce correct state mutations and return valid `MutationResult` objects
- [ ] `handlePlanApproved` initializes the execution phases array from `context.total_phases` with the correct phase template
- [ ] `handleHalt` transitions `current_tier` to `'halted'`
- [ ] All handler signatures conform to `(state, context, config) => MutationResult`
- [ ] All tests pass: `node --test tests-v3/mutations.test.js` (run from `.github/orchestration/scripts/`)
- [ ] No syntax errors — `mutations.js` is importable via `require('./lib-v3/mutations')`
- [ ] No lint errors

## Constraints

- Do NOT implement execution handlers (`handlePhasePlanCreated`, `handleTaskHandoffCreated`, `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhaseReportCreated`, `handlePhaseReviewCompleted`) — those are T02's scope
- Do NOT implement gate or review handlers (`handleTaskApproved`, `handlePhaseApproved`, `handleFinalReviewCompleted`, `handleFinalApproved`) — those are T03's scope
- Do NOT export `resolveTaskOutcome`, `resolvePhaseOutcome`, or `checkRetryBudget` — they are internal helpers called by mutation handlers in T02/T03. Export for testing via a `_test` object if needed: `module.exports._test = { resolveTaskOutcome, resolvePhaseOutcome, checkRetryBudget }`
- Do NOT import `node:fs` or `node:path` — this module is a pure logic module with no I/O
- Do NOT create state factories or mock I/O in the test file — test the decision table helpers and handlers directly by constructing minimal state objects inline
- Do NOT modify any file in `lib/` (the current modules are untouched)
- Do NOT modify `lib-v3/constants.js` — it is complete from Phase 1
- Use `node:test` (`describe`, `it`, `beforeEach`) and `node:assert/strict` only — zero external test dependencies
- The `MUTATIONS` map must be `Object.freeze()`-d
- All handlers must accept 3 arguments `(state, context, config)` even if `config` is unused in some planning handlers — maintain uniform signature for engine compatibility
