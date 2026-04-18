# Iter 4 — Requirements pipeline node

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

Iter 1 shipped the Requirements workflow under `rad-create-plans` but never wired it into the pipeline. Iter 3 removed the four legacy upstream stages that the master_plan step used to depend on. This iteration adds the one new upstream step that replaces all four: `requirements`, produced by `@planner`.

The wiring touches the same engine surfaces Iter 3 drained: `constants.ts` gets a new action + events, the planning mutation arrays in `mutations.ts` get a new entry, `context-enrichment.ts` gets a new `PLANNING_SPAWN_STEPS` entry, and a new `frontmatter-validators.ts` rule enforces `requirement_count > 0` on the `requirements_completed` event. A partial `default.yml` is seeded with just three nodes (`requirements` → `master_plan` → `plan_approval_gate`) — enough for a fresh project to drive planning end-to-end; execution-phase wiring lands in Iter 9.

The `@planner` router already has a `create_requirements` row from Iter 1 — it needs a rename or dual-route so the orchestrator's new `spawn_requirements` action resolves correctly. The brainstorm skill's memory references also update here so the brainstormer's "what planning docs exist" mental model catches up with Requirements + Master Plan being the new canonical pair.

## Scope

- Add to `constants.ts`:
  - `NEXT_ACTIONS.SPAWN_REQUIREMENTS: 'spawn_requirements'`
  - `EVENTS.REQUIREMENTS_STARTED: 'requirements_started'`
  - `EVENTS.REQUIREMENTS_COMPLETED: 'requirements_completed'`
- In `mutations.ts`, add a `[EVENTS.REQUIREMENTS_STARTED, 'requirements']` entry to `planningStartedSteps` (line ~86) and a matching entry to `planningCompletedSteps` (line ~114). The loops registering handlers pick the new event up for free.
- In `context-enrichment.ts:68-74`, add `spawn_requirements: 'requirements'` to the `PLANNING_SPAWN_STEPS` record.
- Add a new rule in `frontmatter-validators.ts` for `requirements_completed`: require `requirement_count` to be a positive integer.
- Update `.claude/agents/planner.md` router to route `spawn_requirements` → `references/requirements/workflow.md`. (Replace or supplement the existing `create_requirements` row, whichever keeps the router intent cleanest.)
- Create `.claude/skills/orchestration/templates/default.yml` with three top-level step nodes: `requirements`, `master_plan` (reusing existing action/events), `plan_approval_gate`. Template is deliberately partial; Iter 5 adds `explode_master_plan`, Iter 7+9 add the loops and closing stages.
- Add `requirements` → `Planning` entry to UI `NODE_SECTION_MAP` (`ui/components/dag-timeline/dag-timeline-helpers.ts:108-120`).

## Scope Deliberately Untouched

- `pre-reads.ts` — generic; the new event gets read by the existing `preRead` function when dispatched. A `requirements_completed`-specific pre-read block is only needed if the Requirements doc's frontmatter needs inspection beyond what the new rule covers — likely not.
- Phase/task loop nodes — still absent from `default.yml`; added in Iter 9.
- `full.yml` — untouched. It's deprecated as of Iter 3.
- Public docs — deferred to Iter 14.

## UI Impact

- **Active-project rendering**: new `requirements` node appears in the DAG timeline at the top of the pipeline, grouped under "Planning." Must render with correct status transitions (not_started → in_progress → completed) and with `doc_path` link once completed.
- **Legacy-project read-only rendering**: unchanged. Legacy projects don't have a `requirements` node; adding one to `NODE_SECTION_MAP` is purely additive and doesn't affect legacy rendering.
- **UI surfaces touched**:
  - `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120` (`NODE_SECTION_MAP`) — add `requirements: 'Planning'` entry.
  - `ui/types/state.ts:34-36` (`PLANNING_STEP_ORDER`) — add `'requirements'` to the literal union. Consumed by `ui/lib/document-ordering.ts` and `ui/lib/status-derivation.ts`; omitting this breaks ordering / status derivation for active projects with the new node.
  - Left-hand project list panel — no change. `pipeline.current_tier` values are unchanged; a project in the `requirements` step still reports `current_tier: 'planning'`.
- **UI tests**:
  - Add a fixture test rendering a scratch state.json with `requirements` node present; assert it groups under Planning and renders status correctly.
  - Add a status-transition test covering `requirements_started` → `requirements_completed` event flow's UI reflection.

## Code Surface

- Engine:
  - `.claude/skills/orchestration/scripts/lib/constants.ts` (actions + events)
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:86-120` (planning arrays)
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:68-74` (`PLANNING_SPAWN_STEPS`)
  - `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts` (new rule)
- Templates: `.claude/skills/orchestration/templates/default.yml` (new file, partial)
- Agent routing: `.claude/agents/planner.md`
- UI: `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120`
- Ripple surfaces:
  - `.claude/skills/brainstorm/SKILL.md` + `.claude/skills/brainstorm/references/*.md` — update memory references to pull from Requirements + Master Plan as canonical planning doctypes
  - `.claude/skills/orchestration/validate/lib/checks/config.js` + any test fixtures that enumerate expected actions / events
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, context, pipeline-guide}.md`
  - `.claude/skills/rad-plan/SKILL.md` — planning step listing logic picks up the new `requirements` node from the template

## Dependencies

- **Depends on**: Iter 3 — the legacy upstream stages + their actions/events must be gone before introducing the new stage cleanly.
- **Blocks**: Iter 5 — the explosion script runs after `master_plan`; `master_plan` needs its new upstream dependency (requirements) in place first.

## Testing Discipline

- **Baseline first**: run the full test suite; save the log; note baseline SHA.
- **Re-run before exit**: full suite green; diff against baseline. Tests added for the new action / event / mutation / validator-rule should be the only meaningful additions; any baseline-passing test newly failing is a regression.
- Add a focused test: a fresh scratch project dispatches `spawn_requirements`, walks to `master_plan`, fires `master_plan_completed`, and reaches `plan_approval_gate`. This is the iteration's happy-path smoke.

## Exit Criteria

- Full test suite green vs. baseline.
- New action `spawn_requirements` + events `requirements_started` / `requirements_completed` present in `constants.ts` and exercised by at least one mutation test + one event-routing test.
- `validateFrontmatter('requirements_completed', …)` rejects a doc missing `requirement_count` and accepts one with `requirement_count: 3`.
- `@planner` with `spawn_requirements` dispatch writes `{NAME}-REQUIREMENTS.md` to the project dir with valid frontmatter.
- Scratch project drives `requirements` → `master_plan` → `plan_approval_gate` end-to-end under `default.yml`.
- UI renders the new `requirements` node in the "Planning" section alongside `master_plan`.
- Brainstorm skill memory refs point at Requirements + Master Plan, not the legacy five-doc set.

## Open Questions

- **Action name convention**: codebase uses `spawn_*` for agent-spawning planning steps and `create_*` for synthesized artifacts produced inside the execution loop (e.g., `create_phase_plan`). `spawn_requirements` fits `spawn_*` — but the Iter-1 `planner.md` router uses `create_requirements`. Either rename the action to `spawn_requirements` (preferred, matches convention) or keep both routes registered briefly. Iteration planner decides and documents.
- **Pre-read for requirements_completed**: the generic `preRead()` function already validates frontmatter if a rule exists. A special-case block (like `plan_approved`'s master-plan-doc-path derivation) is probably unnecessary. Confirm during planning.
- **Partial default.yml validation**: `template-validator.ts` may reject a template with only three nodes and no loops. If so, either relax the validator or seed a minimal-but-complete stub pipeline during Iter 4 (TBD — Iter 9 completes it anyway). Decide early in Iter 4 planning.
