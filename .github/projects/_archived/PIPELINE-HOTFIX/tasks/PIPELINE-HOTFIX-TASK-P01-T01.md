---
project: "PIPELINE-HOTFIX"
phase: 1
task: 1
title: "Master Plan Pre-Read & Phase Initialization"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 3
---

# Master Plan Pre-Read & Phase Initialization

## Objective

Add a `plan_approved` pre-read block in `pipeline-engine.js` that reads `total_phases` from the master plan frontmatter and injects it into the mutation context. Update `handlePlanApproved` in `mutations.js` to use `context.total_phases` to initialize `execution.phases[]` with the correct number of `not_started` entries. Add `total_phases` to the `create-master-plan` template frontmatter.

## Context

The pipeline engine uses a pre-read pattern to enrich mutation context with data from documents before calling pure mutation handlers. Currently, `plan_approved` has no pre-read — `handlePlanApproved` transitions the pipeline to execution but does not initialize the `execution.phases[]` array. The `task_completed` pre-read block (which reads the task report) already demonstrates the pattern to follow. The master plan template must include `total_phases` in its YAML frontmatter so the pre-read can extract it. All error conditions (missing path, missing field, invalid value) must produce a hard error with `success: false` — no state is written.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Add `plan_approved` pre-read block before the existing `task_completed` pre-read (~line 153) |
| MODIFY | `.github/orchestration/scripts/lib/mutations.js` | Update `handlePlanApproved` (~line 92) to initialize phases from `context.total_phases` |
| MODIFY | `.github/skills/create-master-plan/templates/MASTER-PLAN.md` | Add `total_phases` field to YAML frontmatter |

## Implementation Steps

1. **Open `.github/orchestration/scripts/lib/pipeline-engine.js`**. Locate the `// ── STANDARD MUTATION PATH ──` section. Find the `task_completed` pre-read block that starts with `if (event === 'task_completed' && context.report_path)` at approximately line 153. Insert the new `plan_approved` pre-read block **immediately before** this existing block (after `const currentState = deepClone(state);` and before the task report pre-read).

2. **Implement the `plan_approved` pre-read block** using the exact code in the Contracts section below. The block reads the master plan path from `state.planning.steps.master_plan.output`, calls `io.readDocument()`, extracts `total_phases` from frontmatter, validates it's a positive integer via `parseInt(..., 10)` + `Number.isInteger()`, and injects into `context.total_phases`. On any failure, return via `makeErrorResult()` — no state modification.

3. **Open `.github/orchestration/scripts/lib/mutations.js`**. Locate `handlePlanApproved` (Handler 6, ~line 92). The function currently sets `planning.human_approved`, `pipeline.current_tier`, and `execution.status` only.

4. **Update `handlePlanApproved`** to additionally set `state.execution.total_phases = context.total_phases` and build `state.execution.phases` as an array of `context.total_phases` entries. Each entry uses the phase initialization template in the Contracts section. Use a `for` loop with `push()`. Update the `mutations_applied` array to include the two new mutation descriptions.

5. **`mutations.js` already imports `PHASE_STATUSES`** from `./constants` (line 8: `PHASE_STATUSES`). No import changes needed in mutations.js.

6. **Open `.github/skills/create-master-plan/templates/MASTER-PLAN.md`**. In the YAML frontmatter block at the top of the file, add `total_phases: {NUMBER}` as a new field after the existing `status` field. This is a template placeholder — the `{NUMBER}` value is filled in by the agent creating the master plan.

## Contracts & Interfaces

### `plan_approved` Pre-Read Block (pipeline-engine.js)

Insert this block in `executePipeline()`, after `const currentState = deepClone(state);` and **before** the existing `task_completed` pre-read block:

```javascript
// Master plan pre-read: enrich context with total_phases before mutation
if (event === 'plan_approved') {
  const masterPlanPath = state.planning.steps.master_plan.output;
  if (!masterPlanPath) {
    return makeErrorResult(
      'Master plan path not found in state.planning.steps.master_plan.output',
      event, [], null, null
    );
  }
  try {
    const masterPlanDoc = io.readDocument(masterPlanPath);
    if (!masterPlanDoc) {
      return makeErrorResult(
        `Failed to read master plan at '${masterPlanPath}': document not found`,
        event, [], null, null
      );
    }
    const fm = masterPlanDoc.frontmatter || {};
    const totalPhases = parseInt(fm.total_phases, 10);
    if (!Number.isInteger(totalPhases) || totalPhases <= 0) {
      return makeErrorResult(
        `Master plan total_phases must be a positive integer, got '${fm.total_phases}'`,
        event, [], null, null
      );
    }
    context.total_phases = totalPhases;
  } catch (err) {
    return makeErrorResult(
      `Failed to read master plan at '${masterPlanPath}': ${err.message}`,
      event, [], null, null
    );
  }
}
```

**`makeErrorResult` signature** (already defined in pipeline-engine.js):

```javascript
function makeErrorResult(error, event, mutationsApplied, stateSnapshot, validationPassed) {
  return {
    success: false,
    error,
    event: event || null,
    state_snapshot: stateSnapshot || null,
    mutations_applied: mutationsApplied || [],
    validation_passed: validationPassed !== undefined ? validationPassed : null
  };
}
```

**`io.readDocument` contract**: Takes a relative file path string. Returns `{ frontmatter: Object, body: string }` or `null` on file-not-found. Throws on I/O errors. This matches the existing `task_completed` pre-read pattern.

### Error Conditions Table

| Condition | Behavior | Error Message |
|-----------|----------|---------------|
| `state.planning.steps.master_plan.output` is falsy | Hard error, no state written | `"Master plan path not found in state.planning.steps.master_plan.output"` |
| `io.readDocument()` returns `null` | Hard error, no state written | `"Failed to read master plan at '{path}': document not found"` |
| `io.readDocument()` throws | Hard error, no state written | `"Failed to read master plan at '{path}': {err.message}"` |
| `total_phases` missing or not a positive integer | Hard error, no state written | `"Master plan total_phases must be a positive integer, got '{value}'"` |

### Updated `handlePlanApproved` (mutations.js)

Replace the body of `handlePlanApproved` with:

```javascript
function handlePlanApproved(state, context) {
  state.planning.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  state.execution.total_phases = context.total_phases;
  state.execution.phases = [];
  for (let i = 0; i < context.total_phases; i++) {
    state.execution.phases.push({
      status: PHASE_STATUSES.NOT_STARTED,
      tasks: [],
      current_task: 0,
      phase_doc: null,
      phase_report: null,
      phase_review: null,
      phase_review_verdict: null,
      phase_review_action: null,
      triage_attempts: 0,
      human_approved: false
    });
  }
  return {
    state,
    mutations_applied: [
      'planning.human_approved → true',
      'pipeline.current_tier → execution',
      'execution.status → in_progress',
      `execution.total_phases → ${context.total_phases}`,
      `execution.phases → [${context.total_phases} phases initialized]`
    ]
  };
}
```

**Current code to replace** (Handler 6, `handlePlanApproved` at ~line 92 of mutations.js):

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

### Phase Entry Initialization Template

Each entry pushed to `execution.phases[]`:

| Field | Initial Value | Source |
|-------|---------------|--------|
| `status` | `'not_started'` | `PHASE_STATUSES.NOT_STARTED` from `./constants` |
| `tasks` | `[]` | Empty array — Tactical Planner populates later |
| `current_task` | `0` | 0-based index |
| `phase_doc` | `null` | Set later by `phase_plan_created` event |
| `phase_report` | `null` | Set later by `phase_report_created` event |
| `phase_review` | `null` | Set later by phase review |
| `phase_review_verdict` | `null` | Set later by triage |
| `phase_review_action` | `null` | Set later by triage |
| `triage_attempts` | `0` | Counter for triage retries |
| `human_approved` | `false` | Set later by human approval |

### Constants Already Available

`mutations.js` already imports `PHASE_STATUSES` on line 8:

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

`PHASE_STATUSES.NOT_STARTED` resolves to `'not_started'`.

`pipeline-engine.js` imports on line 8 — **no changes needed here** for this task:

```javascript
const { PIPELINE_TIERS, NEXT_ACTIONS } = require('./constants');
```

The pre-read block does not use `PHASE_STATUSES` (that's used in mutations.js only).

### Master Plan Template Frontmatter Update

Current frontmatter in `.github/skills/create-master-plan/templates/MASTER-PLAN.md`:

```yaml
---
project: "{PROJECT-NAME}"
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
---
```

New frontmatter (add `total_phases` after `status`):

```yaml
---
project: "{PROJECT-NAME}"
total_phases: {NUMBER}
status: "draft|approved"
author: "architect-agent"
created: "{ISO-DATE}"
---
```

## Styles & Design Tokens

Not applicable — no UI changes in this task.

## Test Requirements

- [ ] `handlePlanApproved` with `context.total_phases = 3` produces `execution.phases.length === 3`
- [ ] Each phase entry has `status: 'not_started'`, `tasks: []`, `current_task: 0`, all doc fields `null`, `triage_attempts: 0`, `human_approved: false`
- [ ] `execution.total_phases` is set to the `context.total_phases` value
- [ ] `plan_approved` pre-read with missing `master_plan.output` returns `success: false` with error containing `"Master plan path not found"`
- [ ] `plan_approved` pre-read with `io.readDocument()` returning `null` returns `success: false` with error containing the path
- [ ] `plan_approved` pre-read with `total_phases` missing from frontmatter returns `success: false` with error containing `"positive integer"`
- [ ] `plan_approved` pre-read with `total_phases: 0` or `total_phases: -1` returns `success: false`
- [ ] `plan_approved` pre-read with valid `total_phases: 3` injects `context.total_phases = 3` and mutation succeeds

Note: Regression tests for these scenarios (RT-1, RT-2) are implemented in a later task (T06/T07). This task focuses on implementing the production code. Verify your changes by reading the code and confirming correctness.

## Acceptance Criteria

- [ ] `handlePlanApproved` with `context.total_phases = 3` produces `execution.phases.length === 3` with all entries `status: 'not_started'`
- [ ] `execution.total_phases` is set to the context value
- [ ] Missing `total_phases` in frontmatter returns `success: false` with descriptive error
- [ ] Missing `master_plan.output` in state returns `success: false` with descriptive error
- [ ] Invalid `total_phases` (non-integer, zero, negative) returns `success: false` with descriptive error
- [ ] `io.readDocument()` failure returns `success: false` with descriptive error
- [ ] Master plan template includes `total_phases: {NUMBER}` in frontmatter
- [ ] Existing pipeline-engine.js imports are unchanged (no new imports needed for this task)
- [ ] Existing mutations.js imports are unchanged (PHASE_STATUSES already imported)
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests/` (no regressions)
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify `constants.js` — all needed constants already exist
- Do NOT modify `resolver.js` — that is a different task (T02)
- Do NOT modify `triage-engine.js` — it is preserved as-is
- Do NOT modify `state-validator.js` — it is preserved as-is
- Do NOT add new imports to `pipeline-engine.js` for this task — `makeErrorResult` and `io.readDocument` are already available in scope
- Do NOT add new imports to `mutations.js` — `PHASE_STATUSES` is already imported
- Do NOT write test files — regression tests are handled in tasks T06 and T07
- Do NOT add status normalization to the task report pre-read — that is a different task (T03)
- Follow existing code patterns exactly: CommonJS (`require`), `'use strict'`, same JSDoc style
- The pre-read block goes BEFORE the existing `task_completed` pre-read, not after it
