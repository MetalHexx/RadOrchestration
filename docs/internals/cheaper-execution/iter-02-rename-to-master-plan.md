# Iter 2 — Rename Execution Plan → Master Plan

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

Iter 1 introduced the `@planner` agent and two additive workflows in `rad-create-plans`: one for Requirements (`references/requirements/`), one for the inlined planning artifact (`references/execution-plan/`). Neither is wired into the pipeline yet. The legacy `references/master-plan/` folder (tactical-planner-authored, phase-only Master Plan) still sits alongside them.

This iteration performs a surface-level rename and re-type of the Iter-1 inlined artifact so it plugs into the existing `master_plan` pipeline slot with minimal-diff on engine scripts. The folder, template filename, frontmatter type, and router row all change together; the pipeline's node id (`master_plan`), dispatch action (`spawn_master_plan`), events (`master_plan_started` / `master_plan_completed`), and vocabulary ("Master Plan") stay unchanged. The artifact's name is preserved — only its content shape and authoring source change. The legacy `references/master-plan/` folder is deleted to make room for the renamed Iter-1 workflow, which takes the same folder name.

The Iter-1 template already carries `total_tasks` in its frontmatter (see `execution-plan/templates/EXECUTION-PLAN.md:7`), but the `plan_approved` validator rule currently only enforces `total_phases` — the rule is extended here to enforce `total_tasks` as well, closing the gap between what the template declares and what the validator checks.

After this iteration: `@planner` owns `spawn_master_plan` dispatch and produces `{NAME}-MASTER-PLAN.md` for a scratch project, validated against `total_phases` + `total_tasks` at the plan-approval gate. No code path references "execution plan" vocabulary inside the skill system; "Master Plan" vocabulary (which already exists in the pipeline) is now the single canonical name.

## Scope

Sequence matters — delete first, then rename into the empty slot:

1. **Delete** the legacy folder `.claude/skills/rad-create-plans/references/master-plan/` entirely (the tactical-planner-authored phase-only Master Plan workflow is obsolete; Iter 7 removes the tactical-planner agent, but its workflow folder goes now to free the name).
2. **Rename** folder: `.claude/skills/rad-create-plans/references/execution-plan/` → `master-plan/` (Iter-1's workflow moves into the now-empty slot).
3. **Rename** template file inside the new folder: `EXECUTION-PLAN.md` → `MASTER-PLAN.md`.
4. **Update** the Master Plan's frontmatter `type` field in the renamed template: `type: execution_plan` → `type: master_plan`. (`total_tasks` is already in the Iter-1 template at line 7 — no template change needed for that field.)
5. **Update** the renamed `references/master-plan/workflow.md` to set `type: master_plan` in its output contract (was `execution_plan`) and to speak in "Master Plan" vocabulary throughout.
6. **Extend** the `plan_approved` rule in `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts:22-29` to require `total_tasks` alongside the existing `total_phases` check (same positive-integer validator shape). The field exists in the template already; this step makes the pipeline actually enforce it.
7. **Update** `.claude/agents/planner.md` router table: map the pipeline action `spawn_master_plan` to `references/master-plan/workflow.md`. The existing `create_execution_plan` row is replaced, not added to.

## Ripples

- Purge "execution plan" / `execution_plan` / `EXECUTION-PLAN` phrasing (case-insensitive) across internal skill docs:
  - `.claude/skills/rad-create-plans/SKILL.md`
  - `.claude/skills/orchestration/references/document-conventions.md`
  - `.claude/skills/orchestration/references/action-event-reference.md`
  - `.claude/skills/orchestration/references/context.md`
  - `.claude/skills/orchestration/references/pipeline-guide.md`
- Update any Iter-1 smoke-test scripts or hand-drive notes that reference `EXECUTION-PLAN.md` / `type: execution_plan`.
- Update tests that assert the Iter-1 frontmatter contract (the Iter-1 baseline was `type: execution_plan` + `total_phases` + `total_tasks`; now it's `type: master_plan` + both fields, enforced).
- `rad-plan` and `rad-execute` SKILL.md files already speak in "Master Plan" vocabulary — no vocabulary change required. They may reference "Tactical Planner"; that cleanup lands in Iter 7, not here.

## Scope Deliberately Untouched

- `constants.ts` — no action/event renames. The pipeline still dispatches `spawn_master_plan` / fires `master_plan_started` / `master_plan_completed`. Minimum-diff on pipeline scripts is the design intent (root doc §2).
- `mutations.ts` — handlers for `master_plan_started` / `master_plan_completed` stay (they reference the `master_plan` node id, which is unchanged).
- `pre-reads.ts` — the `extractMasterPlanDocPath` helper stays (reads `graph.nodes.master_plan.doc_path`).
- `default.yml` — does not exist yet; building starts in Iter 4. No template work here.
- `docs/*.md` (public-facing) — deferred to Iter 14.

## UI Impact

- **Active-project rendering**: unchanged. Pipeline node id (`master_plan`), action, and events are preserved; only the skill folder and template filename rename.
- **Legacy-project read-only rendering**: unchanged. No state.json shape change.
- **UI surfaces touched**: none.
- **doc_path edge case**: the output filename changes from `{NAME}-EXECUTION-PLAN.md` to `{NAME}-MASTER-PLAN.md`. Any pre-Iter-2 scratch project that wrote a state.json pointing at `EXECUTION-PLAN.md` would have a stale `doc_path`. The refactor explicitly does NOT resume in-flight legacy projects (root doc §2 Non-Goals) — only completed projects render read-only, and completed legacy state.json files produced by `full.yml` reference `MASTER-PLAN.md` (from the old tactical-planner flow), so no rename collision exists in practice. Iter 1's smoke-test artifacts outside the repo are the only stale `doc_path` references; they're not tracked and don't affect the UI.
- **UI tests**: none required by this iteration.

## Code Surface

- Skill folders:
  - `.claude/skills/rad-create-plans/references/execution-plan/workflow.md` (rename source)
  - `.claude/skills/rad-create-plans/references/execution-plan/templates/EXECUTION-PLAN.md` (rename source)
  - `.claude/skills/rad-create-plans/references/master-plan/` (entire folder — delete; same path becomes the rename target)
- Agent + routing:
  - `.claude/agents/planner.md` (router table in the prose body)
- Validator rule:
  - `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts` (the `VALIDATION_RULES` object; `plan_approved` key currently carries one rule for `total_phases`)
- Internal docs (ripple-only edits):
  - `.claude/skills/rad-create-plans/SKILL.md`
  - `.claude/skills/orchestration/references/{document-conventions,action-event-reference,context,pipeline-guide}.md`

## Dependencies

- **Depends on**: Iter 1 (complete) — `@planner` agent + Requirements / Execution-Plan workflows already exist in `rad-create-plans/references/`.
- **Blocks**: Iter 3 — the upstream-planning removal depends on the `master_plan` slot being stably wired to the new artifact before the legacy upstream flow gets gutted.

## Testing Discipline

- **Baseline first**: before any edits, run the full test suite and save the log to the iteration worktree (e.g., `baseline-tests.log`). Note pass/fail totals and the baseline commit SHA.
- **Re-run before exit**: full test suite green; diff against baseline. Any baseline-passing test that newly fails blocks exit unless it's an expected regression under this iteration's scope (explained in the progress tracker).
- Tests modified, added, or removed alongside deliberate code changes are expected and don't count as regressions.

## Exit Criteria

- Full test suite green and diffed clean against the captured baseline (expect a handful of rename-driven test updates; no baseline-passing tests newly failing without justification).
- `type: master_plan` frontmatter with `total_tasks: <N>` round-trips through the `plan_approved` validator rule without error; a doc missing `total_tasks` produces a validation error.
- `@planner` invoked with `spawn_master_plan` action on a scratch project produces `{NAME}-MASTER-PLAN.md` (not `{NAME}-EXECUTION-PLAN.md`).
- Grep across `.claude/` for `execution plan` / `execution_plan` / `EXECUTION-PLAN` returns zero matches outside the cheaper-execution design docs and progress tracker.
- Legacy `rad-create-plans/references/master-plan/` contents (tactical-planner-authored) are gone; the folder now contains the renamed Iter-1 workflow (planner-authored inlined artifact).

## Open Questions

- **Action name**: per the Standing Design Principle "minimum-diff on pipeline scripts" (root doc §2), the action stays `spawn_master_plan`. Iteration planner confirms and documents this in the iteration's plan (no decision needed; just record that the principle applies here).
- **Planner router format**: the current `planner.md` router lists `create_requirements` / `create_execution_plan` actions. After Iter 2 the routing table needs to reflect `spawn_master_plan → references/master-plan/workflow.md`. Whether `create_requirements` also renames (e.g., to `spawn_requirements`) is an Iter 4 concern, not this iteration.
