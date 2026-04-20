# Iter 12 — Corrective cycle wiring (phase-level + final-level)

> **Validation Preface**: Before planning this iteration, the planner agent MUST validate this doc against live code — file paths, symbol names, and line numbers can drift. Run a quick grep / glob pass on the Code Surface section below. Any mismatch → log a deviation in [`CHEAPER-EXECUTION-REFACTOR-PROGRESS.md`](../CHEAPER-EXECUTION-REFACTOR-PROGRESS.md) before proceeding. Do not plan on stale assumptions.

## Overview

Iter 10 establishes diff-based strict-conformance reviews. Iter 11 teaches the executor to handle correction sections. This iteration wires the corrective *cycles* themselves: what happens when a reviewer rejects, how many times a retry can happen before the pipeline halts, and how cleanup phases get injected when final review fails.

Three retry budgets apply at three levels. Task-level uses the existing `limits.max_retries_per_task`. Phase-level and final-level are new: `limits.max_phase_review_retries` (default 2) and `limits.max_final_review_retries` (default 1). All three are configurable per project.

Phase-level corrective behavior changes significantly: instead of re-planning the entire phase, a `changes_requested` verdict from phase_review appends a corrective task to the phase's iteration. The walker re-enters the task loop for just that one corrective task. This uses the same append-task pattern the task-level corrective cycle already uses, just at the phase iteration level.

Final-level corrective behavior injects a cleanup phase: first miss creates `P{N+1}-CLEANUP`, subsequent misses append corrective tasks to its existing iteration. This lifts the phase-level mechanism one more level up with a dedicated naming convention.

Mutation-level corrective seeding also becomes template-aware — instead of hardcoding `task_handoff` in the corrective node list (which no longer exists after Iter 7), it clones whatever body nodes the active template defines. No template-name branching; it's a runtime read of the active template's `bodyDefs`.

This iteration also touches every surface that reads or writes orchestration.yml limits: installer, configure-system skill, UI config editor.

## Scope

- Add to `.claude/skills/orchestration/config/orchestration.yml`:
  ```yaml
  limits:
    # ... existing ...
    max_phase_review_retries: 2    # NEW — phase-level corrective-task appends per phase
    max_final_review_retries: 1    # NEW — cleanup-phase injection cap
  ```
- Extend `.claude/skills/orchestration/schemas/orchestration-state-v5.schema.json` (the `limits` object is declared around **line 51**; it currently carries `additionalProperties: false` which must be relaxed or the new fields must be explicitly added to `properties` — flag this during planning, it's a schema-level blocker if missed):
  - `limits.max_phase_review_retries`: integer ≥ 0, optional, default 2.
  - `limits.max_final_review_retries`: integer ≥ 0, optional, default 1.
  - Iteration schema: `is_cleanup: boolean` (optional, default false on non-cleanup phases).
  - Iteration schema: retry counters (new optional field on phase iterations tracking phase_review_retries count; on state root or pipeline block tracking final_review_retries count).
- Update `.claude/skills/orchestration/scripts/lib/validator.ts` and `schema-validator.ts` to accept the new optional fields.
- In `mutations.ts`:
  - Make corrective task seeding template-aware: when a corrective task entry is created (e.g., from `code_review_completed` changes_requested, or the new phase-level append), clone the active template's task-loop body node definitions rather than hardcoding node IDs. The `template` parameter is already passed to mutation functions (see `CODE_REVIEW_COMPLETED` handler signature) — use it.
  - Extend `PHASE_REVIEW_COMPLETED` handler (already at line ~267): on `changes_requested`, instead of invoking re-planning logic, append a corrective task to the phase iteration. Check `max_phase_review_retries` before appending; if exhausted, halt with operator-facing message listing unmet exit_criteria.
  - Extend `FINAL_REVIEW_COMPLETED` handler (line ~721): on `changes_requested`, check if a `P{N+1}-CLEANUP` phase iteration exists on `phase_loop`. If not, inject one with `is_cleanup: true`. If it exists, append a corrective task to its existing iteration. Check `max_final_review_retries` before first injection; if exhausted after the allowed cleanup round, halt with operator-facing message.
- In `dag-walker.ts:171-194` (phase-level corrective re-planning branch, stubbed to **throw** in Iter 7 — see Iter 7 prerequisites section below): replace the stub with corrective-task-append re-entry logic — walk the phase's `task_loop.iterations` for the new corrective task entry, then resume normal body execution when done.

## Iter 7 prerequisites (added 2026-04-19) — tests skipped pending this iteration's rewire

Iter 7 stubs `dag-walker.ts:171-194` with an explicit `throw`. To keep CI green, Iter 7 also `it.skip()`'d the four tests that directly exercise the branch. **This iteration must un-skip OR replace each of them as part of the corrective-task-append rewire.** Detailed breakdown so the Iter 12 planner has zero rediscovery cost:

| File:line | Test name | What it asserted (pre-Iter-7) | Replacement contract for Iter 12 |
|---|---|---|---|
| `tests/dag-walker.test.ts:1590` | `'phase-level corrective with task body nodes: walker returns first task body action'` | After `phase_review_completed` with `changes_requested`, the walker re-enters the phase body and dispatches the first action of the corrective body nodes (under the old `create_phase_plan` re-planning model). | Walker re-enters the phase's `task_loop.iterations` for the **newly-appended corrective task entry** and dispatches its first task-body action (`create_task_handoff` is gone — likely `execute_task` for the seeded corrective task). |
| `tests/dag-walker.test.ts:1622` | `'phase-level corrective completion: advances iteration when all corrective body nodes done'` | When all body nodes of a corrective phase iteration reach completed, the walker advances to the next phase iteration. | When the corrective task entry reaches completed, the walker re-runs `phase_review` (or advances to the next phase iteration if budget exhausted). New assertion: phase-iteration-level retry counter increments. |
| `tests/dag-walker.test.ts:1663` | `'phase-level halted corrective returns display_halted'` | When a corrective phase iteration carries a halt-state, walker surfaces a display_halted result. | When `max_phase_review_retries` is exhausted, walker surfaces the operator-facing halt with unmet exit_criteria payload. Different halt path; same display_halted shape. |
| `tests/corrective-integration.test.ts:510` | `'phase-level corrective loop — phase review changes_requested → re-planning → complete → advances'` | End-to-end: phase review rejects → walker re-enters create_phase_plan → planner authors corrective phase plan → completes → walker advances. | End-to-end: phase review rejects → mutation appends corrective task → walker enters that task → executor + reviewer round-trip → re-runs phase_review → approves → walker advances. (No re-planning in the loop.) |

Each test currently carries an `it.skip(..., 'STUB PENDING ITER 12 REWIRE — see iter-12-corrective-cycles.md')` comment landed by Iter 7. Iter 12's exit criteria must include either un-skipping (and updating assertions) or replacing each, with no `it.skip()` left for these four titles.
- Update `.claude/skills/configure-system/SKILL.md`: add the two new limit fields to the interactive questionnaire (likely a new Group 6 or extension to Group 3).
- Update `installer/lib/config-generator.js` (already at `limits:` block around line 33): add the two new fields to the generated orchestration.yml template.
- Update `installer/lib/cli.js`: add prompts for the two new fields (following the pattern of the existing `max_retries_per_task` / `max_consecutive_review_rejections` prompts).
- Update the UI config editor (whichever pages edit orchestration.yml): surface the new fields in the edit form.
- Optional UI: render `is_cleanup: true` phases with a subtle badge in the DAG timeline.

## Scope Deliberately Untouched

- `frontmatter-validators.ts` — retry counters and `is_cleanup` live in state.json, not doc frontmatter. Validator rules need no changes.
- `context-enrichment.ts` — existing `spawn_phase_reviewer` / `spawn_code_reviewer` blocks already compute SHAs the reviewers need. No new enrichment required for corrective cycles themselves.
- `code-review` / `execute-coding-task` skills — their behavior lands in Iters 10 + 11. This iteration wires the state-machine plumbing around them.

## UI Impact

- **Active-project rendering**: two new state.json fields become visible:
  1. `is_cleanup: true` on cleanup-phase iterations — optional UI badge differentiates them in the DAG timeline.
  2. Retry counters (phase-level, final-level) — could surface as a badge or tooltip on the iteration tile showing "Attempt N of M" for in-flight corrective cycles.
- Also: corrective-task append semantics means phase iterations grow new entries during a review cycle; the timeline's iteration-panel renderer must handle iteration-array growth gracefully (it already does, per the polymorphic pattern from earlier iterations, but worth re-confirming).
- **Legacy-project read-only rendering**: unchanged. Retry counters and `is_cleanup` are additive optional fields; legacy state.json lacking them renders with default/absent behavior.
- **UI surfaces touched**:
  - DAG timeline iteration renderer — optional `is_cleanup` badge as a new `ui/components/badges/is-cleanup-badge.tsx` file (the folder already hosts `retry-badge`, `pipeline-tier-badge`, `gate-mode-badge`, etc. — consistent home for a new badge).
  - UI config editor — must surface the two new `orchestration.yml` fields in edit forms. The config editor lives at `ui/components/config/{config-editor-panel,config-form,config-field-row}.tsx` backed by `ui/app/api/config/route.ts`. Adding the two integer fields to the form + API schema is the scope.
  - Left-hand project list panel at `ui/components/sidebar/{project-sidebar,project-list-item}.tsx` — no change (tier derivation isn't affected by cleanup phases).
- **UI tests**:
  - Fixture test: state.json with `is_cleanup: true` cleanup phase iteration renders with badge.
  - Fixture test: state.json with retry counters > 0 renders the counter display correctly.
  - Config editor round-trip test: load orchestration.yml with new fields → edit → write → reload → new values persisted.
  - Regression: a completed legacy project (no `is_cleanup`, no retry counters) renders without errors or default-fallback warnings.

## Code Surface

- Config: `.claude/skills/orchestration/config/orchestration.yml` (new limits)
- Schema: `.claude/skills/orchestration/schemas/orchestration-state-v5.schema.json` (lines 57-81 for `limits` block; iteration schema somewhere nearby)
- Engine:
  - `.claude/skills/orchestration/scripts/lib/mutations.ts:267` (PHASE_REVIEW_COMPLETED handler), `:721` (FINAL_REVIEW_COMPLETED handler), `:601` (CODE_REVIEW_COMPLETED handler — template-aware seeding extension)
  - `.claude/skills/orchestration/scripts/lib/validator.ts` + `schema-validator.ts`
  - `.claude/skills/orchestration/scripts/lib/dag-walker.ts:124` (corrective-cycle re-entry)
  - `.claude/skills/orchestration/scripts/lib/types.ts` — may need an `is_cleanup?: boolean` field on iteration state types
- Skill: `.claude/skills/configure-system/SKILL.md` (interactive questionnaire)
- Installer:
  - `installer/lib/cli.js` (interactive prompts)
  - `installer/lib/config-generator.js:33` (limits template block)
- UI:
  - Config editor pages (audit `ui/app/`): any form editing orchestration.yml
  - Optional timeline: `ui/components/badges/` for `is_cleanup` badge
- Tests:
  - `.claude/skills/orchestration/scripts/tests/mutations-phase-corrective.test.ts`
  - `.claude/skills/orchestration/scripts/tests/contract/09-corrective-cycles.test.ts` (heavy expansion expected)
  - Installer tests: `installer/lib/cli.test.js`, `installer/lib/config-generator.test.js`

## Dependencies

- **Depends on**: Iter 11 — executor correction-mode must be working so corrective cycles actually produce a viable fix on retry.
- **Blocks**: Iter 13 — not strictly (rad-plan-audit is independent of corrective cycles), but the pipeline should be stable end-to-end before the audit skill's scope shrinks.

## Testing Discipline

- **Baseline first**: full suite + log + SHA.
- **Re-run before exit**: full suite green; diff against baseline. Several retry-budget edge cases become new tests; no baseline-passing test should newly fail outside the mutation surface being updated.
- **Retry budget boundary tests** — each of these gets explicit coverage:
  - Task retries: `max_retries_per_task` (existing behavior; confirm no regression)
  - Phase retries (default budget = 2): 0 corrections → approved; 1st correction appended → re-reviewed; 2nd correction appended → re-reviewed; on the 3rd attempt (budget exhausted) → halt with operator message listing unmet exit_criteria.
  - Final retries (default budget = 1): on first `changes_requested` → inject `P{N+1}-CLEANUP`; re-run final-review; on second `changes_requested` → halt with operator message listing unmet requirements.

## Exit Criteria

- Full test suite green vs. baseline.
- A scratch project with deliberately-failing phase-review completes two corrective task cycles, then halts on the third with a clear operator-facing message listing unmet exit_criteria.
- A scratch project with deliberately-failing final-review injects `P{N+1}-CLEANUP`, runs the cleanup phase, re-runs final-review, halts if a second miss occurs.
- `orchestration.yml` round-trips through installer → file → configure-system read → UI edit → write with the two new fields intact.
- `is_cleanup: true` phases survive pre-seeding + walker + UI render without breaking existing rendering paths.

## Open Questions

- **Retry counter location**: phase-level retry counter per-phase-iteration or on a state root structure? Per-iteration makes the lookup trivial during mutation; it's the more natural fit. Confirm.
- **Cleanup-phase ID format**: `P{N+1}-CLEANUP` where N is count of pre-existing phases at injection time. If multiple iterations of injection happen (they shouldn't — design limits to 1), would N update? Lock to: injection always creates the single cleanup phase; subsequent misses append to its iteration.
- **Cleanup phase `doc_path`**: the injected cleanup phase needs a phase-plan document. Generate one in-line via mutation, or require the reviewer agent to author one as part of `changes_requested` output? Simpler: reviewer authors a brief phase-plan sketch, mutation attaches the doc_path. Iteration planner decides.
- **UI badge for is_cleanup**: nice-to-have. Scope decision: include in Iter 12 (cleaner end-state) or defer (keep iteration tight). Lean include; cost is small.
- **Halt vs. escalation on retry exhaustion**: halt with manual-intervention message is the design. Does "manual intervention" mean operator amends state.json directly and re-dispatches, or a documented restart procedure? Define the operator playbook during iteration planning.
