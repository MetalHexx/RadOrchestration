---
project: "STATE-TRANSITION-SCRIPTS"
phase: 1
task: 1
title: "Shared Constants Module"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 1
---

# Shared Constants Module

## Objective

Create `src/lib/constants.js` — the shared constants module exporting all 12 frozen enum objects that every other script and test in the project imports. This is the leaf dependency with zero imports.

## Context

This module is the foundation of a set of deterministic CLI scripts being added to the orchestration system. All domain logic modules (`resolver.js`, `triage-engine.js`, `state-validator.js`) and all CLI entry points import enums from this single file. The module must use `Object.freeze()` on every enum to prevent mutation. Keys use `SCREAMING_SNAKE_CASE`; values use lowercase `snake_case` strings. The module follows the existing codebase patterns: `'use strict'`, CommonJS (`require`/`module.exports`), JSDoc annotations, and zero external dependencies.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `src/lib/constants.js` | Shared constants module — 12 frozen enum objects + JSDoc typedefs |

## Implementation Steps

1. Create the file `src/lib/constants.js` with `'use strict'` at the top.
2. Add the `StateJson` JSDoc `@typedef` block (see Contracts & Interfaces below) as a documentation header — this formalizes the shape that scripts consume from `state.json`.
3. Define each of the 12 enum objects using `const NAME = Object.freeze({ ... })` with the exact keys and values specified in the Contracts & Interfaces section.
4. Add a JSDoc `@type` annotation above each enum with the exact `Readonly<{...}>` type (see Contracts & Interfaces).
5. Export all 12 enums via a single `module.exports = { ... }` block at the bottom of the file.
6. Verify: the file has zero `require()` statements — it is a leaf module with no imports.
7. Verify: every enum key is `SCREAMING_SNAKE_CASE` and every enum value is a lowercase `snake_case` string.
8. Verify: `REVIEW_ACTIONS` uses singular `corrective_task_issued` and `PHASE_REVIEW_ACTIONS` uses plural `corrective_tasks_issued` — this distinction is intentional and must NOT be normalized.

## Contracts & Interfaces

All type annotations use JSDoc `@typedef` syntax (this is a CommonJS JavaScript project, not TypeScript).

### StateJson Shape (documentation typedef)

```javascript
/**
 * @typedef {Object} StateJson
 * @property {Object} project
 * @property {string} project.name
 * @property {string} project.created - ISO 8601 timestamp
 * @property {string} project.updated - ISO 8601 timestamp
 * @property {Object} pipeline
 * @property {'planning'|'execution'|'review'|'complete'|'halted'} pipeline.current_tier
 * @property {'ask'|'phase'|'task'|'autonomous'} pipeline.human_gate_mode
 * @property {Object} planning
 * @property {'not_started'|'in_progress'|'complete'} planning.status
 * @property {Object} planning.steps
 * @property {PlanningStep} planning.steps.research
 * @property {PlanningStep} planning.steps.prd
 * @property {PlanningStep} planning.steps.design
 * @property {PlanningStep} planning.steps.architecture
 * @property {PlanningStep} planning.steps.master_plan
 * @property {boolean} planning.human_approved
 * @property {Object} execution
 * @property {'not_started'|'in_progress'|'complete'|'halted'} execution.status
 * @property {number} execution.current_phase - 0-based index into phases[]
 * @property {number} execution.total_phases
 * @property {Phase[]} execution.phases
 * @property {Object} final_review
 * @property {'not_started'|'in_progress'|'complete'|'failed'} final_review.status
 * @property {string|null} final_review.report_doc
 * @property {boolean} final_review.human_approved
 * @property {Object} errors
 * @property {number} errors.total_retries
 * @property {number} errors.total_halts
 * @property {string[]} errors.active_blockers
 * @property {Object} limits
 * @property {number} limits.max_phases
 * @property {number} limits.max_tasks_per_phase
 * @property {number} limits.max_retries_per_task
 */

/**
 * @typedef {Object} PlanningStep
 * @property {'not_started'|'in_progress'|'complete'|'failed'|'skipped'} status
 * @property {string|null} output - Relative path to output document
 */

/**
 * @typedef {Object} Phase
 * @property {number} phase_number - 1-based
 * @property {string} title
 * @property {'not_started'|'in_progress'|'complete'|'failed'|'halted'} status
 * @property {string|null} phase_doc
 * @property {number} current_task - 0-based index into tasks[]
 * @property {number} total_tasks
 * @property {Task[]} tasks
 * @property {string|null} phase_report
 * @property {boolean} human_approved
 * @property {string|null} phase_review
 * @property {'approved'|'changes_requested'|'rejected'|null} phase_review_verdict
 * @property {'advanced'|'corrective_tasks_issued'|'halted'|null} phase_review_action
 */

/**
 * @typedef {Object} Task
 * @property {number} task_number - 1-based
 * @property {string} title
 * @property {'not_started'|'in_progress'|'complete'|'failed'|'halted'} status
 * @property {string|null} handoff_doc
 * @property {string|null} report_doc
 * @property {number} retries
 * @property {string|null} last_error
 * @property {'minor'|'critical'|null} severity
 * @property {string|null} review_doc
 * @property {'approved'|'changes_requested'|'rejected'|null} review_verdict
 * @property {'advanced'|'corrective_task_issued'|'halted'|null} review_action
 */
```

### Enum 1: PIPELINE_TIERS

```javascript
/**
 * @type {Readonly<{PLANNING: 'planning', EXECUTION: 'execution', REVIEW: 'review', COMPLETE: 'complete', HALTED: 'halted'}>}
 */
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted'
});
```

### Enum 2: PLANNING_STATUSES

```javascript
/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete'}>}
 */
const PLANNING_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete'
});
```

### Enum 3: PLANNING_STEP_STATUSES

```javascript
/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', SKIPPED: 'skipped'}>}
 */
const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  SKIPPED: 'skipped'
});
```

### Enum 4: PHASE_STATUSES

```javascript
/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'}>}
 */
const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted'
});
```

### Enum 5: TASK_STATUSES

```javascript
/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'}>}
 */
const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted'
});
```

### Enum 6: REVIEW_VERDICTS

```javascript
/**
 * @type {Readonly<{APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REJECTED: 'rejected'}>}
 */
const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
});
```

### Enum 7: REVIEW_ACTIONS

```javascript
/**
 * Task-level review actions. Note: uses SINGULAR "corrective_task_issued".
 * @type {Readonly<{ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted'}>}
 */
const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted'
});
```

### Enum 8: PHASE_REVIEW_ACTIONS

```javascript
/**
 * Phase-level review actions. Note: uses PLURAL "corrective_tasks_issued" —
 * intentionally different from task-level REVIEW_ACTIONS.
 * @type {Readonly<{ADVANCED: 'advanced', CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued', HALTED: 'halted'}>}
 */
const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted'
});
```

### Enum 9: SEVERITY_LEVELS

```javascript
/**
 * @type {Readonly<{MINOR: 'minor', CRITICAL: 'critical'}>}
 */
const SEVERITY_LEVELS = Object.freeze({
  MINOR: 'minor',
  CRITICAL: 'critical'
});
```

### Enum 10: HUMAN_GATE_MODES

```javascript
/**
 * @type {Readonly<{ASK: 'ask', PHASE: 'phase', TASK: 'task', AUTONOMOUS: 'autonomous'}>}
 */
const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask',
  PHASE: 'phase',
  TASK: 'task',
  AUTONOMOUS: 'autonomous'
});
```

### Enum 11: TRIAGE_LEVELS

```javascript
/**
 * @type {Readonly<{TASK: 'task', PHASE: 'phase'}>}
 */
const TRIAGE_LEVELS = Object.freeze({
  TASK: 'task',
  PHASE: 'phase'
});
```

### Enum 12: NEXT_ACTIONS

```javascript
/**
 * Complete closed enum of next-action values (35 values).
 * @type {Readonly<{
 *   INIT_PROJECT: 'init_project',
 *   DISPLAY_HALTED: 'display_halted',
 *   SPAWN_RESEARCH: 'spawn_research',
 *   SPAWN_PRD: 'spawn_prd',
 *   SPAWN_DESIGN: 'spawn_design',
 *   SPAWN_ARCHITECTURE: 'spawn_architecture',
 *   SPAWN_MASTER_PLAN: 'spawn_master_plan',
 *   REQUEST_PLAN_APPROVAL: 'request_plan_approval',
 *   TRANSITION_TO_EXECUTION: 'transition_to_execution',
 *   CREATE_PHASE_PLAN: 'create_phase_plan',
 *   CREATE_TASK_HANDOFF: 'create_task_handoff',
 *   EXECUTE_TASK: 'execute_task',
 *   UPDATE_STATE_FROM_TASK: 'update_state_from_task',
 *   CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
 *   HALT_TASK_FAILED: 'halt_task_failed',
 *   SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
 *   UPDATE_STATE_FROM_REVIEW: 'update_state_from_review',
 *   TRIAGE_TASK: 'triage_task',
 *   HALT_TRIAGE_INVARIANT: 'halt_triage_invariant',
 *   RETRY_FROM_REVIEW: 'retry_from_review',
 *   HALT_FROM_REVIEW: 'halt_from_review',
 *   ADVANCE_TASK: 'advance_task',
 *   GATE_TASK: 'gate_task',
 *   GENERATE_PHASE_REPORT: 'generate_phase_report',
 *   SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
 *   UPDATE_STATE_FROM_PHASE_REVIEW: 'update_state_from_phase_review',
 *   TRIAGE_PHASE: 'triage_phase',
 *   HALT_PHASE_TRIAGE_INVARIANT: 'halt_phase_triage_invariant',
 *   GATE_PHASE: 'gate_phase',
 *   ADVANCE_PHASE: 'advance_phase',
 *   TRANSITION_TO_REVIEW: 'transition_to_review',
 *   SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
 *   REQUEST_FINAL_APPROVAL: 'request_final_approval',
 *   TRANSITION_TO_COMPLETE: 'transition_to_complete',
 *   DISPLAY_COMPLETE: 'display_complete'
 * }>}
 */
const NEXT_ACTIONS = Object.freeze({
  INIT_PROJECT: 'init_project',
  DISPLAY_HALTED: 'display_halted',
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  TRANSITION_TO_EXECUTION: 'transition_to_execution',
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  UPDATE_STATE_FROM_TASK: 'update_state_from_task',
  CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
  HALT_TASK_FAILED: 'halt_task_failed',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  UPDATE_STATE_FROM_REVIEW: 'update_state_from_review',
  TRIAGE_TASK: 'triage_task',
  HALT_TRIAGE_INVARIANT: 'halt_triage_invariant',
  RETRY_FROM_REVIEW: 'retry_from_review',
  HALT_FROM_REVIEW: 'halt_from_review',
  ADVANCE_TASK: 'advance_task',
  GATE_TASK: 'gate_task',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  UPDATE_STATE_FROM_PHASE_REVIEW: 'update_state_from_phase_review',
  TRIAGE_PHASE: 'triage_phase',
  HALT_PHASE_TRIAGE_INVARIANT: 'halt_phase_triage_invariant',
  GATE_PHASE: 'gate_phase',
  ADVANCE_PHASE: 'advance_phase',
  TRANSITION_TO_REVIEW: 'transition_to_review',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  TRANSITION_TO_COMPLETE: 'transition_to_complete',
  DISPLAY_COMPLETE: 'display_complete'
});
```

### Module Exports

```javascript
module.exports = {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  PHASE_STATUSES,
  TASK_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS,
  HUMAN_GATE_MODES,
  TRIAGE_LEVELS,
  NEXT_ACTIONS
};
```

## Styles & Design Tokens

Not applicable — this is a backend constants module with no UI components.

## Test Requirements

- [ ] All 12 enums are exported and not `undefined`
- [ ] Each enum has the exact keys and values as specified in the Contracts & Interfaces section above
- [ ] Each enum is frozen (`Object.isFrozen()` returns `true`)
- [ ] `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED` equals `'corrective_task_issued'` (singular)
- [ ] `PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED` equals `'corrective_tasks_issued'` (plural)
- [ ] `NEXT_ACTIONS` contains exactly 35 key-value pairs
- [ ] No accidental value overlap between `REVIEW_ACTIONS` values and `PHASE_REVIEW_ACTIONS` values (the `corrective_task_issued` vs. `corrective_tasks_issued` distinction must produce different strings)
- [ ] Zero `require()` statements in the file — leaf module
- [ ] `'use strict'` is the first statement

## Acceptance Criteria

- [ ] File `src/lib/constants.js` exists
- [ ] All 12 enums exported via `module.exports`: `PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `PHASE_STATUSES`, `TASK_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`, `TRIAGE_LEVELS`, `NEXT_ACTIONS`
- [ ] Every enum is `Object.freeze()`-d — `Object.isFrozen(enumObj)` returns `true` for all 12
- [ ] All enum keys are `SCREAMING_SNAKE_CASE`
- [ ] All enum values are lowercase `snake_case` strings
- [ ] `REVIEW_ACTIONS` uses singular `corrective_task_issued`; `PHASE_REVIEW_ACTIONS` uses plural `corrective_tasks_issued`
- [ ] `NEXT_ACTIONS` has exactly 35 entries matching the values in the Contracts & Interfaces section
- [ ] `'use strict'` is the first statement in the file
- [ ] Zero `require()` calls — the module has no imports
- [ ] JSDoc `@typedef` blocks for `StateJson`, `PlanningStep`, `Phase`, and `Task` are present
- [ ] JSDoc `@type` annotation with `Readonly<{...}>` is present above each enum
- [ ] `node -e "require('./src/lib/constants.js')"` executes without error
- [ ] No lint errors, no syntax errors

## Constraints

- Do NOT add any `require()` statements — this is a leaf module with zero dependencies
- Do NOT use ESM syntax (`import`/`export`) — use CommonJS (`module.exports`)
- Do NOT add any runtime logic, functions, or computed values — only static frozen object literals
- Do NOT normalize `corrective_task_issued` / `corrective_tasks_issued` — they are intentionally different
- Do NOT add enums beyond the 12 specified — no extras, no omissions
- Do NOT use `Object.defineProperty` or proxies — use `Object.freeze()` only
- Do NOT add `bin/` shebang — this is a library module, not a CLI entry point
