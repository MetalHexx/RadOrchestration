# Iter 5 — Explosion script + state.json pre-seeding

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → amend this companion directly (commit message carries the reason). Do NOT touch the progress tracker during planning — that doc is for execution outcomes only. Do not plan on stale assumptions.

## Overview

The Master Plan produced in Iter 4 declares phases + tasks inlined, but the orchestrator's `phase_loop` / `task_loop` walker consumes per-phase and per-task documents on disk. This iteration bridges the two: an explosion script parses the approved Master Plan and emits the phase / task files downstream consumers already expect.

The script also pre-seeds `state.json` — specifically, the `iterations[]` arrays on `phase_loop` and `task_loop` nodes get one entry per known phase / task, with empty `nodes: {}` and populated `doc_path` pointing at the exploded files. Today the walker creates these lazily as it encounters each iteration; pre-seeding lets the UI show the full shape at plan approval and lets future parallelization work materialize each iteration without re-entering the authoring loop.

The script runs as a new pipeline action (`explode_master_plan`) between `master_plan` and `plan_approval_gate` — before humans approve, so the approver sees the fully-materialized pipeline. Frontmatter contracts for phase-plan + task-handoff docs are revised to reflect script-authored emission (e.g., `author: explosion-script`); the existing `phase_plan_created` validator rule is already permissive (only checks `tasks: [...]` non-empty array — verified at plan time), so no validator change is required.

**Why pre-seed `doc_path`**: this is the mechanical seam that unlocks Iter 7. Today the per-iteration authoring agents (`create_phase_plan` / `create_task_handoff`) exist purely to populate `doc_path` lazily as iterations open. Once the explosion script pre-populates every iteration's `doc_path` at plan-approval time, those agents have nothing left to do — Iter 7 deletes them entirely. Without pre-seeding, the engine still needs an authoring step per iteration.

## Scope

- Add to `constants.ts`:
  - `NEXT_ACTIONS.EXPLODE_MASTER_PLAN: 'explode_master_plan'`
  - `EVENTS.EXPLOSION_STARTED: 'explosion_started'`
  - `EVENTS.EXPLOSION_COMPLETED: 'explosion_completed'`
- Implement the parser + emitter as a standalone TypeScript module: `.claude/skills/orchestration/scripts/lib/explode-master-plan.ts` (the parsing + emission + state-seeding logic, importable + unit-testable). Pair with a thin sibling CLI wrapper `.claude/skills/orchestration/scripts/explode-master-plan.ts` (mirrors the `migrate-to-v5.ts` pattern — argv parsing → calls into the lib module → exit code). NOT a subcommand of `main.ts` — `main.ts` is `--event`-only today and we don't add subcommand routing in this iteration.
- Trigger: orchestrator sees the `explode_master_plan` action, runs `node .../scripts/explode-master-plan.js {project-dir}` via Bash, then dispatches `explosion_completed` via the standard `--event` path on success. On failure the script throws (non-zero exit + stderr) and the orchestrator surfaces it via the existing `log-error` skill — NO new `EXPLOSION_FAILED` event is introduced.
- The lib module:
  - Reads a Master Plan at a given path. Parses `## P{NN}:` headings (phases) and `### P{NN}-T{MM}:` headings (tasks). Verified at plan time against `MASTER-PLAN.md` template.
  - Emits one file per phase: `{PROJECT}-PHASE-{NN}-{TITLE}.md` into `{PROJECT-DIR}/phases/` with frontmatter (`type: phase_plan`, `author: explosion-script`, phase metadata, `tasks: [...]` array).
  - Emits one file per task: `{PROJECT}-TASK-{PNN}-{TMM}-{TITLE}.md` into `{PROJECT-DIR}/tasks/` with frontmatter (`type: task_handoff`, `author: explosion-script`, task metadata, inlined requirement tags + steps from the Master Plan).
  - Pre-seeds `state.json` — populates `state.graph.nodes.phase_loop.iterations[i]` for each phase and each phase's `task_loop.iterations[j]` for each task, with empty `nodes: {}` and `doc_path` set to the emitted path.
  - Frontmatter-validates each emitted doc via the existing `validateFrontmatter()` before exit (defense in depth — cheap, catches contract drift early).
- **Wipe-and-re-seed on re-run** (when the script runs against a project that already has `phases/` + `tasks/` from a prior planning cycle):
  - **Parse first**: parse + validate the new Master Plan BEFORE touching the filesystem. If parsing fails, the script aborts with no side effects — the user keeps their existing docs.
  - **Move-to-backup, not delete**: relocate the entire contents of `{PROJECT-DIR}/phases/` and `{PROJECT-DIR}/tasks/` to `{PROJECT-DIR}/backups/{ISO-timestamp}/phases/` + `.../tasks/`. No filename pattern matching — move everything in those folders. Hand-edited docs land in the backup folder where the user can recover them.
  - **Reseed iterations**: `phase_loop.iterations = []` and inner `task_loop.iterations = []` get reset before re-seed. No surgical patching of stale entries.
  - **Gitignore**: append `backups/` to whatever per-project gitignore the orchestration scaffold produces (verify at plan time which file owns this — likely the project-template `.gitignore` shipped by the installer / scaffold). One-line addition.
- Add a mutation-registry handler in `mutations.ts` for `explosion_completed`: marks the `explode_master_plan` step as `completed`, sets its `doc_path` to the Master Plan (not the exploded outputs), and preserves the pre-seeded iterations untouched (the script wrote them; the mutation doesn't re-touch them).
- Extend `orchestration-state-v5.schema.json` — add optional `doc_path` field (`string | null`) to the `IterationEntry` definition. The existing `nodes: NodesRecord` schema already permits an empty object, so no change there. Additive only — legacy state.json without the field stays valid.
- `frontmatter-validators.ts`: NO change needed. The existing `phase_plan_created` rule only validates `tasks: [...]` non-empty array; it doesn't constrain the `author` field, so script-authored docs pass. Skip the `task_handoff_created` rule entirely — defer to Iter 13 (`rad-plan-audit` overhaul) which owns conformance.
- Add `explode_master_plan` to `default.yml` between `master_plan` and `plan_approval_gate`. The 4-node `step → step → step → gate` chain validates because `template-loader.ts` already filters the misnamed `unreachable_node` warning on terminal gates (per Iter 4's deviation log).
- Add `explode_master_plan` → `Planning` to UI `NODE_SECTION_MAP`. Add `explode_master_plan` to `PlanningStepName` union and `PLANNING_STEP_ORDER` in `ui/types/state.ts` — three downstream `Record<PlanningStepName, string>` consumers (`document-ordering.ts` STEP_TITLES + STEP_TITLES_V5, `planning-checklist.tsx` STEP_DISPLAY_NAMES) require exhaustiveness updates as TypeScript compile-time consequences (per Iter 4's pattern).

## Scope Deliberately Untouched

- `pre-reads.ts` — generic; the walker reads exploded docs via existing mechanisms.
- `dag-walker.ts` — no changes; the new step is a plain `kind: step` node.
- `scaffold.ts` — iteration seeding happens at explosion time, not scaffold time.
- The `context-enrichment.ts` enrichment blocks for `create_task_handoff` / `create_phase_plan` are still present — Iter 7 removes them. Verified at plan time; explosion does not interact with those blocks.
- `main.ts` subcommand routing — not added. The CLI wrapper is a sibling script.
- New `EXPLOSION_FAILED` event — not added. Failures use the existing `log-error` skill path.
- New `task_handoff_created` validator rule — not added. Conformance is Iter 13's job.
- Tactical-planner authoring path (`create_phase_plan` / `create_task_handoff` actions + agent) — still present. Iter 7 removes it. For Iter 5, the explosion script and the legacy authoring path both produce phase/task files; only `default.yml` triggers the explosion.

## UI Impact

- **Active-project rendering**: two new surfaces:
  1. `explode_master_plan` node appears in the DAG timeline's Planning section (between `master_plan` and `plan_approval_gate`).
  2. Phase and task iterations are **pre-seeded** at plan-approval time — before any execution starts. Each iteration has `doc_path` populated (pointing at the explosion-script output) and `nodes: {}` empty. The timeline must render these iterations as "Not Started" with their doc_path link present. Verified at plan time: `dag-iteration-panel.tsx` already handles this defensively (parses iteration name from `doc_path`, falls back to `Phase N` / `Task N`, empty `nodes: {}` produces an empty child loop) — no rendering code change needed, but test-verify before exit.
- **Legacy-project read-only rendering**: unchanged. Pre-seeded fields are additive optional — legacy state.json lacking them still renders.
- **UI surfaces touched** (verified post-Iter-4):
  - `ui/components/dag-timeline/dag-timeline-helpers.ts:108-120` (`NODE_SECTION_MAP`, now includes Iter 4's `requirements: 'Planning'`) — add `explode_master_plan: 'Planning'` entry.
  - `ui/types/state.ts:10` (`PlanningStepName` union) — add `'explode_master_plan'`.
  - `ui/types/state.ts:34-36` (`PLANNING_STEP_ORDER` array) — add `'explode_master_plan'` after `'master_plan'`.
  - Three exhaustiveness consumers (Iter 4's pattern — TypeScript compile-time):
    - `ui/lib/document-ordering.ts` `STEP_TITLES` record — add `explode_master_plan` key.
    - `ui/lib/document-ordering.ts` `STEP_TITLES_V5` record — add `explode_master_plan` key.
    - `ui/components/planning/planning-checklist.tsx` `STEP_DISPLAY_NAMES` record — add `explode_master_plan` key.
- **UI tests**:
  - Fixture test: state.json post-explosion (pre-approval) renders all phases and tasks as `not_started` with their names derived from `doc_path`.
  - Fixture test: `doc_path` links on pre-seeded iterations render as working links (anchor or button) even before execution starts.
  - Legacy-project regression test: a state.json without `explode_master_plan` node + without pre-seeded `doc_path` on iterations still renders cleanly.
- **Manual browser smoke (REQUIRED — see root design's Standing Design Principles)**: write `ui/.env.local` with `WORKSPACE_ROOT=<absolute path>` and `ORCH_ROOT=.claude` (snippet inlined in the iteration's plan file), `cd ui && npm run build && npm run dev`, verify in browser: new `explode_master_plan` node renders in Planning section; pre-seeded phase/task iterations render as Not Started with doc_path links; legacy state.json renders cleanly; zero new console errors. PR description records the verification.

## Code Surface

- **New files**:
  - `.claude/skills/orchestration/scripts/lib/explode-master-plan.ts` — parser + emitter + state-seeder lib module (importable, unit-testable).
  - `.claude/skills/orchestration/scripts/explode-master-plan.ts` — thin CLI wrapper, mirrors `migrate-to-v5.ts` shape (argv parse → call lib → exit code).
  - `.claude/skills/orchestration/scripts/tests/explode-master-plan.test.ts` — parser + emitter unit tests.
  - `.claude/skills/orchestration/scripts/tests/fixtures/master-plans/well-formed.md` — minimal valid Master Plan (3 phases × 2-3 tasks).
  - `.claude/skills/orchestration/scripts/tests/fixtures/master-plans/malformed.md` — broken Master Plan (e.g., missing phase heading, unparseable task ID) — parser must reject cleanly.
- **Engine** (verified post-Iter-4):
  - `.claude/skills/orchestration/scripts/lib/constants.ts` — add `EXPLODE_MASTER_PLAN` to `NEXT_ACTIONS` (between `SPAWN_MASTER_PLAN` and `REQUEST_PLAN_APPROVAL`); add `EXPLOSION_STARTED` / `EXPLOSION_COMPLETED` to `EVENTS` (after `MASTER_PLAN_COMPLETED`, before `PLAN_APPROVED`). Names verified clean — not used anywhere today.
  - `.claude/skills/orchestration/scripts/lib/mutations.ts` — add `explosion_completed` handler after `master_plan_completed` (current pattern at lines ~111-131 — add to `planningCompletedSteps` array).
- **Schema**: `.claude/skills/orchestration/schemas/orchestration-state-v5.schema.json` — add optional `doc_path` (`string | null`) to `IterationEntry` definition (currently around line 332-374).
- **Template**: `.claude/skills/orchestration/templates/default.yml` — add `explode_master_plan` step node between `master_plan` (line ~41) and `plan_approval_gate` (line ~45). 4-node chain validates without `template-validator.ts` change (Iter 4 deviation).
- **UI**: see UI Impact section above for the 5 file edits.
- **Tests**:
  - Parser unit tests via the two fixtures above (well-formed → emits expected files + state; malformed → throws with clear error). Bundle ≥ 6 cases per the testing discipline section.
  - Re-run integration test: pre-stage `phases/` + `tasks/` with old files, run explosion against a different Master Plan, assert old files at `backups/{timestamp}/`, new files in `phases/` + `tasks/`, iterations re-seeded.
  - Contract tests updated: `tests/contract/02-event-names.test.ts` (add 2 events), `03-action-contexts.test.ts` (add `explode_master_plan` action), `06-state-mutations.test.ts` (add `explosion_completed` handler).
  - Schema test if one exists for `IterationEntry` shape.
- **Ripple surfaces** (verify at plan time):
  - `.claude/skills/orchestration/references/action-event-reference.md` — insert `explode_master_plan` action row above `request_plan_approval`; insert matching `explosion_started` / `explosion_completed` event rows.
  - `.claude/skills/orchestration/references/document-conventions.md` — already documents phase-plan / task-handoff filename patterns + `author` field; verify no edit needed (likely none).
  - `.claude/skills/orchestration/references/pipeline-guide.md` — add a forward-reference noting that post-master-plan the script emits the per-phase / per-task files (only if the existing prose discusses planning ordering at all).
  - `.claude/skills/rad-create-plans/references/requirements/workflow.md` + `master-plan/workflow.md` — optional cross-reference; defer if scope is tight.
  - Per-project `.gitignore` source-of-truth (likely `installer/templates/` or scaffold output) — add `backups/` entry. Verify at plan time which file the scaffold copies into projects.

## Dependencies

- **Depends on**: Iter 4 — requires the Requirements → Master Plan planning flow to exist so the explosion has valid input.
- **Blocks**: Iter 6 — the prompt regression harness exercises the full brainstorm → Requirements → Master Plan → explosion chain; harness can't smoke-test what doesn't exist.

## Testing Discipline

- **Baseline first**: full suite + log + SHA across all three trees (orchestration/scripts, ui, installer).
- **Re-run before exit**: full suite green; diff against baseline. The iteration adds tests (parser fixtures, re-run integration); no baseline-passing test should newly fail.
- Parser tests use the two-fixture pair (well-formed + malformed) as the load-bearing pair. Round it out to ≥ 6 cases covering: missing phase heading, unparseable task ID, empty phase, phase with zero tasks, dependency-tree ASCII parsing robustness, and round-trip (parse → emit → re-parse identity).
- Re-run integration test asserts: old `phases/` + `tasks/` contents land under `backups/{timestamp}/` (full move, not pattern-matched), fresh files emitted, iterations re-seeded, parse-failure aborts cleanly without touching the filesystem.

## Exit Criteria

- Full test suite green vs. baseline across all three trees.
- Scratch project: `spawn_requirements` → `spawn_master_plan` → Master Plan written → `explode_master_plan` runs → `phases/` + `tasks/` populated → `state.json` shows pre-seeded `phase_loop.iterations[].doc_path` set, each with `nodes: {}`.
- A fixture Master Plan (3 phases, 8 tasks) produces exactly 3 phase files + 8 task files, no orphans, no duplicates.
- Re-run on a project with existing `phases/` + `tasks/` moves them to `backups/{ISO-timestamp}/` and emits fresh files. Parse failure on the new Master Plan leaves the filesystem untouched.
- `validateFrontmatter('phase_plan_created', …)` accepts an explosion-authored phase-plan file (existing rule unchanged — verified at plan time).
- **Manual browser smoke completed** per the Standing Design Principle: `ui/.env.local` written, dev server boots clean, new node renders in Planning section, pre-seeded iterations render with `not_started` status + working doc_path links, legacy state.json renders cleanly, zero new console errors. PR description records verification (screenshot or terse note).
- `backups/` added to per-project `.gitignore` source.

## Open Questions

All resolved at plan time:

- **Explosion trigger** — RESOLVED: explicit pipeline step `explode_master_plan`. Orchestrator runs the script as a Bash subprocess via the standard "next action" path, then dispatches `explosion_completed` via `--event`. No `main.ts` subcommand routing added.
- **Event naming** — LOCKED: `explosion_started` / `explosion_completed`. Verified clean, no conflicts.
- **State.json seeding semantics during corrective cycles** — RESOLVED: wipe-and-re-seed (with full move-to-backup of `phases/` + `tasks/` for safety). Parse-first ordering protects against malformed re-plan leaving the user with no docs.
- **Task-handoff frontmatter validation strength** — RESOLVED: no `task_handoff_created` rule introduced this iteration. Conformance (cross-doc requirement-ID coverage) is Iter 13's job.
- **Failure surface** — RESOLVED: script throws on parse / write / validation failure; orchestrator catches via existing `log-error` skill. No new `EXPLOSION_FAILED` event.
