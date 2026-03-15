---
project: "PIPELINE-HOTFIX"
phase: 1
task: 4
title: "Auto-Approve Clean Reports on Null/Null Triage"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Auto-Approve Clean Reports on Null/Null Triage

## Objective

Update `applyTaskTriage` and `applyPhaseTriage` in `mutations.js` to auto-approve when triage returns null verdict and null action and a report document exists (proof of execution), instead of applying zero mutations and leaving the task/phase stuck.

## Context

The triage engine's decision table Row 1 returns `{ verdict: null, action: null }` for clean reports (status `complete`, no deviations, no review doc). Currently both `applyTaskTriage` and `applyPhaseTriage` treat null/null as a skip — applying zero mutations. This leaves the task in `in_progress` and the phase unreviewed forever, deadlocking the pipeline. The fix adds an auto-approve path: when null/null is returned AND a report exists, the caller sets the task or phase to approved. When no report exists, the original skip behavior is preserved. The triage engine itself (`triage-engine.js`) is NOT modified.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/mutations.js` | Update `applyTaskTriage` (~line 389) and `applyPhaseTriage` (~line 440) null/null handling |

## Implementation Steps

1. **Add `REVIEW_VERDICTS` to the imports** at the top of `mutations.js`. The current import block (lines 3–11) imports `PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `TASK_STATUSES`, `PHASE_STATUSES`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS` from `./constants`. Add `REVIEW_VERDICTS` to this destructuring.

2. **Modify `applyTaskTriage`** (starts at line 389). Replace the current null/null skip block (lines 391–393):
   ```javascript
   // Skip case: triage engine returned no verdict/action
   if (triageResult.verdict === null && triageResult.action === null) {
     return { state, mutations_applied: [] };
   }
   ```
   With the new auto-approve block that checks for `task.report_doc`:
   - Look up the task via `state.execution.phases[triageResult.phase_index].tasks[triageResult.task_index]`
   - If `task.report_doc` is truthy → auto-approve: set `task.status`, `task.review_verdict`, `task.review_action`, reset `task.triage_attempts` and `state.execution.triage_attempts` to 0, return with descriptive `mutations_applied`
   - If `task.report_doc` is falsy → return the original skip: `{ state, mutations_applied: [] }`

3. **Modify `applyPhaseTriage`** (starts at line 440). Replace the current null/null skip block (lines 441–443):
   ```javascript
   if (triageResult.verdict === null && triageResult.action === null) {
     return { state, mutations_applied: [] };
   }
   ```
   With the new auto-approve block that checks for `phase.phase_report`:
   - Look up the phase via `state.execution.phases[triageResult.phase_index]`
   - If `phase.phase_report` is truthy → auto-approve: set `phase.phase_review_verdict`, `phase.phase_review_action`, reset `phase.triage_attempts` and `state.execution.triage_attempts` to 0, return with descriptive `mutations_applied`
   - If `phase.phase_report` is falsy → return the original skip: `{ state, mutations_applied: [] }`

4. **Verify** that no other code in the file is changed — the rest of both functions (non-null verdict/action routing) remains untouched.

## Contracts & Interfaces

### Constants Used (from `.github/orchestration/scripts/lib/constants.js`)

```javascript
const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted'
});

const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted'
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted'
});
```

### Current Import Block (mutations.js lines 3–11)

```javascript
const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS
} = require('./constants');
```

**Required change** — add `REVIEW_VERDICTS`:

```javascript
const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS
} = require('./constants');
```

### `applyTaskTriage` — Current Code (lines 389–436)

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

### `applyTaskTriage` — Replacement Code

```javascript
function applyTaskTriage(state, triageResult) {
  // Null/null case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when task has a report (proof of execution)
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc) {
      task.status = TASK_STATUSES.COMPLETE;
      task.review_verdict = REVIEW_VERDICTS.APPROVED;
      task.review_action = REVIEW_ACTIONS.ADVANCED;
      task.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [
          `task[P${triageResult.phase_index}T${triageResult.task_index}].status → complete (auto-approved: clean report, no triage action)`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].review_verdict → approved`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].review_action → advanced`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].triage_attempts → 0`,
          'execution.triage_attempts → 0'
        ]
      };
    }
    // No report → original skip (nothing to auto-approve)
    return { state, mutations_applied: [] };
  }

  // ... rest of function below this point is UNCHANGED ...
```

### `applyPhaseTriage` — Current Code (lines 440–475)

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

### `applyPhaseTriage` — Replacement Code

```javascript
function applyPhaseTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when phase has a report (proof of phase work)
    const phase = state.execution.phases[triageResult.phase_index];
    if (phase.phase_report) {
      phase.phase_review_verdict = REVIEW_VERDICTS.APPROVED;
      phase.phase_review_action = PHASE_REVIEW_ACTIONS.ADVANCED;
      phase.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [
          `phase[P${triageResult.phase_index}].phase_review_verdict → approved (auto-approved: clean report, no triage action)`,
          `phase[P${triageResult.phase_index}].phase_review_action → advanced`,
          `phase[P${triageResult.phase_index}].triage_attempts → 0`,
          'execution.triage_attempts → 0'
        ]
      };
    }
    // No report → original skip
    return { state, mutations_applied: [] };
  }

  // ... rest of function below this point is UNCHANGED ...
```

### `triageResult` Object Shape (from triage-engine.js — NOT modified)

```javascript
// triageResult returned by triage-engine.executeTriage()
{
  verdict: null | 'approved' | 'changes_requested' | 'rejected',
  action: null | 'advanced' | 'corrective_task_issued' | 'halted',  // task-level
  //  or: null | 'advanced' | 'corrective_tasks_issued' | 'halted', // phase-level
  phase_index: number,
  task_index: number,  // task-level only
  details: string | null
}
```

### Task State Shape (relevant fields)

```javascript
// state.execution.phases[N].tasks[M]
{
  status: 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted',
  triage_attempts: number,
  handoff_doc: string | null,
  report_doc: string | null,   // ← key field: truthy = proof of execution
  review_doc: string | null,
  review_verdict: string | null,
  review_action: string | null
}
```

### Phase State Shape (relevant fields)

```javascript
// state.execution.phases[N]
{
  status: 'not_started' | 'in_progress' | 'complete' | 'halted',
  tasks: [...],
  current_task: number,
  phase_report: string | null,  // ← key field: truthy = proof of phase work
  phase_review_verdict: string | null,
  phase_review_action: string | null,
  triage_attempts: number
}
```

## Styles & Design Tokens

N/A — No UI or style changes. This is a pure domain logic fix.

## Test Requirements

- [ ] Existing `triage-engine.test.js` passes unmodified (the triage engine is not touched)
- [ ] Existing `constants.test.js` passes unmodified
- [ ] Existing `state-validator.test.js` passes unmodified
- [ ] Existing `resolver.test.js` passes unmodified
- [ ] All other existing tests in `mutations.test.js` still pass (the non-null verdict/action routing is unchanged)

> **Note**: The dedicated regression tests for this fix (RT-7, RT-8, RT-9) will be created in T06; this task only modifies the production code.

## Acceptance Criteria

- [ ] `applyTaskTriage` called with `{ verdict: null, action: null }` and a task that has `report_doc` set → returns task with `status: 'complete'`, `review_verdict: 'approved'`, `review_action: 'advanced'`, `triage_attempts: 0`; `execution.triage_attempts: 0`
- [ ] `applyTaskTriage` called with `{ verdict: null, action: null }` and a task that has `report_doc: null` → returns `{ state, mutations_applied: [] }` with zero changes (original skip)
- [ ] `applyPhaseTriage` called with `{ verdict: null, action: null }` and a phase that has `phase_report` set → returns phase with `phase_review_verdict: 'approved'`, `phase_review_action: 'advanced'`, `triage_attempts: 0`; `execution.triage_attempts: 0`
- [ ] `applyPhaseTriage` called with `{ verdict: null, action: null }` and a phase that has `phase_report: null` → returns `{ state, mutations_applied: [] }` (original skip)
- [ ] `REVIEW_VERDICTS` is imported from `./constants` in the destructuring block at the top of the file
- [ ] Existing `triage-engine.test.js` passes unmodified
- [ ] All existing `mutations.test.js` tests pass
- [ ] Build succeeds (`node --test .github/orchestration/scripts/tests/mutations.test.js`)

## Constraints

- Do NOT modify `triage-engine.js` — Row 1 of the triage decision table still returns null/null; the auto-approve translation is the responsibility of the callers
- Do NOT modify `constants.js` — all needed constants already exist
- Do NOT change the non-null verdict/action routing logic in either function — only the null/null block is replaced
- Do NOT modify any test files — regression tests are a separate task (T06)
- Do NOT add any npm dependencies — zero external dependencies constraint (NFR-3)
- Follow the existing code pattern: use named constants (`TASK_STATUSES.COMPLETE`, `REVIEW_VERDICTS.APPROVED`, etc.), never string literals for enum values
- The `mutations_applied` array entries must be descriptive strings following the existing pattern (e.g., `'task[P0T2].status → complete (auto-approved: clean report, no triage action)'`)
