---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
task: 3
title: "Mutations Unit Tests"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Mutations Unit Tests

## Objective

Create comprehensive unit tests for all 18 mutation handlers, the two triage mutation helpers (`applyTaskTriage`, `applyPhaseTriage`), and the API functions (`getMutation`, `needsTriage`) exported from the mutations module. Every test uses fixture state objects — zero filesystem access.

## Context

The mutations module at `.github/orchestration/scripts/lib/mutations.js` exports 5 symbols: `MUTATIONS` (an 18-entry lookup record), `getMutation(event)`, `needsTriage(event, state)`, `applyTaskTriage(state, triageResult)`, and `applyPhaseTriage(state, triageResult)`. Each mutation handler is a pure function `(state, context) → MutationResult` where `MutationResult = { state, mutations_applied: string[] }`. The module imports only from `./constants.js`. Tests must use `node:test` (`describe`/`it` blocks) and `node:assert/strict`, matching the convention established by the existing `resolver.test.js` and `state-io.test.js` test suites.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests/mutations.test.js` | ~500–600 lines. Unit tests for all exports. |

## Implementation Steps

1. **Create** `.github/orchestration/scripts/tests/mutations.test.js` with `'use strict'` at top.
2. **Import** from `node:test` (`describe`, `it`), `node:assert/strict`, the mutations module (`../lib/mutations`), and constants (`../lib/constants`).
3. **Create the `makeBaseState()` fixture factory** — returns a deep-cloned minimal valid state object (see Fixture Factory section below).
4. **Create helper `makePlanningState()`** — returns a state in the planning tier with steps at various statuses for testing planning handlers.
5. **Create helper `makeExecutionState()`** — returns a state in the execution tier with one phase containing two tasks for testing execution handlers.
6. **Write `describe('getMutation')` block** — test all 18 events return a function, unknown/start return `undefined`.
7. **Write `describe('needsTriage')` block** — test the 3 triage-triggering events and verify the remaining 16 return `{ shouldTriage: false, level: null }`.
8. **Write one `describe` block per planning handler** (7 handlers) — test the expected state changes for each.
9. **Write one `describe` block per execution handler** (11 handlers) — test the expected state changes for each, including edge cases.
10. **Write `describe('applyTaskTriage')` and `describe('applyPhaseTriage')` blocks** — test all 4 action paths (skip, advanced, corrective, halted) plus `triage_attempts` management.

## Contracts & Interfaces

### Module Exports (from `.github/orchestration/scripts/lib/mutations.js`)

```javascript
module.exports = { MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage };
```

### `MUTATIONS` Record

```javascript
/** @type {Record<string, (state: Object, context: Object) => MutationResult>} */
const MUTATIONS = {
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,
  plan_rejected:            handlePlanRejected,
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,
  gate_approved:            handleGateApproved,
  gate_rejected:            handleGateRejected,
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  final_rejected:           handleFinalRejected
};
```

### `getMutation(event)` Signature

```javascript
/**
 * @param {string} event - Event name
 * @returns {((state: Object, context: Object) => MutationResult)|undefined}
 */
function getMutation(event)
```

### `needsTriage(event, state)` Signature & Rules

```javascript
/**
 * @param {string} event
 * @param {Object} state
 * @returns {{ shouldTriage: boolean, level: 'task'|'phase'|null }}
 */
function needsTriage(event, state)
```

Trigger rules:
- `'task_completed'` → `{ shouldTriage: true, level: 'task' }`
- `'code_review_completed'` → `{ shouldTriage: true, level: 'task' }`
- `'phase_review_completed'` → `{ shouldTriage: true, level: 'phase' }`
- All other 16 events → `{ shouldTriage: false, level: null }`

### `applyTaskTriage(state, triageResult)` Signature

```javascript
/**
 * @param {Object} state - Deep clone of current state
 * @param {Object} triageResult - { verdict, action, phase_index, task_index, details }
 * @returns {MutationResult}
 */
function applyTaskTriage(state, triageResult)
```

Behavior by `triageResult.action`:
- **Skip** (`verdict === null && action === null`): return `{ state, mutations_applied: [] }` — no changes
- **`'advanced'`**: increment `triage_attempts` → set `task.review_verdict` + `task.review_action` → set `task.status = 'complete'` → reset `triage_attempts` to 0
- **`'corrective_task_issued'`**: increment `triage_attempts` → set `task.review_verdict` + `task.review_action` → set `task.status = 'failed'` → increment `task.retries` → increment `errors.total_retries`
- **`'halted'`**: increment `triage_attempts` → set `task.review_verdict` + `task.review_action` → set `task.status = 'halted'` → set `pipeline.current_tier = 'halted'` → increment `errors.total_halts` → push blocker message to `errors.active_blockers`

### `applyPhaseTriage(state, triageResult)` Signature

```javascript
/**
 * @param {Object} state - Deep clone of current state
 * @param {Object} triageResult - { verdict, action, phase_index, details }
 * @returns {MutationResult}
 */
function applyPhaseTriage(state, triageResult)
```

Behavior by `triageResult.action`:
- **Skip** (`verdict === null && action === null`): return `{ state, mutations_applied: [] }` — no changes
- **`'advanced'`**: increment `triage_attempts` → set `phase.phase_review_verdict` + `phase.phase_review_action` → reset `triage_attempts` to 0
- **`'corrective_tasks_issued'`** (note: plural): increment `triage_attempts` → set `phase.phase_review_verdict` + `phase.phase_review_action` — no additional state changes beyond verdict/action/triage_attempts
- **`'halted'`**: increment `triage_attempts` → set `phase.phase_review_verdict` + `phase.phase_review_action` → set `phase.status = 'halted'` → set `pipeline.current_tier = 'halted'` → increment `errors.total_halts` → push blocker message to `errors.active_blockers`

### `MutationResult` Type

```javascript
/**
 * @typedef {Object} MutationResult
 * @property {Object} state - The mutated state object
 * @property {string[]} mutations_applied - Human-readable list of mutations applied
 */
```

### Constants Used (from `.github/orchestration/scripts/lib/constants.js`)

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning', EXECUTION: 'execution', REVIEW: 'review',
  COMPLETE: 'complete', HALTED: 'halted'
});

const PLANNING_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete'
});

const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete',
  FAILED: 'failed', SKIPPED: 'skipped'
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete',
  FAILED: 'failed', HALTED: 'halted'
});

const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete',
  FAILED: 'failed', HALTED: 'halted'
});

const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REJECTED: 'rejected'
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted'
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced', CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued', HALTED: 'halted'
});

const SEVERITY_LEVELS = Object.freeze({ MINOR: 'minor', CRITICAL: 'critical' });
```

## Fixture Factory

Use this base state factory in your test file. Deep-clone it (via `JSON.parse(JSON.stringify(...))`) before each test to avoid state leakage between tests.

```javascript
function makeBaseState() {
  return {
    project: {
      name: 'TEST-PROJECT',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T12:00:00Z'
    },
    pipeline: {
      current_tier: 'planning',
      human_gate_mode: 'autonomous'
    },
    planning: {
      status: 'in_progress',
      steps: {
        research:     { status: 'not_started', output: null },
        prd:          { status: 'not_started', output: null },
        design:       { status: 'not_started', output: null },
        architecture: { status: 'not_started', output: null },
        master_plan:  { status: 'not_started', output: null }
      },
      human_approved: false
    },
    execution: {
      status: 'not_started',
      current_phase: 0,
      total_phases: 1,
      triage_attempts: 0,
      phases: []
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

For execution-tier tests, use this helper that builds on `makeBaseState()`:

```javascript
function makeExecutionState() {
  const state = makeBaseState();
  state.pipeline.current_tier = 'execution';
  state.planning.status = 'complete';
  state.planning.steps.research     = { status: 'complete', output: 'RESEARCH.md' };
  state.planning.steps.prd          = { status: 'complete', output: 'PRD.md' };
  state.planning.steps.design       = { status: 'complete', output: 'DESIGN.md' };
  state.planning.steps.architecture = { status: 'complete', output: 'ARCHITECTURE.md' };
  state.planning.steps.master_plan  = { status: 'complete', output: 'MASTER-PLAN.md' };
  state.planning.human_approved = true;
  state.execution.status = 'in_progress';
  state.execution.current_phase = 0;
  state.execution.total_phases = 1;
  state.execution.triage_attempts = 0;
  state.execution.phases = [{
    phase_number: 1,
    title: 'Phase One',
    status: 'in_progress',
    phase_doc: 'phases/PHASE-01.md',
    current_task: 0,
    total_tasks: 2,
    tasks: [
      {
        task_number: 1, title: 'Task One',
        status: 'not_started', handoff_doc: null,
        report_doc: null, retries: 0,
        last_error: null, severity: null,
        review_doc: null, review_verdict: null, review_action: null
      },
      {
        task_number: 2, title: 'Task Two',
        status: 'not_started', handoff_doc: null,
        report_doc: null, retries: 0,
        last_error: null, severity: null,
        review_doc: null, review_verdict: null, review_action: null
      }
    ],
    phase_report: null,
    human_approved: false,
    phase_review: null,
    phase_review_verdict: null,
    phase_review_action: null
  }];
  return state;
}
```

## Styles & Design Tokens

N/A — backend Node.js test module, no UI.

## Test Requirements

### `getMutation` Tests
- [ ] Returns a function for each of the 18 event names: `research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed`, `plan_approved`, `plan_rejected`, `phase_plan_created`, `task_handoff_created`, `task_completed`, `code_review_completed`, `phase_report_created`, `phase_review_completed`, `gate_approved`, `gate_rejected`, `final_review_completed`, `final_approved`, `final_rejected`
- [ ] Returns `undefined` for `'start'`
- [ ] Returns `undefined` for `'unknown_event'`
- [ ] Returns `undefined` for empty string

### `needsTriage` Tests
- [ ] Returns `{ shouldTriage: true, level: 'task' }` for `'task_completed'`
- [ ] Returns `{ shouldTriage: true, level: 'task' }` for `'code_review_completed'`
- [ ] Returns `{ shouldTriage: true, level: 'phase' }` for `'phase_review_completed'`
- [ ] Returns `{ shouldTriage: false, level: null }` for each of the remaining 16 events (iterate the list)
- [ ] Returns `{ shouldTriage: false, level: null }` for `'start'` and `'unknown_event'`

### Planning Handler Tests

For each of the 5 step-completion handlers (`handleResearchCompleted`, `handlePrdCompleted`, `handleDesignCompleted`, `handleArchitectureCompleted`, `handleMasterPlanCompleted`), call via `getMutation(event)(state, context)`:

- [ ] `research_completed`: sets `planning.steps.research.status` to `'complete'` and `planning.steps.research.output` to the provided `context.doc_path`
- [ ] `prd_completed`: sets `planning.steps.prd.status` to `'complete'` and `.output` to `context.doc_path`
- [ ] `design_completed`: sets `planning.steps.design.status` to `'complete'` and `.output` to `context.doc_path`
- [ ] `architecture_completed`: sets `planning.steps.architecture.status` to `'complete'` and `.output` to `context.doc_path`
- [ ] `master_plan_completed`: sets `planning.steps.master_plan.status` to `'complete'`, `.output` to `context.doc_path`, AND sets `planning.status` to `'complete'`
- [ ] Each returns `{ state, mutations_applied }` where `mutations_applied` is a non-empty `string[]`

### `plan_approved` Tests
- [ ] Sets `planning.human_approved` to `true`
- [ ] Sets `pipeline.current_tier` to `'execution'`
- [ ] Sets `execution.status` to `'in_progress'`
- [ ] Returns `mutations_applied` with 3 entries

### `plan_rejected` Tests
- [ ] Sets `pipeline.current_tier` to `'halted'`
- [ ] Pushes `'Plan rejected by human'` to `errors.active_blockers`
- [ ] Increments `errors.total_halts` by 1

### Execution Handler Tests

#### `phase_plan_created`
- [ ] Sets `phase.phase_doc` to `context.plan_path`
- [ ] Sets `phase.status` to `'in_progress'` when phase was `'not_started'`
- [ ] Does NOT change `phase.status` when phase is already `'in_progress'`
- [ ] Initializes `phase.tasks` array from `context.tasks` with correct default fields (`status: 'not_started'`, `retries: 0`, `handoff_doc: null`, etc.)
- [ ] Sets `phase.total_tasks` and `phase.current_task = 0`

#### `task_handoff_created`
- [ ] Sets `task.handoff_doc` to `context.handoff_path`
- [ ] Sets `task.status` to `'in_progress'`
- [ ] Clears `task.review_doc`, `task.review_verdict`, `task.review_action` to `null`

#### `task_completed`
- [ ] Sets `task.report_doc` to `context.report_path`
- [ ] Sets `task.severity` to `context.report_severity` when provided
- [ ] Does NOT set `task.severity` when `context.report_severity` is `null` or `undefined`
- [ ] Does NOT change `task.status` (status is set by triage, not by this handler)

#### `code_review_completed`
- [ ] Sets `task.review_doc` to `context.review_path`
- [ ] Does NOT set `task.review_verdict` or `task.review_action` (those are set by triage)

#### `phase_report_created`
- [ ] Sets `phase.phase_report` to `context.report_path`

#### `phase_review_completed`
- [ ] Sets `phase.phase_review` to `context.review_path`
- [ ] Does NOT set `phase.phase_review_verdict` or `phase.phase_review_action` (those are set by triage)

#### `gate_approved` (task gate)
- [ ] Increments `phase.current_task` by 1 when `context.gate_type === 'task'`
- [ ] Resets `execution.triage_attempts` to 0

#### `gate_approved` (phase gate)
- [ ] Sets `phase.status` to `'complete'` when `context.gate_type === 'phase'`
- [ ] Sets `phase.human_approved` to `true`
- [ ] Increments `execution.current_phase` by 1
- [ ] Resets `execution.triage_attempts` to 0
- [ ] When `current_phase >= phases.length` (all phases done): sets `pipeline.current_tier` to `'review'` and `execution.status` to `'complete'`
- [ ] When `current_phase < phases.length` (more phases remain): does NOT change `pipeline.current_tier`

#### `gate_rejected`
- [ ] Sets `pipeline.current_tier` to `'halted'`
- [ ] Pushes blocker message containing the gate type to `errors.active_blockers`
- [ ] Increments `errors.total_halts` by 1

### Final Review Handler Tests

#### `final_review_completed`
- [ ] Sets `final_review.report_doc` to `context.review_path`
- [ ] Sets `final_review.status` to `'complete'`

#### `final_approved`
- [ ] Sets `final_review.human_approved` to `true`
- [ ] Sets `pipeline.current_tier` to `'complete'`

#### `final_rejected`
- [ ] Sets `pipeline.current_tier` to `'halted'`
- [ ] Pushes `'Final review rejected by human'` to `errors.active_blockers`
- [ ] Increments `errors.total_halts` by 1

### `applyTaskTriage` Tests
- [ ] **Skip case**: when `triageResult.verdict === null && triageResult.action === null`, returns `mutations_applied: []` and makes no state changes
- [ ] **Advanced**: sets `task.review_verdict`, `task.review_action`, sets `task.status` to `'complete'`, resets `execution.triage_attempts` to 0
- [ ] **Advanced**: `mutations_applied` includes entries for verdict, action, status, and triage_attempts reset
- [ ] **Corrective task issued**: sets `task.status` to `'failed'`, increments `task.retries` by 1, increments `errors.total_retries` by 1
- [ ] **Halted**: sets `task.status` to `'halted'`, sets `pipeline.current_tier` to `'halted'`, increments `errors.total_halts`, pushes blocker to `errors.active_blockers`
- [ ] **triage_attempts increment**: triage_attempts starts at 0, becomes 1 after triage (non-skip case)
- [ ] **triage_attempts default-to-0**: when `execution.triage_attempts` is `undefined`, defaults to 0 then increments to 1

### `applyPhaseTriage` Tests
- [ ] **Skip case**: when `triageResult.verdict === null && triageResult.action === null`, returns `mutations_applied: []` and makes no state changes
- [ ] **Advanced**: sets `phase.phase_review_verdict`, `phase.phase_review_action`, resets `execution.triage_attempts` to 0
- [ ] **Corrective tasks issued**: sets `phase.phase_review_verdict`, `phase.phase_review_action`, increments `triage_attempts` — no additional state changes
- [ ] **Halted**: sets `phase.status` to `'halted'`, sets `pipeline.current_tier` to `'halted'`, increments `errors.total_halts`, pushes blocker
- [ ] **triage_attempts increment**: starts at 0, becomes 1 after triage (non-skip case)
- [ ] **triage_attempts default-to-0**: when `execution.triage_attempts` is `undefined`, defaults to 0 then increments to 1

### General Tests
- [ ] All 18 handlers return `{ state, mutations_applied }` where `mutations_applied` is an array of strings
- [ ] `MUTATIONS` record has exactly 18 entries
- [ ] Every handler in `MUTATIONS` is a named function (not anonymous)

## Acceptance Criteria

- [ ] File created at `.github/orchestration/scripts/tests/mutations.test.js`
- [ ] Module is CommonJS with `'use strict'` at top
- [ ] Uses `node:test` (`describe`, `it`) and `node:assert/strict` — no npm dependencies
- [ ] Tests cover all 18 mutation handlers (invoked via `getMutation(event)(state, context)`)
- [ ] Tests cover `applyTaskTriage` with all 4 action paths: skip, advanced, corrective_task_issued, halted
- [ ] Tests cover `applyPhaseTriage` with all 4 action paths: skip, advanced, corrective_tasks_issued, halted
- [ ] Tests cover `triage_attempts` increment and reset behavior for both triage helpers
- [ ] Tests cover `triage_attempts` default-to-0 backward compatibility for both triage helpers
- [ ] Tests cover `needsTriage` for all 19 events (3 true + 16 false) plus `'start'` and `'unknown_event'`
- [ ] Tests cover `getMutation` for all 18 events + unknown event + `'start'`
- [ ] Tests verify `MUTATIONS` record has exactly 18 entries and all are named functions
- [ ] All tests use fixture state objects (no filesystem access)
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests/mutations.test.js` exits with code 0
- [ ] No lint errors

## Constraints

- Do NOT import `fs`, `path`, or any I/O module — tests are purely in-memory
- Do NOT modify `mutations.js`, `constants.js`, or any other source file
- Do NOT create any other files besides `mutations.test.js`
- Do NOT use any npm test framework (`jest`, `mocha`, `vitest`) — use only `node:test` and `node:assert/strict`
- Do NOT reference any external planning documents (Architecture, Design, PRD, etc.)
- Deep-clone state before passing to handlers to prevent cross-test contamination: use `JSON.parse(JSON.stringify(state))`
