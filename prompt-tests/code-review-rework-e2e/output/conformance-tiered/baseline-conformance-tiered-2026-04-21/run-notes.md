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
| 11 | `final_review_completed` | `request_final_approval` | verdict=approved; pipeline.current_tier=review; halted before gate approval (per runner Step 9). |

## Agents (simulated in-session — Agent tool unavailable)

| Spawn point | Role | Inputs | Output path |
|-------------|------|--------|-------------|
| After call #2 | reviewer (task) | Task Handoff `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING.md` + working tree | `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md` |
| After call #4 | coder (corrective) | Corrective Task Handoff `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md` | Updated `src/greet.ts` (synchronous shape) |
| After call #6 | reviewer (task re-review) | Corrective Task Handoff + working tree | `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md` |
| After call #8 | reviewer (phase) | Phase Plan, Requirements doc, state.json, working tree | `reports/CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md` |
| After call #10 | reviewer (final) | Requirements doc, state.json, working tree | `reports/CONFORMANCE-TIERED-FINAL-REVIEW.md` |

## SHA derivations observed

Auto-commit is disabled in this fixture's `orchestration.yml` (`source_control.auto_commit: never`), so every SHA in spawn context was `null`:

- task-review spawn: `head_sha: null`
- phase-review spawn: `phase_first_sha: null`, `phase_head_sha: null`
- final-review spawn: `project_base_sha: null`, `project_head_sha: null`

Reviewers fall back to working-tree diff (`git diff HEAD` + untracked files). Because the run folder is under a gitignored path, reviewers read `src/` files directly against the Task Handoff / Phase Plan / Requirements doc rather than a git-computed diff.

## Orchestrator mediation (Cycle 1, task scope)

- **Trigger:** raw `verdict: changes_requested` on the first T2 code review.
- **Budget check:** `task_loop.iterations[1].corrective_tasks.length === 0` before mediation → not exhausted (cap = 5).
- **Per-finding dispositions:**
  - **FR-2 — action (drift).** Handoff explicitly inlines FR-2 with synchronous contract ("no `await`, no `.then()`"). Shipped `src/greet.ts` declared `async` and cast `getColors()` as `Promise<string[]>`. Bounded fix: follow reference in handoff's Implementation Notes.
  - **NFR-1 — decline (on-track).** Reviewer correctly marked on-track for the task's slice. Tracking for later scope; the FR-2 action will restore synchronous surface as side-effect.
  - **AD-1 — decline (on-track).** `src/greet.ts` exists, no barrel index. Slice satisfied. Tracking for later scope.
- **Artifacts authored:** `## Orchestrator Addendum` section + additive frontmatter (`orchestrator_mediated: true`, `effective_outcome: "changes_requested"`, `corrective_handoff_path: "tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md"`) on the review doc; corrective Task Handoff at `tasks/CONFORMANCE-TIERED-TASK-P01-T02-GREETING-C1.md` (corrective_index: 1, corrective_scope: task, budget_max: 5, budget_remaining: 4).

## Review-doc paths + verdict progression

| Review | Path | Verdict |
|--------|------|---------|
| T2 first | `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md` | `changes_requested` (raw) → effective_outcome `changes_requested` (mediated, FR-2 actioned) |
| T2 re-review (C1) | `reports/CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md` | `approved` |
| Phase 1 | `reports/CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md` | `approved` (exit_criteria_met: true) |
| Final | `reports/CONFORMANCE-TIERED-FINAL-REVIEW.md` | `approved` (all five requirements `met`) |

## Final state

- `state.graph.nodes.phase_loop.iterations[0].task_loop.iterations[1].corrective_tasks.length`: **1** (expected 1) ✅
- `state.graph.nodes.phase_loop.iterations[0].corrective_tasks.length`: **0** (expected 0) ✅
- `state.graph.status`: `in_progress` (halted at `final_approval_gate` per runner Step 9 — do-not-approve constraint)
- `state.pipeline.current_tier`: `review`
- `state.graph.nodes.final_review.verdict`: `approved`

## Pass criteria assessment

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All four review docs exist at expected save paths. | ✅ | `reports/` listing: `CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING.md`, `CONFORMANCE-TIERED-CODE-REVIEW-P01-T02-GREETING-C1.md`, `CONFORMANCE-TIERED-PHASE-REVIEW-P01-CORE-FLOW.md`, `CONFORMANCE-TIERED-FINAL-REVIEW.md`. |
| 2 | Final-review save path is under `reports/` — not project root. | ✅ | Run-folder root MDs: only `CONFORMANCE-TIERED-BRAINSTORMING.md`, `CONFORMANCE-TIERED-MASTER-PLAN.md`, `CONFORMANCE-TIERED-REQUIREMENTS.md`, `README.md`. No `CONFORMANCE-TIERED-FINAL-REVIEW.md` at root. |
| 3 | First T2 review: `verdict: changes_requested`, one drift finding on FR-2, audit shows FR-2 drift + NFR-1 on-track + AD-1 on-track. | ✅ | Frontmatter `verdict: "changes_requested"`; audit table has exactly three rows — FR-2/drift/medium, NFR-1/on-track/none, AD-1/on-track/none. No FR-1 row. |
| 4 | T2 re-review: `verdict: approved`, all audit rows on-track. | ✅ | Frontmatter `verdict: "approved"`; audit rows FR-2/NFR-1/AD-1 all on-track. |
| 5 | Phase review: `verdict: approved`, `exit_criteria_met: true`. | ✅ | Frontmatter `verdict: "approved"`, `exit_criteria_met: true`; all four exit criteria verified ✅. |
| 6 | Final review: `verdict: approved`; audit enumerates every FR/NFR/AD with status `met`. | ✅ | Audit rows: FR-1 met, FR-2 met, NFR-1 met, NFR-2 met, AD-1 met. Frontmatter `verdict: "approved"`. |
| 7 | Final body does NOT reference PRD / Architecture / Design. | ✅ | Grep of final-review file for `PRD|ARCHITECTURE|DESIGN|Architecture|Design doc` → no matches. |
| 8 | Final body does NOT reference a previous final review. | ✅ | Grep of final-review file for `previous final|prior final` → no matches. |
| 9 | State: task_loop[1].corrective_tasks.length === 1; phase_loop[0].corrective_tasks.length === 0. | ✅ | Confirmed against `state.json` post-run. |
| 10 | Orchestrator addendum on first T2 review cites tier (drift) + reasoning + actioned=true for FR-2; NFR-1 + AD-1 declined with 'tracking for later scope'. | ✅ | Addendum table has three rows with parenthesized status tiers `(drift)`, `(on-track)`, `(on-track)` and dispositions `action` / `decline` / `decline`; decline reasons end with "Tracking for later scope." |

All 10 criteria green (inaugural baseline).

> **Note — test-spec strengthening post-baseline**: PR #64's round-2 review cycle strengthened the harness spec with an 11th pass criterion (pipeline-level validator-health check on `final_review_completed`). This inaugural baseline predates that criterion and therefore verifies only the original 10. The next harness run will capture an updated baseline verifying all 11 criteria.
