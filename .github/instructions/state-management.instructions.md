---
applyTo: '**/state.json'
---

# State Management Rules — v4

When working with `state.json` in the v4 schema (`$schema: 'orchestration-state-v4'`):

## Sole Writer: Pipeline Script

- Only the pipeline script (`pipeline.js`) may create or update `state.json`.
- All agents are read-only. No agent directly writes state — all state mutations flow through the pipeline script.
- No agent other than the Orchestrator may initiate state changes.
- The Orchestrator is responsible for invoking the pipeline script with the appropriate events based on agent outputs.

## Schema Version

All v4 state files carry `$schema: 'orchestration-state-v4'` as the first field. Any file carrying a different schema version string is a legacy file and must be migrated before use.

## Top-Level Structure

v4 state has exactly 5 top-level sections:

```
{
  "$schema": "orchestration-state-v4",
  "project": { ... },
  "pipeline": { ... },
  "planning": { ... },
  "execution": { ... },
  "final_review": { ... }
}
```

| Section | Purpose |
|---------|---------|
| `project` | Project metadata: `name`, `created`, `updated` (ISO 8601) |
| `pipeline` | Current pipeline tier: `pipeline.current_tier` |
| `planning` | Planning phase status, human approval flag, and step records |
| `execution` | Execution status, current phase pointer, and phases array |
| `final_review` | Final review status, doc path, and human approval flag |

## `pipeline` Section

`pipeline.current_tier` is the top-level pipeline tier indicator. This is a top-level `pipeline` section — it is not nested under `execution` or any other section.

Valid tiers (in order): `planning` → `execution` → `review` → `complete`

A pipeline can also be `halted` from any tier when a critical error occurs.

`planning.human_approved` must be `true` before `pipeline.current_tier` can transition to `"execution"`.

## `final_review` Section

Final review state is a top-level section — its fields are not nested under `execution` or any other section.

| v4 Field | Type | Description |
|----------|------|-------------|
| `final_review.status` | `FinalReviewStatus` | `'not_started'` \| `'in_progress'` \| `'complete'` |
| `final_review.doc_path` | `string \| null` | Path to the final review document |
| `final_review.human_approved` | `boolean` | Whether the human approved the final review |

## Nested Field Grouping

### Phase fields

All doc paths and review results for a phase are nested under the phase object:

| Group | Fields |
|-------|--------|
| `phase.docs` | `phase_plan`, `phase_report`, `phase_review` (all `string \| null`) |
| `phase.review` | `verdict` (`ReviewVerdict \| null`), `action` (`PhaseReviewAction \| null`) |

Phase objects have no flat doc or review fields. All doc paths live exclusively under `phase.docs.*` and all review results live exclusively under `phase.review.*`.

### Task fields

All doc paths and review results for a task are nested under the task object:

| Group | Fields |
|-------|--------|
| `task.docs` | `handoff`, `report`, `review` (all `string \| null`) |
| `task.review` | `verdict` (`ReviewVerdict \| null`), `action` (`TaskReviewAction \| null`) |

Task objects have no flat doc or review fields. All doc paths live exclusively under `task.docs.*` and all review results live exclusively under `task.review.*`.

## 1-Based Indexing

`execution.current_phase` and `phase.current_task` are **1-based** integers. A value of `0` means "no item active" (no phases exist yet, or no tasks active in the phase).

To access the active phase object: `phases[execution.current_phase - 1]`

To access the active task object: `phase.tasks[phase.current_task - 1]`

Never use raw `current_phase` or `current_task` as a zero-based array index.

## Removed Fields

These fields do not exist in v4 state. Do not reference them by any name:

| Concept | v4 Approach |
|---------|-------------|
| Phase count (was a stored integer) | Not stored — derive from `execution.phases.length` |
| Task count per phase (was a stored integer) | Not stored — derive from `phase.tasks.length` |
| Planning step pointer (was a stored index) | Removed — dead field with no replacement |

## `stage` vs `status` Distinction

Every phase and task has both a `status` and a `stage` field. They serve different purposes:

- **`status`** — coarse pipeline gate. Indicates overall completion state.
  - Task values: `not_started` → `in_progress` → `complete` | `failed` | `halted`
  - Phase values: `not_started` → `in_progress` → `complete` | `failed` | `halted`

- **`stage`** — precise work focus. Indicates what kind of work is currently active on the item.
  - Task values: `planning` → `coding` → `reviewing` → `complete` | `failed`
  - Phase values: `planning` → `executing` → `reviewing` → `complete` | `failed`

Use `status` to check if an item is active or done. Use `stage` to determine what the current unit of work is.

## Stage Transition Rules

### Task stages

Normal progression: `planning` → `coding` → `reviewing` → `complete` | `failed`

Corrective re-entry: `failed` → `coding`

### Phase stages

Normal progression: `planning` → `executing` → `reviewing` → `complete` | `failed`

Corrective re-entry: `failed` → `executing`

## `complete` Is Truly Terminal

In v4, `task_completed` (the Coder finishing work) keeps task `status = in_progress`. Task `status` only becomes `complete` after code review approves the work. This means:

- `complete` is a truly terminal state — once set, it does not transition back to `failed`
- `failed` → `coding` is the corrective re-entry path, not `complete` → anything
- Never assume `complete` means the Coder finished — it means the full review cycle approved the work

## Pipeline Tiers

The pipeline has these tiers in order: `planning` → `execution` → `review` → `complete`

A pipeline can also be `halted` from any tier when a critical error occurs. The `halted` tier is not part of the normal progression.

## state.json Invariants

- **Never decrease retry counts** — they only go up
- **Never skip states** — items progress through their defined state sequences; no state may be skipped
- **Only one task `in_progress` at a time** across the entire project
- **`planning.human_approved` must be `true`** before `pipeline.current_tier` can transition to `"execution"`
- **Always update `project.updated`** timestamp (ISO 8601) on every write

## Limits Validation

Before advancing to a new phase or task, the pipeline validates counts against configured limits:

- `execution.phases.length <= config.limits.max_phases`
- `phase.tasks.length <= config.limits.max_tasks_per_phase`
- `task.retries <= config.limits.max_retries_per_task`

Limits come from `orchestration.yml` config — they are not stored in `state.json`.

## Pre-Write Validation

Validation is handled internally by the pipeline script. The pipeline engine calls `validator.validateTransition(current, proposed, config)` after every mutation. On validation failure, the state is NOT written — the previous valid state is preserved.

No agent needs to invoke validation manually. The pipeline script is the sole executor of validation.

## Error Severity

Configured in `orchestration.yml`:

- **Critical** (pipeline halts): `build_failure`, `security_vulnerability`, `architectural_violation`, `data_loss_risk`
- **Minor** (auto-retry): `test_failure`, `lint_error`, `review_suggestion`, `missing_test_coverage`, `style_violation`
