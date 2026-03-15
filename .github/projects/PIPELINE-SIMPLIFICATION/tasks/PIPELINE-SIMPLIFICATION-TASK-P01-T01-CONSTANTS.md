---
project: "PIPELINE-SIMPLIFICATION"
phase: 1
task: 1
title: "CONSTANTS"
status: "pending"
skills_required: ["execute_task"]
skills_optional: []
estimated_files: 2
---

# Constants & Type Definitions

## Objective

Create `.github/orchestration/scripts/lib-v3/constants.js` containing all frozen enum objects, JSDoc `@typedef` definitions for the v3 state schema, the `SCHEMA_VERSION` constant, and allowed status transition maps. Create `.github/orchestration/scripts/tests-v3/constants.test.js` verifying all enums are frozen, entry counts are correct, `TRIAGE_LEVELS` does not exist, and transition maps are complete.

## Context

This is the foundational module for the v3 pipeline engine rewrite. Every other module in `lib-v3/` imports from `constants.js`. The v3 schema removes the triage layer entirely — no `TRIAGE_LEVELS` enum, no `triage_attempts` fields in state types. `NEXT_ACTIONS` shrinks from 35 (18 external + 17 internal) to exactly 18 external-only actions. The allowed status transition maps (`ALLOWED_TASK_TRANSITIONS`, `ALLOWED_PHASE_TRANSITIONS`) are exported from this module so the validator can import them. The existing `lib/constants.js` serves as the starting reference — port enums with the specified reductions.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/constants.js` | ~170 lines. All enums, JSDoc types, transition maps, schema version |
| CREATE | `.github/orchestration/scripts/tests-v3/constants.test.js` | Unit tests for freeze, counts, completeness, absence of removed items |

## Implementation Steps

1. Create the `lib-v3/` directory if it does not exist and create `constants.js` with `'use strict';` at the top.

2. Add `SCHEMA_VERSION` as a frozen string constant:
   ```javascript
   const SCHEMA_VERSION = 'orchestration-state-v3';
   ```

3. Add all 11 frozen enum objects in this order, using `Object.freeze({...})` for each:
   - `PIPELINE_TIERS` (5 entries)
   - `PLANNING_STATUSES` (3 entries)
   - `PLANNING_STEP_STATUSES` (3 entries — reduced from 5; no `FAILED` or `SKIPPED`)
   - `PHASE_STATUSES` (4 entries — no `FAILED`)
   - `TASK_STATUSES` (5 entries)
   - `REVIEW_VERDICTS` (3 entries)
   - `REVIEW_ACTIONS` (3 entries — singular `corrective_task_issued`)
   - `PHASE_REVIEW_ACTIONS` (3 entries — plural `corrective_tasks_issued`)
   - `SEVERITY_LEVELS` (2 entries)
   - `HUMAN_GATE_MODES` (4 entries)
   - `NEXT_ACTIONS` (18 entries — external-only; see exact entries in Contracts section)

4. Add `ALLOWED_TASK_TRANSITIONS` and `ALLOWED_PHASE_TRANSITIONS` as frozen objects (see exact definitions in Contracts section).

5. Add all JSDoc `@typedef` blocks for the v3 state schema (see exact definitions in Contracts section). Ensure **no** `triage_attempts` fields appear anywhere.

6. Add `module.exports` exporting all constants:
   `SCHEMA_VERSION`, all 11 enums, `ALLOWED_TASK_TRANSITIONS`, `ALLOWED_PHASE_TRANSITIONS`.

7. Create the `tests-v3/` directory if it does not exist and create `constants.test.js` using `node:test` and `node:assert/strict`.

8. Write tests verifying:
   - Every exported enum is frozen (`Object.isFrozen`)
   - `SCHEMA_VERSION === 'orchestration-state-v3'`
   - `NEXT_ACTIONS` has exactly 18 entries (`Object.keys(...).length === 18`)
   - `TRIAGE_LEVELS` is NOT exported (verify `exports.TRIAGE_LEVELS === undefined`)
   - `PLANNING_STEP_STATUSES` has exactly 3 entries (no `FAILED`, `SKIPPED`)
   - `PHASE_STATUSES` has exactly 4 entries (no `FAILED`)
   - `ALLOWED_TASK_TRANSITIONS` covers all `TASK_STATUSES` values as keys
   - `ALLOWED_PHASE_TRANSITIONS` covers all `PHASE_STATUSES` values as keys
   - No exported typedef or enum contains `triage_attempts` (grep the source string)

9. Run tests: `node --test .github/orchestration/scripts/tests-v3/constants.test.js`

10. Verify the module is importable: `node -e "require('./.github/orchestration/scripts/lib-v3/constants.js')"`

## Contracts & Interfaces

### SCHEMA_VERSION

```javascript
const SCHEMA_VERSION = 'orchestration-state-v3';
```

### Frozen Enums

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

const SEVERITY_LEVELS = Object.freeze({
  CRITICAL: 'critical',
  MINOR: 'minor',
});

const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask',
  PHASE: 'phase',
  TASK: 'task',
  AUTONOMOUS: 'autonomous',
});

const NEXT_ACTIONS = Object.freeze({
  // Planning (6)
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  // Execution — Task (4)
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  // Execution — Phase (2)
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  // Gates (2)
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  // Review (2)
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  // Terminal (2)
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
});
```

### Allowed Status Transition Maps

```javascript
const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    [],
  'halted':      [],
});

const ALLOWED_PHASE_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'halted'],
  'complete':    [],
  'halted':      [],
});
```

### JSDoc Type Definitions

All of the following `@typedef` blocks must appear in `constants.js`:

```javascript
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS values when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error info on failure
 * @property {string[]} mutations_applied - human-readable mutation descriptions; empty on failure
 */

/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => StateJson | null} readState
 * @property {(projectDir: string, state: StateJson) => void} writeState
 * @property {(configPath?: string) => Config} readConfig
 * @property {(docPath: string) => ParsedDocument | null} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */

/**
 * @typedef {Object} ParsedDocument
 * @property {Object | null} frontmatter
 * @property {string} body
 */

/**
 * @typedef {Object} StateJson
 * @property {'orchestration-state-v3'} $schema
 * @property {ProjectMeta} project
 * @property {Planning} planning
 * @property {Execution} execution
 */

/**
 * @typedef {Object} ProjectMeta
 * @property {string} name
 * @property {string} created
 * @property {string} updated
 */

/**
 * @typedef {Object} Planning
 * @property {string} status - one of PLANNING_STATUSES
 * @property {boolean} human_approved
 * @property {PlanningStep[]} steps
 * @property {string} current_step
 */

/**
 * @typedef {Object} PlanningStep
 * @property {string} name
 * @property {string} status - one of PLANNING_STEP_STATUSES
 * @property {string | null} doc_path
 */

/**
 * @typedef {Object} Execution
 * @property {string} status - one of PHASE_STATUSES or 'not_started' | 'complete'
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

/**
 * @typedef {Object} Config
 * @property {Object} limits
 * @property {number} limits.max_phases
 * @property {number} limits.max_tasks_per_phase
 * @property {number} limits.max_retries_per_task
 * @property {Object} human_gates
 * @property {string} human_gates.execution_mode - one of HUMAN_GATE_MODES
 * @property {boolean} human_gates.after_final_review
 */
```

### module.exports

```javascript
module.exports = {
  SCHEMA_VERSION,
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
  NEXT_ACTIONS,
  ALLOWED_TASK_TRANSITIONS,
  ALLOWED_PHASE_TRANSITIONS,
};
```

## Styles & Design Tokens

Not applicable — this is a non-UI module.

## Test Requirements

- [ ] Every exported frozen object passes `Object.isFrozen()` check
- [ ] `SCHEMA_VERSION` strictly equals `'orchestration-state-v3'`
- [ ] `Object.keys(NEXT_ACTIONS).length` strictly equals `18`
- [ ] The imported module does NOT export `TRIAGE_LEVELS` (`require(...)['TRIAGE_LEVELS'] === undefined`)
- [ ] `PLANNING_STEP_STATUSES` has exactly 3 keys; does NOT contain `FAILED` or `SKIPPED`
- [ ] `PHASE_STATUSES` has exactly 4 keys; does NOT contain `FAILED`
- [ ] `ALLOWED_TASK_TRANSITIONS` has a key for every value in `TASK_STATUSES`
- [ ] `ALLOWED_PHASE_TRANSITIONS` has a key for every value in `PHASE_STATUSES`
- [ ] `ALLOWED_TASK_TRANSITIONS` values are arrays of valid `TASK_STATUSES` values
- [ ] `ALLOWED_PHASE_TRANSITIONS` values are arrays of valid `PHASE_STATUSES` values
- [ ] Reading the source file as a string confirms zero occurrences of `triage_attempts`
- [ ] `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED` equals `'corrective_task_issued'` (singular)
- [ ] `PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED` equals `'corrective_tasks_issued'` (plural)
- [ ] `NEXT_ACTIONS` does NOT contain any of the 16 removed internal actions (`ADVANCE_TASK`, `ADVANCE_PHASE`, `TRANSITION_TO_EXECUTION`, `TRANSITION_TO_REVIEW`, `TRANSITION_TO_COMPLETE`, `UPDATE_STATE_FROM_TASK`, `UPDATE_STATE_FROM_REVIEW`, `UPDATE_STATE_FROM_PHASE_REVIEW`, `TRIAGE_TASK`, `TRIAGE_PHASE`, `HALT_TRIAGE_INVARIANT`, `HALT_PHASE_TRIAGE_INVARIANT`, `RETRY_FROM_REVIEW`, `HALT_FROM_REVIEW`, `HALT_TASK_FAILED`, `CREATE_CORRECTIVE_HANDOFF`)
- [ ] All tests pass via `node --test tests-v3/constants.test.js`

## Acceptance Criteria

- [ ] `constants.js` is created at `.github/orchestration/scripts/lib-v3/constants.js`
- [ ] All enum objects are `Object.freeze`'d (11 enums + 2 transition maps)
- [ ] `NEXT_ACTIONS` has exactly 18 entries (6 planning + 4 execution-task + 2 execution-phase + 2 gates + 2 review + 2 terminal)
- [ ] No `TRIAGE_LEVELS` export exists
- [ ] `SCHEMA_VERSION` equals `'orchestration-state-v3'`
- [ ] JSDoc `@typedef` blocks define the complete v3 schema: `StateJson`, `ProjectMeta`, `Planning`, `PlanningStep`, `Execution`, `Phase`, `Task`, `PipelineResult`, `PipelineIO`, `ParsedDocument`, `Config`
- [ ] No `triage_attempts` field appears anywhere in the file
- [ ] `ALLOWED_TASK_TRANSITIONS` and `ALLOWED_PHASE_TRANSITIONS` are exported
- [ ] Transition map keys cover all values in their respective status enums
- [ ] `constants.test.js` is created at `.github/orchestration/scripts/tests-v3/constants.test.js`
- [ ] All tests pass via `node --test tests-v3/constants.test.js`
- [ ] Module is importable without errors: `node -e "require('./.github/orchestration/scripts/lib-v3/constants.js')"`
- [ ] No lint errors or syntax errors

## Constraints

- Do NOT create a `TRIAGE_LEVELS` enum or any triage-related constants
- Do NOT include any of the 16 removed internal actions in `NEXT_ACTIONS`
- Do NOT add `triage_attempts` to any JSDoc typedef
- Do NOT import from or depend on any other `lib-v3/` module — `constants.js` is the leaf dependency
- Do NOT use any external dependencies — only Node.js built-ins (`node:test`, `node:assert/strict`, `node:fs`, `node:path`)
- Do NOT modify any files in `lib/` or `tests/` — those are the current production modules
- Do NOT add `FAILED` to `PLANNING_STEP_STATUSES` or `SKIPPED` — v3 reduces this to 3 entries
- Do NOT add `FAILED` to `PHASE_STATUSES` — v3 reduces this to 4 entries (use `HALTED` instead)
- Keep `REVIEW_ACTIONS` singular (`corrective_task_issued`) and `PHASE_REVIEW_ACTIONS` plural (`corrective_tasks_issued`) — this is intentional
