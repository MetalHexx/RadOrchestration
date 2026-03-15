---
project: "PIPELINE-SIMPLIFICATION"
phase: 2
task: 4
title: "RESOLVER"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# Resolver Module — State-to-Action Resolution

## Objective

Create `resolver.js` in `.github/orchestration/scripts/lib-v3/` — a pure state inspector that examines post-mutation state and config, then returns the single external action the Orchestrator should execute next. The module exports `resolveNextAction(state, config)` returning `{ action, context }` covering all ~18 external actions across planning, execution, gates, review, and terminal tiers, with zero internal actions.

## Context

The resolver is the final step in the pipeline engine recipe: after a mutation is applied and validated, the engine calls `resolveNextAction(proposedState, config)` to determine what the Orchestrator does next. The current v1 resolver (`lib/resolver.js`) returns 35 actions including 16 internal ones; the v3 resolver returns only ~18 external actions because mutations now handle pointer advances and tier transitions internally. Corrective handoffs are no longer a separate action — they return `create_task_handoff` with `context.is_correction: true`. All halt scenarios consolidate into a single `display_halted` action with descriptive `context.details`. The resolver imports only from `constants.js` (Phase 1 output) and has no dependency on `mutations.js`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/resolver.js` | Pure state inspector module (~200 lines) |
| CREATE | `.github/orchestration/scripts/tests-v3/resolver.test.js` | Per-action tests, per-tier describe blocks (~300 lines) |

## Implementation Steps

1. **Create `resolver.js`** with `'use strict'` and import the required constants:
   ```javascript
   const {
     PIPELINE_TIERS, PLANNING_STATUSES, PLANNING_STEP_STATUSES,
     PHASE_STATUSES, TASK_STATUSES, REVIEW_ACTIONS,
     PHASE_REVIEW_ACTIONS, HUMAN_GATE_MODES, NEXT_ACTIONS
   } = require('./constants');
   ```

2. **Implement the planning tier resolver** (`resolvePlanning(state)`): iterate over `state.planning.steps` in order — `research`, `prd`, `design`, `architecture`, `master_plan`. The first step with `status !== 'complete'` yields the corresponding spawn action. If all steps are complete and `planning.human_approved` is `false`, return `request_plan_approval`. Planning tier never returns a "transition" action — that is handled by mutations.

3. **Implement the execution tier resolver** (`resolveExecution(state, config)`): dispatch by current phase/task state. The function inspects `execution.current_phase` and routes to either phase-level or task-level resolution. Key routing logic:
   - Phase `not_started` → `create_phase_plan`
   - Phase `in_progress` + task needs handoff → `create_task_handoff` (with corrective enrichment if applicable)
   - Phase `in_progress` + task `in_progress` with handoff but no report → `execute_task`
   - Phase `in_progress` + task `complete` with no review → `spawn_code_reviewer`
   - Phase `in_progress` + all tasks processed (current_task >= total_tasks) + no phase report → `generate_phase_report`
   - Phase `in_progress` + phase report exists + no phase review → `spawn_phase_reviewer`
   - Phase `halted` → `display_halted`
   - Task `halted` → `display_halted`

4. **Implement corrective context enrichment**: when the current task has `status === 'failed'` and `review_action === 'corrective_task_issued'`, return `create_task_handoff` with:
   ```javascript
   {
     action: 'create_task_handoff',
     context: {
       is_correction: true,
       previous_review: task.review_doc,
       reason: task.review_verdict,
       phase_index: phaseIndex,
       task_index: taskIndex,
       phase_id: formatPhaseId(phaseIndex),
       task_id: formatTaskId(phaseIndex, taskIndex)
     }
   }
   ```

5. **Implement human gate resolution**: after task completion with `review_action === 'advanced'`, check `config.human_gates.execution_mode`:
   - `'task'` → return `gate_task`
   - After phase completion with `phase_review_action === 'advanced'`, check:
   - `'phase'` → return `gate_phase`
   - `'task'` → return `gate_phase` (task mode also gates phases)
   - `'ask'` or `'autonomous'` → skip gate, proceed to next step

6. **Implement the review tier resolver** (`resolveReview(state, config)`): inspect `state.execution` (which is in tier `review`):
   - No `final_review` doc → `spawn_final_reviewer`
   - Final review exists + not human-approved → `request_final_approval`

7. **Implement terminal resolution**: at the top of `resolveNextAction`, check tier first:
   - `tier === 'halted'` → `display_halted` with `context.details` describing what is halted
   - `tier === 'complete'` → `display_complete`

8. **Implement halt consolidation**: anywhere a halted state is detected (task halted, phase halted, tier halted), return `display_halted` with descriptive `context.details` explaining the specific halt reason. Never return separate halt action types.

9. **Wire the main entry point** `resolveNextAction(state, config)`: route by `state.execution.current_tier` → planning, execution, review, complete, halted. Export only `resolveNextAction`.

10. **Create `resolver.test.js`** with per-tier `describe` blocks, per-action test cases, corrective context assertions, and halt consolidation assertions. Use self-contained state factories. Use `node:test` and `node:assert/strict` only.

## Contracts & Interfaces

### ResolverResult — Return type of resolveNextAction

```javascript
/**
 * @typedef {Object} ResolverResult
 * @property {string} action - one of NEXT_ACTIONS (external only, ~18 values)
 * @property {Object} context - action-specific routing context
 */
```

### resolveNextAction — Exported function signature

```javascript
/**
 * Pure state inspector. Given post-mutation state and config, returns the
 * next external action the Orchestrator should execute.
 *
 * @param {StateJson} state - post-mutation, post-validation state
 * @param {Config} config - parsed orchestration config
 * @returns {ResolverResult}
 */
function resolveNextAction(state, config) { /* ... */ }
```

### NEXT_ACTIONS — The complete external action enum (from constants.js)

```javascript
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

### PIPELINE_TIERS — Tier enum (from constants.js)

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted',
});
```

### HUMAN_GATE_MODES — Gate mode enum (from constants.js)

```javascript
const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask',
  PHASE: 'phase',
  TASK: 'task',
  AUTONOMOUS: 'autonomous',
});
```

### TASK_STATUSES, PHASE_STATUSES — Status enums (from constants.js)

```javascript
const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted',
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  HALTED: 'halted',
});
```

### REVIEW_ACTIONS, PHASE_REVIEW_ACTIONS — Review outcome enums (from constants.js)

```javascript
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

### StateJson — v3 state schema (from constants.js)

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
```

### Config shape — relevant fields for resolver

```javascript
/**
 * @typedef {Object} Config
 * @property {Object} human_gates
 * @property {string} human_gates.execution_mode - one of HUMAN_GATE_MODES
 * @property {boolean} human_gates.after_final_review
 * @property {Object} limits
 * @property {number} limits.max_retries_per_task
 * @property {number} limits.max_phases
 * @property {number} limits.max_tasks_per_phase
 */
```

### Planning step order — fixed iteration order for planning resolution

```javascript
const PLANNING_STEP_ORDER = [
  { key: 'research',     action: NEXT_ACTIONS.SPAWN_RESEARCH },
  { key: 'prd',          action: NEXT_ACTIONS.SPAWN_PRD },
  { key: 'design',       action: NEXT_ACTIONS.SPAWN_DESIGN },
  { key: 'architecture', action: NEXT_ACTIONS.SPAWN_ARCHITECTURE },
  { key: 'master_plan',  action: NEXT_ACTIONS.SPAWN_MASTER_PLAN },
];
```

## Styles & Design Tokens

Not applicable — this is a CLI pipeline module with no UI.

## Test Requirements

### Planning tier tests
- [ ] Returns `spawn_research` when research step is not complete
- [ ] Returns `spawn_prd` when research is complete but prd is not
- [ ] Returns `spawn_design` when research+prd complete but design is not
- [ ] Returns `spawn_architecture` when research+prd+design complete but architecture is not
- [ ] Returns `spawn_master_plan` when all steps complete except master_plan
- [ ] Returns `request_plan_approval` when all steps complete and `human_approved` is false

### Execution tier — task-level tests
- [ ] Returns `create_phase_plan` when phase status is `not_started`
- [ ] Returns `create_task_handoff` when task has no handoff_doc and status is `not_started`
- [ ] Returns `create_task_handoff` with `is_correction: true` when task status is `failed` and `review_action` is `corrective_task_issued`
- [ ] Corrective context includes `previous_review` (task.review_doc) and `reason` (task.review_verdict)
- [ ] Returns `execute_task` when task has handoff_doc but no report_doc and status is `in_progress`
- [ ] Returns `spawn_code_reviewer` when task status is `complete` and no review_doc

### Execution tier — phase-level tests
- [ ] Returns `generate_phase_report` when all tasks processed (current_task >= total_tasks) and no phase_report_doc
- [ ] Returns `spawn_phase_reviewer` when phase_report_doc exists and no phase_review_doc

### Gate tests
- [ ] Returns `gate_task` when task review_action is `advanced` and gate mode is `task`
- [ ] Returns `gate_phase` when phase_review_action is `advanced` and gate mode is `phase`
- [ ] Skips gate when mode is `autonomous`
- [ ] Skips gate when mode is `ask`

### Review tier tests
- [ ] Returns `spawn_final_reviewer` when tier is `review` and no final review doc
- [ ] Returns `request_final_approval` when final review exists but not human-approved

### Terminal tests
- [ ] Returns `display_halted` when tier is `halted`
- [ ] Returns `display_halted` when task status is `halted` — includes descriptive `context.details`
- [ ] Returns `display_halted` when phase status is `halted` — includes descriptive `context.details`
- [ ] Returns `display_complete` when tier is `complete`

### Halt consolidation tests
- [ ] All halted states produce action `display_halted` (no separate halt action types)
- [ ] `context.details` is a non-empty string describing the halt reason

### Structural tests
- [ ] `resolveNextAction` is a function
- [ ] Module exports only `resolveNextAction`
- [ ] Return value always has `action` (string) and `context` (object) properties

## Acceptance Criteria

- [ ] `resolver.js` exports exactly one function: `resolveNextAction`
- [ ] `resolveNextAction(state, config)` returns `{ action, context }` where `action` is always a value from `NEXT_ACTIONS`
- [ ] The resolver returns only external actions (~18 from `NEXT_ACTIONS` enum); no internal actions exist (no `advance_task`, `advance_phase`, `transition_to_execution`, `transition_to_review`, `transition_to_complete`, `update_state_from_task`, `triage_task`, `triage_phase`, `halt_task_failed`, `create_corrective_handoff`, etc.)
- [ ] Planning tier: resolves all 6 planning actions in correct step order (research → prd → design → architecture → master_plan → request_plan_approval)
- [ ] Execution tier — task level: resolves `create_phase_plan`, `create_task_handoff`, `execute_task`, `spawn_code_reviewer` from appropriate task/phase states
- [ ] Execution tier — phase level: resolves `generate_phase_report`, `spawn_phase_reviewer` when all tasks in a phase are processed
- [ ] Corrective context enrichment: when task has `review_action === 'corrective_task_issued'`, returns `create_task_handoff` with `context.is_correction === true`, `context.previous_review` set to `task.review_doc`, and `context.reason` set to `task.review_verdict`
- [ ] Gate resolution: returns `gate_task` or `gate_phase` based on `config.human_gates.execution_mode`; skips gates for `autonomous` and `ask` modes
- [ ] Review tier: resolves `spawn_final_reviewer` and `request_final_approval` from final review state
- [ ] Halt consolidation: all halted states (task halted, phase halted, tier halted) return `display_halted` with non-empty `context.details`
- [ ] `display_complete` returned when tier is `complete`
- [ ] The resolver is a pure function — no side effects, no state mutation, no I/O
- [ ] All tests pass: `node --test tests-v3/resolver.test.js`
- [ ] No syntax errors — module is importable via `require('./lib-v3/resolver')`

## Constraints

- Do NOT import from `mutations.js` — the resolver depends only on `constants.js`
- Do NOT return any internal/removed actions: `advance_task`, `advance_phase`, `transition_to_execution`, `transition_to_review`, `transition_to_complete`, `update_state_from_task`, `update_state_from_review`, `update_state_from_phase_review`, `triage_task`, `triage_phase`, `halt_triage_invariant`, `halt_phase_triage_invariant`, `retry_from_review`, `halt_from_review`, `halt_task_failed`, `create_corrective_handoff`
- Do NOT mutate the `state` or `config` objects passed in — the resolver is read-only
- Do NOT add `fs`, `path`, or any Node.js I/O imports — the resolver is a pure function
- Do NOT create helper factories in the source file — factories belong in the test file only
- Do NOT import external test libraries — use `node:test` and `node:assert/strict` only
- Do NOT reference external planning documents in this handoff — all contracts are inlined above
- Keep test factories self-contained within `resolver.test.js` — no cross-file factory imports
