---
project: "STATE-TRANSITION-SCRIPTS"
phase: 1
task: 2
title: "Constants Test Suite"
status: "pending"
skills_required: ["coding"]
skills_optional: []
estimated_files: 2
---

# Constants Test Suite

## Objective

Verify and enhance the existing `tests/constants.test.js` test suite (29 tests, all passing) for complete coverage of all 12 frozen enum objects in `src/lib/constants.js`. Fix the minor JSDoc typedef issue identified in the T1 code review: the `Phase` typedef's `phase_review_verdict` property uses an incorrect union member (`corrective_tasks_issued` instead of `changes_requested`).

## Context

The constants module and its test suite were created in Task 1. All 29 tests pass and the T1 code review verdict was **approved** with one minor documentation issue: the JSDoc `Phase` typedef declares `phase_review_verdict` as `'approved'|'corrective_tasks_issued'|'rejected'|null` — it should be `'approved'|'changes_requested'|'rejected'|null` per the Architecture contract. The value `corrective_tasks_issued` is a `PHASE_REVIEW_ACTIONS` member, not a `REVIEW_VERDICTS` member. This must be fixed before downstream modules (`resolver.js`) reference the typedef. The test suite uses a manual test harness with `passed`/`failed` counters and `process.exit(1)` on failure.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `src/lib/constants.js` | Fix JSDoc `Phase` typedef — change `phase_review_verdict` union member |
| MODIFY | `tests/constants.test.js` | Verify all 29 tests still pass; add tests if any coverage gaps found |

## Implementation Steps

1. Open `src/lib/constants.js` and locate the `Phase` JSDoc `@typedef` block (near line 60).
2. Change the `phase_review_verdict` property line from:
   ```
   @property {'approved'|'corrective_tasks_issued'|'rejected'|null} phase_review_verdict
   ```
   to:
   ```
   @property {'approved'|'changes_requested'|'rejected'|null} phase_review_verdict
   ```
3. Verify the fix: `node -c src/lib/constants.js` passes (no syntax errors).
4. Run the existing test suite: `node tests/constants.test.js` — confirm all 29 tests still pass.
5. Review the existing tests against the Test Requirements checklist below. Confirm each requirement has a corresponding test.
6. If any gap is found, add the missing test(s) to `tests/constants.test.js` using the same manual `test(name, fn)` harness pattern already in the file.
7. Re-run: `node tests/constants.test.js` — confirm all tests pass with exit code `0`.

## Contracts & Interfaces

The constants module exports 12 frozen enums via `module.exports`. Tests must validate against these exact shapes:

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

// SINGULAR — task-level
const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted'
});

// PLURAL — phase-level (intentionally different from task-level)
const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced', CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued', HALTED: 'halted'
});

const SEVERITY_LEVELS = Object.freeze({
  MINOR: 'minor', CRITICAL: 'critical'
});

const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask', PHASE: 'phase', TASK: 'task', AUTONOMOUS: 'autonomous'
});

const TRIAGE_LEVELS = Object.freeze({
  TASK: 'task', PHASE: 'phase'
});

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

### JSDoc `Phase` typedef — corrected `phase_review_verdict` line

The `Phase` typedef must declare `phase_review_verdict` with this exact union:

```javascript
 * @property {'approved'|'changes_requested'|'rejected'|null} phase_review_verdict
```

**Not** `'approved'|'corrective_tasks_issued'|'rejected'|null` — that was the bug. `corrective_tasks_issued` is a `PHASE_REVIEW_ACTIONS` member, not a `REVIEW_VERDICTS` member.

## Styles & Design Tokens

Not applicable — backend test module, no UI.

## Test Requirements

The existing 29-test suite should already cover these. Verify each is present and passing:

- [ ] All 12 enums are exported and not `undefined`
- [ ] No extra exports beyond the 12 enums
- [ ] All 12 enums pass `Object.isFrozen()` check
- [ ] `PIPELINE_TIERS` has exact keys and values (5 members)
- [ ] `PLANNING_STATUSES` has exact keys and values (3 members)
- [ ] `PLANNING_STEP_STATUSES` has exact keys and values (5 members)
- [ ] `PHASE_STATUSES` has exact keys and values (5 members)
- [ ] `TASK_STATUSES` has exact keys and values (5 members)
- [ ] `REVIEW_VERDICTS` has exact keys and values (3 members)
- [ ] `REVIEW_ACTIONS` has exact keys/values with **singular** `corrective_task_issued`
- [ ] `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED` individual value check
- [ ] `PHASE_REVIEW_ACTIONS` has exact keys/values with **plural** `corrective_tasks_issued`
- [ ] `PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED` individual value check
- [ ] No accidental corrective value overlap between `REVIEW_ACTIONS` and `PHASE_REVIEW_ACTIONS`
- [ ] No unintended value overlap between full value sets of `REVIEW_ACTIONS` and `PHASE_REVIEW_ACTIONS`
- [ ] `SEVERITY_LEVELS` has exact keys and values (2 members)
- [ ] `HUMAN_GATE_MODES` has exact keys and values (4 members)
- [ ] `TRIAGE_LEVELS` has exact keys and values (2 members)
- [ ] `NEXT_ACTIONS` has exactly 35 entries
- [ ] `NEXT_ACTIONS` contains all 35 expected values
- [ ] All enum keys match `SCREAMING_SNAKE_CASE` pattern (`/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/`)
- [ ] All enum values match lowercase `snake_case` pattern (`/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/`)
- [ ] Source file has zero `require()` statements (leaf module)
- [ ] Source file starts with `'use strict'`
- [ ] Source file contains JSDoc `@typedef` for `StateJson`
- [ ] Source file contains JSDoc `@typedef` for `PlanningStep`
- [ ] Source file contains JSDoc `@typedef` for `Phase`
- [ ] Source file contains JSDoc `@typedef` for `Task`
- [ ] Source file has 12 `@type {Readonly<...>}` annotations

## Acceptance Criteria

- [ ] `node tests/constants.test.js` exits with code `0`
- [ ] All enums validated for exact keys, exact values, and freeze status
- [ ] `REVIEW_ACTIONS` singular vs. `PHASE_REVIEW_ACTIONS` plural distinction tested
- [ ] `NEXT_ACTIONS` validated to contain all 35 values
- [ ] JSDoc `Phase` typedef `phase_review_verdict` line reads `'approved'|'changes_requested'|'rejected'|null` (not `corrective_tasks_issued`)
- [ ] Source-file structural tests pass (zero `require()`, `'use strict'`, JSDoc typedefs, `@type Readonly` annotations)
- [ ] No existing tests broken by the typedef fix
- [ ] `node -c src/lib/constants.js` succeeds (no syntax errors)
- [ ] No lint errors
- [ ] Build passes

## Constraints

- Do NOT recreate `tests/constants.test.js` from scratch — verify and enhance the existing 29-test suite
- Do NOT change any enum values or keys in `src/lib/constants.js` — only fix the JSDoc typedef
- Do NOT add external dependencies — use only Node.js built-ins (`assert`, `fs`, `path`)
- Do NOT change the test harness pattern — the existing manual `test()` function with `passed`/`failed` counters is acceptable
- Do NOT reference any external documents — all required contracts are inlined above
- `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED` (singular) and `PHASE_REVIEW_ACTIONS.CORRECTIVE_TASKS_ISSUED` (plural) are intentionally different — do NOT normalize them
