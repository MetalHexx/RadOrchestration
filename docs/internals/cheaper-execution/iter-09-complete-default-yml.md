# Iter 9 — Complete `default.yml`

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

Through Iter 8, `default.yml` holds only the planning-phase stub: `requirements → master_plan → explode_master_plan → plan_approval_gate`. Legacy agents / workflows / actions / events / mutations / context-enrichment entries for the pieces this iteration wires in have already been cleared. What remains: assemble the execution phase of the new pipeline by copying the shape full.yml/quick.yml used (minus the removed authoring body nodes) into `default.yml`.

`quick.yml` is also deleted this iteration — its existence is an indirection that confuses agents during the refactor (two choices, one deprecated, one canonical). Once `default.yml` is the only live template, `rad-plan`'s template-selection logic collapses to a one-line default. The process editor UI's hardcoded `templateId="full"` at `ui/app/process-editor/page.tsx:17` flips to `"default"`.

After this iteration: a scratch project runs end-to-end on `default.yml` from brainstorm through final approval. No pipeline code references `quick.yml`, `phase_planning` (body), `task_handoff` (body), or `phase_report`. `full.yml` still sits on disk, deprecated, for legacy state.json rendering.

## Scope

- Complete `.claude/skills/orchestration/templates/default.yml` by adding the execution-phase nodes (after `plan_approval_gate`):
  - `gate_mode_selection` (gate kind)
  - `phase_loop` (for_each_phase kind; iterates pre-seeded phases)
    - body (no `phase_planning` body node):
      - `task_loop` (for_each_task kind; iterates pre-seeded tasks)
        - body (no `task_handoff` body node):
          - `task_executor` (step)
          - `commit_gate` (conditional wrapping a `commit` step)
          - `code_review` (step)
          - `task_gate` (gate)
      - `phase_review` (step; expanded per Iter 8)
      - `phase_gate` (gate)
  - `final_review` (step)
  - `pr_gate` (conditional wrapping `final_pr` step)
  - `final_approval_gate` (gate)
- Delete `.claude/skills/orchestration/templates/quick.yml` entirely.
- Update `ui/app/process-editor/page.tsx:17`: change hardcoded `templateId="full"` → `"default"`.
- Update `.claude/skills/rad-plan/SKILL.md`: drop the "Choose between 'full' or 'quick'" Step 1; `default.yml` is the canonical template. Custom templates remain an option if the user supplies a `project_template` arg pointing at one.
- Purge `quick.yml` references across installer, validation script, tests.

## Scope Deliberately Untouched

- No new actions / events / mutations — Iter 9 uses only the ones already wired through prior iterations (execution-phase pieces like `execute_task`, `spawn_code_reviewer`, `spawn_phase_reviewer`, `spawn_final_reviewer`, `gate_task`, `gate_phase`, `request_final_approval`, `invoke_source_control_commit`, `invoke_source_control_pr` all survive the refactor unchanged).
- `full.yml` — remains on disk deprecated. Do NOT delete.
- Code-review skill rework + execute-coding-task rework + corrective cycles — those are Iters 10, 11, 12 respectively. This iteration uses the existing (pre-rework) skills; the template wiring is the only change.
- State.json schema — no additions. Existing schema handles the seeded phase/task iterations from Iter 5.

## UI Impact

- **Active-project rendering**: first iteration where the full `default.yml` pipeline renders end-to-end. Every node type expected by the timeline (requirements, master_plan, explode_master_plan, phase_loop, task_loop, task_executor, commit_gate, code_review, task_gate, phase_review, phase_gate, final_review, pr_gate, final_approval_gate) is in place. A scratch project should drive the dashboard + project list + DAG timeline through a complete happy path.
- **Legacy-project read-only rendering**: `quick.yml` removed from disk but legacy state.json files referencing `template.id: quick` are still viewable. The UI renders from state.json, not from the template file, so removing quick.yml doesn't break legacy rendering. Confirm via fixture test.
- **UI surfaces touched**:
  - `ui/app/process-editor/page.tsx:17` — change hardcoded `templateId="full"` to `"default"`.
  - Process editor template listing — confirm `default.yml` appears as canonical; audit for any other hardcoded "quick" / "full" references in `ui/app/process-editor/`.
  - Left-hand project list panel — no change needed; it lists projects by directory scan, not by template.
- **UI tests**:
  - End-to-end: a scratch project created from `default.yml` drives through the project list → DAG timeline → completion.
  - Process editor test: loading the page defaults to `default.yml`; `full.yml` renders with deprecated label (from Iter 3's filter); `quick.yml` doesn't appear in the listing at all.
  - Legacy rendering regression across all three surfaces: a state.json referencing `template.id: quick` still renders in (a) the project list, (b) the DAG timeline, AND (c) the process editor's project-sourced-from display. Symmetric coverage with the Iter 3 `full.yml` preservation — the three surfaces ensure nothing silently breaks when the template file isn't on disk.

## Code Surface

- Template: `.claude/skills/orchestration/templates/default.yml` (add execution-phase nodes)
- Template (delete): `.claude/skills/orchestration/templates/quick.yml`
- UI: `ui/app/process-editor/page.tsx:17` (templateId literal)
- Skill: `.claude/skills/rad-plan/SKILL.md` (drop quick/full selection UI)
- Ripple surfaces:
  - `.claude/skills/orchestration/validate/lib/checks/config.js` + any check that enumerates expected templates
  - `.claude/skills/orchestration/scripts/tests/e2e-template-selection.test.ts` — rewrites expected; selection between full/quick goes away
  - `.claude/skills/orchestration/scripts/tests/execution-integration.test.ts`, `parity.test.ts` (if present), integration fixtures
  - `installer/lib/cli.js` + `installer/lib/config-generator.js` — any reference to quick.yml by name
  - `.claude/skills/orchestration/references/{action-event-reference, document-conventions, pipeline-guide}.md` — template refs
- Tests (new): an end-to-end happy-path smoke test drives a scratch project on `default.yml` from brainstorm simulation to `final_approval_gate`.

## Dependencies

- **Depends on**: Iter 8 — phase_review is expected to carry the absorbed phase_report duties; `default.yml` wires the expanded phase_review (not two separate post-task steps).
- **Blocks**: Iter 10 — task-level corrective cycles need `default.yml`'s execution phase (task_loop + code_review + task_gate) wired end-to-end so the mediation flow can be exercised against a real pipeline. Iter 12's code-review rework also benefits from this baseline.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline. Removed `quick.yml` tests are expected; template-selection tests get rewritten. Any baseline-passing test on generic pipeline behavior must still pass.
- **End-to-end smoke**: new test (or extended existing integration) drives a happy-path project on `default.yml` through all nodes. This is the iteration's keystone evidence.

## Exit Criteria

- Full test suite green vs. baseline (noting the intentional removal of quick.yml-specific tests).
- `default.yml` validates under `template-validator.ts` without errors.
- `grep -rn "quick\.yml\|templates/quick" .` returns zero matches outside the cheaper-execution design-doc corpus (and this companion, which references it only as "removed").
- `ui/app/process-editor/page.tsx:17` carries `templateId="default"`.
- A scratch project runs: Requirements → Master Plan → explode → plan approval → phase_loop (≥1 phase, ≥1 task each) → task_executor + commit + code_review + task_gate → phase_review + phase_gate → final_review + pr_gate + final_approval_gate. All nodes reach `completed`.
- `rad-plan/SKILL.md` no longer offers a quick/full template choice.

## Open Questions

- **Process editor template listing**: does the UI enumerate templates by filesystem scan or hardcoded list? If hardcoded, `quick` mentions live there too. Grep `ui/` for `"quick"` / `"full"` / `templateId` during planning.
- **Custom template support in `rad-plan`**: the current Step 1 supports a `project_template` arg for custom templates. Keep this for future flexibility or simplify to always use `default.yml`? Recommendation: keep custom-template support — a single `default.yml` fallback with custom override matches the new intent. Iteration planner documents the final behavior.
- **Legacy template visibility in process editor**: when the editor lists templates and sees `full.yml` + `default.yml`, should it label full.yml "Deprecated"? The Iter 3 deprecation stamp makes this detectable. Nice-to-have UX polish; decide during iteration.
- **Template-selection test rewrites**: `e2e-template-selection.test.ts` exists and exercises the quick/full choice flow. Iteration planner rewrites or deletes this test suite as part of the quick.yml removal.
