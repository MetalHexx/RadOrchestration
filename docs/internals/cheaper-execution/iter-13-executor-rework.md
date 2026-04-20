# Iter 13 — Execute-coding-task rework

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

> **Scope note**: The orchestrator authors corrective task handoffs (Iters 10–11) as fresh, self-contained files with the same shape as original handoffs. The executor therefore reads whichever handoff is pointed at under a single uniform contract — no mode branching on original-vs-corrective, no special handling for corrective attempts.

## Overview

The executor today is trained to re-read upstream planning docs (Requirements, Master Plan, other upstream artifacts) when executing a task. Under the new design, every task-handoff is self-contained: the explosion script inlines the requirements the task satisfies, the steps to take, and the exact code/commands/files. The executor's contract narrows dramatically — read ONLY the task-handoff doc, do what it says.

The same contract applies uniformly to original handoffs (emitted by the explosion script in Iter 5) and corrective handoffs (authored by the orchestrator in Iters 10–11). Both are self-sufficient. The executor does not care which is which, and does no mode-branching.

TDD / DRY / YAGNI principles get an explicit section in the skill workflow. The executor has historically scope-crept into refactor territory; this iteration hardens the "minimum code to pass the step, nothing more" discipline.

## Scope

- Rewrite `.claude/skills/execute-coding-task/SKILL.md`:
  - Input contract: task-handoff doc path only. No Requirements doc. No Master Plan. No other upstream artifacts.
  - Reading model: each task's handoff is self-contained — FR/NFR/AD/DD requirements are inlined, steps are explicit, file paths / commands / test commands are pre-resolved.
  - **No branching between original and corrective handoffs.** The executor reads whichever doc is pointed at by `handoff_doc` in context. Any corrective context the coder needs is inlined by the orchestrator into the corrective handoff itself.
  - TDD / DRY / YAGNI explicit subsection: "every step satisfies ≥1 requirement tag; no speculative code; no refactors outside the step's scope; follow RED-GREEN test pattern per the inlined steps."
  - Commit discipline: unchanged. The executor does not commit. The pipeline's existing `commit_gate` / `invoke_source_control_commit` step owns commit cadence.

## Scope Deliberately Untouched

- `context-enrichment.ts` — `execute_task` enrichment routes `handoff_doc` to the active corrective handoff when one exists. That routing lands in Iter 10 (task-scope correctives) and is extended in Iter 11 (phase-scope correctives). This iteration does not touch enrichment; the executor simply consumes what's passed.
- Source-control skill — commits remain in its purview. The executor does not call git directly.
- `rad-plan-audit` — Iter 14.
- Review workflows — Iter 12 handled the diff-based rework.
- Corrective-handoff authoring format — the orchestrator's playbook from Iters 10–11 is the source of truth for handoff shape. This iteration consumes the format, does not redefine it.

## UI Impact

- **Active-project rendering**: task-handoff `doc_path` links continue to work. Corrective handoffs authored by the orchestrator render identically to original handoffs — same doc shape, same file location under `tasks/`.
- **Legacy-project read-only rendering**: unchanged.
- **UI surfaces touched**: none.
- **UI tests**: none specific to this iteration. Corrective-handoff rendering coverage belongs to Iters 10–11.

## Code Surface

- Skill: `.claude/skills/execute-coding-task/SKILL.md`
- Tests:
  - `.claude/skills/orchestration/scripts/tests/execution-integration.test.ts`
  - `.claude/skills/orchestration/scripts/tests/corrective-integration.test.ts` — confirm the rewritten executor handles original and corrective handoffs identically (no mode-branching observed; no Requirements or Master Plan reads)
- Ripple surfaces:
  - `.claude/skills/orchestration/references/action-event-reference.md` — executor input-surface description
  - `.claude/skills/rad-execute/SKILL.md` — any references to executor's input surface

## Dependencies

- **Depends on**: Iter 11 — phase-level corrective cycles must be in place so the "handoff is handoff, regardless of origin" claim is validated at both task and phase scopes before this iteration tightens the executor's contract.
- **Blocks**: nothing critical downstream. Iter 14 (rad-plan-audit) is independent.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline.
- **Uniform-contract fixture test**: confirm the rewritten executor processes an orchestrator-authored corrective handoff (fixture-level, from Iters 10–11 test artifacts) through the identical execution path as an original handoff and produces a clean fix commit.

## Exit Criteria

- Full test suite green vs. baseline.
- `.claude/skills/execute-coding-task/SKILL.md` explicitly forbids reading Requirements / Master Plan at task execution time (language like "DO NOT read upstream planning docs; everything you need is in the task-handoff").
- TDD / DRY / YAGNI section present in SKILL.md.
- Executor fixture test passes equivalently on original and corrective handoffs — no mode-branching observed.

## Open Questions

- **YAGNI cap on step-count**: the `code` task template from Iter 1 declares exactly 4 steps (RED-GREEN TDD shape). Do orchestrator-authored corrective handoffs honor the same shape? The corrective-playbook from Iters 10–11 prescribes handoff structure; confirm during planning that the playbook's output meets the executor's RED-GREEN expectations, otherwise the executor's contract and the orchestrator's output drift.
