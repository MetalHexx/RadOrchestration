# Iter 10 — Task-level corrective cycles (orchestrator mediation)

> **Status**: shell file. Full content authored in a subsequent planning wave. The architectural source-of-truth is [`../CORRECTIVE-CYCLES-REDESIGN.md`](../CORRECTIVE-CYCLES-REDESIGN.md); when this companion is fleshed out it will inline everything the iteration planner needs — the redesign doc is a reference, not a required read at planning time.

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

_TBD — authored in next planning wave._

Headline: elevate the orchestrator from dispatcher to mediator for task-level review cycles. When `code_review` returns `changes_requested`, the orchestrator reads the review doc, judges each finding (action vs. decline with cross-artifact rationale), appends an addendum to the review doc capturing each disposition, and — if at least one finding is actioned — authors a fresh self-contained corrective task handoff under `tasks/` (`{NAME}-TASK-P{NN}-T{NN}-{TITLE}-C{N}.md`). `CODE_REVIEW_COMPLETED` rewires from auto-birth-on-verdict to birth-on-handoff-path; corrective entries carry a pre-completed `task_handoff` sub-node pointing at the authored file. Reviewer workflows shed prior-review reads and the expected-corrections mechanism. Budget stays `max_retries_per_task`.

## Scope

_TBD._

Expected surfaces (drawn from `CORRECTIVE-CYCLES-REDESIGN.md`, validate during planning):

- New reference doc: `.claude/skills/orchestration/references/corrective-playbook.md`
- Orchestrator agent definition (`.claude/agents/orchestrator.md`) — narrow write surface for addenda + corrective handoffs
- `scripts/lib/mutations.ts` — `CODE_REVIEW_COMPLETED` handler rewire; template-aware scaffolding; `task_handoff` sub-node synthesis
- `scripts/lib/context-enrichment.ts` — `execute_task` enrichment routes `handoff_doc` to the active task-scope corrective
- `scripts/lib/frontmatter-validators.ts` — validation rules for `effective_outcome` / `orchestrator_mediated`
- `skills/code-review/task-review/workflow.md` — remove Corrective-review check + Corrective Review Context + expected-corrections
- Orchestration skill docs — SKILL.md, context.md, pipeline-guide.md, action-event-reference.md, document-conventions.md (corrective handoff naming + frontmatter)

## Scope Deliberately Untouched

_TBD._

- Phase-level corrective cycles — Iter 11.
- Final-level corrective cycles — out of scope for the refactor entirely.
- Code-review diff-based rework — Iter 12.
- Executor input-contract narrowing — Iter 13.

## UI Impact

_TBD._

Expected: additive rendering on `orchestrator_mediated: true` review docs (optional mediated badge); no breaking UI shape changes. Legacy state.json renders unchanged.

## Code Surface

_TBD — validate the CORRECTIVE-CYCLES-REDESIGN.md "Orchestration skill touchpoints" section against live code during planning._

## Dependencies

- **Depends on**: Iter 9 — `default.yml` must carry the execution-phase node graph (task_loop → executor → commit → code_review → task_gate) so task-level corrective cycles have a working pipeline to exercise.
- **Blocks**: Iter 11 — phase-level corrective cycles extend this iteration's mediation pattern (same mutation handler shape, same playbook, same walker traversal) to phase scope.

## Testing Discipline

_TBD — standard baseline + re-run discipline applies; detailed test rework is captured in the redesign doc's Test Surface section and expanded in next wave._

## Exit Criteria

_TBD._

Headline: test suite green vs. baseline; scratch task with a deliberately broken first attempt round-trips through orchestrator mediation → fresh corrective handoff → fix commit → reviewer re-approval, with the review doc carrying an addendum recording each finding's disposition.

## Open Questions

_TBD — surfaced during detailed content authoring._
