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
  - `EVENTS.EXPLOSION_FAILED: 'explosion_failed'` (parse-failure recovery loop — see "Recovery loop" below)
- Implement the parser + emitter as a standalone TypeScript module: `.claude/skills/orchestration/scripts/lib/explode-master-plan.ts` (the parsing + emission + state-seeding logic, importable + unit-testable). Pair with a thin sibling CLI wrapper `.claude/skills/orchestration/scripts/explode-master-plan.ts` (mirrors the `migrate-to-v5.ts` pattern — argv parsing → calls into the lib module → exit code). NOT a subcommand of `main.ts` — `main.ts` is `--event`-only today and we don't add subcommand routing in this iteration.
- Trigger: orchestrator sees the `explode_master_plan` action, runs `node .../scripts/explode-master-plan.js {project-dir}` via Bash, then dispatches the appropriate event via the standard `--event` path:
  - **Success** → `explosion_completed`.
  - **Parse failure** (malformed Master Plan — recoverable) → `explosion_failed` with structured error info (line number, expected, found, brief message). Triggers the recovery loop (see below).
  - **Real failure** (filesystem, permissions, write error, frontmatter validation failure on script-emitted docs — the latter being a script bug, not a planner problem) → script throws non-zero exit + stderr; orchestrator surfaces via the existing `log-error` skill; pipeline halts.
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
- **Recovery loop on parse failure** — planner self-correction, no human intervention:
  - When the script emits `explosion_failed`, a new mutation handler:
    - Resets `explode_master_plan` step status to `not_started`.
    - Flips `master_plan` step status back to `in_progress`.
    - Stores the parse error on the master_plan node: `state.graph.nodes.master_plan.last_parse_error: { line, expected, found, message }` (additive optional schema field).
    - Increments `state.graph.nodes.master_plan.parse_retry_count` (additive optional, starts at 0). **Counter location is provisional** — see Open Questions; finalized in the configurability iteration.
    - If `parse_retry_count > MAX_PARSE_RETRIES` (hardcoded constant `= 3` in this iteration), DO NOT re-spawn — instead halt the pipeline via `log-error` with "planner cannot produce parseable Master Plan after N attempts; manual intervention required." Configurability of the cap is deferred to the new iteration before public-facing docs (see root design timeline).
    - Otherwise, re-dispatch `spawn_master_plan` to re-spawn @planner.
  - On `explosion_completed`: clear `last_parse_error` and reset `parse_retry_count` to 0.
- `@planner`'s `spawn_master_plan` workflow (`.claude/skills/rad-create-plans/references/master-plan/workflow.md`) gains a small "if `state.graph.nodes.master_plan.last_parse_error` is populated, the previous attempt failed parsing — read the error from state, fix the specific issue (line number + expected/found), and re-emit the Master Plan" branch. Workflow already reads state.json; no `context-enrichment.ts` change needed.
- Add a mutation-registry handler in `mutations.ts` for `explosion_completed`: marks the `explode_master_plan` step as `completed`, sets its `doc_path` to the Master Plan (not the exploded outputs), preserves the pre-seeded iterations untouched, AND clears `last_parse_error` + resets `parse_retry_count` on the master_plan node.
- Extend `orchestration-state-v5.schema.json` — additive optional fields:
  - `doc_path` (`string | null`) on the `IterationEntry` definition.
  - `last_parse_error` (`{ line: number, expected: string, found: string, message: string } | null`) on the `master_plan` node-state shape.
  - `parse_retry_count` (`integer | null`, default 0) on the `master_plan` node-state shape.
  All three additive only — legacy state.json without these fields stays valid. The existing `nodes: NodesRecord` schema already permits an empty object.
- `frontmatter-validators.ts`: NO change needed. The existing `phase_plan_created` rule only validates `tasks: [...]` non-empty array; it doesn't constrain the `author` field, so script-authored docs pass. Skip the `task_handoff_created` rule entirely — defer to Iter 14 (`rad-plan-audit` overhaul) which owns conformance.
- Add `explode_master_plan` to `default.yml` between `master_plan` and `plan_approval_gate`. The 4-node `step → step → step → gate` chain validates because `template-loader.ts` already filters the misnamed `unreachable_node` warning on terminal gates (per Iter 4's deviation log).
- Add `explode_master_plan` → `Planning` to UI `NODE_SECTION_MAP`. Add `explode_master_plan` to `PlanningStepName` union and `PLANNING_STEP_ORDER` in `ui/types/state.ts` — three downstream `Record<PlanningStepName, string>` consumers (`document-ordering.ts` STEP_TITLES + STEP_TITLES_V5, `planning-checklist.tsx` STEP_DISPLAY_NAMES) require exhaustiveness updates as TypeScript compile-time consequences (per Iter 4's pattern).

## Scope Deliberately Untouched

- `pre-reads.ts` — generic; the walker reads exploded docs via existing mechanisms.
- `dag-walker.ts` — no changes; the new step is a plain `kind: step` node.
- `scaffold.ts` — iteration seeding happens at explosion time, not scaffold time.
- The `context-enrichment.ts` enrichment blocks for `create_task_handoff` / `create_phase_plan` are still present — Iter 7 removes them. Verified at plan time; explosion does not interact with those blocks.
- `main.ts` subcommand routing — not added. The CLI wrapper is a sibling script.
- New `task_handoff_created` validator rule — not added. Conformance is Iter 14's job.
- **Explosion-retry configurability** — NOT in this iteration. The retry cap is a hardcoded constant. A new iteration (slotted before public-facing docs in the timeline) introduces `orchestration.yml` config field + validator rule + `/configure-system` skill prompt + installer interactive prompt. Defer to that iteration so the configuration UX (skill workflow, installer prompt ergonomics, validator bounds) gets proper attention.
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
  - `.claude/skills/orchestration/scripts/lib/constants.ts` — add `EXPLODE_MASTER_PLAN` to `NEXT_ACTIONS` (between `SPAWN_MASTER_PLAN` and `REQUEST_PLAN_APPROVAL`); add `EXPLOSION_STARTED` / `EXPLOSION_COMPLETED` / `EXPLOSION_FAILED` to `EVENTS` (after `MASTER_PLAN_COMPLETED`, before `PLAN_APPROVED`). Names verified clean — not used anywhere today.
  - `.claude/skills/orchestration/scripts/lib/mutations.ts` — add `explosion_completed` handler (clears last_parse_error + retry counter) after `master_plan_completed` (current pattern at lines ~111-131 — add to `planningCompletedSteps` array). Add `explosion_failed` handler that resets explode_master_plan to not_started, flips master_plan back to in_progress, stores parse error, increments retry counter, gates on cap.
  - `.claude/skills/rad-create-plans/references/master-plan/workflow.md` — add the "if last_parse_error is populated, fix the specific issue" branch.
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
- Recovery loop integration test: feed the malformed fixture, assert `explosion_failed` event fires with structured error, mutation handler resets master_plan to in_progress and stores last_parse_error, retry counter increments. Then feed the well-formed fixture (simulating planner correction), assert `explosion_completed` clears the error and resets the counter. Cap-exceeded test: drive 4 consecutive parse failures, assert pipeline halts via log-error after the cap (not infinite-looping).

## Exit Criteria

- Full test suite green vs. baseline across all three trees.
- Scratch project: `spawn_requirements` → `spawn_master_plan` → Master Plan written → `explode_master_plan` runs → `phases/` + `tasks/` populated → `state.json` shows pre-seeded `phase_loop.iterations[].doc_path` set, each with `nodes: {}`.
- A fixture Master Plan (3 phases, 8 tasks) produces exactly 3 phase files + 8 task files, no orphans, no duplicates.
- Re-run on a project with existing `phases/` + `tasks/` moves them to `backups/{ISO-timestamp}/` and emits fresh files. Parse failure on the new Master Plan leaves the filesystem untouched.
- Recovery loop: malformed Master Plan → `explosion_failed` → master_plan re-spawned with last_parse_error in state → @planner reads + corrects → `explosion_completed` → pipeline proceeds. Retry cap (hardcoded 3) enforced — fourth consecutive parse failure halts via log-error.
- `validateFrontmatter('phase_plan_created', …)` accepts an explosion-authored phase-plan file (existing rule unchanged — verified at plan time).
- **Manual browser smoke completed** per the Standing Design Principle: `ui/.env.local` written, dev server boots clean, new node renders in Planning section, pre-seeded iterations render with `not_started` status + working doc_path links, legacy state.json renders cleanly, zero new console errors. PR description records verification (screenshot or terse note).
- `backups/` added to per-project `.gitignore` source.

## Open Questions

Resolved at plan time:

- **Explosion trigger** — RESOLVED: explicit pipeline step `explode_master_plan`. Orchestrator runs the script as a Bash subprocess via the standard "next action" path, then dispatches `explosion_completed` / `explosion_failed` via `--event`. No `main.ts` subcommand routing added.
- **Event naming** — LOCKED: `explosion_started` / `explosion_completed` / `explosion_failed`. Verified clean, no conflicts.
- **State.json seeding semantics during corrective cycles** — RESOLVED: wipe-and-re-seed (with full move-to-backup of `phases/` + `tasks/` for safety). Parse-first ordering protects against malformed re-plan leaving the user with no docs.
- **Task-handoff frontmatter validation strength** — RESOLVED: no `task_handoff_created` rule introduced this iteration. Conformance (cross-doc requirement-ID coverage) is Iter 14's job.
- **Failure surface** — RESOLVED: split. Parse failure → `explosion_failed` event → planner self-correction loop. Real failure (filesystem / permissions / script's own emitted-doc validation) → script throws → orchestrator surfaces via `log-error` skill → halt.

Deferred (revisit during the configurability iteration before public-facing docs):

- **Retry counter location**: Iter 5 stores `parse_retry_count` on the `master_plan` node. Provisional — could move to a dedicated counter object on the explode_master_plan node, or to `state.metadata`, when the configurability iteration formalizes the contract. Decide once we have evidence on how often the loop fires and what observability the UI needs.
- **Configurability surface design**: how the new `orchestration.yml` field (`explosion_max_retries`) plumbs through validator + `/configure-system` skill prompt + installer interactive prompt. Each surface has UX decisions (default value, validation bounds, prompt copy) that deserve their own iteration's attention.
- **Should the recovery loop also catch frontmatter-validation failures on script-emitted docs?** Iter 5 says no (those are script bugs, not planner problems). Reconsider if real-world usage shows the planner sometimes produces input that causes valid emission but invalid frontmatter on the scripted output — that would mean the parser is too permissive, which is a bug in a different place.
