# Baseline — colors-greet-mismatch — 2026-04-21

**Fixture**: colors-greet-mismatch
**Run folder**: `output/colors-greet-mismatch/baseline-colors-greet-mismatch-2026-04-21/`
**Harness**: phase-review-mediation-e2e
**Date**: 2026-04-21 (inaugural, iter-11)
**Driver**: TBD — populated by the orchestrator session that drives `_runner.md` for the first time. The content below is a scaffold; the runner overwrites this file with the real run record on first execution.

## Final state values

| Field | Value |
|---|---|
| `graph.status` | TBD (expected: `in_progress`) |
| `phase_loop.iterations[0].status` | TBD (expected: `completed`) |
| `phase_loop.iterations[0].nodes.phase_review.status` | TBD (expected: `completed`; NOT reset) |
| `phase_loop.iterations[0].nodes.phase_review.verdict` | TBD (expected: equals orchestrator's `effective_outcome`) |
| `phase_loop.iterations[0].nodes.phase_planning.status` | TBD (expected: `completed`; NOT reset) |
| `phase_loop.iterations[0].nodes.task_loop.iterations.length` | TBD (expected: `2`; not cleared) |
| `phase_loop.iterations[0].corrective_tasks.length` | TBD (expected: `1`) |
| `phase_loop.iterations[0].corrective_tasks[0].status` | TBD (expected: `completed`) |
| `phase_loop.iterations[0].corrective_tasks[0].nodes.task_handoff.doc_path` | TBD (expected: `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md`) |
| `phase_loop.iterations[0].corrective_tasks[0].nodes.code_review.doc_path` | TBD (expected: `reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md`) |
| `phase_loop.iterations[0].corrective_tasks[0].nodes.code_review.verdict` | TBD (expected: `approved`) |

## Pipeline call sequence

1. `start` → TBD (expected: `action: null` — walker idling on pre-seeded in-progress `phase_review`)
2. Orchestrator mediation (out-of-band): appended `## Orchestrator Addendum` + additive frontmatter to `reports/COLORS-GREET-MISMATCH-PHASE-REVIEW-P01-COLORS-GREET.md`; authored `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C1.md`
3. `phase_review_completed --doc-path reports/COLORS-GREET-MISMATCH-PHASE-REVIEW-P01-COLORS-GREET.md` → TBD (expected: `action: execute_task` with `handoff_doc: tasks/…-PHASE-C1.md`, `task_id: P01-PHASE`, `task_number: null`, `is_correction: true`, `corrective_index: 1`). Mutations: `phase_review.status=completed`, `phase_review.verdict=changes_requested` (from effective_outcome), birthed phase-scope corrective 1, set corrective_task[1].task_handoff.doc_path, `phaseIter.corrective_tasks.length=1`.
4. `execution_started` → TBD (expected: `action: execute_task` — confirms context enrichment)
5. `@coder` invocation: applied the phase-sentinel corrective handoff to `src/greet.js`
6. `task_completed` → TBD (expected: `action: spawn_code_reviewer`; `commit_gate` auto-routes to `false` branch under `auto_commit: never`)
7. `code_review_started` → TBD (expected: `action: spawn_code_reviewer`)
8. `@reviewer` invocation (stateless): wrote `reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md` with `verdict: approved`
9. `code_review_completed --doc-path reports/COLORS-GREET-MISMATCH-CODE-REVIEW-P01-PHASE-C1.md` → TBD (expected: `action: spawn_final_reviewer` or similar phase-advance action; task_gate auto-approves; walker marks phaseIter `completed`)
10. **Halt** (harness exit) — do NOT drive Phase 2 or `final_review`

## Mediation judgment calls

| Finding | Disposition | Rationale |
|---|---|---|
| F-1 — Cross-Task Shape Mismatch | TBD (expected: action) | Expected rationale: traces to FR-2 + phase exit criterion; fix bounded to `src/greet.js` because FR-1 pins `makeColors()`'s string return shape; phase-scope because the defect spans both Task Handoffs' integrated behavior. |

Budget banner: `Attempt 1 of 5` (1 = `phaseIter.corrective_tasks.length + 1` at author time; 5 = `max_retries_per_task` from fixture-local `orchestration.yml`).

## Pass criteria — all 10 to be marked green

1. TBD — `corrective_tasks.length >= 1` and final corrective `task_handoff.status === 'completed'` and `doc_path` matches `tasks/COLORS-GREET-MISMATCH-TASK-P01-PHASE-C{N}.md`.
2. TBD — Phase review doc contains `## Orchestrator Addendum` with budget banner, Finding Dispositions table, `Effective Outcome:` line, `Corrective Handoff:` line.
3. TBD — Phase review doc frontmatter has `orchestrator_mediated: true`, `effective_outcome ∈ {approved, changes_requested}`, `corrective_handoff_path` iff effective_outcome = changes_requested, `exit_criteria_met` untouched.
4. TBD — Phase-sentinel corrective handoff exists with frontmatter `corrective_index: 1`, `corrective_scope: phase`, `budget_max` + `budget_remaining` set; body self-contained.
5. TBD — Phase-iteration reset block is GONE: `nodes.phase_review.status === 'completed'` (NOT reset); `verdict` = effective_outcome; `nodes.phase_planning.status === 'completed'` (NOT reset); `nodes.task_loop.iterations` unchanged.
6. TBD — Task-level re-review doc body does NOT reference prior phase review (grep: no "previous review", "phase review said", "first attempt", "prior review").
7. TBD — `phase_loop.iterations[0].corrective_tasks[0].status === 'completed'` and `phase_loop.iterations[0].status === 'completed'`; graph not halted.
8. TBD — Only ONE `PHASE-REVIEW-…md` doc on disk (no `-C{N}.md` corrective form); walker does NOT re-dispatch `spawn_phase_reviewer`.
9. TBD — Budget intact: `phaseIter.corrective_tasks.length <= max_retries_per_task`; converges in 1 cycle.
10. TBD — Task-level re-review save-path uses phase sentinel: filename matches `CODE-REVIEW-P01-PHASE-C1.md`.

## Operator hand-verification

Run `user-instructions.md` next — the UI-side verification steps (frontmatter rendering, addendum markdown render, `(Phase-C{N})` sidebar suffix, legacy state regression test against `fully-hydrated/` fixture) are intentionally NOT covered by this automated smoke.
