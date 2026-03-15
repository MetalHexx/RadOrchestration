---
project: "PIPELINE-HOTFIX"
phase: 1
task: 2
title: "Resolver Conditional Fix for In-Progress Tasks"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Resolver Conditional Fix for In-Progress Tasks

## Objective

Fix the `resolveTaskLifecycle` function in `resolver.js` to return the correct action for `in_progress` tasks: return `execute_task` when a task has a `handoff_doc` but no `report_doc` (Coder hasn't run yet), and return `update_state_from_task` only when both `handoff_doc` and `report_doc` exist (Coder finished).

## Context

The `resolveTaskLifecycle` function in the resolver module routes task-level actions based on `task.status`. The current `in_progress` branch unconditionally returns `update_state_from_task` — an internal action the Orchestrator cannot route. When a task is `in_progress` with a handoff but no report, the correct action is `execute_task` (spawn the Coder). The unconditional return causes the pipeline to stall because the Orchestrator receives an unmapped action. This is Error 2 in the PIPELINE-HOTFIX project — a single conditional split in one function.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/resolver.js` | Replace the `in_progress` block (~lines 168–173) with a conditional split on `task.handoff_doc` and `task.report_doc` |

## Implementation Steps

1. Open `.github/orchestration/scripts/lib/resolver.js`.

2. Locate the `resolveTaskLifecycle` function (starts ~line 130). Inside it, find the `in_progress` block — it looks exactly like this:

```javascript
// ── in_progress ───────────────────────────────────────────────────────
if (task.status === TASK_STATUSES.IN_PROGRESS) {
  return makeResult(NEXT_ACTIONS.UPDATE_STATE_FROM_TASK, {
    ...baseOpts,
    details: 'Task ' + taskId + ' is in progress; checking Coder results and recording'
  });
}
```

3. Replace that entire `if` block with the following code. Do NOT change anything else in the function:

```javascript
// ── in_progress ───────────────────────────────────────────────────────
if (task.status === TASK_STATUSES.IN_PROGRESS) {
  // Task has handoff but no report → Coder hasn't run yet; spawn Coder
  if (task.handoff_doc && !task.report_doc) {
    return makeResult(NEXT_ACTIONS.EXECUTE_TASK, {
      ...baseOpts,
      details: 'Task ' + taskId + ' has handoff but no report; spawning Coder to execute'
    });
  }
  // Task has both handoff and report → Coder finished; engine processes report
  return makeResult(NEXT_ACTIONS.UPDATE_STATE_FROM_TASK, {
    ...baseOpts,
    details: 'Task ' + taskId + ' is in progress with report; processing Coder results'
  });
}
```

4. Verify: The block immediately before this is the `not_started` block (ends with `});` and `}`). The block immediately after is the `failed` block starting with `if (task.status === TASK_STATUSES.FAILED)`. Only the `in_progress` block changes.

5. Save the file. No other files are modified.

## Contracts & Interfaces

### Function Signature (unchanged)

```javascript
/**
 * Resolve the next action for a specific task within the execution tier.
 * Routes by task.status, then by sub-conditions within each status.
 * @param {Task} task - Current task object
 * @param {number} taskIndex - 0-based task index
 * @param {Phase} phase - Parent phase object
 * @param {number} phaseIndex - 0-based phase index
 * @param {string} humanGateMode - Resolved human gate mode
 * @param {Object} limits - state.limits with max_retries_per_task
 * @returns {NextActionResult}
 */
function resolveTaskLifecycle(task, taskIndex, phase, phaseIndex, humanGateMode, limits)
```

### Task Object Shape (relevant fields)

```javascript
// A task entry from state.execution.phases[N].tasks[M]
{
  status: 'in_progress',     // TASK_STATUSES.IN_PROGRESS
  handoff_doc: 'path/to/handoff.md' | null,
  report_doc: 'path/to/report.md' | null,
  // ... other fields not relevant to this fix
}
```

### Constants Used (already imported at top of resolver.js)

```javascript
const {
  PIPELINE_TIERS, PLANNING_STATUSES, PLANNING_STEP_STATUSES,
  PHASE_STATUSES, TASK_STATUSES, REVIEW_VERDICTS, REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS, SEVERITY_LEVELS, HUMAN_GATE_MODES, NEXT_ACTIONS
} = require('./constants');
```

- `TASK_STATUSES.IN_PROGRESS` — string `'in_progress'`
- `NEXT_ACTIONS.EXECUTE_TASK` — string `'execute_task'`
- `NEXT_ACTIONS.UPDATE_STATE_FROM_TASK` — string `'update_state_from_task'`

### Helper Function Used (defined earlier in resolver.js)

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

### `baseOpts` (defined at the top of `resolveTaskLifecycle`, before the status checks)

```javascript
const phaseId = formatPhaseId(phaseIndex);
const taskId = formatTaskId(phaseIndex, taskIndex);
const baseOpts = {
  tier: PIPELINE_TIERS.EXECUTION,
  phase_index: phaseIndex,
  task_index: taskIndex,
  phase_id: phaseId,
  task_id: taskId
};
```

### Decision Matrix for `in_progress` Status

| `handoff_doc` | `report_doc` | Returned Action | Rationale |
|---------------|-------------|-----------------|-----------|
| truthy | falsy | `NEXT_ACTIONS.EXECUTE_TASK` (`'execute_task'`) | Coder hasn't run yet — spawn Coder |
| truthy | truthy | `NEXT_ACTIONS.UPDATE_STATE_FROM_TASK` (`'update_state_from_task'`) | Coder finished — engine processes report |
| falsy | falsy | Falls through to `UPDATE_STATE_FROM_TASK` | Defensive — handoff should always exist for `in_progress` tasks |
| falsy | truthy | Falls through to `UPDATE_STATE_FROM_TASK` | Defensive — anomalous state, process report anyway |

## Styles & Design Tokens

Not applicable — this is a backend script fix with no UI components.

## Test Requirements

- [ ] Existing `resolver.test.js` test suite passes unmodified (run with `node --test .github/orchestration/scripts/lib/resolver.test.js`)
- [ ] Manual verification: construct a task object with `{ status: 'in_progress', handoff_doc: 'path/to/handoff.md', report_doc: null }` and confirm `resolveTaskLifecycle` returns `{ action: 'execute_task', ... }`
- [ ] Manual verification: construct a task object with `{ status: 'in_progress', handoff_doc: 'path/to/handoff.md', report_doc: 'path/to/report.md' }` and confirm `resolveTaskLifecycle` returns `{ action: 'update_state_from_task', ... }`

## Acceptance Criteria

- [ ] In-progress task with `handoff_doc` present and `report_doc` absent → resolver returns action `'execute_task'`
- [ ] In-progress task with both `handoff_doc` and `report_doc` present → resolver returns action `'update_state_from_task'`
- [ ] In-progress task with neither `handoff_doc` nor `report_doc` → resolver returns action `'update_state_from_task'` (defensive fallthrough)
- [ ] Existing `resolver.test.js` suite passes unmodified (`node --test .github/orchestration/scripts/lib/resolver.test.js`)
- [ ] No other status branches in `resolveTaskLifecycle` are modified
- [ ] No other files are modified
- [ ] No new imports or dependencies added

## Constraints

- Do NOT modify any code outside the `in_progress` block in `resolveTaskLifecycle`
- Do NOT modify `resolver.test.js` — the existing test suite must pass as-is
- Do NOT modify `constants.js` — all required constants (`NEXT_ACTIONS.EXECUTE_TASK`, `TASK_STATUSES.IN_PROGRESS`) are already defined and imported
- Do NOT add any new npm dependencies
- Do NOT modify any other files (`pipeline-engine.js`, `mutations.js`, etc.)
- Follow the existing code style: single quotes, `+` for string concatenation (not template literals), `...baseOpts` spread pattern for `makeResult` calls
