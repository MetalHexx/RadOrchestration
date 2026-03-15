---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
task: 2
title: "Mutations Module — All 18 Handlers + Helpers"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Mutations Module — All 18 Handlers + Helpers

## Objective

Create `mutations.js` — the event-to-mutation lookup table containing one named pure function per event type (18 handlers), plus triage mutation helpers (`applyTaskTriage`, `applyPhaseTriage`) and API functions (`getMutation`, `needsTriage`). Every function is pure: `(state, context) → MutationResult` with zero I/O.

## Context

The unified pipeline script processes events by looking up a mutation handler, applying it to a deep-cloned state, then validating and writing the result. This module IS that lookup table. It imports only from the preserved `constants.js` module for enum values. The pipeline engine (Task T04) will call these functions — this module has no knowledge of the pipeline engine, state I/O, or the resolver. Each handler receives a pre-cloned state and returns the mutated state plus a human-readable list of changes. The `triage_attempts` field at `state.execution.triage_attempts` is a new persisted field (integer, default 0) that this module manages via the triage helpers.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib/mutations.js` | ~300–400 lines. 18 handlers + helpers. CommonJS, `'use strict'`. |

## Implementation Steps

1. **Create** `.github/orchestration/scripts/lib/mutations.js` with `'use strict'` at top.
2. **Import constants** — see exact imports in the Contracts section below.
3. **Implement all 18 handler functions** — each ≤15 lines, pure, named `handle<EventName>`. See the Handler Specifications section for exact state changes per handler.
4. **Implement `getMutation(event)`** — returns `MUTATIONS[event]` or `undefined`.
5. **Implement `needsTriage(event, state)`** — returns `{ shouldTriage, level }` based on the 3-event trigger table.
6. **Implement `applyTaskTriage(state, triageResult)`** — writes task-level triage verdict/action, manages `triage_attempts` and task status. See Triage Helpers section for exact behavior.
7. **Implement `applyPhaseTriage(state, triageResult)`** — writes phase-level triage verdict/action, manages `triage_attempts`. See Triage Helpers section for exact behavior.
8. **Build the `MUTATIONS` record** — the lookup table mapping all 18 event names to their handler functions.
9. **Export** `{ MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage }`.
10. **Verify** the module loads without errors: `node -e "require('./.github/orchestration/scripts/lib/mutations')"`.

## Contracts & Interfaces

### Imports from `constants.js`

```javascript
// .github/orchestration/scripts/lib/mutations.js
'use strict';

const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS
} = require('./constants');
```

### MutationResult Type

Every handler and every triage helper returns this shape:

```javascript
/**
 * @typedef {Object} MutationResult
 * @property {Object} state - The mutated state object (same reference passed in, modified in place)
 * @property {string[]} mutations_applied - Human-readable list of mutations applied
 */
```

Example return: `{ state, mutations_applied: ['planning.steps.research.status → complete', 'planning.steps.research.output → path/to/doc.md'] }`

### MUTATIONS Record

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

Note: `start` is NOT in MUTATIONS — it is handled specially by the pipeline engine (init path or cold-start path).

### Module Exports

```javascript
module.exports = { MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage };
```

### API Function Contracts

#### `getMutation(event)`

```javascript
/**
 * Look up the mutation handler for an event name.
 * @param {string} event - Event name
 * @returns {((state: Object, context: Object) => MutationResult)|undefined}
 */
function getMutation(event) {
  return MUTATIONS[event];
}
```

#### `needsTriage(event, state)`

```javascript
/**
 * Determine whether triage should run after this event.
 * @param {string} event - Event name
 * @param {Object} state - Current state (unused currently, reserved for future logic)
 * @returns {{ shouldTriage: boolean, level: 'task'|'phase'|null }}
 */
function needsTriage(event, state) {
  if (event === 'task_completed')          return { shouldTriage: true, level: 'task' };
  if (event === 'code_review_completed')   return { shouldTriage: true, level: 'task' };
  if (event === 'phase_review_completed')  return { shouldTriage: true, level: 'phase' };
  return { shouldTriage: false, level: null };
}
```

Three events trigger triage. All other 15 events (and `start`) do not.

## Handler Specifications

Each handler receives `(state, context)` where `state` is a deep clone of current `state.json` and `context` is the event-specific payload. Each returns `{ state, mutations_applied }`.

### Helpers

Create a small helper used by all planning-step handlers to avoid repetition:

```javascript
/**
 * Generic planning step completion handler.
 * @param {Object} state
 * @param {string} stepKey - One of: 'research', 'prd', 'design', 'architecture', 'master_plan'
 * @param {string} docPath - Path to the output document
 * @returns {MutationResult}
 */
function completePlanningStep(state, stepKey, docPath) {
  state.planning.steps[stepKey].status = PLANNING_STEP_STATUSES.COMPLETE;
  state.planning.steps[stepKey].output = docPath;
  return {
    state,
    mutations_applied: [
      `planning.steps.${stepKey}.status → complete`,
      `planning.steps.${stepKey}.output → ${docPath}`
    ]
  };
}
```

Also create a helper for getting the current phase and task:

```javascript
/**
 * Get the current phase object from state.
 * @param {Object} state
 * @returns {Object} Current phase
 */
function currentPhase(state) {
  return state.execution.phases[state.execution.current_phase];
}

/**
 * Get the current task object from the current phase.
 * @param {Object} state
 * @returns {Object} Current task
 */
function currentTask(state) {
  const phase = currentPhase(state);
  return phase.tasks[phase.current_task];
}
```

---

### Handler 1: `handleResearchCompleted(state, context)`

**Context**: `{ doc_path: string }`
**State changes**:
- `state.planning.steps.research.status` → `'complete'`
- `state.planning.steps.research.output` → `context.doc_path`

**Implementation**: Call `completePlanningStep(state, 'research', context.doc_path)`.

---

### Handler 2: `handlePrdCompleted(state, context)`

**Context**: `{ doc_path: string }`
**State changes**:
- `state.planning.steps.prd.status` → `'complete'`
- `state.planning.steps.prd.output` → `context.doc_path`

**Implementation**: Call `completePlanningStep(state, 'prd', context.doc_path)`.

---

### Handler 3: `handleDesignCompleted(state, context)`

**Context**: `{ doc_path: string }`
**State changes**:
- `state.planning.steps.design.status` → `'complete'`
- `state.planning.steps.design.output` → `context.doc_path`

**Implementation**: Call `completePlanningStep(state, 'design', context.doc_path)`.

---

### Handler 4: `handleArchitectureCompleted(state, context)`

**Context**: `{ doc_path: string }`
**State changes**:
- `state.planning.steps.architecture.status` → `'complete'`
- `state.planning.steps.architecture.output` → `context.doc_path`

**Implementation**: Call `completePlanningStep(state, 'architecture', context.doc_path)`.

---

### Handler 5: `handleMasterPlanCompleted(state, context)`

**Context**: `{ doc_path: string }`
**State changes**:
- `state.planning.steps.master_plan.status` → `'complete'`
- `state.planning.steps.master_plan.output` → `context.doc_path`
- `state.planning.status` → `'complete'`

**Implementation**:
```javascript
function handleMasterPlanCompleted(state, context) {
  const result = completePlanningStep(state, 'master_plan', context.doc_path);
  state.planning.status = PLANNING_STATUSES.COMPLETE;
  result.mutations_applied.push('planning.status → complete');
  return result;
}
```

---

### Handler 6: `handlePlanApproved(state, context)`

**Context**: `{}` (empty)
**State changes**:
- `state.planning.human_approved` → `true`
- `state.pipeline.current_tier` → `'execution'`
- `state.execution.status` → `'in_progress'`

**Implementation**:
```javascript
function handlePlanApproved(state, context) {
  state.planning.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  return {
    state,
    mutations_applied: [
      'planning.human_approved → true',
      'pipeline.current_tier → execution',
      'execution.status → in_progress'
    ]
  };
}
```

---

### Handler 7: `handlePlanRejected(state, context)`

**Context**: `{}` (empty)
**State changes**:
- `state.pipeline.current_tier` → `'halted'`
- `state.errors.active_blockers` ← push `'Plan rejected by human'`
- `state.errors.total_halts` += 1

**Implementation**:
```javascript
function handlePlanRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  state.errors.active_blockers.push('Plan rejected by human');
  state.errors.total_halts += 1;
  return {
    state,
    mutations_applied: [
      'pipeline.current_tier → halted',
      'errors.active_blockers ← Plan rejected by human',
      'errors.total_halts += 1'
    ]
  };
}
```

---

### Handler 8: `handlePhasePlanCreated(state, context)`

**Context**: `{ plan_path: string, tasks?: Array<{ id: string, title: string }> }`

The `context.tasks` array is optional. When provided (by the pipeline engine pre-reading the phase plan), it initializes the phase's tasks array. Each task stub has the shape specified below.

**State changes**:
- `currentPhase(state).phase_doc` → `context.plan_path`
- `currentPhase(state).status` → `'in_progress'` (if currently `'not_started'`)
- If `context.tasks` is a non-empty array: initialize `currentPhase(state).tasks` from it, set `currentPhase(state).total_tasks` = `context.tasks.length`

**Task stub shape** (when initializing from context.tasks):
```javascript
{
  id: task.id,           // e.g. "T01-MODULE-NAME"
  title: task.title,     // e.g. "Module Name Implementation"
  status: 'not_started',
  retries: 0,
  handoff_doc: null,
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null
}
```

**Implementation**:
```javascript
function handlePhasePlanCreated(state, context) {
  const phase = currentPhase(state);
  const mutations = [];

  phase.phase_doc = context.plan_path;
  mutations.push(`phase.phase_doc → ${context.plan_path}`);

  if (phase.status === PHASE_STATUSES.NOT_STARTED) {
    phase.status = PHASE_STATUSES.IN_PROGRESS;
    mutations.push('phase.status → in_progress');
  }

  if (Array.isArray(context.tasks) && context.tasks.length > 0) {
    phase.tasks = context.tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: TASK_STATUSES.NOT_STARTED,
      retries: 0,
      handoff_doc: null,
      report_doc: null,
      review_doc: null,
      review_verdict: null,
      review_action: null
    }));
    phase.total_tasks = context.tasks.length;
    phase.current_task = 0;
    mutations.push(`phase.tasks initialized (${context.tasks.length} tasks)`);
  }

  return { state, mutations_applied: mutations };
}
```

---

### Handler 9: `handleTaskHandoffCreated(state, context)`

**Context**: `{ handoff_path: string }`
**State changes**:
- `currentTask(state).handoff_doc` → `context.handoff_path`
- `currentTask(state).status` → `'in_progress'` (from `not_started` or `failed`)
- Clear review cycle fields for corrective support:
  - `currentTask(state).review_doc` → `null`
  - `currentTask(state).review_verdict` → `null`
  - `currentTask(state).review_action` → `null`

**Rationale**: Setting status to `in_progress` is required because the state validator (V12) enforces strict status transitions: `not_started → in_progress → complete|failed|halted`. The task MUST pass through `in_progress` before it can be set to `complete` or `failed` by triage. Clearing review fields supports the corrective cycle — for first-time handoffs these fields are already `null` (no-op); for corrective handoffs this resets the review cycle so V8 is satisfied and the review/triage flow can repeat.

**Validator compatibility**:
- V12: `not_started → in_progress` ✅, `failed → in_progress` ✅ (retry path)
- V8: After clearing, `review_doc = null` and `review_verdict = null` → both null → V8 satisfied ✅
- V14: `review_doc` goes from null→null (first handoff, no-op) or non-null→null (corrective); V14 only flags null→non-null transitions, so no violation ✅

**Implementation**:
```javascript
function handleTaskHandoffCreated(state, context) {
  const task = currentTask(state);
  const mutations = [];

  task.handoff_doc = context.handoff_path;
  mutations.push(`task.handoff_doc → ${context.handoff_path}`);

  task.status = TASK_STATUSES.IN_PROGRESS;
  mutations.push('task.status → in_progress');

  // Clear review cycle for corrective support
  task.review_doc = null;
  task.review_verdict = null;
  task.review_action = null;
  mutations.push('task review fields cleared (review_doc, review_verdict, review_action → null)');

  return { state, mutations_applied: mutations };
}
```

---

### Handler 10: `handleTaskCompleted(state, context)`

**Context**: `{ report_path: string, report_status?: string, report_severity?: string|null, report_deviations?: boolean }`

The `report_status`, `report_severity`, and `report_deviations` fields are enriched by the pipeline engine (T04) which pre-reads the task report frontmatter before calling this handler. The mutation handler itself performs zero I/O.

**State changes**:
- `currentTask(state).report_doc` → `context.report_path`
- `currentTask(state).severity` → `context.report_severity` (if provided and not null)
- Does **NOT** change `task.status` — it stays `in_progress`

**Rationale for NOT changing task status**: Triage ALWAYS runs for `task_completed` (per `needsTriage`). The `applyTaskTriage` helper sets the final task status based on the triage outcome. This design ensures all task status transitions are valid under V12:
- `in_progress → complete` (triage approved) ✅
- `in_progress → failed` (triage corrective) ✅
- `in_progress → halted` (triage halted) ✅

If this handler set status to `complete` (terminal per V12), `applyTaskTriage` could not transition to `failed` for corrective cycles.

**Implementation**:
```javascript
function handleTaskCompleted(state, context) {
  const task = currentTask(state);
  const mutations = [];

  task.report_doc = context.report_path;
  mutations.push(`task.report_doc → ${context.report_path}`);

  if (context.report_severity != null) {
    task.severity = context.report_severity;
    mutations.push(`task.severity → ${context.report_severity}`);
  }

  return { state, mutations_applied: mutations };
}
```

---

### Handler 11: `handleCodeReviewCompleted(state, context)`

**Context**: `{ review_path: string }`
**State changes**:
- `currentTask(state).review_doc` → `context.review_path`
- Does **NOT** change `task.status`, `task.review_verdict`, or `task.review_action`

**Rationale**: Triage always runs for `code_review_completed` (per `needsTriage`). The `applyTaskTriage` helper sets verdict and action. V14 prohibits setting `review_doc` and `review_verdict/action` in the same write. The pipeline engine (T04) writes this mutation result, then writes the triage mutation result as a separate write — satisfying V14.

**Important note for pipeline engine (T04)**: V8 requires that if `review_doc` is non-null, `review_verdict` must also be non-null. After this mutation (before triage), `review_doc` is set but `review_verdict` is null — V8 would fail at intermediate validation. The pipeline engine MUST either: (a) skip intermediate validation for triage-triggering events and validate only after both mutations are applied, or (b) combine both mutations into a single validation pass. This is a T04 design decision.

**Implementation**:
```javascript
function handleCodeReviewCompleted(state, context) {
  const task = currentTask(state);
  task.review_doc = context.review_path;
  return {
    state,
    mutations_applied: [`task.review_doc → ${context.review_path}`]
  };
}
```

---

### Handler 12: `handlePhaseReportCreated(state, context)`

**Context**: `{ report_path: string }`
**State changes**:
- `currentPhase(state).phase_report` → `context.report_path`

**Implementation**:
```javascript
function handlePhaseReportCreated(state, context) {
  const phase = currentPhase(state);
  phase.phase_report = context.report_path;
  return {
    state,
    mutations_applied: [`phase.phase_report → ${context.report_path}`]
  };
}
```

---

### Handler 13: `handlePhaseReviewCompleted(state, context)`

**Context**: `{ review_path: string }`
**State changes**:
- `currentPhase(state).phase_review` → `context.review_path`
- Does **NOT** change `phase_review_verdict` or `phase_review_action`

**Note for T04**: Same V9 constraint as V8 for tasks — `phase_review` non-null requires `phase_review_verdict` non-null. Pipeline engine must handle intermediate validation for triage-triggering events.

**Implementation**:
```javascript
function handlePhaseReviewCompleted(state, context) {
  const phase = currentPhase(state);
  phase.phase_review = context.review_path;
  return {
    state,
    mutations_applied: [`phase.phase_review → ${context.review_path}`]
  };
}
```

---

### Handler 14: `handleGateApproved(state, context)`

**Context**: `{ gate_type: 'task' | 'phase' }`

**For task gate** (`context.gate_type === 'task'`):
- Increment `currentPhase(state).current_task` by 1
- Reset `state.execution.triage_attempts` to 0

**For phase gate** (`context.gate_type === 'phase'`):
- Set `currentPhase(state).status` → `'complete'`
- Set `currentPhase(state).human_approved` → `true`
- Increment `state.execution.current_phase` by 1
- Reset `state.execution.triage_attempts` to 0
- If `state.execution.current_phase >= state.execution.phases.length`: set `state.pipeline.current_tier` → `'review'`, `state.execution.status` → `'complete'`

**Implementation**:
```javascript
function handleGateApproved(state, context) {
  const mutations = [];

  if (context.gate_type === 'task') {
    const phase = currentPhase(state);
    phase.current_task += 1;
    mutations.push(`phase.current_task → ${phase.current_task}`);
  } else if (context.gate_type === 'phase') {
    const phase = currentPhase(state);
    phase.status = PHASE_STATUSES.COMPLETE;
    phase.human_approved = true;
    mutations.push('phase.status → complete', 'phase.human_approved → true');

    state.execution.current_phase += 1;
    mutations.push(`execution.current_phase → ${state.execution.current_phase}`);

    if (state.execution.current_phase >= state.execution.phases.length) {
      state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      state.execution.status = 'complete';
      mutations.push('pipeline.current_tier → review', 'execution.status → complete');
    }
  }

  state.execution.triage_attempts = 0;
  mutations.push('execution.triage_attempts → 0');

  return { state, mutations_applied: mutations };
}
```

---

### Handler 15: `handleGateRejected(state, context)`

**Context**: `{ gate_type: 'task' | 'phase' }`
**State changes**:
- `state.pipeline.current_tier` → `'halted'`
- `state.errors.active_blockers` ← push `'Gate rejected: <gate_type>'`
- `state.errors.total_halts` += 1

**Implementation**:
```javascript
function handleGateRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  const msg = 'Gate rejected: ' + (context.gate_type || 'unknown');
  state.errors.active_blockers.push(msg);
  state.errors.total_halts += 1;
  return {
    state,
    mutations_applied: [
      'pipeline.current_tier → halted',
      `errors.active_blockers ← ${msg}`,
      'errors.total_halts += 1'
    ]
  };
}
```

---

### Handler 16: `handleFinalReviewCompleted(state, context)`

**Context**: `{ review_path: string }`
**State changes**:
- `state.final_review.report_doc` → `context.review_path`
- `state.final_review.status` → `'complete'`

**Implementation**:
```javascript
function handleFinalReviewCompleted(state, context) {
  state.final_review.report_doc = context.review_path;
  state.final_review.status = 'complete';
  return {
    state,
    mutations_applied: [
      `final_review.report_doc → ${context.review_path}`,
      'final_review.status → complete'
    ]
  };
}
```

---

### Handler 17: `handleFinalApproved(state, context)`

**Context**: `{}` (empty)
**State changes**:
- `state.final_review.human_approved` → `true`
- `state.pipeline.current_tier` → `'complete'`

**Implementation**:
```javascript
function handleFinalApproved(state, context) {
  state.final_review.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.COMPLETE;
  return {
    state,
    mutations_applied: [
      'final_review.human_approved → true',
      'pipeline.current_tier → complete'
    ]
  };
}
```

---

### Handler 18: `handleFinalRejected(state, context)`

**Context**: `{}` (empty)
**State changes**:
- `state.pipeline.current_tier` → `'halted'`
- `state.errors.active_blockers` ← push `'Final review rejected by human'`
- `state.errors.total_halts` += 1

**Implementation**:
```javascript
function handleFinalRejected(state, context) {
  state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
  state.errors.active_blockers.push('Final review rejected by human');
  state.errors.total_halts += 1;
  return {
    state,
    mutations_applied: [
      'pipeline.current_tier → halted',
      'errors.active_blockers ← Final review rejected by human',
      'errors.total_halts += 1'
    ]
  };
}
```

## Triage Helpers

### `applyTaskTriage(state, triageResult)`

Called by the pipeline engine after `triage-engine.executeTriage()` returns a result at the task level.

**Parameters**:
- `state` — Deep clone of current state (already mutated by the initial event handler)
- `triageResult` — Result from `triage-engine.executeTriage()`:
  ```javascript
  {
    success: true,
    level: 'task',
    verdict: 'approved'|'changes_requested'|'rejected'|null,
    action: 'advanced'|'corrective_task_issued'|'halted'|null,
    phase_index: number,    // 0-based
    task_index: number,     // 0-based
    row_matched: number,
    details: string
  }
  ```

**Behavior**:

1. **Skip case** — If `triageResult.verdict === null && triageResult.action === null` (triage engine Rows 1, 7 — "skip triage"):
   - Return `{ state, mutations_applied: [] }` — no state changes.

2. **All other cases** — Increment `state.execution.triage_attempts` by 1 (guard: default to 0 if field is missing).

3. **Set verdict/action on the task** at `triageResult.phase_index` / `triageResult.task_index`:
   - `task.review_verdict` → `triageResult.verdict`
   - `task.review_action` → `triageResult.action`

4. **Route by action**:

   | `triageResult.action` | Status Change | Additional State Changes |
   |----------------------|---------------|--------------------------|
   | `'advanced'` | `task.status → 'complete'` | Reset `execution.triage_attempts → 0` |
   | `'corrective_task_issued'` | `task.status → 'failed'` | `task.retries += 1`, `errors.total_retries += 1` |
   | `'halted'` | `task.status → 'halted'` | `pipeline.current_tier → 'halted'`, `errors.total_halts += 1`, `errors.active_blockers ← 'Task halted by triage: <triageResult.details>'` |

**Validator compatibility for status transitions from `in_progress`**:
- `in_progress → complete` ✅ (V12 allows)
- `in_progress → failed` ✅ (V12 allows)
- `in_progress → halted` ✅ (V12 allows)

**Implementation**:
```javascript
function applyTaskTriage(state, triageResult) {
  // Skip case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    return { state, mutations_applied: [] };
  }

  const mutations = [];

  // Increment triage_attempts (default to 0 if missing)
  state.execution.triage_attempts = (state.execution.triage_attempts || 0) + 1;
  mutations.push(`execution.triage_attempts → ${state.execution.triage_attempts}`);

  // Write verdict and action to the task
  const phase = state.execution.phases[triageResult.phase_index];
  const task = phase.tasks[triageResult.task_index];
  task.review_verdict = triageResult.verdict;
  task.review_action = triageResult.action;
  mutations.push(
    `task.review_verdict → ${triageResult.verdict}`,
    `task.review_action → ${triageResult.action}`
  );

  // Route by action
  if (triageResult.action === REVIEW_ACTIONS.ADVANCED) {
    task.status = TASK_STATUSES.COMPLETE;
    state.execution.triage_attempts = 0;
    mutations.push('task.status → complete', 'execution.triage_attempts → 0 (reset on advance)');
  } else if (triageResult.action === REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED) {
    task.status = TASK_STATUSES.FAILED;
    task.retries += 1;
    state.errors.total_retries += 1;
    mutations.push('task.status → failed', `task.retries → ${task.retries}`, 'errors.total_retries += 1');
  } else if (triageResult.action === REVIEW_ACTIONS.HALTED) {
    task.status = TASK_STATUSES.HALTED;
    state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
    state.errors.total_halts += 1;
    const msg = 'Task halted by triage: ' + (triageResult.details || 'no details');
    state.errors.active_blockers.push(msg);
    mutations.push('task.status → halted', 'pipeline.current_tier → halted', `errors.active_blockers ← ${msg}`);
  }

  return { state, mutations_applied: mutations };
}
```

---

### `applyPhaseTriage(state, triageResult)`

Called by the pipeline engine after `triage-engine.executeTriage()` returns a result at the phase level.

**Parameters**:
- `state` — Deep clone of current state
- `triageResult` — Result from `triage-engine.executeTriage()`:
  ```javascript
  {
    success: true,
    level: 'phase',
    verdict: 'approved'|'changes_requested'|'rejected'|null,
    action: 'advanced'|'corrective_tasks_issued'|'halted'|null,
    phase_index: number,    // 0-based
    task_index: null,       // always null for phase-level
    row_matched: number,
    details: string
  }
  ```

**Behavior**:

1. **Skip case** — If `triageResult.verdict === null && triageResult.action === null`: return no-op.

2. **All other cases** — Increment `state.execution.triage_attempts` by 1.

3. **Set verdict/action on the phase** at `triageResult.phase_index`:
   - `phase.phase_review_verdict` → `triageResult.verdict`
   - `phase.phase_review_action` → `triageResult.action`

4. **Route by action**:

   | `triageResult.action` | Additional State Changes |
   |----------------------|--------------------------|
   | `'advanced'` | Reset `execution.triage_attempts → 0`. Do NOT advance the phase — the pipeline engine handles `ADVANCE_PHASE` internally after the resolver returns it. |
   | `'corrective_tasks_issued'` | Keep `triage_attempts` at incremented value. The resolver will return `CREATE_PHASE_PLAN` (corrective). |
   | `'halted'` | `phase.status → 'halted'`, `pipeline.current_tier → 'halted'`, `errors.total_halts += 1`, `errors.active_blockers ← message` |

**Implementation**:
```javascript
function applyPhaseTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    return { state, mutations_applied: [] };
  }

  const mutations = [];

  state.execution.triage_attempts = (state.execution.triage_attempts || 0) + 1;
  mutations.push(`execution.triage_attempts → ${state.execution.triage_attempts}`);

  const phase = state.execution.phases[triageResult.phase_index];
  phase.phase_review_verdict = triageResult.verdict;
  phase.phase_review_action = triageResult.action;
  mutations.push(
    `phase.phase_review_verdict → ${triageResult.verdict}`,
    `phase.phase_review_action → ${triageResult.action}`
  );

  if (triageResult.action === PHASE_REVIEW_ACTIONS.ADVANCED) {
    state.execution.triage_attempts = 0;
    mutations.push('execution.triage_attempts → 0 (reset on advance)');
  } else if (triageResult.action === PHASE_REVIEW_ACTIONS.HALTED) {
    phase.status = PHASE_STATUSES.HALTED;
    state.pipeline.current_tier = PIPELINE_TIERS.HALTED;
    state.errors.total_halts += 1;
    const msg = 'Phase halted by triage: ' + (triageResult.details || 'no details');
    state.errors.active_blockers.push(msg);
    mutations.push('phase.status → halted', 'pipeline.current_tier → halted', `errors.active_blockers ← ${msg}`);
  }
  // corrective_tasks_issued: no additional state changes beyond verdict/action/triage_attempts

  return { state, mutations_applied: mutations };
}
```

## Styles & Design Tokens

Not applicable — this is a Node.js backend module with no UI.

## Test Requirements

Tests for this module are covered by **Task T03** (Mutations Unit Tests). This task produces the module only — no test file.

## Acceptance Criteria

- [ ] File created at `.github/orchestration/scripts/lib/mutations.js`
- [ ] Module is CommonJS with `'use strict'` at top
- [ ] Module imports ONLY from `./constants` — zero other imports, zero I/O modules
- [ ] `MUTATIONS` record contains exactly 18 entries matching the 18 event names listed above
- [ ] `getMutation(event)` returns the correct handler for each of the 18 event names
- [ ] `getMutation('unknown_event')` returns `undefined`
- [ ] `getMutation('start')` returns `undefined` (start is not a mutation — handled by pipeline engine)
- [ ] `needsTriage(event, state)` returns `{ shouldTriage: true, level: 'task' }` for `task_completed` and `code_review_completed`
- [ ] `needsTriage(event, state)` returns `{ shouldTriage: true, level: 'phase' }` for `phase_review_completed`
- [ ] `needsTriage(event, state)` returns `{ shouldTriage: false, level: null }` for all other 16 events (15 mutation events + `start`)
- [ ] All 18 handlers are named functions (not anonymous): `handleResearchCompleted`, `handlePrdCompleted`, `handleDesignCompleted`, `handleArchitectureCompleted`, `handleMasterPlanCompleted`, `handlePlanApproved`, `handlePlanRejected`, `handlePhasePlanCreated`, `handleTaskHandoffCreated`, `handleTaskCompleted`, `handleCodeReviewCompleted`, `handlePhaseReportCreated`, `handlePhaseReviewCompleted`, `handleGateApproved`, `handleGateRejected`, `handleFinalReviewCompleted`, `handleFinalApproved`, `handleFinalRejected`
- [ ] Each handler is ≤15 lines (excluding JSDoc comments and the shared `completePlanningStep` helper)
- [ ] Every handler is a pure function — no `require('fs')`, no `require('path')`, no `console.log`, no `process.*` calls
- [ ] Every handler returns `{ state, mutations_applied }` where `mutations_applied` is a non-empty `string[]`
- [ ] `applyTaskTriage` correctly handles all 4 cases: skip (null/null), advanced, corrective_task_issued, halted
- [ ] `applyPhaseTriage` correctly handles all 4 cases: skip (null/null), advanced, corrective_tasks_issued, halted
- [ ] `applyTaskTriage` and `applyPhaseTriage` default `triage_attempts` to 0 if the field is missing (backward compat)
- [ ] Module loads without errors: `node -e "require('./.github/orchestration/scripts/lib/mutations')"`
- [ ] Exports are exactly: `{ MUTATIONS, getMutation, needsTriage, applyTaskTriage, applyPhaseTriage }`
- [ ] Zero npm dependencies — only `./constants` import

## Constraints

- **Do NOT create a test file** — tests are Task T03
- **Do NOT modify** `constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`, or `state-io.js`
- **Do NOT import** `fs`, `path`, `process`, or any I/O module — this module is 100% pure logic
- **Do NOT import** the resolver, triage engine, or state validator — those are called by the pipeline engine, not by mutations
- **Do NOT handle the `start` event** — it is handled by the pipeline engine's init/cold-start path, not by a mutation
- **Each handler receives a pre-cloned state** — mutate it in place and return it. Do NOT deep-clone inside handlers.
- **Use enum constants** (e.g., `PIPELINE_TIERS.HALTED`) — never string literals for status values
- **`handleTaskCompleted` must NOT change `task.status`** — status is finalized by `applyTaskTriage` to ensure valid V12 transitions
- **`handleCodeReviewCompleted` must NOT change `task.review_verdict` or `task.review_action`** — those are set by `applyTaskTriage` after triage runs. V14 prohibits setting `review_doc` and `review_verdict/action` in the same write.
- **`handlePhaseReviewCompleted` must NOT change `phase.phase_review_verdict` or `phase.phase_review_action`** — those are set by `applyPhaseTriage` after triage runs.
- **`handleTaskHandoffCreated` MUST clear review fields** (`review_doc`, `review_verdict`, `review_action` → null) to support the corrective cycle
- **`triage_attempts` must default to 0** if the field is missing on state — use `(state.execution.triage_attempts || 0)` pattern
