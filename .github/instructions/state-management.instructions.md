---
applyTo: '**/state.json'
---

# State Management Rules

When working with `state.json`:

## Sole Writer: Pipeline Script

- Only the pipeline script (`pipeline.js`) may create or update `state.json`. 
- All agents are read-only. No agent directly writes state — all state mutations flow through the pipeline script.  
- No agent other than the Orchestrator may initiate state changes.
- The Orchestrator is responsible for invoking the pipeline script with the appropriate state mutations based on agent outputs.


## state.json Invariants

- **Never decrease retry counts** — they only go up
- **Never skip states** — tasks progress: `not_started` → `in_progress` → `complete` | `failed`
- **Only one task `in_progress` at a time** across the entire project
- **`planning.human_approved` must be `true`** before `current_tier` can transition to `"execution"`
- **Always update `project.updated`** timestamp on every write
- **Validate limits before advancing**: 
  - `phases.length <= config.limits.max_phases`
  - `phase.tasks.length <= config.limits.max_tasks_per_phase`
  -  `task.retries <= config.limits.max_retries_per_task` 
  - (limits come from `orchestration.yml` config, not from `state.json`)

## Pipeline Tiers

The pipeline has these tiers in order: `planning` → `execution` → `review` → `complete`

A pipeline can also be `halted` from any tier when a critical error occurs.

## Error Severity

Configured in `orchestration.yml`:
- **Critical** (pipeline halts): `build_failure`, `security_vulnerability`, `architectural_violation`, `data_loss_risk`
- **Minor** (auto-retry): `test_failure`, `lint_error`, `review_suggestion`, `missing_test_coverage`, `style_violation`

## Pre-Write Validation

Validation is handled internally by the pipeline script. The pipeline engine calls `validator.validateTransition(current, proposed, config)` after every mutation. On validation failure, the state is NOT written — the previous valid state is preserved.

No agent needs to invoke validation manually. The pipeline script is the sole executor of validation.
