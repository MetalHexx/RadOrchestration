# Run Notes — Baseline `conformance-tiered` (2026-04-21)

- **Run folder:** `prompt-tests/code-review-rework-e2e/output/conformance-tiered/baseline-conformance-tiered-2026-04-21/`
- **Fixture:** `prompt-tests/code-review-rework-e2e/fixtures/conformance-tiered/`
- **Date:** 2026-04-21
- **Auto mode:** active (auto_commit=never, auto_pr=never → SHAs null throughout)

## Pipeline call log

| # | Event | `result.action` | Notes |
|---|-------|-----------------|-------|
| 1 | `start` | `spawn_code_reviewer` | task_id=P01-T02, head_sha=null |
| 2 | `code_review_started` | `spawn_code_reviewer` | two-step protocol confirm; code_review.status=in_progress |
| 3 | `code_review_completed` (T2 first) | `execute_task` | injected corrective task 1 (scope=task); handoff=tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md; corrective_tasks.length=1 |
| 4 | `execution_started` | `execute_task` | two-step protocol confirm; task_executor.status=in_progress |
| 5 | `task_completed` | `spawn_code_reviewer` | is_correction=true, corrective_index=1 |
| 6 | `code_review_started` | `spawn_code_reviewer` | two-step protocol confirm (re-review) |
| 7 | `code_review_completed` (C1) | `spawn_phase_reviewer` | verdict=approved; phase_first_sha=null, phase_head_sha=null |
| 8 | `phase_review_started` | `spawn_phase_reviewer` | two-step protocol confirm; phase_review.status=in_progress |
| 9 | `phase_review_completed` | `spawn_final_reviewer` | verdict=approved; project_base_sha=null, project_head_sha=null |
| 10 | `final_review_started` | `spawn_final_reviewer` | two-step protocol confirm; final_review.status=in_progress |
| 11 | `final_review_completed` | `request_final_approval` | verdict=approved; current_tier transitioned to review |

## Agents spawned

| Agent | Doc input | Mode |
|-------|-----------|------|
| `@reviewer` | `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING.md` | task (T2 first review) |
| `@coder-junior` | `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md` | corrective execution |
| `@reviewer` | `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md` | task (T2 re-review) |
| `@reviewer` | `phases/CONFORMANCE-TIERED-PHASE-01-CORE-FLOW.md` | phase |
| `@reviewer` | `CONFORMANCE-TIERED-REQUIREMENTS.md` | final |

## Events signaled (in order)

`start` → `code_review_started` → `code_review_completed` (T2 first) → `execution_started` → `task_completed` → `code_review_started` (re-review) → `code_review_completed` (C1) → `phase_review_started` → `phase_review_completed` → `final_review_started` → `final_review_completed`

## Orchestrator judgments (first T2 mediation)

Mediation per `.claude/skills/orchestration/references/corrective-playbook.md` → Tiered Conformance Model + Finding Disposition by Status.

Budget check: `max_retries_per_task=5`; `task_loop.iterations[1].corrective_tasks.length=0` at mediation time → Attempt 1 of 5. Not exhausted.

| Finding ID | Disposition | Tier | Reason |
|------------|-------------|------|--------|
| FR-2 | action | drift | Handoff-inlined FR-2 mandates synchronous consumption of `getColors()` and `string` return. Diff returned `Promise<string>` and awaited a non-Promise — direct contract violation. Bounded to `src/greet.ts` per File Targets. |
| AD-1 | decline | on-track | Only `src/greet.ts` added; no barrel index. The task's slice is correct. Tracking for later scope. |

One finding actioned, one declined → one corrective handoff birthed. NFR-1 is correctly absent from the task-scope audit — it is cross-cutting and only inlined at phase/final scope (post-fixture adjustment).

## SHA derivations observed

auto_commit=off throughout. All review-doc frontmatter carries `reviewed_base_sha: null` + `reviewed_head_sha: null` (task scope), `phase_first_sha: null` + `phase_head_sha: null` (phase scope), or `project_base_sha: null` + `project_head_sha: null` (final scope). Every reviewer fell back to working-tree diff (`git diff HEAD` + untracked files).

## Review-doc paths + verdict progression

| Scope | Path | Verdict |
|-------|------|---------|
| T2 first (Attempt 1) | `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md` | `changes_requested` (raw) → `changes_requested` (effective, mediated) |
| T2 re-review (C1) | `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md` | `approved` |
| Phase 1 | `reports/CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md` | `approved`, `exit_criteria_met: true` |
| Final | `reports/CONFORMANCE-TIERED-FINAL-REVIEW.md` | `approved` (all 5 requirements `met`) |

## Final state values

- `state.graph.status`: `in_progress` ✓ (halted at `final_approval_gate` per runner Step 9)
- `state.pipeline.current_tier`: `review` ✓ (walker at final approval gate)
- `state.graph.current_node_path`: `final_review`
- `state.graph.nodes.phase_loop.iterations[0].task_loop.iterations[1].corrective_tasks.length`: `1` ✓
- `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length`: `0` ✓
- `state.graph.nodes.final_review.status`: `completed`
- `state.graph.nodes.final_review.verdict`: `approved`

## Pass criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Four review docs exist at expected save paths | PASS |
| 2 | Final-review save path under `reports/` (not at project root) | PASS |
| 3 | First T2 review: `verdict: changes_requested`, **one** drift on FR-2, audit shows FR-2 drift + AD-1 on-track (handoff order) | PASS |
| 4 | T2 re-review: `verdict: approved`, all rows on-track | PASS |
| 5 | Phase review: `verdict: approved`, `exit_criteria_met: true` | PASS |
| 6 | Final review: `verdict: approved`; audit enumerates every Requirements-doc FR/NFR/AD/DD as `met` | PASS |
| 7 | Final-review body does NOT reference PRD / Architecture / Design docs | PASS |
| 8 | Final-review body does NOT reference a previous final review | PASS |
| 9 | State corrective_tasks counts: task=1, phase=0 | PASS |
| 10 | Orchestrator addendum uses parenthesized tier enums; FR-2 `action (drift)`, AD-1 `decline (on-track)` with tracking-for-later-scope reason | PASS |
| 11 | Validator health: `final_review_completed` accepted; `final_review` → `completed` with `verdict: approved`; no `pre_read_validation_error` surfaced | PASS |

All 11 pass criteria green. The 2026-04-21 re-run validates the fixture adjustment that dropped redundant task-scope NFR-1 inlining — reviewer produced the clean two-row task-scope audit (FR-2 drift + AD-1 on-track) without any cross-cutting fabrication, and NFR-1 was correctly evaluated as `on-track` at phase scope and `met` at final scope.

## Artifacts on disk

```
reports/
├── CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md     (first T2 review + orchestrator addendum)
├── CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md  (T2 re-review)
├── CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md
└── CONFORMANCE-TIERED-FINAL-REVIEW.md

tasks/
├── CONFORMANCE-TIERED-TASK-P01-T01-COLORS.md              (from fixture)
├── CONFORMANCE-TIERED-TASK-P01-T02-GREETING.md            (from fixture)
└── CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md         (orchestrator-authored corrective)

src/
├── colors.ts   (unchanged from fixture — T1 baseline)
└── greet.ts    (rewritten by @coder-junior during C1 — synchronous, 5 lines)
```

## Exit

Halted at `request_final_approval` without approving the human gate. Operator to run `user-instructions.md` hand-verification and commit baseline artifacts (only `run-notes.md` is gitignore-exempted).
