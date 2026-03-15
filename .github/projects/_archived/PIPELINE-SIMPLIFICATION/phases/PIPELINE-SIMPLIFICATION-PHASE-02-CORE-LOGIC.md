---
project: "PIPELINE-SIMPLIFICATION"
phase: 2
title: "CORE-LOGIC"
status: "active"
total_tasks: 5
tasks:
  - id: "T01-MUTATIONS-SCAFFOLDING"
    title: "Mutations Module — Structure, Decision Tables, and Planning Handlers"
  - id: "T02-MUTATIONS-EXECUTION"
    title: "Mutations Module — Execution Handlers with Pointer Advances"
  - id: "T03-MUTATIONS-REMAINING"
    title: "Mutations Module — Gate, Review, and Terminal Handlers"
  - id: "T04-RESOLVER"
    title: "Resolver Module — State-to-Action Resolution"
  - id: "T05-CROSS-MODULE-FIXES"
    title: "Corrective — Cross-Module Integration Fixes"
author: "tactical-planner-agent"
created: "2026-03-14T00:00:00Z"
updated: "2026-03-14T00:00:00Z"
---

# Phase 2: CORE-LOGIC (Corrective)

> **Corrective Phase Plan** — Phase review verdict: `changes_requested`. Three cross-module integration issues identified between `mutations.js` (T01–T03) and `resolver.js` (T04). Original tasks T01–T04 are complete; one corrective task (T05) added to fix all three issues before Phase 3.

## Phase Goal

Build the mutation layer that processes all 17 pipeline events with absorbed decision-table logic (8-row task table, 5-row phase table) and the resolver that maps post-mutation state to exactly one of ~18 external actions. **Corrective addition**: Align `mutations.js` and `resolver.js` on final review state paths, persist `report_status` in task state, and fix resolver fallback inconsistency.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-SIMPLIFICATION-MASTER-PLAN.md) | Phase 2 scope, exit criteria, execution constraints |
| [Architecture](../PIPELINE-SIMPLIFICATION-ARCHITECTURE.md) | StateJson typedef (`Execution` object, `Task` object), Mutation Contracts, Resolver Contracts, decision tables |
| [Phase Review](PIPELINE-SIMPLIFICATION-PHASE-REVIEW-P02.md) | Cross-Task Issues #1 (final review state path mismatch), #2 (`report_status` not persisted), #3 (resolver fallback inconsistency) |
| [Phase Report](../reports/PIPELINE-SIMPLIFICATION-PHASE-REPORT-P02.md) | All 4 original tasks complete (147 tests passing), exit criteria met |
| [Phase 1 Report](PIPELINE-SIMPLIFICATION-PHASE-REPORT-P01.md) | Carry-forward: Architecture doc `validateTransition` param discrepancy, `halted` tier coverage — both deferred to Phase 3 |

## Cross-Task Issues from Phase Review

These issues drive the corrective task:

| # | Severity | Issue | Root Cause | Fix Strategy |
|---|----------|-------|------------|-------------|
| 1 | Medium | **Final review state path mismatch.** `handleFinalReviewCompleted` writes `state.final_review.report_doc` / `state.final_review.status`. `handleFinalApproved` writes `state.final_review.human_approved`. `resolveReview` reads `state.execution.final_review_doc` / `state.execution.final_review_approved`. Different object paths and field names. | T03 (mutations) used `state.final_review.*` while T04 (resolver) used `state.execution.*` — each module's tests matched its own assumptions. | Update mutations to write to `state.execution.final_review_doc` and `state.execution.final_review_approved`. Remove the `state.final_review` top-level object. Update mutation tests to use new paths. |
| 2 | Minor | **`report_status` not persisted.** Pre-read extracts `report_status` during `task_completed` but `handleTaskCompleted` never stores it on the task. `handleCodeReviewCompleted` falls back to `'complete'`, making task decision table rows 6–7 unreachable. | `handleTaskCompleted` stores `has_deviations` and `deviation_type` but omits `report_status`. | Add `task.report_status = context.report_status` to `handleTaskCompleted`. Add `report_status` field (default `null`) to Task schema in `handlePhasePlanCreated` task initialization. Update tests. |
| 3 | Minor | **Resolver `resolvePlanning` unreachable fallback.** Final return in `resolvePlanning` (line ~53) returns `{ action: NEXT_ACTIONS.REQUEST_PLAN_APPROVAL, context: {} }` instead of using the `halted(...)` helper used everywhere else in the module. | Oversight during T04 implementation — pattern inconsistency. | Change to `return halted('Planning complete and approved but tier not transitioned — expected mutation to transition tier')`. Update resolver test for this path. |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc | Status |
|---|------|-------------|-----------------|-----------|-------------|--------|
| T01 | Mutations Module — Structure, Decision Tables, and Planning Handlers | — | `create-task-handoff` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P02-T01-MUTATIONS-SCAFFOLD.md) | ✅ Complete |
| T02 | Mutations Module — Execution Handlers with Pointer Advances | T01 | `create-task-handoff` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P02-T02-EXECUTION-HANDLERS.md) | ✅ Complete |
| T03 | Mutations Module — Gate, Review, and Terminal Handlers | T02 | `create-task-handoff` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P02-T03-GATE-HANDLERS.md) | ✅ Complete |
| T04 | Resolver Module — State-to-Action Resolution | T01 | `create-task-handoff` | 2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P02-T04-RESOLVER.md) | ✅ Complete |
| **T05** | **Corrective — Cross-Module Integration Fixes** | T01–T04 | `create-task-handoff` | 4 | *Pending* | 🔧 Corrective |

### T05: Corrective — Cross-Module Integration Fixes

**Objective**: Fix three cross-module integration inconsistencies between `mutations.js` and `resolver.js` identified during the Phase 2 review, ensuring both modules agree on state paths and patterns before Phase 3 wires them together.

**Scope**:

**Fix #1 — Final review state path alignment** (Medium severity):
- Modify `.github/orchestration/scripts/lib-v3/mutations.js`:
  - `handleFinalReviewCompleted`: Change `state.final_review.report_doc = context.doc_path` → `state.execution.final_review_doc = context.doc_path`. Remove `state.final_review.status = 'complete'` (resolver does not read a `status` field; the presence of `final_review_doc` is sufficient).
  - `handleFinalApproved`: Change `state.final_review.human_approved = true` → `state.execution.final_review_approved = true`. Keep the `state.execution.current_tier = PIPELINE_TIERS.COMPLETE` transition as-is.
  - Update `mutations_applied` description strings to reflect the new paths.
- Resolver (`resolver.js`) already reads `state.execution.final_review_doc` and `state.execution.final_review_approved` — **no changes needed** in resolver for this fix.
- Modify `.github/orchestration/scripts/tests-v3/mutations.test.js`:
  - Update `handleFinalReviewCompleted` test fixtures to assert `state.execution.final_review_doc` instead of `state.final_review.report_doc`.
  - Update `handleFinalApproved` test fixtures to assert `state.execution.final_review_approved` instead of `state.final_review.human_approved`.
  - Remove any test fixtures that initialize `state.final_review` as a top-level object.

**Fix #2 — Persist `report_status` on task** (Minor severity):
- Modify `.github/orchestration/scripts/lib-v3/mutations.js`:
  - `handleTaskCompleted`: Add `task.report_status = context.report_status;` alongside the existing `task.has_deviations` and `task.deviation_type` assignments. Add a corresponding entry to `mutations_applied`.
  - `handlePhasePlanCreated`: Add `report_status: null` to the task initialization object (alongside `has_deviations: false`, `deviation_type: null`).
- Modify `.github/orchestration/scripts/tests-v3/mutations.test.js`:
  - Add test case verifying `task.report_status` is set after `handleTaskCompleted` with `context.report_status = 'complete'`.
  - Add test case verifying `task.report_status` is set to `'failed'` after `handleTaskCompleted` with `context.report_status = 'failed'`.
  - Verify `handleCodeReviewCompleted` reads the persisted `task.report_status` value (not the fallback `'complete'`).

**Fix #3 — Resolver `resolvePlanning` fallback pattern** (Minor severity):
- Modify `.github/orchestration/scripts/lib-v3/resolver.js`:
  - Replace the final return in `resolvePlanning` (line ~53): change `return { action: NEXT_ACTIONS.REQUEST_PLAN_APPROVAL, context: {} };` → `return halted('Planning complete and approved but tier not transitioned — expected mutation to transition tier');`
- Modify `.github/orchestration/scripts/tests-v3/resolver.test.js`:
  - Update or add test for the unreachable fallback path in `resolvePlanning` to assert `{ action: 'display_halted', context: { details: '...' } }` instead of `{ action: 'request_plan_approval', context: {} }`.

**Estimated output**: ~15 lines changed in `mutations.js`, ~3 lines changed in `resolver.js`, ~30 lines changed in `mutations.test.js`, ~10 lines changed in `resolver.test.js`

## Execution Order

```
T01 ✅ → T02 ✅ → T03 ✅
                         ↘
T04 ✅ ───────────────────→ T05 🔧 (corrective — depends on all prior tasks)
```

**Sequential execution order**: T01 ✅ → T02 ✅ → T03 ✅ → T04 ✅ → **T05** 🔧

*T05 is the sole remaining task. It modifies files produced by T01–T04.*

## Phase Exit Criteria

- [x] `mutations.js` exports `getMutation` and `normalizeDocPath`; the `MUTATIONS` map contains exactly 17 entries (one per event); `getMutation` returns `undefined` for unknown events
- [x] `resolveTaskOutcome` covers all 8 task decision table rows with identical outcomes to the Architecture specification; each row has a dedicated test named by row number
- [x] `resolvePhaseOutcome` covers all 5 phase decision table rows with identical outcomes to the Architecture specification; each row has a dedicated test named by row number
- [x] Pointer advances occur within mutations: `handleCodeReviewCompleted` bumps `phase.current_task` on advance; `handlePhaseReviewCompleted` bumps `execution.current_phase` on phase advance
- [x] Tier transitions occur within mutations: `handlePlanApproved` transitions to `execution`; `handlePhaseReviewCompleted` transitions to `review` after last phase; `handleFinalApproved` transitions to `complete`
- [x] `resolver.js` exports `resolveNextAction`; returns only external actions (~18); no internal actions exist in the action set
- [x] `create_corrective_handoff` does not exist as a separate action; corrective handoffs return `create_task_handoff` with `context.is_correction: true`, `context.previous_review`, and `context.reason`
- [x] All halt scenarios return `display_halted` with descriptive `context.details`
- [ ] **[Corrective]** `handleFinalReviewCompleted` writes to `state.execution.final_review_doc`; `handleFinalApproved` writes to `state.execution.final_review_approved`; `resolveReview` reads the same paths — no `state.final_review` top-level object exists
- [ ] **[Corrective]** `handleTaskCompleted` persists `context.report_status` to `task.report_status`; `handleCodeReviewCompleted` reads the persisted value (not a fallback)
- [ ] **[Corrective]** `resolvePlanning` unreachable fallback returns `halted(...)` matching the module-wide pattern
- [ ] All Phase 2 unit tests pass (`node --test tests-v3/mutations.test.js tests-v3/resolver.test.js`)
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors, all modules importable via `require()`)

## Known Risks for This Phase

- **Test fixture drift**: Corrective changes to `handleFinalReviewCompleted` and `handleFinalApproved` require updating test fixtures that initialize `state.final_review`. If any test still references the old path, it will pass vacuously (asserting on the wrong location). Mitigation: T05 must grep for all occurrences of `final_review` in test files and update them systematically.
- **Report status fallback removal**: After persisting `report_status`, existing tests that relied on the `|| 'complete'` fallback may need fixture updates to supply `task.report_status` explicitly. Mitigation: T05 tests explicitly verify both `'complete'` and `'failed'` paths through `handleCodeReviewCompleted`.
