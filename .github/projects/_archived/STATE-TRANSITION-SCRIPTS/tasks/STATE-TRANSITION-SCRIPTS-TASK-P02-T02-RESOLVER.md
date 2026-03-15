---
project: "STATE-TRANSITION-SCRIPTS"
phase: 2
task: 2
title: "Next-Action Resolver Core"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# Next-Action Resolver Core

## Objective

Create `src/lib/resolver.js` — a pure function `resolveNextAction(state, config?)` that encodes the full routing decision tree from the Orchestrator agent. Given a parsed `state.json` object (and optional config), it returns a `NextActionResult` identifying the exact next action the Orchestrator should take. This is the core domain module for Script 1 of the STATE-TRANSITION-SCRIPTS project.

## Context

The Orchestrator agent currently re-derives ~35 routing decisions from prose on every invocation. This module replaces that prose logic with a deterministic pure function. The resolver imports ONLY from `src/lib/constants.js` (the shared enum module created in Phase 1). It performs zero filesystem access — all I/O is handled by the CLI wrapper (`src/next-action.js`, a later task). The function must produce identical output for identical input — no randomness, no time-dependence, no ambient state.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/lib/resolver.js` | Core routing logic — pure function, CommonJS module |

## Implementation Steps

1. **File header**: Add `'use strict'` at top. Import all needed enums from `./constants.js`:
   ```javascript
   const {
     PIPELINE_TIERS, PLANNING_STATUSES, PLANNING_STEP_STATUSES,
     PHASE_STATUSES, TASK_STATUSES, REVIEW_VERDICTS, REVIEW_ACTIONS,
     PHASE_REVIEW_ACTIONS, SEVERITY_LEVELS, HUMAN_GATE_MODES, NEXT_ACTIONS
   } = require('./constants');
   ```

2. **Define `PLANNING_STEP_ORDER`** — ordered array mapping planning step keys to their corresponding spawn actions:
   ```javascript
   const PLANNING_STEP_ORDER = [
     { key: 'research',     action: NEXT_ACTIONS.SPAWN_RESEARCH },
     { key: 'prd',          action: NEXT_ACTIONS.SPAWN_PRD },
     { key: 'design',       action: NEXT_ACTIONS.SPAWN_DESIGN },
     { key: 'architecture', action: NEXT_ACTIONS.SPAWN_ARCHITECTURE },
     { key: 'master_plan',  action: NEXT_ACTIONS.SPAWN_MASTER_PLAN }
   ];
   ```

3. **Implement `makeResult(action, context)` helper** — constructs a `NextActionResult` object with defaults for null fields:
   ```javascript
   function makeResult(action, opts) {
     return {
       action,
       context: {
         tier:        opts.tier        || null,
         phase_index: opts.phase_index ?? null,
         task_index:  opts.task_index  ?? null,
         phase_id:    opts.phase_id    || null,
         task_id:     opts.task_id     || null,
         details:     opts.details     || ''
       }
     };
   }
   ```

4. **Implement `resolveHumanGateMode(state, config)` helper** — resolves effective human gate mode:
   ```javascript
   function resolveHumanGateMode(state, config) {
     if (config && config.human_gates && config.human_gates.execution_mode) {
       return config.human_gates.execution_mode;
     }
     return (state.pipeline && state.pipeline.human_gate_mode) || HUMAN_GATE_MODES.ASK;
   }
   ```

5. **Implement `resolvePlanning(state)` helper** — handles all planning tier routing:
   - Iterate `PLANNING_STEP_ORDER`; for each step, check `state.planning.steps[key].status !== 'complete'` → return the corresponding spawn action
   - If all steps complete and `!state.planning.human_approved` → return `REQUEST_PLAN_APPROVAL`
   - If all steps complete and `state.planning.human_approved === true` → return `TRANSITION_TO_EXECUTION`

6. **Implement `resolveExecution(state, humanGateMode)` helper** — handles execution tier routing:
   - Check if `current_phase >= phases.length` → `TRANSITION_TO_REVIEW`
   - Get current phase at `state.execution.phases[state.execution.current_phase]`
   - If `phase.status === 'not_started'` → `CREATE_PHASE_PLAN`
   - Get current task at `phase.tasks[phase.current_task]`
   - If `current_task >= phase.tasks.length` → delegate to `resolvePhaseLifecycle()`
   - Otherwise → delegate to `resolveTaskLifecycle()`

7. **Implement `resolveTaskLifecycle(task, taskIndex, phase, phaseIndex, humanGateMode, limits)` helper** — handles all task-level routing (see Decision Tree section below for exact logic).

8. **Implement `resolvePhaseLifecycle(phase, phaseIndex, humanGateMode)` helper** — handles all phase-level routing after all tasks are processed (see Decision Tree section below for exact logic).

9. **Implement `resolveReview(state)` helper** — handles review tier:
   - If `state.final_review.status !== 'complete'` → `SPAWN_FINAL_REVIEWER`
   - If `state.final_review.status === 'complete'` and `!state.final_review.human_approved` → `REQUEST_FINAL_APPROVAL`
   - If `state.final_review.human_approved === true` → `TRANSITION_TO_COMPLETE`

10. **Implement `resolveNextAction(state, config)` main function** — entry point with JSDoc. Evaluation order:
    1. If `state` is null/undefined → `INIT_PROJECT`
    2. If `state.pipeline.current_tier === 'halted'` → `DISPLAY_HALTED`
    3. If `state.pipeline.current_tier === 'complete'` → `DISPLAY_COMPLETE`
    4. If `state.pipeline.current_tier === 'planning'` → `resolvePlanning(state)`
    5. If `state.pipeline.current_tier === 'execution'` → `resolveExecution(state, humanGateMode)`
    6. If `state.pipeline.current_tier === 'review'` → `resolveReview(state)`
    7. Fallback → `INIT_PROJECT` (unknown/missing tier)

11. **Export via `module.exports`**:
    ```javascript
    module.exports = { resolveNextAction };
    ```

## Contracts & Interfaces

### NextActionResult (return type)

```javascript
/**
 * @typedef {Object} NextActionResult
 * @property {string} action - One of NEXT_ACTIONS enum values (35 possible values)
 * @property {Object} context
 * @property {string|null} context.tier - Current pipeline tier (PIPELINE_TIERS enum value)
 * @property {number|null} context.phase_index - 0-based index, null if not in execution tier
 * @property {number|null} context.task_index - 0-based index, null if not task-scoped
 * @property {string|null} context.phase_id - Human-readable e.g. "P01", null if N/A
 * @property {string|null} context.task_id - Human-readable e.g. "P01-T03", null if N/A
 * @property {string} context.details - Explanation of the resolution path taken
 */
```

### OrchestratorConfig (optional input)

```javascript
/**
 * @typedef {Object} OrchestratorConfig
 * @property {Object} [human_gates]
 * @property {'ask'|'phase'|'task'|'autonomous'} [human_gates.execution_mode]
 * @property {Object} [projects]
 * @property {string} [projects.base_path]
 */
```

### Function Signature

```javascript
/**
 * Resolve the next action the Orchestrator should take.
 * Pure function: same inputs always produce same output.
 *
 * @param {StateJson|null|undefined} state - Parsed state.json object (null/undefined → init_project)
 * @param {OrchestratorConfig} [config] - Parsed orchestration.yml (optional)
 * @returns {NextActionResult}
 */
function resolveNextAction(state, config) { /* ... */ }
```

### StateJson Shape (consumed — do NOT define, it's in constants.js)

The `StateJson` typedef is already defined in `src/lib/constants.js`. The resolver consumes it; do NOT redefine it. Key fields the resolver reads:

- `state.pipeline.current_tier` — `'planning'|'execution'|'review'|'complete'|'halted'`
- `state.pipeline.human_gate_mode` — `'ask'|'phase'|'task'|'autonomous'`
- `state.planning.status` — `'not_started'|'in_progress'|'complete'`
- `state.planning.steps.{research|prd|design|architecture|master_plan}.status` — step statuses
- `state.planning.human_approved` — boolean
- `state.execution.current_phase` — 0-based index into `phases[]`
- `state.execution.phases[]` — array of Phase objects
- `phase.status` — `'not_started'|'in_progress'|'complete'|'failed'|'halted'`
- `phase.current_task` — 0-based index into `tasks[]`
- `phase.tasks[]` — array of Task objects
- `phase.phase_report` — string|null
- `phase.phase_review` — string|null
- `phase.phase_review_verdict` — `'approved'|'changes_requested'|'rejected'|null`
- `phase.phase_review_action` — `'advanced'|'corrective_tasks_issued'|'halted'|null`
- `task.status` — `'not_started'|'in_progress'|'complete'|'failed'|'halted'`
- `task.handoff_doc` — string|null
- `task.report_doc` — string|null
- `task.review_doc` — string|null
- `task.review_verdict` — `'approved'|'changes_requested'|'rejected'|null`
- `task.review_action` — `'advanced'|'corrective_task_issued'|'halted'|null`
- `task.retries` — number
- `task.severity` — `'minor'|'critical'|null`
- `state.final_review.status` — `'not_started'|'in_progress'|'complete'|'failed'`
- `state.final_review.human_approved` — boolean
- `state.limits.max_retries_per_task` — number

### Complete NEXT_ACTIONS Enum Reference (35 values)

All values are defined in `src/lib/constants.js` as `NEXT_ACTIONS`. Import and use the constants — never use raw string literals.

```javascript
const NEXT_ACTIONS = Object.freeze({
  // Terminal / setup
  INIT_PROJECT:                    'init_project',
  DISPLAY_HALTED:                  'display_halted',
  DISPLAY_COMPLETE:                'display_complete',

  // Planning tier
  SPAWN_RESEARCH:                  'spawn_research',
  SPAWN_PRD:                       'spawn_prd',
  SPAWN_DESIGN:                    'spawn_design',
  SPAWN_ARCHITECTURE:              'spawn_architecture',
  SPAWN_MASTER_PLAN:               'spawn_master_plan',
  REQUEST_PLAN_APPROVAL:           'request_plan_approval',
  TRANSITION_TO_EXECUTION:         'transition_to_execution',

  // Execution tier — task lifecycle
  CREATE_PHASE_PLAN:               'create_phase_plan',
  CREATE_TASK_HANDOFF:             'create_task_handoff',
  EXECUTE_TASK:                    'execute_task',
  UPDATE_STATE_FROM_TASK:          'update_state_from_task',
  CREATE_CORRECTIVE_HANDOFF:       'create_corrective_handoff',
  HALT_TASK_FAILED:                'halt_task_failed',
  SPAWN_CODE_REVIEWER:             'spawn_code_reviewer',
  UPDATE_STATE_FROM_REVIEW:        'update_state_from_review',
  TRIAGE_TASK:                     'triage_task',
  HALT_TRIAGE_INVARIANT:           'halt_triage_invariant',
  RETRY_FROM_REVIEW:               'retry_from_review',
  HALT_FROM_REVIEW:                'halt_from_review',
  ADVANCE_TASK:                    'advance_task',
  GATE_TASK:                       'gate_task',

  // Execution tier — phase lifecycle
  GENERATE_PHASE_REPORT:           'generate_phase_report',
  SPAWN_PHASE_REVIEWER:            'spawn_phase_reviewer',
  UPDATE_STATE_FROM_PHASE_REVIEW:  'update_state_from_phase_review',
  TRIAGE_PHASE:                    'triage_phase',
  HALT_PHASE_TRIAGE_INVARIANT:     'halt_phase_triage_invariant',
  GATE_PHASE:                      'gate_phase',
  ADVANCE_PHASE:                   'advance_phase',
  TRANSITION_TO_REVIEW:            'transition_to_review',

  // Review tier
  SPAWN_FINAL_REVIEWER:            'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL:          'request_final_approval',
  TRANSITION_TO_COMPLETE:          'transition_to_complete'
});
```

## Decision Tree — Full Logic

This is the **complete routing decision tree** the resolver must encode. Evaluation is top-down; first match wins.

### Tier 0: Terminal & Setup

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| 0a | `state` is `null` or `undefined` | `INIT_PROJECT` | No state.json — new project |
| 0b | `state.pipeline.current_tier === 'halted'` | `DISPLAY_HALTED` | Pipeline halted — show blockers |
| 0c | `state.pipeline.current_tier === 'complete'` | `DISPLAY_COMPLETE` | Project complete |

### Tier 1: Planning

Evaluate planning steps in strict order: research → prd → design → architecture → master_plan.

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| 1a | `steps.research.status !== 'complete'` | `SPAWN_RESEARCH` | First incomplete step |
| 1b | `steps.prd.status !== 'complete'` | `SPAWN_PRD` | Research done, PRD needed |
| 1c | `steps.design.status !== 'complete'` | `SPAWN_DESIGN` | PRD done, Design needed |
| 1d | `steps.architecture.status !== 'complete'` | `SPAWN_ARCHITECTURE` | Design done, Arch needed |
| 1e | `steps.master_plan.status !== 'complete'` | `SPAWN_MASTER_PLAN` | Arch done, Master Plan needed |
| 1f | All steps complete, `!planning.human_approved` | `REQUEST_PLAN_APPROVAL` | Needs human approval gate |
| 1g | All steps complete, `planning.human_approved === true` | `TRANSITION_TO_EXECUTION` | Ready to start execution |

### Tier 2: Execution — Phase Routing

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| 2a | `current_phase >= phases.length` | `TRANSITION_TO_REVIEW` | All phases done |
| 2b | `phase.status === 'not_started'` | `CREATE_PHASE_PLAN` | Phase needs planning |
| 2c | `current_task >= phase.tasks.length` | → Phase lifecycle (Tier 2c below) | All tasks processed |
| 2d | Otherwise | → Task lifecycle (Tier 2b below) | Route by current task |

### Tier 2b: Execution — Task Lifecycle

Get the current task: `task = phase.tasks[phase.current_task]`. Route by `task.status`:

**When `task.status === 'not_started'`:**

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| T1 | `task.handoff_doc` is null | `CREATE_TASK_HANDOFF` | Needs handoff before execution |
| T2 | `task.handoff_doc` is non-null | `EXECUTE_TASK` | Handoff ready, spawn Coder |

**When `task.status === 'in_progress'`:**

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| T3 | Always | `UPDATE_STATE_FROM_TASK` | Coder was spawned; check results and record |

**When `task.status === 'failed'`:**

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| T4 | `task.severity === 'critical'` | `HALT_TASK_FAILED` | Critical failure — halt immediately |
| T5 | `task.retries >= limits.max_retries_per_task` | `HALT_TASK_FAILED` | Retry budget exhausted |
| T6 | `task.severity !== 'critical'` AND `task.retries < limits.max_retries_per_task` | `CREATE_CORRECTIVE_HANDOFF` | Minor failure with retries available |

**When `task.status === 'complete'`:**

Evaluate in this exact order (first match wins):

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| T7 | `task.review_verdict === 'approved'` | `ADVANCE_TASK` or `GATE_TASK` | Approved — check gate mode (see below) |
| T8 | `task.review_verdict === 'changes_requested'` | `RETRY_FROM_REVIEW` | Needs corrective handoff |
| T9 | `task.review_verdict === 'rejected'` | `HALT_FROM_REVIEW` | Critical rejection — halt |
| T10 | `task.review_doc !== null` AND `task.review_verdict === null` | `TRIAGE_TASK` | Review exists, needs triage |
| T11 | `task.review_doc === null` AND `task.review_verdict === null` | `SPAWN_CODE_REVIEWER` | Needs code review |

**T7 gate sub-logic:**

```javascript
if (task.review_verdict === REVIEW_VERDICTS.APPROVED) {
  if (humanGateMode === HUMAN_GATE_MODES.TASK) {
    return GATE_TASK;
  }
  return ADVANCE_TASK;
}
```

> **Important**: Check `review_verdict` BEFORE checking `review_doc`. A task may have `review_verdict = 'approved'` with `review_doc = null` (fast-track approval without formal review). The verdict is authoritative.

**When `task.status === 'halted'`:**

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| T12 | Always | `DISPLAY_HALTED` | Task was halted — show status |

### Tier 2c: Execution — Phase Lifecycle

Entered when `phase.current_task >= phase.tasks.length` (all tasks processed). Evaluate in order:

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| P1 | `phase.phase_report` is null | `GENERATE_PHASE_REPORT` | All tasks done, need report |
| P2 | `phase.phase_review` is null | `SPAWN_PHASE_REVIEWER` | Report exists, need review |
| P3 | `phase.phase_review !== null` AND `phase.phase_review_verdict === null` | `TRIAGE_PHASE` | Review exists, needs triage |
| P4 | `phase.phase_review_action === 'halted'` | `DISPLAY_HALTED` | Phase rejected — halt |
| P5 | `phase.phase_review_action === 'corrective_tasks_issued'` | `CREATE_PHASE_PLAN` | Corrective tasks needed — re-plan |
| P6 | `phase.phase_review_verdict === 'approved'` AND `humanGateMode === 'phase'` | `GATE_PHASE` | Phase approved, human gate |
| P7 | `phase.phase_review_verdict === 'approved'` | `ADVANCE_PHASE` | Phase complete, advance |

### Tier 3: Review

| # | Condition | Action | Details |
|---|-----------|--------|---------|
| 3a | `final_review.status !== 'complete'` | `SPAWN_FINAL_REVIEWER` | Final review needed |
| 3b | `final_review.status === 'complete'` AND `!final_review.human_approved` | `REQUEST_FINAL_APPROVAL` | Needs final human approval |
| 3c | `final_review.status === 'complete'` AND `final_review.human_approved` | `TRANSITION_TO_COMPLETE` | Approved — complete project |

### Actions Not Produced by State Analysis (4 of 35)

These values exist in `NEXT_ACTIONS` and are used by the Orchestrator's runtime workflow, but the resolver does **not** produce them because their trigger conditions depend on runtime-local state not present in `state.json`:

| Action | Why Not Produced | Who Uses It |
|--------|-----------------|-------------|
| `UPDATE_STATE_FROM_REVIEW` | No state signal distinguishes "reviewer just finished" from "reviewer not yet spawned" (both show `review_doc = null`) | Orchestrator — internal workflow step after `SPAWN_CODE_REVIEWER` |
| `UPDATE_STATE_FROM_PHASE_REVIEW` | Same — no state signal distinguishes "phase reviewer finished" from "not yet spawned" | Orchestrator — internal workflow step after `SPAWN_PHASE_REVIEWER` |
| `HALT_TRIAGE_INVARIANT` | Requires `triage_attempts` counter which is runtime-local in the Orchestrator, not persisted in `state.json` | Orchestrator — converts `TRIAGE_TASK` to this when `triage_attempts > 1` |
| `HALT_PHASE_TRIAGE_INVARIANT` | Same as above for phase-level triage | Orchestrator — converts `TRIAGE_PHASE` to this when `triage_attempts > 1` |

The resolver returns `TRIAGE_TASK` / `TRIAGE_PHASE` for the triage-invariant states; the Orchestrator performs its own guard and may substitute `HALT_TRIAGE_INVARIANT` / `HALT_PHASE_TRIAGE_INVARIANT` based on its local counter.

## Styles & Design Tokens

Not applicable — this is a pure logic module with no UI.

## Test Requirements

_(Tests are covered by T3 — Resolver Test Suite. These are listed here so the coder can structure the code for testability.)_

- [ ] Every code path in the decision tree is reachable and returns the correct `NEXT_ACTIONS` value
- [ ] `resolveNextAction(null)` returns `{ action: 'init_project', ... }`
- [ ] `resolveNextAction(undefined)` returns `{ action: 'init_project', ... }`
- [ ] Planning step order is strict: research → prd → design → architecture → master_plan
- [ ] `config.human_gates.execution_mode` overrides `state.pipeline.human_gate_mode`
- [ ] When config is omitted, `state.pipeline.human_gate_mode` is used
- [ ] All returned objects match the `NextActionResult` shape (action + context with all 6 fields)
- [ ] `context.phase_id` format is `"P{NN}"` (zero-padded: `"P01"`, `"P02"`)
- [ ] `context.task_id` format is `"P{NN}-T{NN}"` (zero-padded: `"P01-T03"`)
- [ ] No `Date.now()`, `Math.random()`, `fs`, `path`, or `process` imports
- [ ] `context.details` is always a non-empty string explaining the resolution path

## Acceptance Criteria

- [ ] File `src/lib/resolver.js` exists and is valid JavaScript (`node -c src/lib/resolver.js` exits 0)
- [ ] Exports `resolveNextAction` via `module.exports = { resolveNextAction }`
- [ ] `resolveNextAction(state, config?)` returns a `NextActionResult` for every reachable state combination
- [ ] Pure function: no `Date.now()`, no `Math.random()`, no `require('fs')`, no `require('path')`, no `require('process')`, no ambient state
- [ ] Only import is `require('./constants')` — zero other dependencies
- [ ] `'use strict'` at the top of the file
- [ ] JSDoc `@param` and `@returns` annotations on `resolveNextAction` and all helper functions
- [ ] Produces 31 of 35 `NEXT_ACTIONS` values from state analysis (the 4 Orchestrator-managed values documented above are intentionally not produced)
- [ ] `config` parameter is optional; when omitted, `human_gate_mode` is read from `state.pipeline.human_gate_mode`
- [ ] Planning steps are evaluated in strict order: research → prd → design → architecture → master_plan
- [ ] Execution tier evaluates phases via `current_phase` index, tasks via `current_task` index
- [ ] Failed task routing checks severity first (critical → halt), then retry budget (exhausted → halt), then minor with budget → corrective
- [ ] Complete task routing checks `review_verdict` BEFORE `review_doc` (supports fast-track approval with no review doc)
- [ ] Phase lifecycle checks `phase_review_action` for `'halted'` and `'corrective_tasks_issued'` before checking gate mode
- [ ] `context.phase_id` and `context.task_id` use zero-padded format (`"P01"`, `"P01-T03"`)
- [ ] All tests pass: `node tests/constants.test.js` and `node tests/state-validator.test.js` (no regressions)
- [ ] Build succeeds: `node -c src/lib/resolver.js` exits 0

## Constraints

- **Do NOT access the filesystem** — no `require('fs')`, no `require('path')`, no file reading. All data comes in via function parameters.
- **Do NOT use `Date.now()`** — the function must be deterministic. Timestamps are the Tactical Planner's responsibility.
- **Do NOT import from any module other than `./constants`** — the resolver is a pure logic module.
- **Do NOT define a CLI entry point** — that is T4's scope (`src/next-action.js`).
- **Do NOT define test cases** — that is T3's scope (`tests/resolver.test.js`).
- **Do NOT write to `state.json`** — the resolver is read-only; state writes are the Tactical Planner's responsibility.
- **Do NOT track `triage_attempts`** — this is a runtime-local counter in the Orchestrator, not part of state.json.
- **Do NOT use raw string literals** for enum values — always use `NEXT_ACTIONS.SPAWN_RESEARCH`, never `'spawn_research'`.
- **Do NOT use `console.log()` or `console.error()`** — the resolver is a library module, not a CLI.
- **Do NOT modify `src/lib/constants.js`** or `src/lib/state-validator.js`.
