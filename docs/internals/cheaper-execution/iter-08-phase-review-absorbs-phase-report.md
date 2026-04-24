# Iter 8 — phase_review absorbs phase_report

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

Today the phase loop runs two separate agents after tasks complete: `generate-phase-report` (a narrative report of what happened) and `phase-review` (a verdict on conformance + quality). Their inputs overlap heavily — both read the phase's tasks and their outputs — and their outputs are read together by downstream gates. This iteration consolidates: the `code-review/phase-review/` skill expands to emit both the verdict AND the structured phase summary, and `generate-phase-report` is retired.

The consolidation is primarily a skill-level change (content of `phase-review/workflow.md` + `template.md`) paired with removing the `phase_report` step from the engine — its action, events, mutation-registry entry in `phaseExecStartedSteps`, its individual `phase_report_created` handler, and the `generate_phase_report` entry in `context-enrichment.ts`'s `PHASE_LEVEL_ACTIONS` set. The `spawn_phase_reviewer` enrichment block also simplifies — it no longer looks up a `phase_report` node for the phase_report_doc field.

After this iteration: phase_review emits one artifact (verdict + phase summary in a single doc), `generate_phase_report` has no runtime or docs footprint, and `default.yml`'s phase_loop body (once wired in Iter 9) has only one post-task-loop step instead of two.

## Scope

- Delete `.claude/skills/generate-phase-report/` (entire folder: SKILL.md + templates/).
- Remove from `constants.ts`:
  - Action: `GENERATE_PHASE_REPORT`
  - Events: `PHASE_REPORT_STARTED`, `PHASE_REPORT_CREATED`
- In `mutations.ts`:
  - Remove `[EVENTS.PHASE_REPORT_STARTED, 'phase_report']` from `phaseExecStartedSteps` (symbol anchor; leaves the remaining `[PHASE_REVIEW_STARTED, 'phase_review']` entry).
  - Delete `phaseExecDocSteps` array + its for-loop outright — `PHASE_REPORT_CREATED` is its only entry, so the registration block becomes dead.
  - In `phase_review_completed`'s `CHANGES_REQUESTED` branch: strip `'phase_report'` from the `for (const nodeId of ['phase_report', 'phase_review', 'phase_gate'])` reset list. This branch is stubbed on the walker side post-Iter-7 but its state-shape reset is still exercised by `mutations-phase-corrective.test.ts`.
- In `context-enrichment.ts`:
  - Remove `'generate_phase_report'` from `PHASE_LEVEL_ACTIONS` set.
  - Remove the `generate_phase_report` special-case enrichment block.
  - Simplify the `spawn_phase_reviewer` enrichment block: remove the `phaseReport` node lookup + `phase_report_doc` field from the returned context. Phase review no longer reads a pre-authored report; Iter 12 will further rework this for diff-based strict conformance.
- In `dag-walker.ts`: update the v4-parity comment on the zero-tasks-phase branch — drop the `generate_phase_report` reference.
- Expand `.claude/skills/code-review/phase-review/workflow.md` + `template.md`:
  - **Absorption shape**: thread the phase-report template's 7 sections (Summary, Task Results, Exit Criteria Assessment, Files Changed, Issues & Resolutions, Carry-Forward Items, Master Plan Adjustments) INTO the phase-review template, merging with existing sections where they overlap (Summary, Exit Criteria → existing "Exit Criteria Verification"). New content lands as distinct sections for what doesn't overlap (Task Results, Files Changed, Carry-Forward Items, Master Plan Adjustments).
  - **Corrections Applied section**: distinct named section that makes corrective-cycle work easy to find. Renders empty on first-time reviews; populated on corrective re-reviews with what was fixed and how.
  - **Incidental cleanup** (Iter-3 residue): phase-review/workflow.md's Inputs table still lists PRD / Architecture / Design (removed in Iter 3) + Phase Report (removed by this iteration). Drop all four rows as part of the workflow edit; this file would otherwise stay stale until Iter 12/16 touched it.
  - Workflow output carries one frontmatter-tagged doc (`type: phase_review`, unchanged) with both the verdict shape and the structured summary shape.
- Remove `phase_report` body node from `full.yml`'s `phase_loop.body` and retarget the `phase_review.depends_on: [phase_report]` to `[task_loop]`. `full.yml` is deprecated but must still be syntactically valid so it loads under the deprecated-skip path.
- `@planner` agent (`.claude/agents/planner.md`): remove the `generate_phase_report` routing table row + the narrative line describing Phase Report generation.
- References: scrub `generate_phase_report` / `phase_report_*` vocabulary from `action-event-reference.md` (action row, 2 event rows, phase auto-resolution note), `context.md` (planner row description), `code-review/SKILL.md` (phase-review inputs row — drop `phase_report_doc`), and `orchestration/SKILL.md` action count if it still cites the old number. Cheaper-execution design-doc corpus is exempt.

## Scope Deliberately Untouched

- `phase_review_completed` validator rule in `frontmatter-validators.ts` stays — the expanded skill still emits this event; the rule's `verdict` + `exit_criteria_met` fields still apply.
- The rewiring of `phase_review`'s review semantics (diff-based input, strict conformance) is Iter 12's concern. The stateless-reviewer contract and workflow simplification (dropping Corrective-review checks) land in Iter 11 as part of the phase-level corrective cycles work. This iteration only does the phase-report absorption.
- `default.yml` — phase_loop body is still being built; by the time Iter 9 wires it, phase_report is already gone from the node vocabulary.

## UI Impact

- **Active-project rendering**: new `default.yml` phase_loop body has no `phase_report` step between task_loop and phase_review. Timeline renders one post-task-loop step (`phase_review`) instead of two.
- **Legacy-project read-only rendering**: legacy projects have `phase_report` step in `phase_loop.iterations[i].nodes`. The DAG timeline must continue to render it. Same polymorphic-body-rendering guarantee from Iter 7 applies here.
- **UI surfaces touched**:
  - DAG timeline body renderer — relies on Iter 7's polymorphic-iteration coverage; no additional code change expected.
  - `NODE_SECTION_MAP` — no change (phase_report is a body node, not top-level).
- **UI tests**:
  - **New fixture** (not just an extension): add a legacy state.json fixture that explicitly contains a `phase_report` body node inside `phase_loop.iterations[i].nodes` with `completed` status and a populated `doc_path`. Assert it renders in the iteration body just like its surrounding nodes. Iter 7's suite covers `phase_planning` / `task_handoff` only; `phase_report` rendering is first proven here.
  - Fixture test: new state.json without `phase_report` renders cleanly (one less body node in phase_loop iterations).
  - If the expanded phase-review doc format changes (verdict + summary section structure), update any UI tests that inspect rendered phase-review doc content.

## Code Surface

Line numbers are drift-prone; the plan file should re-resolve with grep at planning time. Symbol anchors below.

- **Skill (delete entirely)**: `.claude/skills/generate-phase-report/` (SKILL.md + templates/PHASE-REPORT.md)
- **Skill (expand)**: `.claude/skills/code-review/phase-review/workflow.md` + `.claude/skills/code-review/phase-review/template.md`
- **Agent**: `.claude/agents/planner.md` — routing row for `generate_phase_report` + narrative reference
- **Engine**:
  - `.claude/skills/orchestration/scripts/lib/constants.ts` — `NEXT_ACTIONS.GENERATE_PHASE_REPORT`, `EVENTS.PHASE_REPORT_STARTED`, `EVENTS.PHASE_REPORT_CREATED`
  - `.claude/skills/orchestration/scripts/lib/mutations.ts` — `phaseExecStartedSteps` entry, `phaseExecDocSteps` array + its for-loop (dies outright), `CHANGES_REQUESTED`-branch reset list in `phase_review_completed`
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts` — `PHASE_LEVEL_ACTIONS` set, `spawn_phase_reviewer` block (drop `phase_report_doc`), `generate_phase_report` block (delete)
  - `.claude/skills/orchestration/scripts/lib/dag-walker.ts` — zero-tasks-phase comment referencing `generate_phase_report`
- **Template**: `.claude/skills/orchestration/templates/full.yml` — delete `phase_report` body node + fix `phase_review.depends_on`
- **Tests** (not exhaustive — the plan's first action is a grep sweep):
  - Engine: `constants.test.ts`, `context-enrichment.test.ts`, `mutations.test.ts`, `mutations-negative-path.test.ts`, `mutations-phase-corrective.test.ts`, `engine.test.ts`, `execution-integration.test.ts`, `event-routing-integration.test.ts`, `corrective-integration.test.ts`, `verdict-validation.test.ts`, `template-loader.test.ts`, `e2e-template-selection.test.ts`, `fixtures/parity-states.ts`
  - Contract: `02-event-names.test.ts`, `03-action-contexts.test.ts` (phase_report_doc assertion), `04-gate-behavior.test.ts`, `06-state-mutations.test.ts`, `07-tier-transitions.test.ts`, `09-corrective-cycles.test.ts`
  - Dag-walker: skip any scaffolding that uses invented `create_phase_report` action names (those are abstract walker fixtures, not referencing the real action; leave untouched).
  - UI: Iter 7's `dag-timeline-legacy-render.test.ts` already covers `phase_report` legacy rendering. Extend if the grep sweep surfaces coverage gaps; otherwise no new UI tests required.
- **Ripple surfaces**:
  - `.claude/skills/orchestration/references/action-event-reference.md` — action table row 5, event table `phase_report_started` / `phase_report_created`, phase auto-resolution note.
  - `.claude/skills/orchestration/references/context.md` — `@planner` row description.
  - `.claude/skills/code-review/SKILL.md` — phase-review inputs row (drop `phase_report_doc`).
  - `.claude/skills/orchestration/SKILL.md` — action count if cited.
  - `.claude/skills/orchestration/validate/lib/checks/skills.js` — if it carries an expected skill roster (verify at planning time; no reference to generate-phase-report surfaced in current grep, so may be a no-op).

## Test Sweep Posture

User directive for this iteration: **comprehensive sweep, no dead code, no breaking tests, no half-removed vocabulary**. The plan's first action after baseline capture is a two-step grep sweep across the entire repo:

1. `grep -rn "generate_phase_report\|generate-phase-report\|phase_report_started\|phase_report_created\|phase_report_doc\|GENERATE_PHASE_REPORT\|PHASE_REPORT_STARTED\|PHASE_REPORT_CREATED" .claude/ ui/ installer/ docs/internals/` excluding the cheaper-execution design corpus.
2. `grep -rn "phase_report" .claude/ ui/ installer/` — this MUST return only the UI legacy-rendering paths (`ui/types/state.ts`, `ui/lib/document-ordering.ts`, `ui/components/execution/phase-card.tsx`, `ui/components/dag-timeline/...`, and their tests) + the legacy v4 schema / migrator files (which Iter 16 sunsets). Every engine-side match must be gone.

Inventory the matches at plan-write time; every hit becomes a deletion or an explicit "intentionally retained (legacy rendering)" note.

## Dependencies

- **Depends on**: Iter 7 — keeps the `phaseExecStartedSteps` array edits as two sequential, focused diffs rather than one tangled diff touching both concerns.
- **Blocks**: Iter 9 — `default.yml`'s phase_loop body expects one post-task-loop step (phase_review), not two (phase_report + phase_review).

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline. Removed tests for `generate_phase_report` events are expected; the Iter-0 regression test covering `phase_report_created`'s fallback behavior gets deleted alongside the handler it tested (deliberate regression under this iteration's scope — note in progress tracker).
- Add a focused test: `phase-review` skill run against a complete phase emits a doc with both structured summary sections AND a verdict; both linter-style structure check and event-routing test pass.

## Exit Criteria

- Full test suite green vs. baseline (noting deliberate removal of Iter-0's `phase_report_created` regression test).
- `grep -rn "generate_phase_report\|phase_report_started\|phase_report_created\|generate-phase-report" .claude/` returns zero matches outside the cheaper-execution design-doc corpus.
- A simulated phase-review run emits one artifact that passes both the conformance-verdict shape check AND the structured-summary shape check.
- No code path references a `phase_report` node in state.json.

## Resolved at Planning Time (2026-04-20)

- **Structured phase summary shape**: **Option (b)** — thread phase-report's 7 sections INTO phase-review's existing template, merging where they overlap and adding distinct sections for what doesn't. A named **Corrections Applied** section makes corrective-cycle work easy to find (empty on first-time reviews).
- **Phase review doc type**: stays `type: phase_review`. Frontmatter carries existing `verdict` + `exit_criteria_met` fields; body absorbs the summary sections. No new doctype, no validator rule changes.
- **Iter-0 regression test fate**: the `phase_report_created` auto-resolution regression test is deleted alongside the handler it tested. Not a regression — intentional removal. Logged in progress tracker at iteration exit.
- **`spawn_phase_reviewer` enrichment simplification**: happens in Iter 8, not deferred. Drops `phase_report_doc` from context now; the `contract/03-action-contexts.test.ts` assertion updates to match. Iter 12 handles the further rework for diff-based strict conformance.
- **Incidental cleanup of Iter-3 residue** (PRD / Architecture / Design refs in phase-review/workflow.md Inputs table): applied in Iter 8 since the file is being edited anyway. Cheap, reduces confusion; Iter 12 rewrites the file further but would otherwise inherit stale framing.
- **V4 legacy sunset**: out of scope for Iter 8 — deferred to Iter 16 (repository deep clean), which absorbs the v4 migrator + legacy schema + `$schema` identifier rename (v4 → v5) as a scoped addition.
