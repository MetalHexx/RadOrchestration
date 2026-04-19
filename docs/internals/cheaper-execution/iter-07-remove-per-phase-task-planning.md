# Iter 7 — Remove per-phase/per-task planning (tactical-planner + phase-plan/task-handoff folders)

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

With Iter 5's explosion script in place, phase-plan and task-handoff documents exist on disk before the execution loop starts — no per-iteration agent authoring is needed. This iteration guts the legacy path: the tactical-planner agent, its `rad-create-plans` workflow folders, the per-loop authoring nodes (`phase_planning`, `task_handoff`), their actions / events / mutations, and their context-enrichment blocks all go.

The trickiest bit is the `execute_task` action's context enrichment (`context-enrichment.ts:211-219`). Today it reads a `task_handoff` node's `doc_path` from the task iteration via an in-loop authoring step. After this iteration, authoring is gone — but the task iteration still carries a pre-seeded `task_handoff` child step node at `taskIter.nodes['task_handoff']` (populated by the explosion script in Iter 5, status `completed`). The enrichment continues to read `taskIter.nodes['task_handoff'].doc_path`; the only change is that the value arrives via pre-seeding rather than via an authoring dispatch.

`dag-walker.ts` has two `phase_planning` references that need attention: (a) `resolveDocRefInScope` at line 124 hardcodes a `phase_planning` lookup for `$.current_phase.{field}` template refs — a template-resolution helper, not corrective-cycle logic; (b) the actual phase-level corrective re-planning path at lines 171-194 walks the phase body against `iteration.nodes` and re-enters `create_phase_plan` via `phase_planning.status === 'in_progress'` (per the line-174 comment). The corrective re-planning path breaks after the in-loop `phase_planning` authoring node is removed; this iteration stubs it (Iter 12 replaces it with corrective-task-append). Helper (a) remains valid — the explosion script still seeds a `phase_planning` child step node with `doc_path` on each phase iteration, so the `scopeNodes['phase_planning'].doc_path` lookup continues to resolve; no change required.

Phase-plan and task-handoff document contracts — and their validators — stay. Docs still exist and are still consumed downstream. What changes is the authoring surface.

## Scope

- Delete `.claude/agents/tactical-planner.md`.
- Delete three workflow folders from `rad-create-plans`:
  - `.claude/skills/rad-create-plans/references/phase-plan/`
  - `.claude/skills/rad-create-plans/references/task-handoff/`
  - `.claude/skills/rad-create-plans/references/shared/` (orphaned after tactical-planner removal; Iter-1 planner workflows already skip it)
- Remove from `constants.ts`:
  - Actions: `CREATE_PHASE_PLAN`, `CREATE_TASK_HANDOFF`
  - Events: `PHASE_PLANNING_STARTED`, `PHASE_PLAN_CREATED`, `TASK_HANDOFF_STARTED`, `TASK_HANDOFF_CREATED`
- In `mutations.ts`:
  - Remove `[EVENTS.PHASE_PLANNING_STARTED, 'phase_planning']` from `phaseExecStartedSteps` (line ~189)
  - Remove individual handlers for `TASK_HANDOFF_CREATED` (line ~450) — this handler owns task iteration advancement; its responsibility shifts to pre-seeding at explosion time
  - Remove any `task_handoff_started` individual handler if one exists
- In `context-enrichment.ts`:
  - Remove `'create_phase_plan'` from `PHASE_LEVEL_ACTIONS` set (line ~76)
  - Remove `'create_task_handoff'` from `TASK_LEVEL_ACTIONS` set (line ~83)
  - Remove the `create_phase_plan` special-case block (lines ~115-130)
  - Remove the `create_task_handoff` special-case block (lines ~182-209)
  - The `execute_task` special-case block (lines ~211-219) keeps reading `taskIter.nodes['task_handoff'].doc_path`; the only change is that the `task_handoff` child step is now pre-seeded by the explosion script in Iter 5 (status `completed`) rather than authored per-loop. No code change expected here unless the surrounding block needs touching as collateral from removing the separate `create_task_handoff` special case above.
- In `dag-walker.ts`:
  - **Lines 171-194** (phase-level corrective re-planning): stub the branch. Currently this path walks the phase body against `iteration.nodes` and relies on `phase_planning.status === 'in_progress'` to drive `create_phase_plan` dispatch. With `phase_planning` removed, replace the branch body with a short-term halt (operator message "Phase-level corrective flow will be rewired in Iter 12") until Iter 12 swaps it for the corrective-task-append path.
  - **Line 124** (`resolveDocRefInScope`): hardcoded `scopeNodes['phase_planning']` lookup for `$.current_phase.{field}` template refs. After the in-loop `phase_planning` authoring node is gone, this helper still resolves because the explosion script (Iter 5) pre-seeds a `phase_planning` child step node on each phase iteration (status `completed`, `doc_path` populated). Confirm at iteration start that the helper's assumed shape (`scopeNodes['phase_planning'].doc_path`) still matches the seeded node; no rewire expected.
- Remove `phase_planning` body node from `full.yml`'s `phase_loop.body` and `task_handoff` body node from `full.yml`'s `task_loop.body`. (`full.yml` is already deprecated from Iter 3; these edits just keep it syntactically tidy.)

## Scope Deliberately Untouched

- `phase_plan_created` and `task_handoff_created` validator rules in `frontmatter-validators.ts` (if any exist for the latter) stay — the docs still exist, still get read by downstream consumers (executor reads task-handoff; phase-review reads phase-plan in Iter 10).
- `pre-reads.ts` — generic; consumers' reads continue to work against the same doc paths.
- `default.yml` phase/task loop bodies — don't yet contain `phase_planning` / `task_handoff` body nodes; nothing to remove. Iter 9 finalizes the body shape.
- Phase-plan and task-handoff document FORMATS stay — only the authoring source changes (explosion script vs. tactical-planner).

## UI Impact

- **Active-project rendering**: new `default.yml` phase_loop body has no `phase_planning` node; task_loop body has no `task_handoff` node. The timeline iteration-body renderer must render whatever nodes are in `iteration.nodes` without assuming either node exists.
- **Legacy-project read-only rendering**: LOAD-BEARING. Completed projects' state.json contains `phase_planning` nodes inside `phase_loop.iterations[i].nodes` and `task_handoff` nodes inside `task_loop.iterations[j].nodes`. The DAG timeline must continue to render these legacy body nodes polymorphically — iterating `iteration.nodes` by key rather than looking up expected node ids.
- **UI surfaces touched**:
  - DAG timeline body renderer — verify polymorphic behavior (expected based on earlier Explore survey which found no hardcoded node-id assumptions beyond `NODE_SECTION_MAP`, but this is the key iteration to prove it).
  - `NODE_SECTION_MAP` — retains no change (`phase_planning` / `task_handoff` don't appear there since they're body nodes, not top-level).
- **UI tests**:
  - Regression fixture test: legacy state.json (with `phase_planning` + `task_handoff` body nodes inside iterations) renders cleanly with all statuses intact.
  - Fixture test: new state.json (without those body nodes) renders cleanly — just `task_executor` / `commit_gate` / `code_review` / `task_gate` in task-loop iterations.
  - This is the iteration to add the "legacy-state-renders-as-before" regression suite that Iter 8 and subsequent iterations build on.

## Code Surface

- Agent: `.claude/agents/tactical-planner.md`
- Skill workflows (entire folders):
  - `.claude/skills/rad-create-plans/references/phase-plan/`
  - `.claude/skills/rad-create-plans/references/task-handoff/`
  - `.claude/skills/rad-create-plans/references/shared/`
- Engine:
  - `.claude/skills/orchestration/scripts/lib/constants.ts` (actions + events)
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:189` (phaseExecStartedSteps) + `:450` (task_handoff_created handler) + any related individual handlers
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:76, :83, :115-130, :182-219` (action sets + special-case blocks; `execute_task` block keeps reading `taskIter.nodes['task_handoff'].doc_path` — now pre-seeded by Iter 5)
  - `.claude/skills/orchestration/scripts/lib/dag-walker.ts:124` (doc-ref helper `resolveDocRefInScope`) + `:171-194` (phase-level corrective re-planning branch)
- Template: `.claude/skills/orchestration/templates/full.yml` (body-node removals; file is already deprecated)
- Tests:
  - `.claude/skills/orchestration/scripts/tests/mutations.test.ts`, `mutations-negative-path.test.ts`, `mutations-phase-corrective.test.ts`
  - `.claude/skills/orchestration/scripts/tests/contract/06-state-mutations.test.ts`, `09-corrective-cycles.test.ts`
  - `.claude/skills/orchestration/scripts/tests/context-enrichment.test.ts`
  - `.claude/skills/orchestration/scripts/tests/execution-integration.test.ts`
- Ripple surfaces:
  - `.claude/skills/orchestration/validate/lib/checks/agents.js` (drop tactical-planner from expected roster)
  - `.claude/skills/rad-create-plans/SKILL.md` (agent-routing table now shows only `@planner`; references to `shared/` concept removed)
  - `.claude/skills/rad-execute/SKILL.md` (stop referencing "Tactical Planner")
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, pipeline-guide}.md`

## Dependencies

- **Depends on**: Iter 5 — the explosion script must be pre-seeding a `task_handoff` child step node (with `doc_path` populated) inside each task iteration, otherwise the `execute_task` enrichment reads `undefined` at `taskIter.nodes['task_handoff'].doc_path`. Likewise the phase-iteration `phase_planning` child must be seeded for the `resolveDocRefInScope` helper at `dag-walker.ts:124`.
- **Blocks**: Iter 8 — phase_report absorption is cleaner once the per-phase/task authoring layer is gone (no overlapping mutation registrations).

## Testing Discipline

- **Baseline first**: full suite + log + SHA. Note specifically which tests currently reference `task_handoff_created` / `phase_plan_created` — they'll be the rewrite surface.
- **Re-run before exit**: full suite green; diff against baseline. Removed legacy tests are expected; test counts may drop noticeably. Any baseline-passing test covering retained behavior (executor reads handoff, reviewer reads phase-plan) must still pass.
- Add a focused integration test: a scratch project drives `requirements` → `master_plan` → `explode_master_plan` → scratch-executor reads a task-handoff file → completes the task; no `task_handoff` node / step / event participates.

## Exit Criteria

- Full test suite green vs. baseline.
- `grep -rn "tactical-planner\|create_phase_plan\|create_task_handoff\|phase_planning_started\|task_handoff_created" .claude/` returns zero matches outside the cheaper-execution design-doc corpus.
- `context-enrichment.ts` has no references to `create_phase_plan` or `create_task_handoff` (authoring actions gone). The `execute_task` block still reads the task iteration's `task_handoff` child (now pre-seeded by Iter 5) — that reference is retained by design.
- `rad-create-plans/SKILL.md` references only `@planner`; `shared/` concept is gone.
- `rad-execute/SKILL.md` speaks in `@planner` vocabulary (no `Tactical Planner`).
- A scratch project on `default.yml` (partial; through Iter 5) drives to the plan_approval_gate, then (simulated) through a single task's executor using the pre-seeded task-handoff file.

## Open Questions

- **Corrective cycle stub**: once `dag-walker.ts:171-194` is stubbed, phase-level corrective cycles temporarily have no re-entry point. How should the walker behave until Iter 12 wires the corrective-task-append path — no-op (skip), halt (forced manual intervention), or warn-and-continue? Halt is safest (makes the regression loud); iteration planner confirms.
- **`task_handoff_created` mutation responsibility transfer**: the existing handler does task-iteration-entry management (advancing `iterations[].index`, status). Some of that logic likely needs to migrate to the explosion-script's pre-seeding pass. Audit `mutations.ts:450` during planning and identify which side-effects move vs. which are obsolete.
- **Order of edits within this iteration**: the `execute_task` enrichment path (reading from `taskIter.nodes['task_handoff'].doc_path`) depends on the explosion script (Iter 5) pre-seeding that child step node. Verify at iteration start that the seeded `task_handoff` child node is present with `doc_path` populated; if not, fix there first.
