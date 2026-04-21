# Iter 11 — Phase-level corrective cycles (orchestrator mediation)

> **Scope**: phase-level corrective cycles only. Task-level mediation shipped in Iter 10. Final-level correctives are out of scope for the refactor entirely.
>
> **Design source of truth**: [`../CORRECTIVE-CYCLES-REDESIGN.md`](../CORRECTIVE-CYCLES-REDESIGN.md) covers both iter-10 and iter-11. This companion is the phase-level slice — everything the planner needs to author the iter-11 plan without re-reading the redesign or the iter-10 companion. The redesign remains the ambient architectural reference for terminology and cross-iteration alignment.
>
> **Validation status**: code-surface references below were validated against live code at planning time (post-iter-10 merge at `3b85095`). If you re-use this companion later, re-run the grep/glob pass — pipeline lib files drift ≈40 lines per merged iteration.

## Overview

Iter 10 elevated the orchestrator from a deterministic dispatcher into an active **mediator** for task-level code reviews. On `changes_requested`, it reads the review, judges each finding, appends a disposition addendum, and (if any finding is actioned) authors a fresh self-contained corrective Task Handoff. The mutation flipped from birth-on-raw-verdict to birth-on-handoff-path. Reviewers became stateless across attempts. All of this landed at task scope only — phase-level correctives were carved out for this iteration.

Iter 11 extends that pattern to phase scope. When `phase_review` returns `changes_requested`, the orchestrator mediates the same way: addendum + additive frontmatter + self-contained corrective task handoff. The key architectural commitments that differ from task scope:

1. **Phase-scope correctives are appended to `phaseIter.corrective_tasks[]`** (not `taskIter.corrective_tasks[]`). They are a structural task — same handoff shape, same executor contract, same task-level code-review — but hosted at the phase iteration.
2. **`phase_review` runs exactly once per phase iteration.** Once the phase-scope corrective's task-level code review approves, the phase iteration completes. No second phase-review pass. This is a deliberate simplification per the redesign — we trust orchestrator mediation plus task-level review of the correction as the quality floor, with final_review as the outermost backstop.
3. **No mutation-side "phase-iteration reset" block remains.** Today's `PHASE_REVIEW_COMPLETED` handler on `changes_requested` resets `phase_planning` and `task_loop` iterations back to `not_started`, then appends an empty corrective entry. Post-iter-11 that reset block is gone — the corrective is a single-task append, and the existing completed phase artifacts stay as they are. The walker's empty-nodes halt stub (dag-walker.ts:171-184) becomes dead code and is removed.
4. **Walker traversal is unchanged.** The walker already traverses `corrective_tasks[]` at both task-iteration and phase-iteration levels today; it already derives the correct body defs (task-loop body) when walking a phase-scope corrective (see `dag-walker.ts:186-193` + the active test at `dag-walker.test.ts:1697-1729`). Iter 11 unblocks this by removing the halt stub and making sure the corrective is birthed with scaffolded nodes (not `nodes: {}`).

**Ancestor-derivation for corrective-of-corrective routing.** When a phase-scope corrective's own task-level code review returns `changes_requested`, `CODE_REVIEW_COMPLETED`'s mediation branch must decide where the new corrective appends. The cleanest and future-proof rule: **the hosting iteration is the parent of the code_review node being completed.** The mutation already resolves that node (it sets `status = completed` there); from the resolved location it walks up the state tree:

- If the node's ancestor is `taskIter.nodes` OR `taskIter.corrective_tasks[K].nodes` → hosting is `taskIter`; append to `taskIter.corrective_tasks` (today's behaviour, preserved).
- If the node's ancestor is `phaseIter.corrective_tasks[K].nodes` → hosting is `phaseIter`; append to `phaseIter.corrective_tasks`.
- In the future, if final-review scope correctives are ever added, the same rule applies at that scope without new event fields or new validator rules.

No orchestrator-authored scope hint, no new event payload field, no mutation-side scope flag — the hosting iteration is derivable from state because the code_review node's location unambiguously names it.

**Why "possibly the most important iteration":** iter-11 is the last load-bearing engine change in the corrective-cycles redesign. Shipping it clean unlocks the whole multi-scope mediation pattern: task / phase / (future) final all ride the same machinery. Shipping it with rough edges leaves a second broken scope on top of an already-subtle architecture. Budget for care here is well-spent.

## Scope

**In scope (phase-level mediation):**

- **`corrective-playbook.md` extension**: Iter 10 authored a self-contained task-scope playbook at `.claude/skills/orchestration/references/corrective-playbook.md`. Iter 11 **extends** (not replaces) it to cover phase-scope mediation. New section(s) covering: when phase mediation fires, what inputs to gather (the phase review doc + master plan + requirements + task handoffs + cumulative phase diff hint), how to judge cross-task integration findings vs. per-task findings, addendum shape (unchanged), corrective handoff format (phase sentinel filename), single-pass phase_review clause, ancestor-derivation rule for corrective-of-corrective. Preserve the existing task-scope content untouched — add a clearly-named "Phase-Scope Mediation" section adjacent to the task-scope sections, and a lead-in "Scope: Task vs. Phase" note at the top of the playbook.

- **Orchestrator agent + skill ripples**:
  - `.claude/agents/orchestrator.md` — narrow-write-surface clause added in iter-10 already permits writing review-doc addenda + corrective Task Handoffs under `tasks/`. No tool-list change needed (Write/Edit/TodoWrite already granted). Extend the mediation-flow summary with one phase-scope sentence and update the pointer to the playbook to mention both scopes.
  - `.claude/skills/orchestration/references/context.md` — no change expected (narrow-write-surface language already covers both scopes by virtue of "addendum" being the abstraction, not scope-specific).
  - `.claude/skills/orchestration/references/pipeline-guide.md` — one-paragraph addition under the `phase_review_completed` event / spawning flow mentioning the orchestrator mediation hook (paralleling the iter-10 language for `code_review_completed`).
  - `.claude/skills/orchestration/references/action-event-reference.md`:
    - `spawn_phase_reviewer` action row (line ~16): add a one-line note that orchestrator mediation sits between reviewer completion and event signaling (parallel to iter-10's change to `spawn_code_reviewer`).
    - `phase_review_completed` event row (line ~54): document the new frontmatter contract — reviewer's raw `verdict` + `exit_criteria_met` + orchestrator's additive `orchestrator_mediated` / `effective_outcome` / `corrective_handoff_path` (parallel to iter-10's change to `code_review_completed`). Keep the reviewer's raw `exit_criteria_met` field untouched.
  - `.claude/skills/orchestration/references/document-conventions.md`:
    - Filename Patterns table: add the phase-scope corrective Task Handoff row — `tasks/{NAME}-TASK-P{NN}-PHASE-C{N}.md` (PHASE occupies the T-slot as a named sentinel since phase-scope correctives don't belong to a specific task).
    - Corrective Filename Suffix section: extend to document the phase-scope sentinel form.
    - Frontmatter Field Reference: `corrective_scope` enum updated from `"task"` to `"task" | "phase"`. No new fields beyond iter-10's set.
    - Remove the `{NAME}-PHASE-REVIEW-P{NN}-{TITLE}-C{N}.md` corrective-form row from the Filename Patterns table (phase_review is single-pass per iteration under the new design; the corrective-form filename is never produced). A future iteration that adds an outer phase-scope re-run loop can re-introduce it.

- **Pipeline engine** (`.claude/skills/orchestration/scripts/lib/`):

  - **`mutations.ts`**:
    - **`PHASE_REVIEW_COMPLETED` handler** (starts ~line 339; the `changes_requested` branch is lines ~391-441). Rewrite the `changes_requested` branch end-to-end:
      1. Delete the reset block: do NOT reset `phase_planning.status`/`doc_path`, do NOT clear `task_loop.iterations`, do NOT reset `phase_review`/`phase_gate`. `phase_review.status` stays `completed`, its `verdict` stays `changes_requested` (or effective_outcome after iter-11's mediation — see below).
      2. Add the Iter-10-parallel mediation contract extraction: read `effective_outcome`, `corrective_handoff_path`, `orchestrator_mediated` from context. Gate mediation usage (raw `changes_requested` + `orchestrator_mediated === true` + `effective_outcome` present). Route state writes using `effective_outcome` when mediated, else the raw verdict — mirroring iter-10's `code_review_completed` pattern verbatim.
      3. Birth-on-handoff-path: when effective_outcome is `changes_requested` and a non-empty `corrective_handoff_path` is supplied, scaffold body-def nodes via `findTaskLoopBodyDefs` (line ~609) AND synthesize a pre-completed `task_handoff` sub-node in the corrective's `nodes` map with `status: completed` + `doc_path: <trimmed path>`. Append the corrective to `phaseIter.corrective_tasks[]` (not any taskIter array).
      4. Budget enforcement: same contract as iter-10's task-scope. Exhausted budget with supplied handoff path → hard halt with descriptive reason. No handoff path + `changes_requested` effective outcome → clean halt (orchestrator's budget-exhausted signal).
      5. `effective_outcome: approved` (mediation filter-down) → no corrective birth, no halt — pipeline advances as if the reviewer had approved.
      6. Raw `rejected` → halt (unchanged from today's behaviour).
    - **`CODE_REVIEW_COMPLETED` handler** (line ~624) — extend to route corrective-of-corrective append based on ancestor-derivation (see Overview). Concretely: when the mediation branch is about to append to `iteration.corrective_tasks[]`, `iteration` today is always resolved via `resolveTaskIteration(phase, task)`. Change this to compute the hosting iteration from state:
      - If `phaseIter.corrective_tasks` has an active entry (status `in_progress` or `not_started`) AND that entry's `nodes['code_review']` is the node whose completion we're processing → hosting = phaseIter.
      - Else → hosting = taskIter (today's behaviour).
      - The "is it the same code_review node" check can be implemented by resolving the code_review node's location at the top of the handler and keeping a reference to its parent `corrective_tasks[]` array (if any) plus iteration. Simpler: since the mutation already calls `resolveNodeState(cloned, 'code_review', 'task', phase, task)` and that function prioritizes `phaseIter.corrective_tasks[latest active]` over `taskIter.*`, we know the node came from phaseIter if that active-phase-corrective branch resolved it. An explicit helper like `resolveHostingIteration(cloned, phase, task)` is cleanest — have it return `{ iteration, scope }` where `iteration` is the state object to mutate and `scope` is `'task'` | `'phase'` for the corrective's frontmatter/addendum consistency.
    - **`COMMIT_COMPLETED` handler** (line ~944) — today routes commit_hash to either `taskIteration.commit_hash` or the active `taskIteration.corrective_tasks[latest].commit_hash`. Extend: before resolving the task iteration, check for an active phase-scope corrective. If `phaseIter.corrective_tasks` has a `not_started` / `in_progress` entry, route the commit hash to that entry's `commit_hash`. Else, fall through to the current task-scope routing.
    - **`resolveNodeState`** (lines ~28-79) — update the comment at lines ~52-55 that says "Phase-level corrective tasks (from phase_review_completed) have nodes: {} so this check always falls through." Under iter-11 phase-scope correctives carry pre-seeded nodes (the synthesized task_handoff + scaffolded task-body). The existing code path already routes correctly (the check DOES hit for phase-scope correctives with populated nodes); only the comment needs updating. No functional change.

  - **`dag-walker.ts`**:
    - Remove the empty-nodes halt stub at lines ~171-184 entirely. Under iter-11 every birthed corrective (task or phase scope) carries pre-seeded nodes via the mutation; an empty-nodes corrective is unreachable in normal operation and deserves no special-case handler. Deletion is the right move (not a rewrite to "re-enter the phase body" — that was the old re-planning design which is not what iter-11 implements).
    - Corrective-completion logic at lines ~199-212 stays unchanged. It already correctly marks both task-scope and phase-scope correctives `completed` once all their body nodes finish, then advances the hosting iteration.

  - **`context-enrichment.ts`**:
    - **`execute_task` enrichment** (lines ~148-180) — extend with a phase-scope-first branch **before** the current task-scope corrective check. When `phaseIter.corrective_tasks` has an active entry, route `handoff_doc` to the active phase-scope corrective's `task_handoff.doc_path`. Phase-scope-first ordering matters because the task-scope check (lines ~159-175) derives `taskIter` from `taskLoop.iterations[taskNumber - 1]` where `taskNumber = resolveActiveTaskIndex(...)` which falls through to `1` when no task is active — that fall-through would return a stale taskIter under a phase-scope corrective and silently route to the wrong handoff.
    - **`spawn_code_reviewer` enrichment** (lines ~182-198) — parallel extension: check phase-scope corrective first. When active, route `head_sha` to the phase-scope corrective's `commit_hash`, and surface `is_correction: true` + `corrective_index: phaseIter.corrective_tasks.length`. Else fall through to today's task-scope behaviour.
    - **`spawn_phase_reviewer` enrichment** (lines ~109-129) — already handles `is_correction` / `corrective_index` when `phaseIter.corrective_tasks.length > 0` (lines ~124-126). This is correct and needs no iter-11 change. Under the new design `phase_review` is single-pass per iteration, so when it runs the length is always 0 — but leaving the branch in place is harmless and matches the reversibility clause from the redesign.
    - `phase_head_sha` computation (lines ~117-122) unchanged. Phase-scope correctives will produce their own commits under auto-commit-on scenarios, but those commits are task-body commits inside the phase-scope corrective — they roll up into `phaseIter.corrective_tasks[latest].commit_hash` which the `phase_head_sha` computation doesn't read (it reads from taskIter.commit_hash chain). This is correct for the current design (phase_review runs once, before any phase-scope corrective exists). If a future iteration adds phase_review re-run, this is where the extension would land.
    - **Task context fields on phase-scope correctives**: the `TASK_LEVEL_ACTIONS` branch sets `task_number` + `task_id` via `resolveActiveTaskIndex(...)` which falls through to `1` when no task is active. For phase-scope corrective dispatches, these values are semantically meaningless — there is no "task 1" being operated on. Two options: (a) set `task_number = null` / `task_id = null` (explicit), or (b) derive a sentinel like `task_id = formatPhaseId(phase) + '-PHASE'` / `task_number = 0`. Planner to decide at plan time — option (a) is more honest, option (b) preserves existing consumer contracts. Spawned coder/reviewer agents currently read `task_id` as a labeling hint only; verify before deciding.

  - **`frontmatter-validators.ts`**:
    - `phase_review_completed` rules (lines ~143-154) currently require only `verdict` + `exit_criteria_met`. Extend with the Iter-10-parallel conditional mediation contract: raw `changes_requested` requires `orchestrator_mediated: true` + `effective_outcome`; handoff path required iff `effective_outcome === changes_requested`; mediation fields forbidden on raw `approved` / `rejected`. Preserve `exit_criteria_met` — it's the reviewer's own frontmatter, unaffected by mediation. Use the same `when` + `mustBeAbsent` flag combinations iter-10 introduced (no new validator machinery required).

- **Code-review skill**:
  - `.claude/skills/code-review/phase-review/workflow.md`:
    - **Remove** step 6 "Corrective-review check" (line ~42).
    - **Remove** the "Corrective Review Context" section (lines ~79-85).
    - **Remove** the verdict-rules note "During corrective reviews, deviations matching previous review issues are expected corrections..." (line ~108).
    - **Remove** the `Previous Phase Review` Inputs row (line ~28) — reviewer is stateless across attempts per design.
    - **Remove** the "Corrective" save-path row under both step 10 and the Output section (lines ~48 and ~115) — phase_review is single-pass per iteration under the new design. (Consistent with removing the corrective-form filename row from document-conventions.md.)
    - **Add** a `Requirements` Inputs row referencing `{NAME}-REQUIREMENTS.md` — the phase reviewer needs it for cross-task integration and exit-criteria checks that can't be derived from per-task handoffs alone. This is the pre-existing-drift cleanup flagged in the redesign (line 176).
    - **Verify and clean up** stale Inputs rows referring to PRD / Architecture / Design docs if any remain post-iter-8. (Iter 8 removed these from the template but the workflow Inputs may still carry residue.)
  - `.claude/skills/code-review/task-review/workflow.md`:
    - Save-path section (lines ~32-36): **add** a parallel named-sentinel form for task-level code reviews of phase-scope correctives: `{PROJECT-DIR}/reports/{NAME}-CODE-REVIEW-P{NN}-PHASE-C{N}.md`. Keeps the reviewer's save-path logic self-contained — the reviewer derives the correct form from the task_id sentinel (`P{NN}-PHASE` vs. `P{NN}-T{NN}`).

- **Frontmatter contract** (single-source-of-truth validation enforced at the `phase_review_completed` event boundary, conditional on reviewer's raw verdict):
  - `verdict = approved` → `orchestrator_mediated`, `effective_outcome`, `corrective_handoff_path` all absent. `exit_criteria_met` required (reviewer's own field). Pipeline advances. (Iter 11 additive; today's rules become iter-11 baseline.)
  - `verdict = changes_requested` →
    - `orchestrator_mediated = true` required.
    - `effective_outcome` required (`approved` | `changes_requested`).
    - If `effective_outcome = changes_requested` → `corrective_handoff_path` required, non-empty string pointing at an existing file under `tasks/` with the phase sentinel filename.
    - If `effective_outcome = approved` → `corrective_handoff_path` must be absent.
    - `exit_criteria_met` required (reviewer's own field, unaffected by mediation).
  - `verdict = rejected` → mediation fields all absent. Pipeline halts.

- **UI**: Phase-scope correctives become operational — they render as corrective entries inside the phase iteration panel. Confirm the existing `dag-corrective-task-group` / `dag-iteration-panel` / `dag-timeline` components handle phase-iteration corrective_tasks arrays without changes. Verify both the `dag-timeline-legacy-render.test.ts` legacy canary passes unchanged AND a new fixture demonstrating a phase-scope corrective renders. The redesign doc explicitly notes "We need to look at the UI and see if the phase corrective cycles need to be added into the UI." Plan task: inspect the UI for phase-iteration rendering gaps before declaring no-code-change; if a small additive tweak is required, include it in scope.

- **Prompt harness behavior** (new folder under `prompt-tests/`): `prompt-tests/phase-review-mediation-e2e/` — mirrors `corrective-mediation-e2e/` structure (README + `_runner.md` + `user-instructions.md` + `fixtures/` + `output/`). Exercises the end-to-end phase-scope mediation flow against a pre-seeded two-task cross-task-contract-drift fixture. Commits the inaugural baseline under `output/<fixture>/baseline-*/run-notes.md`. `.gitignore` extended with the re-include rule for the new behavior folder. See "Prompt Harness Behavior" section below for fixture design and pass criteria.

**Scope Deliberately Untouched (iter-11 out of scope):**

- Final-level corrective cycles — not part of the refactor at all.
- Adversarial review modes — out of scope.
- Executor input-contract narrowing (drop `Previous Code Review` / `Corrective Task Handoff` rows from task-handoff skill Inputs) — deferred to iter-13 (already scoped there).
- Installer retry-limit configurability — iter-12 (already scoped).
- Any change to `full.yml` / `quick.yml` — deprecated templates stay untouched.
- `code_review_completed` mutation's ancestor-derivation MUST NOT break task-scope-only paths — all existing iter-10 behaviour and tests must remain green. The change is purely additive to the routing decision.

## UI Impact

**Validated at planning time. Small, targeted UI work lands in iter-11.** The DAG timeline's iteration-panel component is already generic over phase and task iterations, so the DAG rendering side is free. A document-ordering gap does exist and must be closed.

### What already works (verified)

- **`ui/components/dag-timeline/dag-iteration-panel.tsx:43-182`** — `DAGIterationPanel` is generic over both scopes via `parentKind: 'for_each_phase' | 'for_each_task'`. Lines 171-179 render `<DAGCorrectiveTaskGroup correctiveTasks={iteration.corrective_tasks} … />` unconditionally off `iteration.corrective_tasks` — this works identically for phase and task iterations. A populated `phaseIter.corrective_tasks` array will render the corrective task group inside the phase iteration card with zero component change.
- **`ui/types/state.ts:260-275`** — `IterationEntry` carries `corrective_tasks: CorrectiveTaskEntry[]` and is shared by `ForEachPhaseNodeState.iterations` (line 249) and `ForEachTaskNodeState.iterations` (line 255). Type system already supports phase-iteration correctives; no widening needed.
- **`DAGCorrectiveTaskGroup`** (`dag-corrective-task-group.tsx`) — consumes a generic `CorrectiveTaskEntry[]` prop. No scope assumption baked in.

### Gap (must fix in iter-11)

- **`ui/lib/document-ordering.ts:197-235`** — the document-ordering sidebar iterates `taskIter.corrective_tasks` inside the phase/task traversal (lines 220-228, emitting each corrective's step-node `doc_path` with title suffix `(CT{N})`) but does NOT iterate `iteration.corrective_tasks` at the phase-iteration level. Under iter-11 a phase-scope corrective's `task_handoff.doc_path` (the phase-sentinel corrective handoff), its `code_review.doc_path` (the phase-sentinel code review), and any other pre-seeded step nodes with `doc_path` would never surface in the document list sidebar. Fix: after the `for_each_task` traversal inside the phase loop (line 230 boundary), add a parallel loop over `iteration.corrective_tasks` emitting each corrective's step-node `doc_path`s with a title suffix like `(Phase-C{N})` — the suffix distinguishes these from task-scope correctives at a glance. Keep title naming consistent with existing `titleForTaskChild` helper conventions.

### Tests needed

- **`ui/components/dag-timeline/dag-timeline-legacy-render.test.ts`** — add a `makePhaseCorrectiveIteration` fixture helper (parallel to `makeLegacyPhaseIteration`) that carries a populated `phaseIter.corrective_tasks[0]` with a synthesized `task_handoff` step node + scaffolded body nodes. Assert the new iteration renders without errors, surfaces the corrective task group, and does not disturb the legacy canary (empty-corrective-array iterations still render identically).
- **`ui/components/dag-timeline/dag-iteration-panel.test.ts`** — add a test asserting `DAGIterationPanel` with `parentKind: 'for_each_phase'` and a populated `iteration.corrective_tasks` passes the array to `DAGCorrectiveTaskGroup`. Unit-scope coverage, minimal fixture.
- **`ui/lib/document-ordering.test.ts`** — add a test asserting a phase-scope corrective's doc_paths appear in the ordered document list with the `(Phase-C{N})` title suffix. Mirror the existing task-scope corrective test.

### Fully-hydrated showcase fixture (UI visual verification)

The `_runner.md` happy-path harness drives exactly one phase-scope corrective from `changes_requested` → `approved`. That is automated correctness coverage. It does NOT exercise the visual density of a real project with mixed task-scope and phase-scope correctives stacked in the same state tree.

**Deliverable**: a separate, pre-cooked fully-hydrated fixture under `prompt-tests/phase-review-mediation-e2e/fixtures/fully-hydrated/` that the UI is pointed at during in-implementation manual verification. This fixture is NOT driven by the runner — it is a static state snapshot with all on-disk artifacts present, engineered to showcase every rendering dimension simultaneously. Suggested shape:

- **Phase 1**: three tasks.
  - T1 — one task-scope corrective (T1-C1) that approved. Renders `CT1` group under T1 iteration.
  - T2 — clean first pass. Renders no corrective group.
  - T3 — two task-scope correctives (T3-C1, T3-C2) before approving. Renders `CT1` + `CT2` groups stacked under T3 iteration.
  - Phase review ran → returned `changes_requested` (mediated).
  - Phase-scope corrective PHASE-C1 was authored; its own task-level code review came back `changes_requested` (mediated again — exercises the ancestor-derivation path for corrective-of-corrective at phase scope).
  - Phase-scope corrective PHASE-C2 was authored and approved.
  - Phase iteration marked completed. Renders `Phase-C1` + `Phase-C2` groups stacked under Phase 1 iteration.
- **Phase 2**: one task, clean, completed. Demonstrates the "no correctives" phase rendering isn't disturbed.
- **Final review**: not yet dispatched. Graph status: `in_progress`. Keeps the fixture representative of a real mid-project state.

All documents on disk (requirements, master plan, phase plans, task handoffs — original + both layers of correctives — and code review docs + one phase review doc with its Orchestrator Addendum). State.json references every doc_path. The fixture is static — no runner driver. The UI points at it during implementation and during `user-instructions.md` hand-verification.

Pass criterion for this fixture (added to the harness's pass criteria list): mounted in the browser, the DAG timeline renders every corrective group, every mediated review doc, every sentinel filename without layout issues, and the document sidebar lists every doc_path with sensible titles including `(CT{N})` and `(Phase-C{N})` suffixes. Operator / agent eyeballs cohesion.

### In-implementation manual verification (dev server)

During iter-11 implementation, after the UI change lands, the implementing agent must boot the UI and visually verify phase-scope correctives render inside the phase iteration card, following the same visual pattern as task-scope correctives inside task iteration cards. Concrete steps:

1. **Kill port 3000 occupants first** to avoid Next.js port-hopping (memory: [UI dev server — kill port 3000 occupants before starting]). Any process holding 3000 → stop it.
2. **Create `ui/.env.local`** if absent. Format per `installer/lib/env-generator.js`:
   ```
   WORKSPACE_ROOT=<absolute path to parent of prompt-tests run folder, or a workspace containing iter-11 fixture output>
   ORCH_ROOT=.claude
   ```
   `WORKSPACE_ROOT` points at a folder containing project directories (the UI lists them from there). For iter-11, point at the `prompt-tests/phase-review-mediation-e2e/output/<fixture>/` parent so the harness run folder is picked up as a project. `ORCH_ROOT` reads the orchestration skill root (default `.claude`).
3. **Start the dev server**: `cd ui && npm run build && npm run dev`. Confirm it binds to port 3000 (not 3001/3002 — that's the port-hop signal).
4. **Open the browser** to `http://localhost:3000`. Navigate to the harness run-folder project. Inspect the DAG timeline:
   - Phase iteration card shows `Phase-C1` corrective task group rendered below the phase body nodes.
   - Corrective task group lists the same step-node children as a task-scope corrective (task_handoff, task_executor, commit, code_review, task_gate).
   - Document sidebar lists the phase-sentinel corrective handoff and code review under the phase (title suffix `(Phase-C1)`).
   - Clicking the corrective handoff opens the file in the document viewer; clicking the review opens the review doc with its addendum rendered.
5. **Legacy check**: switch to a pre-iter-11 project (any previously completed project in the workspace or the iter-6 `rainbow-hello` baseline). Verify zero regressions — no missing-node warnings, no layout drift, no new console errors. The legacy state.json has `corrective_tasks: []` arrays on both phase and task iterations; rendering must be identical to pre-iter-11.

A decorative "mediated" badge was considered at iter-10 planning time and explicitly deferred. Iter-11 does not revisit this — the addendum section is the real audit artifact and a future UI-signals pass will design from evidence.

## Code Surface

Validated line numbers as of `feat/cheaper-execution` @ `3b85095` (post iter-10 merge). Planner must re-validate before authoring the plan if additional merges have landed.

**New files:**

- `prompt-tests/phase-review-mediation-e2e/README.md`
- `prompt-tests/phase-review-mediation-e2e/_runner.md`
- `prompt-tests/phase-review-mediation-e2e/user-instructions.md`
- `prompt-tests/phase-review-mediation-e2e/fixtures/<fixture-name>/…` (pre-seeded project artifacts + state.json at the "phase_review returned changes_requested" moment — runner-driven happy path)
- `prompt-tests/phase-review-mediation-e2e/fixtures/fully-hydrated/…` (static showcase fixture — mixed task-scope + phase-scope correctives, NOT runner-driven, for UI visual verification)
- `prompt-tests/phase-review-mediation-e2e/output/<fixture-name>/.gitkeep`
- `prompt-tests/phase-review-mediation-e2e/output/<fixture-name>/baseline-<fixture-name>-YYYY-MM-DD/run-notes.md` — inaugural baseline committed on first successful run.

**Existing files to edit:**

| File | Location | Change |
|---|---|---|
| `.claude/agents/orchestrator.md` | mediation-flow summary | Extend 2-3 line summary to cover both task and phase scope; update pointer to playbook to mention both. No tool-list change (Write/Edit/TodoWrite already granted in iter-10). |
| `.claude/skills/orchestration/references/corrective-playbook.md` | top + new section | Add lead-in "Scope: Task vs. Phase" note; add "Phase-Scope Mediation" section covering inputs, judgment, addendum shape (unchanged), corrective handoff filename with PHASE sentinel, single-pass phase_review clause, ancestor-derivation rule. Preserve all existing task-scope content. |
| `.claude/skills/orchestration/references/pipeline-guide.md` | `phase_review_completed` event section | One-paragraph pointer to the playbook for phase-scope mediation. Parallel to iter-10's addition. |
| `.claude/skills/orchestration/references/action-event-reference.md` | Action #5 row (~line 16); `phase_review_completed` event row (~line 54) | Action row: one-line mediation note. Event row: document the new frontmatter contract (reviewer's raw verdict + exit_criteria_met + orchestrator's additive mediation fields). |
| `.claude/skills/orchestration/references/document-conventions.md` | Filename Patterns (~line 9-18); Corrective Suffix (~line 20-35); Frontmatter Field Reference | Add phase-sentinel corrective Task Handoff row (`tasks/{NAME}-TASK-P{NN}-PHASE-C{N}.md`). Extend Corrective Suffix to document sentinel form. Update `corrective_scope` enum to include `"phase"`. **Remove** the `{NAME}-PHASE-REVIEW-…-C{N}.md` corrective-form row (phase_review single-pass under new design). |
| `.claude/skills/orchestration/scripts/lib/mutations.ts` | `PHASE_REVIEW_COMPLETED` handler (line ~339; `changes_requested` branch ~391-441) | Delete reset block; implement Iter-10-parallel mediation contract; birth-on-handoff-path with scaffolded body nodes + synthesized pre-completed `task_handoff` sub-node; budget enforcement. Write effective_outcome to `phase_review.verdict`. |
| `.claude/skills/orchestration/scripts/lib/mutations.ts` | `CODE_REVIEW_COMPLETED` handler (line ~624; corrective append block) | Route corrective-of-corrective append via ancestor-derivation: extract hosting iteration (phaseIter or taskIter) from the resolved code_review node's ancestor. Append to hosting.corrective_tasks. |
| `.claude/skills/orchestration/scripts/lib/mutations.ts` | `COMMIT_COMPLETED` handler (line ~944) | Add phase-scope-first branch: if phaseIter has an active corrective, route commit_hash there. Else fall through to task-scope routing. |
| `.claude/skills/orchestration/scripts/lib/mutations.ts` | `resolveNodeState` (lines ~52-55) | Update stale comment — phase-level correctives now carry pre-seeded nodes. No functional change. |
| `.claude/skills/orchestration/scripts/lib/dag-walker.ts` | Lines ~171-184 | Delete empty-nodes halt stub entirely. Stub is unreachable under iter-11's pre-seeded-nodes invariant. |
| `.claude/skills/orchestration/scripts/lib/context-enrichment.ts` | `execute_task` enrichment lines ~148-180 | Add phase-scope-first branch before task-scope corrective check. When phaseIter has active corrective, route handoff_doc to phase-scope corrective's `task_handoff.doc_path`. |
| `.claude/skills/orchestration/scripts/lib/context-enrichment.ts` | `spawn_code_reviewer` enrichment lines ~182-198 | Add phase-scope-first branch. When phaseIter has active corrective, route `head_sha`, `is_correction`, `corrective_index` to phase-scope corrective. |
| `.claude/skills/orchestration/scripts/lib/context-enrichment.ts` | `TASK_LEVEL_ACTIONS` base context | Decide task_number / task_id behaviour for phase-scope corrective dispatches: null, sentinel (`P{NN}-PHASE`), or synthetic. Planner to pick at plan time — verify existing coder/reviewer consumers of task_id first. |
| `.claude/skills/orchestration/scripts/lib/frontmatter-validators.ts` | `phase_review_completed` rules (lines ~143-154) | Extend with iter-10-parallel conditional mediation contract using existing `when` + `mustBeAbsent` machinery. No new validator primitives. |
| `.claude/skills/code-review/phase-review/workflow.md` | lines ~28, ~42, ~48, ~79-85, ~108, ~115 | Remove: Corrective-review check step, Corrective Review Context section, expected-corrections verdict note, `Previous Phase Review` Inputs row, both corrective save-path rows. Add: `Requirements` Inputs row. Verify: no PRD/Architecture/Design residue remains. |
| `.claude/skills/code-review/task-review/workflow.md` | save-path section (~line 32-36) | Add parallel named-sentinel save-path form: `CODE-REVIEW-P{NN}-PHASE-C{N}.md` for task-level code reviews of phase-scope correctives. |
| `ui/lib/document-ordering.ts` | lines ~197-235 | Extend the phase-loop traversal with a parallel iteration of `iteration.corrective_tasks` (phase scope). Emit step-node `doc_path`s with `(Phase-C{N})` title suffix. Mirrors the existing task-scope corrective emission block at lines 220-228. |

**Helpers to reference but not modify:**

- `mutations.ts` `findTaskLoopBodyDefs` (line ~609) — unchanged; still scaffolds the corrective's body nodes for both scopes.
- `mutations.ts` `resolveTaskIteration` / `resolvePhaseIteration` — reference utilities for mutation routing.
- `scripts/lib/explode-master-plan.ts` lines ~598-610 — reference pattern for synthesizing the pre-completed `task_handoff` sub-node; same shape used by iter-10 `CODE_REVIEW_COMPLETED` and will be used by iter-11 `PHASE_REVIEW_COMPLETED`.
- `dag-walker.ts` corrective walking block (lines ~154-212) — unchanged structurally; the halt stub deletion is the only edit.

## Dependencies

- **Depends on**: Iter 10 — task-level mediation plumbing, orchestrator agent definition, corrective-playbook reference, frontmatter-validator conditional contract (`when` + `mustBeAbsent`), and the `task_handoff` sub-node synthesis pattern must be in place. Iter 11 extends every one of these to a second scope.
- **Blocks**: Iter 12 — code-review diff-based rework benefits from having both task + phase corrective cycles stable before it narrows the reviewer's input surface. No other downstream iteration has a hard dependency on iter-11.

## Playbook extension contents

`corrective-playbook.md` gains a "Phase-Scope Mediation" section plus a top-level "Scope" lead-in. In whatever structure reads well:

- **Lead-in at the top of the playbook**: "This playbook covers both task-scope and phase-scope mediation. The core flow — read the review, judge findings, write the addendum, author the handoff — is identical at both scopes. Section titles call out scope when relevant." Update the opening paragraph to remove the "task-scope" narrow framing (iter-10 wrote it as task-scope-only).
- **Phase-Scope Mediation section** (new):
  - **When phase mediation fires**: only on `phase_review` `verdict: changes_requested`. Approved reviews propagate untouched. Rejected reviews halt.
  - **Per-finding judgment inputs**: read the finding's referenced file/line; trace to requirement ID in `{NAME}-REQUIREMENTS.md`; re-read the master plan's phase exit criteria and the task handoffs in the phase; run `git diff <phase_first_sha>~1..<phase_head_sha>` (or the fallback `git diff HEAD`) to see the cumulative phase diff the reviewer judged.
  - **Cross-artifact scan**: scan the master plan for phase boundaries, adjacent phase artifacts, requirement IDs traced elsewhere. Phase-scope findings often legitimately span tasks (integration, contract drift) or belong to a future phase (decline with cross-artifact rationale).
  - **Action-vs-decline criteria**: same as task-scope — action when the finding traces to an inlined requirement this phase owes; decline when it's out-of-contract or speculative.
  - **Single-pass phase_review clause**: `phase_review` runs exactly once per phase iteration. If mediated as `changes_requested`, the phase-scope corrective's task-level code review (not a second phase_review) is the approval path. If the corrective's task-review itself returns `changes_requested`, the orchestrator mediates that review following the task-scope flow — the resulting corrective is appended flat to `phaseIter.corrective_tasks[]` per the ancestor-derivation rule.
  - **Addendum shape**: identical to task-scope. Budget banner (`Attempt N of M`) uses `phaseIter.corrective_tasks.length` at phase scope.
  - **Corrective handoff filename**: `tasks/{NAME}-TASK-P{NN}-PHASE-C{N}.md`. `PHASE` occupies the T-slot since phase-scope correctives don't belong to a specific task.
  - **Corrective handoff frontmatter**: same as task-scope except `corrective_scope: phase` (vs `corrective_scope: task`).
  - **Corrective handoff body**: prose preamble describing the original phase's intent (what the phase was trying to accomplish cumulatively) followed by the corrective steps. No delta reasoning, no references to prior attempts or task reviews.
  - **Bundling**: one corrective handoff per mediation cycle. All actioned findings land in one handoff.
  - **Budget**: before mediating, read `max_retries_per_task` from `orchestration.yml` (default 5) and compare to `phaseIter.corrective_tasks.length`. Same config, same check point, same halt behaviour as task scope.
- **Ancestor-derivation section** (new, near the "Scope" lead-in): "When a phase-scope corrective's own task-level code review returns `changes_requested`, mediation fires exactly as it would on any task-level review. The orchestrator authors the addendum and (if applicable) a corrective handoff with `corrective_scope: phase` pointing at another phase-sentinel filename (C2, C3, ...). The pipeline derives the hosting iteration (phaseIter) from the reviewed node's location automatically — the orchestrator does not write any scope hint to the review doc or event payload."

## Prompt Harness Behavior (`phase-review-mediation-e2e`)

New prompt-test behavior that gives the iteration end-to-end regression protection against phase-scope mediation drift. Parallels the iter-10 `corrective-mediation-e2e/` harness.

### Why this exists

Unit tests catch engine bugs; this catches **orchestrator prompt-content drift** — the kind that only surfaces when a real Claude session reads the playbook, judges findings against a multi-task phase, and authors a corrective phase handoff that flows through the real pipeline. Iter 11 is particularly sensitive to this: the playbook now covers two scopes, the filename sentinel changes shape, and the ancestor-derivation routing relies on the orchestrator authoring the corrective handoff path into the phase_review doc frontmatter correctly.

### Folder shape

```
prompt-tests/phase-review-mediation-e2e/
  README.md              # why this exists, how to run, pass criteria
  _runner.md             # kickoff prompt for the simulated orchestrator session
  user-instructions.md   # operator hand-verification steps (UI eyeball, addendum quality, etc.)
  fixtures/
    <fixture-name>/      # pre-seeded project at the "phase_review returned changes_requested" moment
      BRAINSTORMING.md
      {NAME}-REQUIREMENTS.md
      {NAME}-MASTER-PLAN.md
      phases/{NAME}-PHASE-01-…md
      tasks/{NAME}-TASK-P01-T01-…md
      tasks/{NAME}-TASK-P01-T02-…md
      reports/
        {NAME}-CODE-REVIEW-P01-T01-…md    # pre-authored, verdict: approved
        {NAME}-CODE-REVIEW-P01-T02-…md    # pre-authored, verdict: approved
        {NAME}-PHASE-REVIEW-P01-…md       # pre-authored, verdict: changes_requested
      src/…               # two-file implementation with cross-task contract drift
      state.json          # pre-seeded to the exact pre-mediation moment
      orchestration.yml   # local override, auto_commit: never + auto_pr: never
      template.yml        # copy of default.yml for harness self-containment
  output/
    <fixture-name>/.gitkeep
    <fixture-name>/baseline-<fixture>-YYYY-MM-DD/run-notes.md
```

### Fixture design — two-task cross-task contract drift (decided at planning time)

Phase with 2 tasks that both pass individual code-review but don't integrate correctly:

- **T1**: creates `src/colors.js` exporting `makeColors()` returning an **array of strings** `['red', 'orange', 'yellow']`. Code review approves — contract satisfies T1's handoff.
- **T2**: creates `src/greet.js` exporting `greet(names)` that iterates `names` expecting **objects with a `.name` property** (e.g., `names.map(n => \`Hello, ${n.name}\`)`). T2's handoff said "consume makeColors()" but didn't pin the shape. Code review approves T2 in isolation — the code compiles, tests (if any) pass.
- **Phase review** runs `git diff <phase_first_sha>~1..<phase_head_sha>`, catches the cross-task shape mismatch, returns `verdict: changes_requested` with one finding: "T2's greet() expects an object shape, T1's makeColors() returns strings — integration broken."
- **Orchestrator mediates**: actions the finding, authors `tasks/{NAME}-TASK-P01-PHASE-C1.md` instructing the coder to fix `greet()` to accept the string shape.
- **Coder** implements the fix. **Re-reviewer** (task-level code review of the phase-scope corrective) approves. Walker advances past task_gate, marks phase iteration completed, pipeline reaches display_complete (or halt on a subsequent phase that doesn't exist in the minimal fixture).

The fixture must be minimal enough that the coder can fix it deterministically and the reviewer can approve deterministically, while exercising every new surface in iter-11. Fixture name TBD at plan time (suggestion: `colors-greet-mismatch`).

### Fixture details

- **Pre-seeded state.json** carries the pre-iter-11 shape: `requirements`, `master_plan`, `explode_master_plan` all complete. `phase_loop.iterations[0].task_loop.iterations[0]` and `[1]` both have `task_executor`, `commit`, `code_review`, `task_gate` all `completed`. `phase_loop.iterations[0].nodes['phase_review'].status = 'in_progress'` with the review doc already on disk. `phase_loop.iterations[0].corrective_tasks = []`.
- **`auto_commit: never`** in the fixture config — avoids requiring the harness to make real commits. Reviewer operates on `git diff HEAD` + untracked files.
- **Template** — fixture ships `template.yml` (copy of `default.yml`) so the harness is self-contained and resilient to future `default.yml` changes.

### `_runner.md` contract

Goal-oriented kickoff prompt for a simulated orchestrator Claude session. Mirror the `corrective-mediation-e2e/_runner.md` shape:

- **Mission**: you are the orchestrator mid-phase-corrective cycle. The fixture is pre-seeded at the moment `phase_review` returned `changes_requested`. Your job is to mediate the phase-scope review and drive the cycle to `approved`.
- **Setup**: copy the fixture to `output/<fixture>/<run-folder>/`, set up workspace paths, use `--config <run-folder>/orchestration.yml` on every pipeline call.
- **Drive the cycle**: load `corrective-playbook.md` (both scope sections), read the phase review doc, judge the finding, write the `## Orchestrator Addendum` section + additive frontmatter, author the corrective phase-sentinel Task Handoff, signal `phase_review_completed --doc-path <path>`. Route the returned actions through the two-step protocol: `execute_task` → `@coder` → `invoke_source_control_commit` (skipped under `auto_commit: never`) → `spawn_code_reviewer` → `@reviewer` re-review. Continue until `approved` or halt.
- **Outputs**: write `run-notes.md` summarizing each step, every agent spawn, every event signaled, every judgment call.
- **Exit**: do not approve any human gate downstream of the mediation. Halt once the corrective's task-level re-review returns `approved` and the walker advances past the task_gate (phase iteration completes without re-running phase_review). Surface file paths and key state values.

### Pass criteria (shape-based, accommodates non-determinism)

1. **Phase-scope corrective birthed**: `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length >= 1` AND the corrective's `task_handoff.status === 'completed'` AND its `task_handoff.doc_path` points at the phase-sentinel handoff filename.
2. **Addendum present on phase_review doc**: contains `## Orchestrator Addendum` with budget banner, disposition table, `Effective Outcome` line.
3. **Additive frontmatter on phase_review doc**: `orchestrator_mediated: true`, `effective_outcome ∈ {approved, changes_requested}`, `corrective_handoff_path` iff `effective_outcome === changes_requested`. `exit_criteria_met` untouched from reviewer's original write.
4. **Phase-sentinel corrective handoff file exists**: `tasks/{NAME}-TASK-P01-PHASE-C1.md` with frontmatter `corrective_index: 1`, `corrective_scope: phase`, `budget_max` and `budget_remaining` set.
5. **Phase-iteration reset block is GONE**: `phase_loop.iterations[0].nodes['phase_review'].status === 'completed'` (NOT reset to not_started); its `verdict` is the effective_outcome (not null); `nodes['phase_planning'].status === 'completed'` (NOT reset); `nodes['task_loop']` iterations are unchanged (NOT cleared).
6. **Re-review doc stateless**: the task-level re-review doc body does NOT reference the prior phase review (grep heuristic: no "previous review" / "prior review" / "phase review said" / "first attempt").
7. **Walker completes phase**: `phase_loop.iterations[0].corrective_tasks[0].status === 'completed'` AND `phase_loop.iterations[0].status === 'completed'`. Graph does not halt.
8. **`phase_review` does not re-run**: only ONE phase_review doc exists on disk (no `-C1.md` corrective form); the walker does not re-dispatch `spawn_phase_reviewer` after the corrective's task-review approves.
9. **Budget intact**: `phaseIter.corrective_tasks.length <= max_retries_per_task`; should converge in 1 cycle on the happy-path fixture.
10. **Task-level re-review save-path uses phase sentinel**: re-review doc filename matches `CODE-REVIEW-P01-PHASE-C1.md` (not the regular `CODE-REVIEW-P01-T{NN}-{TITLE}.md` form).

### `user-instructions.md` content

Operator hand-verification steps run AFTER the automated `_runner.md` run. Parallel to the iter-10 harness:

- Read `output/<fixture>/<run-folder>/run-notes.md` for the run summary.
- Inspect the addendum appended to the phase_review doc: is the disposition rationale coherent? Does the budget banner make sense? Does the effective-outcome line match the disposition table?
- Inspect the authored phase-sentinel corrective handoff for self-sufficiency: no references to prior attempts, no delta reasoning, steps executable as a standalone spec.
- Inspect the task-level re-review doc: statelessness check (no reference to phase review); correct save-path (`CODE-REVIEW-P01-PHASE-C1.md`).
- Boot the UI dev server (`cd ui && npm run build && npm run dev`, kill port 3000 occupants first). Verify: phase-scope corrective renders in the phase iteration panel; corrective task-group label reads `PHASE-C1`; new frontmatter fields render in the document viewer; addendum renders in the markdown viewer; legacy pre-iter-11 state.json still renders clean (no missing-node warnings, no layout regressions).
- Report any regression or quality concern to the iteration agent before iteration is considered done.

### `.gitignore` pattern

Mirror the iter-10 pattern. Append to the repo-root `.gitignore`:

```
/prompt-tests/phase-review-mediation-e2e/output/*/*/**
!/prompt-tests/phase-review-mediation-e2e/output/*/.gitkeep
!/prompt-tests/phase-review-mediation-e2e/output/<fixture-name>/baseline-*/run-notes.md
```

### Cost profile

Per run on the happy-path fixture: 1 mediator step (in-session, no spawn) + 1 `@coder` (corrective attempt) + 1 `@reviewer` (re-review) = **~2 Opus agent spawns**. Same as iter-10's harness. If the first corrective fix misses, +2 (another coder + another reviewer).

### Harness failures are blockers, not suggestions

Same rule as iter-10. If the harness run fails, or the pipeline emits an error mid-run, or the frontmatter validator rejects orchestrator output and no self-correction recovers it, or the mutation hard-errors, or any structural pass criterion fails to land green — **stop and resolve the root cause before merging**. Iter 11 is the last load-bearing change in the corrective-cycles redesign; drift here lands quietly.

## Testing Discipline

Baseline-first. Capture `baseline-tests.log` across all three trees before any edits:

- `.claude/skills/orchestration/scripts/` — `npm test` (vitest)
- `ui/` — `npm test` (`node --test --import tsx`)
- `installer/` — `npm test` (`node --test --experimental-test-module-mocks`)

Do NOT commit baseline / final test logs.

### Test surfaces — high-impact (core corrective-flow rework)

- `scripts/tests/mutations.test.ts`:
  - `phase_review_completed` tests — rewrite for mediation contract (parallel to iter-10's `code_review_completed` tests): approved / changes_requested+handoff / changes_requested+no-handoff / rejected branches. Assert synthesized `task_handoff` sub-node shape on each phase-scope corrective entry.
  - `code_review_completed` corrective-of-corrective routing — add tests for the ancestor-derivation path: new corrective appends to phaseIter when the reviewed code_review lives under an active phase-scope corrective; new corrective appends to taskIter otherwise.
  - `commit_completed` — add tests for phase-scope-first routing: when phaseIter has active corrective, commit_hash lands on `phaseIter.corrective_tasks[latest].commit_hash`; else task-scope behaviour unchanged.

- `scripts/tests/mutations-phase-corrective.test.ts`:
  - **Entire file rewrite.** The existing tests exercise the phase-iteration-reset logic that disappears. Rewrite for append-only semantics: birth a phase-scope corrective with handoff path → scaffolded body nodes + synthesized pre-completed `task_handoff` + phaseIter.corrective_tasks append. No reset. Test the approved / rejected branches stay as they are.

- `scripts/tests/dag-walker.test.ts`:
  - **Un-skip the three phase-corrective walker tests** at lines ~1591, ~1624, ~1666. Update fixture assertions for pre-seeded-nodes semantics (not empty-nodes halt).
  - Add a test asserting the empty-nodes halt stub is gone (any pre-seeded empty-nodes corrective now walks without halting — or, if that's impossible to construct under iter-11's invariants, document it as an invariant in a comment).

- `scripts/tests/corrective-integration.test.ts`:
  - **Un-skip the phase-corrective end-to-end test** at lines ~693-749. Rewrite for append-only semantics: phase_review changes_requested → mediation → corrective handoff authored → corrective executes → task-level review approves → phase iteration completes without re-running phase_review.
  - Add a multi-round phase-scope test (parallel to iter-10's task-scope multi-round): two correctives in succession, verify `handoff_doc` and `corrective_index` resolve correctly per round.

- `scripts/tests/contract/09-corrective-cycles.test.ts`:
  - Phase-corrective regression tests (previously skipped pending iter-11) — un-skip.
  - Add tests asserting: (a) no corrective is birthed when `effective_outcome === 'approved'` at phase scope (filter-down path); (b) `effective_outcome` overrides raw `verdict` in `phase_review.verdict` state write; (c) ancestor-derivation appends to the correct array across phase/task scope combinations.

### Test surfaces — medium-impact (validation / wiring)

- `scripts/tests/contract/05-frontmatter-validation.test.ts`:
  - Add conditional-rule coverage for `phase_review_completed`: all three verdict branches × valid + invalid mediation-field combinations. Mirrors iter-10's `code_review_completed` coverage.
- `scripts/tests/mutations-negative-path.test.ts`:
  - Hard-error coverage for phase scope: `effective_outcome=changes_requested` with no `corrective_handoff_path` → clean halt with budget-exhausted message; budget exhausted + supplied handoff → hard halt with contract-violation message. Parallel to iter-10's task-scope coverage.
- `scripts/tests/engine.test.ts` / `scripts/tests/event-routing-integration.test.ts`:
  - Add wiring tests for `phase_review_completed` with the new mediation shape. Follow iter-10's decision to fold into `event-routing-integration.test.ts` (not duplicate in engine.test.ts) per the iter-10 deviation log.
- `scripts/tests/pre-reads.test.ts`:
  - Verify pre-reads surfaces the new mediation frontmatter fields from `phase_review_completed` docs onto event context and that validator errors propagate.
- `scripts/tests/context-enrichment.test.ts`:
  - Add tests: (a) `execute_task` enrichment routes `handoff_doc` to phase-scope corrective's handoff when active; (b) `spawn_code_reviewer` enrichment routes `head_sha` / `is_correction` / `corrective_index` to phase-scope corrective when active; (c) `TASK_LEVEL_ACTIONS` base context behaves correctly under phase-scope corrective (task_number / task_id decision landed).
- `scripts/tests/contract/06-state-mutations.test.ts`:
  - Add mutation contracts for phase-scope handoff-path-driven birth + ancestor-derivation corrective-of-corrective.

### UI

- `ui/lib/document-ordering.ts` — extend the phase-loop traversal to also iterate `iteration.corrective_tasks` (phase scope), emitting step-node `doc_path`s with a `(Phase-C{N})` title suffix. See UI Impact section above for the gap rationale.
- `ui/lib/document-ordering.test.ts` — add coverage asserting phase-scope corrective doc_paths surface in the ordered list.
- `ui/components/dag-timeline/dag-iteration-panel.test.ts` — add test asserting `DAGIterationPanel` with `parentKind: 'for_each_phase'` + populated `iteration.corrective_tasks` forwards the array to `DAGCorrectiveTaskGroup`.
- `ui/components/dag-timeline/dag-timeline-legacy-render.test.ts` — add a new fixture + test asserting a phase-iteration with a populated `corrective_tasks` entry renders without errors AND legacy (empty `corrective_tasks`) canary continues to pass unchanged.

No component file changes needed — `DAGIterationPanel` + `DAGCorrectiveTaskGroup` are already generic across scopes.

### Installer

No changes. Retry-limit config lives in iter-12.

### Prompt harness

Not part of `npm test`. Operator-driven. Inaugural `baseline-<fixture>-YYYY-MM-DD/run-notes.md` gets committed; all 10 pass criteria must be green.

## Exit Criteria

All must hold before the iteration is considered done:

- All three test suites green vs. baseline (orchestration vitest, UI node-test, installer node-test). No baseline-passing test regresses.
- `corrective-playbook.md` covers both task and phase scopes; the task-scope content from iter-10 is preserved; a new Phase-Scope Mediation section and a Scope lead-in are added.
- Orchestrator agent definition reflects both scopes in its mediation-flow summary.
- `PHASE_REVIEW_COMPLETED` mutation births phase-scope correctives from handoff paths, not from raw reviewer verdict. State's `phase_review.verdict` records the effective outcome. The reset block is gone.
- `CODE_REVIEW_COMPLETED` mutation routes corrective-of-corrective appends via ancestor-derivation. Task-scope-only paths continue to behave exactly as in iter-10 (no regression).
- `COMMIT_COMPLETED` mutation routes commit hashes to phase-scope corrective when one is active; else task-scope behaviour unchanged.
- `dag-walker.ts` empty-nodes halt stub is deleted. Walker traverses phase-scope correctives via the same corrective-walking code path used for task-scope.
- `frontmatter-validators.ts` `phase_review_completed` rules enforce the conditional mediation contract via the same `when` + `mustBeAbsent` machinery iter-10 introduced.
- `context-enrichment.ts` `execute_task` and `spawn_code_reviewer` route correctly under both task-scope and phase-scope correctives. `TASK_LEVEL_ACTIONS` base context handles phase-scope corrective dispatches sensibly.
- `phase-review/workflow.md` has no Corrective-review check, no Corrective Review Context, no expected-corrections note, no Previous Phase Review Inputs row, no corrective save-path rows. Requirements row is present. No PRD/Architecture/Design residue.
- `task-review/workflow.md` save-path section documents the phase-sentinel form for task-level reviews of phase-scope correctives.
- `document-conventions.md` lists the phase-sentinel corrective Task Handoff filename row + updated `corrective_scope` enum. The corrective-form `PHASE-REVIEW-...-C{N}.md` row is removed.
- Prompt harness `phase-review-mediation-e2e/` exists with one fixture, inaugural baseline committed, all 10 shape-based pass criteria green. `.gitignore` re-include rule added.
- `ui/lib/document-ordering.ts` emits phase-scope corrective doc_paths with `(Phase-C{N})` titles. Tests in `document-ordering.test.ts`, `dag-iteration-panel.test.ts`, and `dag-timeline-legacy-render.test.ts` updated per the UI section above. Legacy canary unchanged.
- In-implementation UI manual verification: the implementing agent boots the UI dev server (kill port 3000 first; set up `ui/.env.local` with `WORKSPACE_ROOT` + `ORCH_ROOT=.claude` per `installer/lib/env-generator.js`), points at the harness run folder, and visually confirms phase-scope corrective rendering + legacy regression-free. This happens mid-iteration, not as a post-hoc operator hand-verification (though `user-instructions.md` also documents operator-facing steps).
- All four Iter-7-carry-forward walker / integration tests (three in `dag-walker.test.ts`, one in `corrective-integration.test.ts`) un-skipped and passing against append-based semantics.
- No task-scope regression: every iter-10 test continues to pass.
- Progress tracker updated with Progression Log entry, Deviation entries where execution diverged, Branches & Worktrees table entry for iter-11. Iter-10 carry-forward Open Items (if any from the iter-10 log) resolved.
- **User has been explicitly reminded to read `prompt-tests/phase-review-mediation-e2e/user-instructions.md` (and any retroactive iter-10 reminder if applicable) and complete the hand-verification before the iteration is considered done.**

## Open Questions

Resolved at planning time (2026-04-21):

- **Phase-corrective context enrichment**: Phase-scope-first detection in `execute_task` / `spawn_code_reviewer` enrichment. No synthetic task index; no new action family.
- **Corrective-of-corrective routing**: Ancestor-derivation — hosting iteration is the parent of the code_review node being completed. No new event fields, no orchestrator-authored scope hints.
- **Phase-review corrective filename**: Removed from document-conventions.md and phase-review/workflow.md (single-pass phase_review under new design). Future iteration that adds phase-review re-run can re-introduce.
- **Harness fixture**: two-task cross-task contract drift (`colors-greet-mismatch` or equivalent). Exercises every new surface.

Carry-forward to planning time (resolve when authoring the plan):

- **task_number / task_id behaviour on phase-scope corrective dispatches**: null vs. sentinel (`P{NN}-PHASE`) vs. synthetic index. Planner verifies existing coder/reviewer consumers of `task_id` first.
- **UI phase-scope corrective rendering gap**: planner greps UI for `phaseIter.corrective_tasks` handling and decides whether any additive UI code is required. Minimum-diff principle: if existing components already render the shape, no code change.
- **`resolveHostingIteration` helper vs. inline**: inline ancestor-walk in `CODE_REVIEW_COMPLETED` handler vs. a small helper function. Planner picks based on clarity.
