# Iter 13 — Execute-coding-task rework

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

> **Scope note**: The orchestrator authors corrective task handoffs (Iters 10–11) as fresh, self-contained files with the same shape as original handoffs. The executor therefore reads whichever handoff is pointed at under a single uniform contract — no mode branching on original-vs-corrective, no special handling for corrective attempts.

## Overview

The executor today is trained to re-read upstream planning docs (Requirements, Master Plan, other upstream artifacts) when executing a task. Under the new design, every task-handoff is self-contained: the explosion script inlines the requirements the task satisfies, the steps to take, and the exact code/commands/files. The executor's contract narrows dramatically — read ONLY the task-handoff doc, do what it says.

The same contract applies uniformly to original handoffs (emitted by the explosion script in Iter 5) and corrective handoffs (authored by the orchestrator in Iters 10–11). Both are self-sufficient. The executor does not care which is which, and does no mode-branching.

TDD / DRY / YAGNI principles get an explicit section in the skill workflow. The executor has historically scope-crept into refactor territory; this iteration hardens the "minimum code to pass the step, nothing more" discipline.

## Scope

- Rewrite `.claude/skills/execute-coding-task/SKILL.md` top-down:
  - **Input contract**: task-handoff doc path only. No Requirements doc. No Master Plan. No other upstream artifacts.
  - **Reading model**: each task's handoff is self-contained — FR/NFR/AD/DD requirements are inlined, steps are explicit, file paths / commands / test commands are pre-resolved.
  - **No branching between original and corrective handoffs.** The executor reads whichever doc is pointed at by `handoff_doc` in context. Any corrective context the coder needs is inlined by the orchestrator into the corrective handoff itself. The executor has no visibility into the Iter-12 finding tier (on-track / drift / regression / met / missing) that birthed a corrective — the orchestrator pre-digests tier reasoning into handoff content.
  - **Task-type branching in the operational checklist.** For `code` tasks: 4-step RED-GREEN shape is mandatory (write failing test → run and confirm fail → implement → run and confirm pass). For `doc` / `config` / `infra` tasks: follow handoff steps in order; TDD is not required, but every step still ends in a requirement tag. This mirrors `rad-create-plans/references/master-plan/workflow.md:132–140`.
  - **TDD / DRY / YAGNI operational checklist + self-checks**:
    - Every step satisfies ≥1 requirement tag (FR-N / NFR-N / AD-N / DD-N).
    - No speculative code; no refactors outside the step's scope.
    - `code` tasks follow the RED-GREEN pattern per the inlined steps; don't skip the failing-test step.
    - File edits stay within the handoff's File Targets list.
    - Executor self-checks against these rules at runtime and logs any gaps or interpretive decisions as Execution Notes (below).
  - **Execution Notes appendix (process feature, not violation log).** When the handoff is ambiguous, under-specified, or requires a judgment call outside the literal steps (e.g., a File Targets exception), the executor makes a best-effort interpretation and appends an `## Execution Notes` section to the bottom of the handoff doc describing: which step, what was ambiguous or needed interpretation, what the executor did, and the rationale. The handoff thus becomes both an intent record (from explode / orchestrator) and an execution record (from executor). This gives the orchestrator and Iter-12's reviewer visibility into where handoff authoring needed shoring up — flowing signal back upstream without halting the pipeline.
  - **Commit discipline**: unchanged. The executor does not commit. The pipeline's existing `commit_gate` / `invoke_source_control_commit` step owns commit cadence.

- **Ripple: orchestrator corrective-playbook amendment.** `.claude/skills/orchestration/references/corrective-playbook.md` must require orchestrator-authored corrective handoffs for `code` tasks to honor the 4-step RED-GREEN shape — matching the explosion script's output. This retroactively tightens the Iter 10–11 playbook; log as a deviation in the progress tracker.

- **Ripple: downstream Iter-14 signpost.** The invariants Iter-13 codifies (every step ends in a requirement tag; `code` tasks honor 4-step RED-GREEN; File Targets mandatory) are natural plan-audit checks for `rad-plan-audit` (Iter 14). The Iter-14 planner should pick these up as plan-time audit rules rather than relying on executor-time Execution Notes to surface authoring gaps.

## Scope Deliberately Untouched

- `context-enrichment.ts` — `execute_task` enrichment routes `handoff_doc` to the active corrective handoff when one exists. That routing landed in Iter 10 (task-scope correctives) and was extended in Iter 11 (phase-scope correctives). This iteration does not touch enrichment; the executor simply consumes what's passed.
- Source-control skill — commits remain in its purview. The executor does not call git directly.
- `rad-plan-audit` — Iter 14.
- Review workflows — Iter 12 handled the diff-based rework.
- **Iter-12 finding-tier visibility in the executor** — out of scope; executor is context-free on tier (see Scope). The orchestrator pre-digests tier reasoning when authoring correctives.
- **New validators or pre-execution gates** — no new validator lands in Iter-13; rigor is expressed via operational checklist + self-check + Execution Notes, not via hard gates. If these prove insufficient in practice, a validator becomes a follow-up iteration.

## UI Impact

- **Active-project rendering**: task-handoff `doc_path` links continue to work. Handoff docs may now carry an `## Execution Notes` appendix — rendered as ordinary markdown under the same `doc_path`, no node-shape change.
- **Legacy-project read-only rendering**: unchanged; legacy handoffs have no Execution Notes section and render identically to today.
- **UI surfaces touched**: none. Handoffs are treated opaquely; the UI does not specially parse Execution Notes content.
- **UI tests**: none specific to this iteration. Corrective-handoff rendering coverage belongs to Iters 10–11.

## Code Surface

- Skill: `.claude/skills/execute-coding-task/SKILL.md`
- Tests:
  - `.claude/skills/orchestration/scripts/tests/execution-integration.test.ts` — extend to cover uniform handling across original and corrective handoffs (no mode-branching observed; no Requirements or Master Plan reads).
  - `.claude/skills/orchestration/scripts/tests/corrective-integration.test.ts` — confirm the rewritten executor handles original and corrective handoffs identically through the same execution path.
  - **New grep-based contract test** — assert SKILL.md body contains the key language blocks (no-upstream-reads rule, TDD/YAGNI operational checklist, task-type branching, Execution Notes mechanism). Catches prose regressions across future edits.
- Prompt harness:
  - `prompt-tests/execute-coding-task-e2e/` — new dedicated harness fixture exercising TDD rigor on a `code` task, File Targets discipline, Execution Notes logging on an intentionally ambiguous handoff step, and uniform handling across original and corrective handoffs. Inaugural baseline captured at iteration exit.
- Ripple surfaces:
  - `.claude/skills/orchestration/references/corrective-playbook.md` — amend to require 4-step RED-GREEN shape for `code`-task corrective handoffs authored by the orchestrator.
  - `.claude/skills/orchestration/references/action-event-reference.md` — executor input-surface description (handoff-only) and Execution Notes appendix reference.
  - `.claude/skills/rad-execute/SKILL.md` — audit-only; expected no change, but confirm no stale executor-input vocabulary.

## Dependencies

- **Depends on**: Iter 11 — phase-level corrective cycles must be in place so the "handoff is handoff, regardless of origin" claim is validated at both task and phase scopes before this iteration tightens the executor's contract.
- **Blocks**: nothing critical. Iter 14 (rad-plan-audit) is not blocked but **inherits** Iter-13's invariants (tag-on-every-step, 4-step RED-GREEN for `code` tasks, File Targets mandatory) as natural plan-time audit checks. Iter-14 planning should pick these up as audit rules so authoring gaps get caught at plan-time instead of surfacing as Execution Notes at execute-time.

## Testing Discipline

- **Baseline first**: full suite + log + SHA across all three trees (scripts, ui, installer).
- **Re-run before exit**: full suite green; diff against baseline; no baseline-passing test regresses.
- **Contract tests (grep-based)**: new test that asserts SKILL.md retains key language blocks — no-upstream-reads, TDD/YAGNI checklist, task-type branching, Execution Notes. Catches prose drift in the future.
- **Behavioral tests**: extend `execution-integration.test.ts` + `corrective-integration.test.ts` to exercise original and corrective handoffs through an identical execution path, with assertions on no upstream-doc reads and identical event routing.
- **Prompt harness**: `execute-coding-task-e2e/` fixture runs green; inaugural baseline captured; Execution Notes appears on the deliberately ambiguous step; no mode-branching observed between original and corrective handoff executions.

## Exit Criteria

- Full test suite green vs. baseline across all three trees.
- `.claude/skills/execute-coding-task/SKILL.md` explicitly forbids reading Requirements / Master Plan at task execution time (language like "DO NOT read upstream planning docs; everything you need is in the task-handoff").
- TDD / DRY / YAGNI operational checklist present in SKILL.md, with `code` vs `doc` / `config` / `infra` task-type branching.
- Execution Notes appendix mechanism documented in SKILL.md (when to emit, format, where it lives in the handoff body).
- Executor fixture test passes equivalently on original and corrective handoffs — no mode-branching observed.
- Grep-based contract test covering the key language blocks passes.
- `execute-coding-task-e2e/` prompt-harness fixture runs green; inaugural baseline committed.
- Corrective-playbook (`orchestration/references/corrective-playbook.md`) amended to require 4-step RED-GREEN shape for `code`-task correctives authored by the orchestrator. Tracker carries a deviation noting the retroactive tightening.
- Companion signpost present for Iter-14 rad-plan-audit adoption of Iter-13's invariants.
