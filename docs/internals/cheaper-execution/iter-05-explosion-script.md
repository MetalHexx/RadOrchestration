# Iter 5 — Explosion script + state.json pre-seeding

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

The Master Plan produced in Iter 4 declares phases + tasks inlined, but the orchestrator's `phase_loop` / `task_loop` walker consumes per-phase and per-task documents on disk. This iteration bridges the two: an explosion script parses the approved Master Plan and emits the phase / task files downstream consumers already expect.

The script also pre-seeds `state.json` — specifically, the `iterations[]` arrays on `phase_loop` and `task_loop` nodes get one entry per known phase / task, with empty `nodes: {}` and populated `doc_path` pointing at the exploded files. Today the walker creates these lazily as it encounters each iteration; pre-seeding lets the UI show the full shape at plan approval and lets future parallelization work materialize each iteration without re-entering the authoring loop.

The script runs as a new pipeline action (`explode_master_plan`) between `master_plan` and `plan_approval_gate` — before humans approve, so the approver sees the fully-materialized pipeline. Frontmatter contracts for phase-plan + task-handoff docs are revised to reflect script-authored emission (e.g., `author: explosion-script`), and the existing `phase_plan_created` validator rule is adjusted to match.

## Scope

- Add to `constants.ts`:
  - `NEXT_ACTIONS.EXPLODE_MASTER_PLAN: 'explode_master_plan'`
  - `EVENTS.EXPLOSION_STARTED: 'explosion_started'`
  - `EVENTS.EXPLOSION_COMPLETED: 'explosion_completed'`
- Implement the parser + emitter as a new TypeScript module under `.claude/skills/orchestration/scripts/lib/` (e.g., `lib/explode-master-plan.ts`), exposed as a CLI subcommand via `.claude/skills/orchestration/scripts/main.ts` (following the `migrate-to-v5.ts` pattern of a standalone subcommand).
- The module:
  - Reads a Master Plan at a given path. Parses `## PNN:` headings (phases) and `### PNN-TMM:` headings (tasks).
  - Emits one file per phase: `{PROJECT}-PHASE-{NN}-{TITLE}.md` into `{PROJECT-DIR}/phases/` with frontmatter (`type: phase_plan`, `author: explosion-script`, phase metadata, `tasks: [...]` array).
  - Emits one file per task: `{PROJECT}-TASK-{PNN}-{TMM}-{TITLE}.md` into `{PROJECT-DIR}/tasks/` with frontmatter (`type: task_handoff`, `author: explosion-script`, task metadata, inlined requirement tags + steps from the Master Plan).
  - Pre-seeds `state.json` — populates `state.graph.nodes.phase_loop.iterations[i]` for each phase and each phase's `task_loop.iterations[j]` for each task, with empty `nodes: {}` and `doc_path` set to the emitted path.
  - Validates the frontmatter it wrote before exit (defense in depth alongside consumer-side pre-read validation).
- Add a mutation-registry handler in `mutations.ts` for `explosion_completed`: marks the `explode_master_plan` step as `completed`, sets its `doc_path` to the Master Plan (not the exploded outputs), and preserves the pre-seeded iterations untouched.
- Extend `orchestration-state-v5.schema.json` for additive optional fields on iteration entries:
  - `doc_path` may be populated at seed time (was previously populated only after per-iteration authoring fired).
  - `nodes: {}` is allowed to be an empty object at seed time.
- Update the `phase_plan_created` rule in `frontmatter-validators.ts` to accept script-authored phase-plan frontmatter. Add a new rule for `task_handoff_created` if the revised task-handoff contract gains validated fields (e.g., requirement_tags presence).
- Add `explode_master_plan` to `default.yml` between `master_plan` and `plan_approval_gate`.
- Add `explode_master_plan` → `Planning` to UI `NODE_SECTION_MAP`.

## Scope Deliberately Untouched

- `pre-reads.ts` — generic; the walker reads exploded docs via existing mechanisms.
- `dag-walker.ts` — no changes; the new step is a plain `kind: step` node.
- `scaffold.ts` — iteration seeding happens at explosion time, not scaffold time.
- The `context-enrichment.ts` enrichment blocks for `create_task_handoff` / `create_phase_plan` are still present — Iter 7 removes them.

## UI Impact

- **Active-project rendering**: two new surfaces:
  1. `explode_master_plan` node appears in the DAG timeline's Planning section (between `master_plan` and `plan_approval_gate`).
  2. Phase and task iterations are **pre-seeded** at plan-approval time — before any execution starts. Each iteration has `doc_path` populated (pointing at the explosion-script output) and `nodes: {}` empty. The timeline must render these iterations as "Not Started" with their doc_path link present. Per the earlier Explore survey, the v5 UI already renders iterations polymorphically from the `iterations[]` array and the `not_started` status is already supported — so this should work without code changes, but it must be test-verified.
- **Legacy-project read-only rendering**: unchanged. Pre-seeded fields are additive optional — legacy state.json lacking them still renders.
- **UI surfaces touched**:
  - `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120` (`NODE_SECTION_MAP`) — add `explode_master_plan: 'Planning'` entry.
  - `ui/types/state.ts:34-36` (`PLANNING_STEP_ORDER`) — add `'explode_master_plan'` to the literal union. Consumed by `ui/lib/document-ordering.ts` and `ui/lib/status-derivation.ts`; omitting this breaks ordering for active projects with the new node.
  - DAG timeline iteration renderer (`ui/components/dag-timeline/dag-iteration-panel.tsx` and helpers) — verify it handles pre-seeded iterations with `doc_path` populated + empty `nodes: {}` before any events have fired. The defensive guards from the v5 design audit (fallback to `Phase N` / `Task N` when doc_path parsing misses) stay relevant.
- **UI tests**:
  - Fixture test: state.json post-explosion (pre-approval) renders all phases and tasks as `not_started` with their names derived from `doc_path`.
  - Fixture test: `doc_path` links on pre-seeded iterations render as working links (anchor or button) even before execution starts.

## Code Surface

- New module: `.claude/skills/orchestration/scripts/lib/explode-master-plan.ts`
- Subcommand wiring: `.claude/skills/orchestration/scripts/main.ts`
- Engine:
  - `.claude/skills/orchestration/scripts/lib/constants.ts` (new action + events)
  - `.claude/skills/orchestration/scripts/lib/mutations.ts` (new handler)
  - `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts` (rule adjustments)
- Schema: `.claude/skills/orchestration/schemas/orchestration-state-v5.schema.json` (additive optional fields on iteration entries)
- Template: `.claude/skills/orchestration/templates/default.yml` (add explode_master_plan node)
- UI: `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120` (NODE_SECTION_MAP)
- Tests:
  - New fixture-based tests for the parser: `.claude/skills/orchestration/scripts/tests/explode-master-plan.test.ts`
  - Fixture Master Plans in `.claude/skills/orchestration/scripts/tests/fixtures/master-plans/`
  - Contract tests updated: `tests/contract/02-event-names.test.ts`, `03-action-contexts.test.ts`, `05-frontmatter-validation.test.ts`
  - Integration test: a Master Plan → exploded phase + task files → pre-seeded state.json round-trip
- Ripple surfaces:
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, pipeline-guide}.md`
  - `.claude/skills/rad-create-plans/references/requirements/workflow.md` + `master-plan/workflow.md` — add cross-reference noting the exploded outputs

## Dependencies

- **Depends on**: Iter 4 — requires the Requirements → Master Plan planning flow to exist so the explosion has valid input.
- **Blocks**: Iter 6 — the prompt regression harness exercises the full brainstorm → Requirements → Master Plan → explosion chain; harness can't smoke-test what doesn't exist.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline. The iteration adds tests (parser fixtures, integration); no baseline-passing test should newly fail.
- Parser tests must cover: well-formed Master Plan, malformed headings, missing frontmatter, empty phases, phase with zero tasks, dependency-tree ASCII parsing robustness. At least 6 parser-level test cases.

## Exit Criteria

- Full test suite green vs. baseline.
- Scratch project: `spawn_requirements` → `spawn_master_plan` → Master Plan written → `explode_master_plan` runs → `phases/` + `tasks/` populated → `state.json` shows pre-seeded `phase_loop.iterations[].doc_path` set, each with `nodes: {}`.
- A fixture Master Plan (3 phases, 8 tasks) produces exactly 3 phase files + 8 task files, no orphans, no duplicates.
- `validateFrontmatter('phase_plan_created', …)` accepts an explosion-authored phase-plan file.
- UI smoke-check: post-explosion, the pipeline's phase/task iterations render in the timeline (status = `not_started`) before plan approval.

## Open Questions

- **Explosion trigger**: is `explode_master_plan` an explicit pipeline step (my preference, observable in state.json) or an action called from within `master_plan_completed`'s mutation handler (more coupled, less visible)? Explicit step matches the design in the root doc. Iteration planner confirms and records the rationale.
- **Event naming locked**: events are `explosion_started` / `explosion_completed`. If this conflicts with other in-flight work surfaced during planning, iteration planner documents the deviation.
- **State.json seeding semantics during corrective cycles**: if a plan is rejected post-explosion and re-planning replaces the Master Plan, the pre-seeded iterations become stale. Does explosion re-run wipe+re-seed, or patch? Iteration planner decides — probably wipe+re-seed to keep the invariant simple.
- **Task-handoff frontmatter validation strength**: minimal rule (presence check) or strict (requirement_tags must reference existing Requirements IDs)? Lean minimal in this iteration; full conformance is Iter 13 (`rad-plan-audit`'s job).
