---
project: "PIPELINE-HOTFIX"
phase: 1
task: 5
title: "Internal advance_phase Handling & Unmapped Action Guard"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Internal `advance_phase` Handling & Unmapped Action Guard

## Objective

Add internal `advance_phase` handling in `pipeline-engine.js` with a bounded re-resolve loop (max 1 iteration), define the `EXTERNAL_ACTIONS` set (18 external actions) at module scope, and add the unmapped action guard so any resolved action not in `EXTERNAL_ACTIONS` triggers a hard error (exit 1).

## Context

After T04 (auto-approve), when a phase completes all tasks and triage auto-approves the phase report, the resolver returns `advance_phase`. This is an internal action — it is NOT in the Orchestrator's routing table. The pipeline engine must handle it internally: mark the current phase complete, advance `current_phase` (or set `execution.status = 'complete'` on last phase), re-validate, write state, re-resolve to obtain an external action. Additionally, any action that is not one of the 18 external actions after internal handling must produce a hard error — this catches resolver bugs before they silently fail. The last-phase case must keep `current_phase` at the last valid index (never `>= phases.length`) to avoid the V1 validator out-of-bounds error.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Add `PHASE_STATUSES` import, `EXTERNAL_ACTIONS` set, `advance_phase` internal handler, unmapped action guard |

## Implementation Steps

1. **Add `PHASE_STATUSES` to the constants import** (line 8). The current import is:
   ```javascript
   const { PIPELINE_TIERS, NEXT_ACTIONS } = require('./constants');
   ```
   Change to:
   ```javascript
   const { PIPELINE_TIERS, NEXT_ACTIONS, PHASE_STATUSES } = require('./constants');
   ```

2. **Define `EXTERNAL_ACTIONS` set at module scope**. Insert after the imports block (after line 8, before the `// ─── Helpers` comment on line 10) a new constant:
   ```javascript
   /**
    * The 18 actions the Orchestrator's routing table handles.
    * Any resolved action not in this set is a bug.
    * @type {Set<string>}
    */
   const EXTERNAL_ACTIONS = new Set([
     NEXT_ACTIONS.SPAWN_RESEARCH,
     NEXT_ACTIONS.SPAWN_PRD,
     NEXT_ACTIONS.SPAWN_DESIGN,
     NEXT_ACTIONS.SPAWN_ARCHITECTURE,
     NEXT_ACTIONS.SPAWN_MASTER_PLAN,
     NEXT_ACTIONS.REQUEST_PLAN_APPROVAL,
     NEXT_ACTIONS.CREATE_PHASE_PLAN,
     NEXT_ACTIONS.CREATE_TASK_HANDOFF,
     NEXT_ACTIONS.EXECUTE_TASK,
     NEXT_ACTIONS.SPAWN_CODE_REVIEWER,
     NEXT_ACTIONS.GENERATE_PHASE_REPORT,
     NEXT_ACTIONS.SPAWN_PHASE_REVIEWER,
     NEXT_ACTIONS.SPAWN_FINAL_REVIEWER,
     NEXT_ACTIONS.REQUEST_FINAL_APPROVAL,
     NEXT_ACTIONS.GATE_TASK,
     NEXT_ACTIONS.GATE_PHASE,
     NEXT_ACTIONS.DISPLAY_HALTED,
     NEXT_ACTIONS.DISPLAY_COMPLETE
   ]);
   ```

3. **Change `const resolved` to `let resolved`** in the RESOLVE section. The current code (around line 285) is:
   ```javascript
   // ── RESOLVE ──
   const config = io.readConfig(configPath);
   const resolved = resolveNextAction(proposedState, config);
   ```
   Change `const resolved` to `let resolved` so it can be reassigned after re-resolve:
   ```javascript
   // ── RESOLVE ──
   const config = io.readConfig(configPath);
   let resolved = resolveNextAction(proposedState, config);
   ```

4. **Insert `advance_phase` internal handler** after the first resolve call and before the return statement. This block:
   - Checks if `resolved.action === NEXT_ACTIONS.ADVANCE_PHASE`
   - Sets `phase.status = PHASE_STATUSES.COMPLETE` on the current phase
   - Determines if this is the last phase (`current_phase >= phases.length - 1`)
   - Last phase: sets `pipeline.current_tier = PIPELINE_TIERS.REVIEW` and `execution.status = 'complete'`, keeps `current_phase` at last valid index
   - Non-last phase: increments `current_phase += 1`
   - Pushes descriptive entries to `allMutationsApplied`
   - Re-validates by calling `validateTransition(preAdvanceState, proposedState)` — hard error if invalid
   - Writes state via `io.writeState(projectDir, proposedState)`
   - Re-resolves via `resolved = resolveNextAction(proposedState, config)`
   - Bounded loop guard: if re-resolved action is NOT in `EXTERNAL_ACTIONS`, returns hard error

5. **Insert unmapped action guard** after the internal handler block, before the final return. If `resolved.action` is not in `EXTERNAL_ACTIONS`, return a hard error naming the unmapped action and listing the expected set.

6. **Verify** no other code in the file is changed — all pre-reads, mutation handling, triage, and non-triage paths remain untouched.

## Contracts & Interfaces

### Constants Used (from `.github/orchestration/scripts/lib/constants.js`)

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted'
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted'
});

const NEXT_ACTIONS = Object.freeze({
  // ... 35 values total. The 18 EXTERNAL actions:
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
  // Internal actions (NOT in EXTERNAL_ACTIONS):
  ADVANCE_PHASE: 'advance_phase',
  // ... and others like UPDATE_STATE_FROM_TASK, TRIAGE_TASK, etc.
});
```

### `EXTERNAL_ACTIONS` Set (18 values)

The exact 18 string values that the Orchestrator routes:

```
spawn_research, spawn_prd, spawn_design, spawn_architecture,
spawn_master_plan, request_plan_approval, create_phase_plan,
create_task_handoff, execute_task, spawn_code_reviewer,
generate_phase_report, spawn_phase_reviewer, spawn_final_reviewer,
request_final_approval, gate_task, gate_phase, display_halted,
display_complete
```

### Current Import Line (pipeline-engine.js line 8)

```javascript
const { PIPELINE_TIERS, NEXT_ACTIONS } = require('./constants');
```

**Required change** — add `PHASE_STATUSES`:

```javascript
const { PIPELINE_TIERS, NEXT_ACTIONS, PHASE_STATUSES } = require('./constants');
```

### Current RESOLVE Section (pipeline-engine.js ~lines 283–299)

This is the complete code from the RESOLVE comment to the closing brace of `executePipeline`:

```javascript
  // ── RESOLVE ──
  const config = io.readConfig(configPath);
  const resolved = resolveNextAction(proposedState, config);

  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: allMutationsApplied,
    triage_ran: triageRan,
    validation_passed: true
  };
}
```

### Replacement RESOLVE Section

Replace the above block with:

```javascript
  // ── RESOLVE ──
  const config = io.readConfig(configPath);
  let resolved = resolveNextAction(proposedState, config);

  // ── INTERNAL ACTION HANDLING ──
  // Handle advance_phase internally: apply phase advancement, re-validate, re-resolve
  if (resolved.action === NEXT_ACTIONS.ADVANCE_PHASE) {
    const phase = proposedState.execution.phases[proposedState.execution.current_phase];
    phase.status = PHASE_STATUSES.COMPLETE;

    const isLastPhase = (proposedState.execution.current_phase >= proposedState.execution.phases.length - 1);
    if (isLastPhase) {
      proposedState.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      proposedState.execution.status = 'complete';
      // current_phase stays at last valid index — never exceeds phases.length - 1
    } else {
      proposedState.execution.current_phase += 1;
    }

    allMutationsApplied.push(
      `phase[${resolved.context.phase_index}].status → complete`,
      isLastPhase
        ? 'pipeline.current_tier → review, execution.status → complete'
        : `execution.current_phase → ${proposedState.execution.current_phase}`
    );

    // Re-validate after internal advancement
    const preAdvanceState = deepClone(proposedState);
    proposedState.project.updated = new Date().toISOString();
    const advanceValidation = validateTransition(preAdvanceState, proposedState);
    if (!advanceValidation.valid) {
      const firstError = advanceValidation.errors[0];
      return makeErrorResult(
        `Validation failed after advance_phase: [${firstError.invariant}] ${firstError.message}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        false
      );
    }

    // Write state after advancement
    io.writeState(projectDir, proposedState);

    // Re-resolve to get external action
    resolved = resolveNextAction(proposedState, config);

    // Bounded loop guard: if re-resolved action is still not external, hard error
    if (!EXTERNAL_ACTIONS.has(resolved.action)) {
      return makeErrorResult(
        `Internal re-resolve produced unmapped action '${resolved.action}' after handling 'advance_phase'. Max internal iterations (1) exceeded.`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        true
      );
    }
  }

  // ── UNMAPPED ACTION GUARD ──
  if (!EXTERNAL_ACTIONS.has(resolved.action)) {
    return makeErrorResult(
      `Pipeline resolved unmapped action '${resolved.action}'. Expected one of: ${[...EXTERNAL_ACTIONS].join(', ')}. This indicates a resolver bug.`,
      event, allMutationsApplied,
      { current_phase: proposedState.execution.current_phase },
      true
    );
  }

  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: allMutationsApplied,
    triage_ran: triageRan,
    validation_passed: true
  };
}
```

### Helper Functions Already Available in pipeline-engine.js

These functions are already defined in the file and used by the new code:

- `makeErrorResult(error, event, mutationsApplied, stateSnapshot, validationPassed)` — builds the error result object
- `deepClone(obj)` — JSON round-trip deep clone
- `validateTransition(currentState, proposedState)` — imported from `./state-validator`
- `resolveNextAction(proposedState, config)` — imported from `./resolver`

### Phase Advancement State Mutations

| Mutation | Last Phase | Non-Last Phase |
|----------|-----------|----------------|
| `phase.status` | `PHASE_STATUSES.COMPLETE` (`'complete'`) | `PHASE_STATUSES.COMPLETE` (`'complete'`) |
| `execution.current_phase` | **unchanged** (stays at last valid index) | `+= 1` |
| `execution.status` | `'complete'` | unchanged |
| `pipeline.current_tier` | `PIPELINE_TIERS.REVIEW` (`'review'`) | unchanged |

### Expected External Actions After Re-Resolve

| Scenario | Tier After Advancement | Expected Re-resolved Action |
|----------|----------------------|---------------------------|
| Non-last phase (more phases remain) | `execution` | `create_phase_plan` (new phase is `not_started`) |
| Last phase completed | `review` | `spawn_final_reviewer` (final review not started) |

### Resolver Context

The resolver's `resolved` object has the shape:
```javascript
{
  action: string,    // e.g. 'advance_phase', 'create_phase_plan'
  context: {
    phase_index: number,  // 0-based current phase index
    task_index: number,   // 0-based current task index (when applicable)
    details: string       // human-readable description
  }
}
```

`resolved.context.phase_index` is used in the `allMutationsApplied.push()` call to label which phase was advanced.

## Styles & Design Tokens

N/A — no UI changes.

## Test Requirements

- [ ] Non-last phase approved → engine handles `advance_phase` internally → returns `create_phase_plan` as external action, `current_phase` incremented by 1
- [ ] Last phase approved → engine handles `advance_phase` internally → returns `spawn_final_reviewer`, `current_phase` stays at last valid index, `execution.status === 'complete'`, `pipeline.current_tier === 'review'`
- [ ] Unmapped action (not in 18-action set) → `result.success === false` with error naming the unmapped action
- [ ] Existing `state-validator.test.js` passes unmodified (V1 bounds check never triggered because `current_phase` stays at last index)

*Note: The actual regression test cases (RT-10, RT-11, RT-12, RT-13) will be written in T07 — not in this task. This task implements the production code only.*

## Acceptance Criteria

- [ ] `PHASE_STATUSES` is imported from `./constants` alongside `PIPELINE_TIERS` and `NEXT_ACTIONS`
- [ ] `EXTERNAL_ACTIONS` is defined as a `Set` at module scope with exactly 18 entries matching the values listed above
- [ ] Non-last phase with `advance_phase` action → engine applies advancement internally, re-validates, writes state, re-resolves → returns `create_phase_plan` as external action
- [ ] Last phase with `advance_phase` action → engine applies advancement internally, `current_phase` stays at last valid index (not incremented past `phases.length - 1`), `execution.status = 'complete'`, `pipeline.current_tier = 'review'` → returns `spawn_final_reviewer` as external action
- [ ] Unmapped action (not in the 18-action `EXTERNAL_ACTIONS` set) → `result.success === false` with error message naming the action and listing expected actions
- [ ] Re-resolve bounded loop guard: if re-resolved action after `advance_phase` handling is still not in `EXTERNAL_ACTIONS` → `result.success === false`
- [ ] `const resolved` changed to `let resolved` in the RESOLVE section
- [ ] Existing `state-validator.test.js` passes unmodified (`node --test .github/orchestration/scripts/tests/state-validator.test.js`)
- [ ] Existing `resolver.test.js` passes unmodified (`node --test .github/orchestration/scripts/tests/resolver.test.js`)
- [ ] Existing `mutations.test.js` passes unmodified (`node --test .github/orchestration/scripts/tests/mutations.test.js`)
- [ ] Existing `triage-engine.test.js` passes unmodified (`node --test .github/orchestration/scripts/tests/triage-engine.test.js`)
- [ ] Existing `constants.test.js` passes unmodified (`node --test .github/orchestration/scripts/tests/constants.test.js`)
- [ ] Build succeeds: all test files in `.github/orchestration/scripts/tests/` pass

## Constraints

- Do NOT modify `constants.js` — no new enum values, no changes to `NEXT_ACTIONS` or `PHASE_STATUSES`
- Do NOT modify `resolver.js` — the resolver still returns `advance_phase`; the engine handles it
- Do NOT modify `state-validator.js` — the V1 bounds check is correct; the fix prevents it from triggering
- Do NOT modify `mutations.js` — the auto-approve logic from T04 is already in place
- Do NOT modify any test files — regression tests are T06 and T07
- Do NOT write `state.json` — the pipeline engine writes state via `io.writeState()`
- Do NOT export `EXTERNAL_ACTIONS` — it is internal to the pipeline engine module
- The `advance_phase` internal handler must write state (`io.writeState`) before re-resolving, because the resolver reads from the proposed state object in memory (not from disk), but the state write ensures persistence in case of subsequent failure
- The re-validate step uses `deepClone(proposedState)` as the "before" snapshot — this matches the pattern used in the triage validation path (using post-mutation state as the validation baseline)
