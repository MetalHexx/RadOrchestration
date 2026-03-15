---
project: "V3-FIXES"
phase: 2
title: "Behavioral Test Updates"
status: "active"
total_tasks: 1
tasks:
  - id: "T01-CAT11-BEHAVIORAL"
    title: "Add Category 11 — Corrective Task Flow behavioral test to pipeline-behavioral.test.js"
author: "tactical-planner-agent"
created: "2026-03-15T00:00:00Z"
---

# Phase 2: Behavioral Test Updates

## Phase Goal

Add Category 11 — Corrective Task Flow to `pipeline-behavioral.test.js`, providing end-to-end behavioral verification that the full corrective task retry flow (inject stale state → signal `task_handoff_created` → assert stale fields cleared, status reset, and handoff_doc set) works correctly through the live pipeline engine.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../V3-FIXES-MASTER-PLAN.md) | Phase 2 scope, exit criteria, execution constraints |
| [Architecture](../V3-FIXES-ARCHITECTURE.md) | Goal 1-D: Category 11 structure, assertions, and implementation notes |
| [Design](../V3-FIXES-DESIGN.md) | Area 1: Corrective task state lifecycle, handler responsibility map, field values at each boundary |
| [Phase 1 Report](../reports/V3-FIXES-PHASE-REPORT-P01.md) | Carry-forward items: uncommitted `mutations.js` change (non-blocking); `handlePlanApproved` unit test gap (non-blocking, out of Phase 2 scope) |
| [Phase 1 Review](../reviews/V3-FIXES-PHASE-REVIEW-P01.md) | Verdict: approved; no cross-task issues; Phase 2 cleared to proceed immediately |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Add Category 11 — Corrective Task Flow behavioral test to `pipeline-behavioral.test.js` | — | — | 1 | [Link](../tasks/V3-FIXES-TASK-P02-T01-CAT11-BEHAVIORAL.md) |

## Execution Order

```
T01 (single task — no dependencies)
```

**Sequential execution order**: T01

*No parallel-ready pairs — single-task phase.*

## Task Details

### T01 — Add Category 11 — Corrective Task Flow Behavioral Test

**Objective**: Append a new `describe('Category 11 — Corrective Task Flow', ...)` block at the end of `pipeline-behavioral.test.js` that exercises the full corrective task retry flow end-to-end through the live pipeline engine.

**File target**: `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` (MODIFY)

**What the test must do**:

1. **State setup** (in `before` block or direct state injection): Build mid-flight state where the current task has:
   - `status = 'failed'`
   - `review_action = 'corrective_task_issued'`
   - `report_doc` = a path string (set — from prior `task_completed`)
   - `report_status = 'complete'` (set — from prior `task_completed`)
   - `review_doc` = a path string (set — from prior `code_review_completed`)
   - `review_verdict = 'changes_requested'`

2. **V13 bypass**: Apply `delete state.project.updated` before writing the injected state, following the pattern already established in Categories 6–9.

3. **Test assertions** (three `it` blocks):
   - Signal `task_handoff_created` with `{ doc_path: '<corrective-handoff-path>' }` → assert `result.success === true` and `result.action === 'execute_task'`
   - Read state after the event → assert all five stale fields are `null` (`report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`)
   - Read state → assert `task.status === 'in_progress'` and `task.handoff_doc` equals the corrective handoff path

4. **State isolation**: Category 11 must not leak state into any subsequent test scope. Follow the same shared-IO sequential execution pattern as Categories 1–10.

**Patterns to reuse**:
- State-building helpers from Categories 6–9 for mid-flight state injection
- Shared-IO sequential `describe` pattern (before block + sequential `it` blocks sharing IO)
- `delete state.project.updated` V13 bypass for timestamp conflicts
- Node built-in test runner (`node:test` + `node:assert/strict`) — no external frameworks

**Constraints**:
- Do NOT modify any existing Categories 1–10 or their helper functions
- Do NOT add new helper functions or abstractions — inline the state setup
- Do NOT create new files — all additions go inside `pipeline-behavioral.test.js`
- Do NOT modify `mutations.js` or any other runtime script

## Phase Exit Criteria

- [ ] Category 11 passes: `result.action === 'execute_task'` returned after corrective `task_handoff_created`
- [ ] Category 11 passes: all five stale fields are `null` after the event (`report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`)
- [ ] Category 11 passes: `task.status === 'in_progress'` and `task.handoff_doc` set to corrective path
- [ ] All existing Categories 1–10 still pass without modification
- [ ] No state leaks from Category 11 into subsequent test scope
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] All tests pass (full suite — no regressions)

## Known Risks for This Phase

- **R-2 (from Master Plan): State setup complexity** — Category 11 requires a task in `failed`/`corrective_task_issued` state with `report_doc`, `review_doc`, and `review_action` all pre-populated. Mitigation: reuse state-building helpers from Categories 6–9 and follow the `delete state.project.updated` V13 bypass pattern already established in the test file.
- **Carry-forward: uncommitted `mutations.js` change** — The Phase 1 report notes a working tree change to `mutations.js` from the original Orchestrator mid-run edit. This is the runtime fix that Phase 1's T01 unit tests verify. It does not block Category 11 (the behavioral test exercises the live pipeline which already includes the fix), but it should be committed before final review.
