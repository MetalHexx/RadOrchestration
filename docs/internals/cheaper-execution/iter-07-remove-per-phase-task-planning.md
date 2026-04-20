# Iter 7 — Remove per-phase/per-task planning (tactical-planner + phase-plan/task-handoff folders)

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → **amend this companion directly** (Iter 5 set the precedent — planning-time corrections live here, not in the progress tracker). Do not plan on stale assumptions.

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
  - Remove `[EVENTS.PHASE_PLANNING_STARTED, 'phase_planning']` from `phaseExecStartedSteps` (line **311** — verified 2026-04-19)
  - Remove individual handler for `TASK_HANDOFF_CREATED` (line **572** — verified 2026-04-19). Iter 5's pre-seeding already populates the `task_handoff` child node with `status: completed` + `doc_path`; verified this handler does not pre-advance status, so removal is safe (no orphan side-effects)
  - No separate `task_handoff_started` / `phase_planning_started` individual handlers exist — both flow through the shared `taskStartedSteps` / `phaseExecStartedSteps` loops, which the line-311 edit handles
- In `context-enrichment.ts`:
  - Remove `'create_phase_plan'` from `PHASE_LEVEL_ACTIONS` set (line ~76)
  - Remove `'create_task_handoff'` from `TASK_LEVEL_ACTIONS` set (line ~83)
  - Remove the `create_phase_plan` special-case block (lines ~115-130)
  - Remove the `create_task_handoff` special-case block (lines ~182-209)
  - The `execute_task` special-case block (lines ~211-219) keeps reading `taskIter.nodes['task_handoff'].doc_path`; the only change is that the `task_handoff` child step is now pre-seeded by the explosion script in Iter 5 (status `completed`) rather than authored per-loop. No code change expected here unless the surrounding block needs touching as collateral from removing the separate `create_task_handoff` special case above.
- In `dag-walker.ts`:
  - **Lines 171-194** (phase-level corrective re-planning): stub the branch by **throwing an explicit error** (not a silent no-op). Form:
    ```ts
    throw new Error(
      'Phase-level corrective re-planning branch unreachable post-Iter 7. ' +
      'Iter 12 will rewire this via corrective-task-append. See iter-12-corrective-cycles.md.'
    );
    ```
    Loud-at-runtime + quiet-in-CI: the 4 tests that exercise this branch get `it.skip()` with comments pointing at Iter 12 (see Scope §"Test surgery" below). Mutation-side tests for `phase_review_completed` stay green and prove state-shape work isn't regressing.
  - **Line 124** (`resolveDocRefInScope`): hardcoded `scopeNodes['phase_planning']` lookup for `$.current_phase.{field}` template refs. After the in-loop `phase_planning` authoring node is gone, this helper still resolves because the explosion script (Iter 5) pre-seeds a `phase_planning` child step node on each phase iteration (status `completed`, `doc_path` populated). Confirm at iteration start that the helper's assumed shape (`scopeNodes['phase_planning'].doc_path`) still matches the seeded node; no rewire expected.
- **Strip dead body nodes from deprecated templates** (re-added 2026-04-19): once Iter 7 removes the action/event string constants, the body-node references in `full.yml` and `quick.yml` become genuine dead code (not cosmetic drift) — the strings they cite no longer exist anywhere. Per the refactor's "excommunicate as you go" standing principle, strip them now. Defense in depth beyond the `status: deprecated` validator sentinel.
  - `.claude/skills/orchestration/templates/full.yml` — remove `phase_planning` body node from `phase_loop.body` and `task_handoff` body node from `task_loop.body`.
  - `.claude/skills/orchestration/templates/quick.yml` — same edits (Iter 9 will delete `quick.yml` entirely; symmetric strip keeps the integration branch clean in the interim).
- **Test surgery** (added 2026-04-19, planning-time):
  - **Delete** `.claude/skills/orchestration/scripts/tests/parity.test.ts` entirely. Pre-Iter-7 it had 48 `it()` blocks; ~36 break under the constants/event removals above. Surviving narrative coverage is fully redundant with the `tests/contract/` suite + integration tests (`engine.test.ts`, `execution-integration.test.ts`, `corrective-integration.test.ts`, `event-routing-integration.test.ts`). Net delta: ~–48 tests; logged as expected.
  - **`it.skip()` 4 tests** that exercise the phase-level corrective re-planning branch (which the stub above makes unreachable). Each gets a one-line comment pointing at Iter 12:
    - `tests/dag-walker.test.ts:1590` — `'phase-level corrective with task body nodes: walker returns first task body action'`
    - `tests/dag-walker.test.ts:1622` — `'phase-level corrective completion: advances iteration when all corrective body nodes done'`
    - `tests/dag-walker.test.ts:1663` — `'phase-level halted corrective returns display_halted'`
    - `tests/corrective-integration.test.ts:510` — `'phase-level corrective loop — phase review changes_requested → re-planning → complete → advances'`
  - **Do not touch** the 14+ tests in `tests/mutations-phase-corrective.test.ts` (they cover the mutation-side state-shape change, not the walker branch — they remain valid).
- **Cross-reference migration** (added 2026-04-19, surfaced during deep validation scan): the corrective-filename `-C{N}.md` pattern (Iter 0's standardization) currently lives at `rad-create-plans/references/phase-plan/workflow.md:135-150` — gets deleted with the `phase-plan/` folder. Three other skills cross-reference it. Migration:
  - **Move** the pattern section into `.claude/skills/orchestration/references/document-conventions.md` (already a filename-patterns doc).
  - **Update 3 cross-refs** to point at the new location:
    - `.claude/skills/code-review/phase-review/workflow.md`
    - `.claude/skills/code-review/task-review/workflow.md`
    - `.claude/skills/generate-phase-report/SKILL.md`
  - Net: ~15-line section move + 3 link updates. No DRY violation; pattern stays alive.
- **Additional ripples** (added 2026-04-19, surfaced during deep validation scan):
  - `.claude/skills/orchestration/references/context.md:18` — delete the tactical-planner agent-table row.
  - `.claude/skills/orchestration/references/document-conventions.md:34` — update author-field reference `tactical-planner-agent` → `explosion-script` (Iter 5's new author convention).
  - `prompt-tests/plan-pipeline-e2e/_runner.md:70` — drop the `tactical-planner` "wrong-template-detected" sentinel. Engine throws on unknown actions; runner already asserts on state.json shape (requirements/master_plan/explode_master_plan all completed) which is a stronger check.
  - `ui/components/documents/document-metadata.tsx:49` + `ui/components/documents/document-metadata.test.ts:74` — tidy "phase-plan frontmatter" comments where the phrasing reads as misleading post-Iter-7.
- **Out-of-scope-but-folded UI perf fix** (added 2026-04-19, surfaced during planning-time UI smoke):
  - `ui/lib/fs-reader.ts` `discoverProjects` (lines ~115-196) currently reads + parses every project's `state.json` **sequentially**. Pre-Iter-5 this was ~2 KB per project so the loop was instant; post-Iter-5 state.json is ~50–200 KB (pre-seeded iterations + nested nodes), and at >100 projects the loop blocks the renderer for 10–15 s.
  - **Fix**: parallelize via `Promise.all(entries.map(...))` with **per-project try/catch** so one malformed state.json doesn't poison the whole list. ~10 lines.
  - **Why fold here**: Iter 7 already needs UI smoke for legacy-state regression coverage; verifying against the user's real 107-project workspace doubles as the test for this fix. Sidebar virtualization + project-count cap are deferred to Open Items — not scoped here.
  - **Smoke ownership**: inner agent runs the dev server **locally** from inside the worktree's `ui/` and verifies in a browser. The user's workspace (`C:\dev\orchestration-projects` — ~107 projects) is the smoke target; the inner agent does NOT hand the smoke off to the user.
  - **`.env.local` setup**: create `ui/.env.local` (gitignored — never commit) with the format produced by `installer/lib/env-generator.js`:
    ```
    WORKSPACE_ROOT=C:\dev\orchestration-projects
    ORCH_ROOT=C:\dev\orchestration\v3-worktrees\feat-iter-7-remove-per-phase-task-planning\.claude
    ```
    `WORKSPACE_ROOT` points at the user's real workspace so the 107 projects are visible. `ORCH_ROOT` points at the worktree's `.claude` so the iteration's engine + skill changes are exercised. Pass time-to-render of the project list as the explicit pass criterion: <2s on the 107-project workspace (vs. the pre-fix 10–15s hang).

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
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:311` (phaseExecStartedSteps) + `:572` (TASK_HANDOFF_CREATED handler) — verified 2026-04-19; no separate `_started` individual handlers exist
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:73, :80, :112-127, :179-206` (action sets + special-case blocks; `execute_task` block at `:208-215` keeps reading `taskIter.nodes['task_handoff'].doc_path` — now pre-seeded by Iter 5)
  - `.claude/skills/orchestration/scripts/lib/dag-walker.ts:124` (doc-ref helper `resolveDocRefInScope` — keeps working because explosion script seeds `phase_planning` child) + `:171-194` (phase-level corrective re-planning branch — stubbed via `throw`)
- Templates: `.claude/skills/orchestration/templates/full.yml` + `.claude/skills/orchestration/templates/quick.yml` — strip dead body nodes (`phase_planning` from phase_loop.body; `task_handoff` from task_loop.body) per Scope §"Strip dead body nodes"
- Tests:
  - **Delete entirely**: `.claude/skills/orchestration/scripts/tests/parity.test.ts` (~48 it() blocks; redundant post-Iter-7 — see Scope §"Test surgery")
  - **Skip 4 tests** (`it.skip` pending Iter 12 corrective rewire — see Scope §"Test surgery"): `tests/dag-walker.test.ts:1590,1622,1663` and `tests/corrective-integration.test.ts:510`
  - **Edit/trim**: `.claude/skills/orchestration/scripts/tests/mutations.test.ts`, `mutations-negative-path.test.ts`, `context-enrichment.test.ts`, `execution-integration.test.ts`, `event-routing-integration.test.ts`, `engine.test.ts` (right-size as the underlying constants/handlers/blocks are removed)
  - **Edit**: `.claude/skills/orchestration/scripts/tests/contract/02-event-names.test.ts`, `03-action-contexts.test.ts`, `06-state-mutations.test.ts`, `09-corrective-cycles.test.ts` (drop the deleted action/event references)
  - **Untouched**: `mutations-phase-corrective.test.ts` (mutation-side coverage, still valid)
- UI fix surface (added 2026-04-19):
  - `ui/lib/fs-reader.ts` `discoverProjects` (~lines 115-196) — parallelize sequential parse via `Promise.all` + per-project try/catch
  - New unit test in `ui/` covering: malformed state.json doesn't poison the Promise.all; result order stable; large fixture list (e.g., 50 projects) returns
- Ripple surfaces:
  - ~~`.claude/skills/orchestration/validate/lib/checks/agents.js`~~ — REMOVED (validation report 2026-04-19: no hardcoded roster; agents are auto-discovered via `listFiles(agentsDir, '.agent.md')`. Deleting the agent file is sufficient.)
  - `.claude/skills/rad-create-plans/SKILL.md` — **5 specific edits required** (deleting `shared/` cascades through the doc's framing, not just the routing table):
    1. **Frontmatter `description`** (line 3): currently reads "most routes load shared conventions first, planner (Requirements / Master Plan) routes are self-contained" — reframe to describe what the skill does without the shared-vs-self-contained distinction (since `shared/` no longer exists, every route is self-contained).
    2. **Intro paragraph** (line 9): same framing as the description — rewrite without the "most routes load shared guidelines... planner routes are self-contained and skip `references/shared/`" qualifier.
    3. **"When to Use" list** (lines 13-16): the Requirements bullet ends with "(supported — self-contained workflow, does not load `shared/`)". Drop the parenthetical qualifier (every workflow is self-contained now). Also delete the `Phase Plan` and `Task Handoff` bullets — those workflows are deleted in this iteration.
    4. **"Load Sequence" section** (lines 18-23): steps 1 and 2 reference the deleted `shared/guidelines.md` + `shared/self-review.md` — delete both. Renumber the routing step to be the only step (or restructure as a brief routing-only section without the "Load Sequence" framing, since there's no longer a sequence — just routing).
    5. **Routing table** (lines 24-27): delete the `tactical-planner` row entirely. On the `planner` row, drop the trailing qualifier "Both workflows are self-contained and do NOT inherit from `references/shared/`" (no longer meaningful).
  - `.claude/skills/rad-execute/SKILL.md` (stop referencing "Tactical Planner")
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, pipeline-guide, context}.md` — `context.md` added 2026-04-19 (agent-table row); `document-conventions.md` carries both vocabulary purge AND the migrated corrective-filename pattern section
  - `.claude/skills/code-review/{phase-review,task-review}/workflow.md` + `.claude/skills/generate-phase-report/SKILL.md` — corrective-filename cross-refs updated to new location in `document-conventions.md`
  - `prompt-tests/plan-pipeline-e2e/_runner.md` — drop `tactical-planner` sentinel
  - `ui/components/documents/document-metadata.{tsx,test.ts}` — tidy comment phrasing
  - `.agents/skills/pipeline-changes/references/pipeline-internals.md` (lines ~58, 74) — update Mermaid diagrams to drop `task_handoff_created` + `phase_plan_created` event refs (replace with the post-Iter-7 transitions; documentation only, no executable consequence)

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

## Open Questions — resolved at planning time (2026-04-19)

- ✅ **Corrective cycle stub**: locked → **throw an explicit error** at `dag-walker.ts:171-194` (form inlined in Scope above). Loud-at-runtime; the 4 tests that exercise this branch get `it.skip()` with comments pointing at Iter 12. Mutation-side tests stay green.
- ✅ **`task_handoff_created` mutation responsibility transfer**: verified at planning time — the handler at `mutations.ts:572` only sets node status `completed` + writes `doc_path`. It does NOT pre-advance task iteration status. Iter 5's pre-seeding already creates the `task_handoff` child with `status: completed` + `doc_path` at explosion time. Removal is safe; no side-effect migration needed.
- ✅ **Order of edits**: also verified — explosion script (`scripts/lib/explode-master-plan.ts:603-615`) seeds `task_handoff` child node with `status: 'completed'` + relative `doc_path`. The `execute_task` enrichment block (`context-enrichment.ts:208-215`) reads it as `taskIter.nodes['task_handoff'].doc_path`. No fix needed — the seam is in place.

## Companion-amendment trail (2026-04-19, planning-time)

This companion was amended on 2026-04-19 during Iter 7 outer-session brainstorming. Changes:
- Validation Preface flipped from "log a deviation" → "amend this companion directly" (matching Iter 5/6 precedent).
- Line numbers updated to verified-against-live-code values (mutations.ts:311 + 572; context-enrichment.ts:73, 80, 112-127, 179-206, 208-215).
- `agents.js` ripple removed (no hardcoded roster; agents are auto-discovered).
- Stub form for `dag-walker.ts:171-194` specified as `throw` with exact code.
- Test surgery section added (parity.test.ts deletion + 4 it.skip tests with file:line + Iter 12 pointers).
- `full.yml` body-node strip dropped, then **re-added 2026-04-19** along with symmetric `quick.yml` strip — the dead body-node references become genuine dead code post-Iter-7 (cited action/event strings no longer exist anywhere); per "excommunicate as you go" standing principle, strip both.
- Cross-reference migration added: corrective-filename pattern moves from `phase-plan/workflow.md:135-150` → `orchestration/references/document-conventions.md`. 3 cross-refs in code-review subskills + generate-phase-report updated.
- 4 additional ripples surfaced by deep validation scan: `context.md:18` (agent-table row), `document-conventions.md:34` (author field), `_runner.md:70` (sentinel drop), `document-metadata.{tsx,test.ts}` (comment tidy).
- UI perf fix (`fs-reader.ts` `discoverProjects` async + per-project try/catch) folded in — surfaced during planning-time UI smoke against the user's 107-project workspace, where state.json size growth from Iter 5's pre-seeding now blocks the renderer for 10–15s.
- `rad-create-plans/SKILL.md` ripple expanded from a one-liner to 5 enumerated edits — deleting `shared/` cascades through the doc's frontmatter description, intro paragraph, "When to Use" list, "Load Sequence" section, and routing table. Without enumeration, the inner agent risks a half-rewrite that leaves stale framing referencing the deleted folder.
- UI perf-fix smoke ownership clarified: inner agent runs the dev server locally from the worktree (`ui/.env.local` with `WORKSPACE_ROOT=C:\dev\orchestration-projects` + `ORCH_ROOT` pointing at the worktree's `.claude`) and verifies in a browser. Explicit pass criterion: <2s render time on 107 projects.
- Open Questions resolved.

A companion note added to `iter-12-corrective-cycles.md` enumerates the 4 skipped tests so the Iter 12 planner has zero rediscovery cost.
