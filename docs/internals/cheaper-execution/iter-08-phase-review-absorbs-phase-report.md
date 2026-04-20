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
  - Remove `[EVENTS.PHASE_REPORT_STARTED, 'phase_report']` from `phaseExecStartedSteps` (line ~189)
  - Remove the individual `phase_report_created` handler (wherever it lives; the Iter-0 fix referenced this handler)
- In `context-enrichment.ts`:
  - Remove `'generate_phase_report'` from `PHASE_LEVEL_ACTIONS` set (line ~76-81)
  - Remove the `generate_phase_report` special-case enrichment block (lines ~156-163)
  - Simplify the `spawn_phase_reviewer` enrichment block (lines ~132-154): remove the `phaseReport` node lookup and `phase_report_doc` field. The phase review agent now reads only its own inputs (Requirements + phase-plan + commit-SHA diff per Iter 12's rework).
- Expand `.claude/skills/code-review/phase-review/workflow.md` + `template.md`:
  - Workflow captures both: (a) structured phase summary (task outcomes, corrections applied, diff stats, risk notes) and (b) conformance verdict with `exit_criteria_met` field.
  - Template output carries both sections in one frontmatter-tagged doc.
- Remove `phase_report` body node from `full.yml`'s `phase_loop.body` (if still present — `full.yml` is already deprecated; this keeps it syntactically tidy).

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

- Skill (delete entirely): `.claude/skills/generate-phase-report/`
- Skill (expand): `.claude/skills/code-review/phase-review/workflow.md` + `.claude/skills/code-review/phase-review/template.md`
- Engine:
  - `.claude/skills/orchestration/scripts/lib/constants.ts` (action + events removal)
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:189` (phaseExecStartedSteps) + individual handler (search for `PHASE_REPORT_CREATED`)
  - `.claude/skills/orchestration/scripts/lib/context-enrichment.ts:76, :156-163, :132-154` (set entry, block, enrichment simplification)
- Template: `.claude/skills/orchestration/templates/full.yml` (remove phase_report body node; file is deprecated)
- Tests:
  - `.claude/skills/orchestration/scripts/tests/mutations.test.ts`, `mutations-phase-corrective.test.ts`
  - `.claude/skills/orchestration/scripts/tests/context-enrichment.test.ts`
  - `.claude/skills/orchestration/scripts/tests/contract/06-state-mutations.test.ts`
- Ripple surfaces:
  - `.claude/skills/orchestration/validate/lib/checks/skills.js` (drop generate-phase-report from expected skill roster)
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, pipeline-guide}.md`
  - `.claude/skills/code-review/SKILL.md` (note that phase-review emits two concerns in one doc)

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

## Open Questions

- **Structured phase summary schema**: what exactly does the expanded phase-review output look like? One-doc-two-sections, or frontmatter-rich with both fields? Iteration planner defines the exact shape. Reference: the current `generate-phase-report/templates/` is the starting point for what content the summary must cover.
- **Iter-0 regression test fate**: three tests were added in Iter 0 to cover the corrective-cycle auto-resolution fix. One of them (`phase_report_created after a task-level corrective cycle with empty context`) becomes irrelevant when the handler is deleted. Record the intentional removal in the progress tracker; don't let it look like a regression.
- **Phase review doc type**: currently `phase_review` produces its own doc type (`phase_review`) with `verdict` + `exit_criteria_met`. Does absorbing phase_report change the `type` field? Lean: keep `type: phase_review`, add a structured-summary section inside. Confirm during planning.
