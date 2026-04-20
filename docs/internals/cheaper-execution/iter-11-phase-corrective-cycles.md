# Iter 11 — Phase-level corrective cycles

> **Status**: shell file. Full content authored in a subsequent planning wave. The architectural source-of-truth is [`../CORRECTIVE-CYCLES-REDESIGN.md`](../CORRECTIVE-CYCLES-REDESIGN.md); when this companion is fleshed out it will inline everything the iteration planner needs — the redesign doc is a reference, not a required read at planning time.

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

_TBD — authored in next planning wave._

Headline: extend the Iter-10 mediation pattern to phase scope. On `phase_review changes_requested`, the orchestrator authors a phase-scope corrective task handoff (`{NAME}-TASK-P{NN}-PHASE-C{N}.md`) and appends it to `phase_iteration.corrective_tasks[]`. The walker re-enters the phase iteration for just that corrective task, using the standard task-body (executor → commit → code_review → task_gate). Once its task-level review approves, the phase iteration completes — **phase_review does not re-run**. The same `max_retries_per_task` budget bounds phase-iteration arrays independently of task-iteration arrays.

## Scope

_TBD._

Expected surfaces (drawn from `CORRECTIVE-CYCLES-REDESIGN.md`, validate during planning):

- `scripts/lib/mutations.ts` — `PHASE_REVIEW_COMPLETED` handler rewrite (drop phase-iteration-reset block; append one corrective task); `COMMIT_COMPLETED` phase-scope corrective routing; `resolveNodeState` comment/logic update for phase-level correctives with pre-seeded nodes
- `scripts/lib/dag-walker.ts` — remove the empty-nodes halt stub (~lines 171-184); re-enable phase-corrective re-entry; close the `dag-walker.ts:124` stub from Iter 7
- `scripts/lib/context-enrichment.ts` — `spawn_code_reviewer` enrichment extended to resolve `head_sha` / `is_correction` / `corrective_index` against `phaseIter.corrective_tasks[]` when walking a phase-scope corrective
- `skills/code-review/phase-review/workflow.md` — remove Corrective-review check, Corrective Review Context, expected-corrections; add Requirements to Inputs; drop stale PRD/Architecture/Design rows; parallel named-sentinel save-path for phase-scope correctives
- Skipped tests from Iter 7 (see CORRECTIVE-CYCLES-REDESIGN.md Test surface) — un-skip against append-based walker contract
- Orchestration skill docs — ripple updates for phase-scope corrective filename pattern, payload shape

## Scope Deliberately Untouched

_TBD._

- Task-level mediation plumbing — landed in Iter 10.
- Final-level corrective cycles — out of scope entirely.
- Code-review diff-based rework — Iter 12.
- Executor rework — Iter 13.

## UI Impact

_TBD._

Expected: phase-level correctives become operational, so the DAG timeline's phase-iteration panel grows new entries during a review cycle. Legacy state.json without phase-level correctives must continue to render unchanged.

## Code Surface

_TBD — validate the CORRECTIVE-CYCLES-REDESIGN.md "Orchestration skill touchpoints" section against live code during planning._

## Dependencies

- **Depends on**: Iter 10 — task-level mediation, orchestrator agent definition, corrective-playbook reference, and the `task_handoff` sub-node synthesis pattern must be in place. This iteration mostly reuses the same machinery and extends routing/walker handling to phase scope.
- **Blocks**: Iter 12 — code-review diff-based rework benefits from having both task + phase corrective cycles stable before it narrows the reviewer's input surface.

## Testing Discipline

_TBD — standard baseline + re-run discipline applies; the four dag-walker/corrective-integration tests skipped in Iter 7 must be un-skipped (or replaced) as part of this iteration's exit criteria._

## Exit Criteria

_TBD._

Headline: test suite green vs. baseline; scratch project with a failing `phase_review` round-trips through orchestrator mediation → phase-scope corrective task → task-level review approval → phase iteration completes without `phase_review` re-running.

## Open Questions

_TBD — surfaced during detailed content authoring._
