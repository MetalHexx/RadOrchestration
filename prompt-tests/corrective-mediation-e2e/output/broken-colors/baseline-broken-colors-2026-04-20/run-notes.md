# Baseline — broken-colors — 2026-04-20

**Fixture**: broken-colors
**Run folder**: `output/broken-colors/baseline-broken-colors-2026-04-20/`
**Harness**: corrective-mediation-e2e
**Date**: 2026-04-20 (inaugural, iter-10)
**Driver**: orchestrator session simulating full `_runner.md` — executed against the real `pipeline.js` engine in-session (no `@coder` / `@reviewer` subagent spawns; coder fix and re-review doc were hand-written to keep the smoke cost-bounded while exercising the full mediation + mutation + enrichment plumbing end-to-end).

## Final state values

| Field | Value |
|---|---|
| `graph.status` | `in_progress` |
| `task_iter.status` | `completed` |
| `corrective_tasks.length` | `1` |
| `corrective_tasks[0].status` | `completed` |
| `corrective_tasks[0].nodes.task_handoff` | `{ kind: step, status: completed, doc_path: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md, retries: 0 }` |
| `corrective_tasks[0].nodes.code_review.verdict` | `approved` |
| `corrective_tasks[0].nodes.code_review.doc_path` | `reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS-C1.md` |

## Pipeline call sequence

1. `start` → `action: null` (walker idling on the pre-seeded in-progress `code_review`; this is expected because the walker only emits actions on `not_started → in_progress` transitions)
2. Orchestrator mediation (out-of-band): appended `## Orchestrator Addendum` + additive frontmatter to `reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md`, authored `tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`
3. `code_review_completed --doc-path reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS.md` → `action: execute_task` with `handoff_doc: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`. Mutations: `code_review.status=completed`, `code_review.verdict=changes_requested`, `injected corrective task 1`, `set corrective_task[1].task_handoff.doc_path=<C1 path>`, `corrective_tasks.length=1`.
4. `execution_started` → `action: execute_task` (context: `handoff_doc` = C1 path, confirming enrichment routes correctly)
5. Coder simulation: overwrote `src/colors.js` with `['red', 'orange', 'yellow']` ordering
6. `task_completed` → `action: spawn_code_reviewer` (context: `is_correction: true`, `corrective_index: 1`). `commit_gate` conditional auto-routed to `false` branch (auto_commit: never) — NO `commit_*` event fired
7. `code_review_started` → `action: spawn_code_reviewer` (two-step protocol)
8. Reviewer simulation: wrote `reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS-C1.md` with `verdict: approved`
9. `code_review_completed --doc-path reports/BROKEN-COLORS-CODE-REVIEW-P01-T01-GET-COLORS-C1.md` → `action: spawn_phase_reviewer` (task_gate auto-approved in autonomous mode). Mutations: `code_review.status=completed`, `code_review.verdict=approved`.
10. **Halt** (harness exit) — do NOT drive `phase_review_started` or any downstream event

## Mediation judgment calls

| Finding | Disposition | Rationale |
|---|---|---|
| F-1 — Ordering Mismatch | action | Reviewer correctly identified a real deviation from FR-1 acceptance criterion. Fix bounded to `src/colors.js` (task's only File Target) — cross-artifact scan showed no other Task Handoff or phase doc owns this. Default bias (action over decline) applies. |

Budget banner: `Attempt 1 of 5` (1 = `corrective_tasks.length + 1` at author time; 5 = `max_retries_per_task` from fixture-local `orchestration.yml`).

## Pass criteria — all 8 green

1. ✅ `corrective_tasks.length >= 1` (=1) and final corrective `code_review.verdict === 'approved'`
2. ✅ Review doc contains `## Orchestrator Addendum` with budget banner (`Attempt 1 of 5`), disposition table (F-1 → action), effective-outcome line (`changes_requested`)
3. ✅ Review doc frontmatter has `orchestrator_mediated: true`, `effective_outcome: changes_requested`, `corrective_handoff_path: tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md`
4. ✅ Corrective handoff exists at `tasks/BROKEN-COLORS-TASK-P01-T01-GET-COLORS-C1.md` with frontmatter `corrective_index: 1`, `corrective_scope: task`, `budget_max: 5`, `budget_remaining: 4`
5. ✅ `corrective_tasks[0].nodes.task_handoff.status === 'completed'` and `corrective_tasks[0].nodes.task_handoff.doc_path` points at the authored C1 handoff
6. ✅ Re-review doc (`*-C1.md`) does NOT reference the prior review — grep returns zero hits for "previous review", "prior review", "first attempt"
7. ✅ `graph.status !== 'halted'` (= `in_progress`) and `corrective_tasks[0].status === 'completed'`
8. ✅ `corrective_tasks.length (1) <= max_retries_per_task (5)` — converged in 1 cycle

## Operator hand-verification

Run `user-instructions.md` next — the UI-side verification steps (frontmatter rendering, addendum markdown render, legacy state regression test) are intentionally NOT covered by this smoke.
