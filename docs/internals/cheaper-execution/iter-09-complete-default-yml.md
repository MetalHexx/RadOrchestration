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

**Primary edits:**

- Template: `.claude/skills/orchestration/templates/default.yml` — add execution-phase nodes (shape copied from `full.yml`, already retargeted by Iter 8's `phase_review.depends_on: [task_loop]`).
- Template (delete): `.claude/skills/orchestration/templates/quick.yml`.
- UI: `ui/app/process-editor/page.tsx:17` — `templateId="full"` → `"default"`.
- Skill: `.claude/skills/rad-plan/SKILL.md` — drop quick/full selection Step 1; Step 1 collapses to: CLI `--template` → config `default_template` (non-`ask`) → `"default"`. Custom template names remain supported.

**Engine fallback flips (engine-correctness — critical for "default.yml is canonical" exit criterion):**

- `.claude/skills/orchestration/scripts/lib/template-resolver.ts` — hardcoded `"full"` final fallback at line 30 (and matching jsdoc lines 7–8) → `"default"`.
- `.claude/skills/orchestration/scripts/lib/state-io.ts:32` — `DEFAULT_CONFIG.default_template: 'full'` → `'default'` (the zero-config in-memory default).
- `template-resolver.test.ts:95–104` — two fallback assertions (`default_template: ''` → templateName `"full"`; `default_template: 'ask'` → templateName `"full"`) flip to `"default"`. ~4 assertion updates. These are the only test assertions that directly exercise the fallback literal; DO NOT mass-replace `'full'` across other test fixtures.

**Scope boundary for the `"full"` → `"default"` flip (important — don't cascade):**

Keep the flip narrowly scoped to load-bearing engine fallbacks + their matched tests. Do **not** mass-replace `'full'` across ~35 other test files that use it as a fixture value — `full.yml` stays on disk (retained deprecated per Iter 3), so those fixtures remain valid coverage.

- **Leave unchanged** — `default_template: 'full'` in ~20 test-config helpers (`mutations*.test.ts`, `dag-walker.test.ts`, `engine.test.ts`, etc.). They're shape-complete fixtures, not fallback assertions.
- **Leave unchanged** — `template_id: 'full'` in state fixtures across ~15 files. Those tests exercise full.yml loading (deprecated but still on disk). This is valid regression coverage.
- **Leave unchanged** — `migrate-to-v5.ts` + `migrate-to-v5.test.ts` + `migrated-state-integration.test.ts` hardcoded `'full'`. V4 states legitimately came from full.yml; flipping would be historically inaccurate. V4 migrator sunset is Iter 16's scope.
- **Leave unchanged** — `ui/lib/document-ordering.test.ts:415` + `ui/lib/template-api-helpers.test.ts:85` (isolated `'full'` as generic template-name fixture).

**Ripples (actually present in tree — grep-verified):**

- `.claude/skills/orchestration/config/orchestration.yml:14` — comment `# full | quick | <custom-name> | ask` → drop `quick`.
- `.claude/skills/orchestration/SKILL.md:33` — "Pipeline templates (`full.yml`, `quick.yml`)" → "(`default.yml`, `full.yml`)".
- `.claude/skills/orchestration/scripts/lib/mutations.ts:983` — comment references `full.yml, quick.yml`; update for `quick.yml` removal.
- `prompt-tests/plan-pipeline-e2e/_runner.md:53` — "Config quirk — read once, then act" note explaining `ask` → `full.yml` fallback. The quirk goes away post-Iter-9 (fallback is now `default.yml`). Simplify or remove the note; `--template default` first-call workaround no longer needed.
- `.claude/skills/orchestration/scripts/tests/e2e-template-selection.test.ts` — rewrite. Quick/full selection matrix collapses; replace with coverage of the new fallback chain (state → CLI → config → `"default"`) and the `ask` resolution path.
- `.claude/skills/orchestration/scripts/tests/quick-template.test.ts` — **delete entirely** (103-line file dedicated to quick.yml structural assertions).
- `ui/lib/template-serializer.test.ts` + `ui/lib/template-layout.test.ts` — swap `quick.yml` fixture → `default.yml`. Post-Iter-9 `default.yml` has the full execution shape, so it's a meaningful second fixture alongside `full.yml`; coverage stays comparable.
- Other tests that reference `template_id: 'full'` / `template: 'full'` as fixture content (e.g. `ui/lib/document-ordering.test.ts:415`, `ui/lib/template-api-helpers.test.ts:85`) — leave as-is; they assert generic template-name handling, not canonical-template behavior.

**Ripples dropped from the original companion (no matches in live tree — the companion was guessing):**

- `.claude/skills/orchestration/validate/lib/checks/config.js` — validates `orchestration.yml` schema only, does not enumerate templates. No edit needed.
- `installer/lib/cli.js` + `installer/lib/config-generator.js` — zero `quick.yml` references. Installer is clean.
- `parity.test.ts` — deleted in Iter 7; no such file.
- `.claude/skills/orchestration/references/{action-event-reference, document-conventions, pipeline-guide}.md` — no actionable `quick`/`full` specific references (greps clean).

**New tests:**

- End-to-end happy-path smoke: a scratch project drives `default.yml` from brainstorm simulation to `final_approval_gate`.
- `default.yml` template-loader test — parses cleanly, all node ids resolve, exec-phase nodes present.

**Process editor health check (user-flagged):**

- Per user: the process editor view may currently be broken. **Iter 9 scope includes verifying the editor renders `default.yml` end-to-end and fixing any rendering regressions found in the UI smoke step.** If broken: add the fix + a regression test in-iteration rather than deferring.

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
