# Iter 11 — Execute-coding-task rework + correction sections

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

The executor today is trained to re-read upstream planning docs (Requirements, Master Plan, other upstream artifacts) when executing a task. Under the new design, every task-handoff is self-contained: the explosion script inlines the requirements the task satisfies, the steps to take, and the exact code/commands/files. The executor's contract narrows dramatically — read ONLY the task-handoff doc, do what it says.

The second half of this iteration formalizes the correction-section format. When the code-reviewer (Iter 10) returns `changes_requested`, it amends the task-handoff with a dated `## Correction N — YYYY-MM-DD — <title>` section containing the finding and revised guidance. On the next executor run (triggered by Iter 12's corrective-cycle machinery), the executor operates in "correction mode": it reads the original handoff plus the latest `## Correction N` section plus the prior commit's diff for context of what was attempted. The executor's output commits a fix through the normal source-control step — no amend, no side channels.

TDD / DRY / YAGNI principles get an explicit section in the skill workflow. The executor has historically scope-crept into refactor territory; this iteration hardens the "minimum code to pass the step, nothing more" discipline.

## Scope

- Rewrite `.claude/skills/execute-coding-task/SKILL.md`:
  - Input contract: task-handoff doc path only. No Requirements doc. No Master Plan. No other upstream artifacts.
  - Reading model: each task's handoff is self-contained — FR/NFR/AD/DD requirements are inlined, steps are explicit, file paths / commands / test commands are pre-resolved.
  - Correction mode (branching based on context field `is_correction: true` + `corrective_index: N`):
    - Read the handoff's `## Correction N — YYYY-MM-DD — <title>` section (the latest by index).
    - Read the prior commit's diff via `git show <commit_hash>` where `commit_hash` is the task's prior commit SHA (available in context via existing enrichment from `context-enrichment.ts`).
    - Execute the revised guidance.
  - TDD / DRY / YAGNI explicit subsection: "every step satisfies ≥1 requirement tag; no speculative code; no refactors outside the step's scope; follow RED-GREEN test pattern per the inlined steps."
  - Commit discipline: unchanged. The executor does not commit. The pipeline's existing `commit_gate` / `invoke_source_control_commit` step owns commit cadence.
- Update the explosion script's task-handoff emission (Iter 5's `lib/explode-master-plan.ts`) to reserve a conventional "## Corrections" region at the end of each emitted task-handoff (placeholder comment marking where code-review appends). Note: the legacy `rad-create-plans/references/task-handoff/templates/` folder was deleted in Iter 7 — the explosion script is the only path producing task-handoff files by this iteration.
- Formalize the correction-section convention. Document the exact heading format, date format, body shape:
  ```markdown
  ## Correction 1 — 2026-04-16 — aria-selected missing
  **Finding**: <what was wrong>
  **Revised steps**: <what to do instead>
  ```
  This convention lives in the explosion script's output (empty placeholder), in the code-review skill workflows (Iter 10 already landed this — update if format drifts), and in the executor skill workflow (this iteration's read logic).
- Update the `code-review` skill outputs from Iter 10 if their correction-section format doesn't match this iteration's final convention. (Iter 10's task-review/workflow.md already writes these sections; this iteration locks the format.)

## Scope Deliberately Untouched

- Corrective-cycle MUTATIONS (how a `changes_requested` verdict produces a corrective iteration entry, how the walker re-enters the executor for the correction) — Iter 12 handles all engine-level cycle wiring.
- `context-enrichment.ts` — `execute_task` enrichment (post-Iter-7 rewire: reads from `taskIter.nodes['task_handoff'].doc_path`) passes the handoff path and `is_correction`, `corrective_index`, `previous_review`, `reason` fields (see lines 211-219 + task-loop enrichment at lines 189-209 pre-Iter-7). The new correction-mode executor consumes these context fields as already provided.
- Source-control skill — commits remain in its purview. The executor does not call git directly.
- `rad-plan-audit` — still legacy; Iter 13.

## UI Impact

- **Active-project rendering**: task-handoff `doc_path` links continue to work. Correction sections appended to task-handoff files appear as additional markdown content inside the doc — no UI node/shape change.
- **Legacy-project read-only rendering**: unchanged. Legacy task-handoffs don't have correction sections; they render unchanged.
- **UI surfaces touched**:
  - None in the DAG timeline.
  - If the UI has a doc-preview component that renders task-handoff content inline, it receives docs with the new `## Correction N — YYYY-MM-DD — <title>` sections — markdown-level content; should render without special handling.
- **UI tests**:
  - If a doc-preview component is tested, add a fixture with a correction-section task-handoff and assert it renders as markdown (headings visible, body visible).
  - No status-transition UI tests needed; corrective-cycle state-machine changes are Iter 12's scope.

## Code Surface

- Skill: `.claude/skills/execute-coding-task/SKILL.md`
- Explosion script: `.claude/skills/orchestration/scripts/lib/explode-master-plan.ts` (Iter 5's module) — update task-handoff emission to reserve correction region
- Code-review skill: confirm `.claude/skills/code-review/task-review/workflow.md` correction-section output matches this iteration's format
- Tests:
  - `.claude/skills/orchestration/scripts/tests/execution-integration.test.ts`
  - `.claude/skills/orchestration/scripts/tests/corrective-integration.test.ts` (existing — verifies corrective cycle; this iteration doesn't change its shape, but does change what the executor does inside)
  - New fixture: a task-handoff with a `## Correction 1` section + prior-commit fixture; execute in correction mode; produce the fix
- Ripple surfaces:
  - `.claude/skills/orchestration/references/action-event-reference.md` — executor mode description
  - `.claude/skills/rad-execute/SKILL.md` — any references to executor's input surface

## Dependencies

- **Depends on**: Iter 10 — code-review amends handoffs with correction sections; executor needs that mechanism in place to read them.
- **Blocks**: Iter 12 — corrective-cycle wiring assumes the executor can consume correction sections; confirm this iteration's work before wiring retry budgets and cleanup-phase injection.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline.
- **Correction-mode fixture test**: add a test where a task-handoff has one correction section + a prior commit; the executor in correction mode reads both and produces a fix commit. Assert the new commit contains the corrective change, not a duplicate of the original.

## Exit Criteria

- Full test suite green vs. baseline.
- `.claude/skills/execute-coding-task/SKILL.md` explicitly forbids reading Requirements / Master Plan at task execution time (language like "DO NOT read upstream planning docs; everything you need is in the task-handoff").
- Correction-mode fixture test passes: executor reads handoff + `## Correction 1` section + prior-commit diff, produces a fix.
- Task-handoff files emitted by the explosion script reserve a conventional place for correction sections.
- TDD / DRY / YAGNI section present in SKILL.md.

## Open Questions

- **Correction section location in emitted handoffs**: at the end of the file (empty placeholder section) or only appended when corrections happen? Lean: no placeholder, reviewer appends on `changes_requested`. Placeholders invite accidentally-empty corrections.
- **Prior-commit diff access**: the `previous_review` field from enrichment points to the review doc; the diff itself is reconstructed by the executor via `git show <commit_hash>`. Confirm the executor's skill has implicit access to git operations (it does — coder/coder-senior agents commonly call git). No new tooling needed.
- **Multiple corrections in one task**: if a task goes through 3 corrective cycles, the executor in cycle 3 reads Correction 1, 2, 3? Or only 3 (latest)? Design in root doc suggests "the latest" — validate reasoning. Iteration planner decides: probably read only latest, with the convention that each correction captures its own complete revised guidance.
- **YAGNI cap on step-count**: the `code` task template from Iter 1 declares exactly 4 steps (RED-GREEN TDD shape). Does correction mode override this? Lean: correction mode writes whatever steps the correction section specifies, ignoring the 4-step convention for corrections. Document explicitly in SKILL.md.
