---
project: "PIPELINE-SIMPLIFICATION"
phase: 2
task: 3
title: "GATE-HANDLERS"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# GATE-HANDLERS

## Objective

Complete the `mutations.js` module by adding the 4 remaining handlers — `handleTaskApproved`, `handlePhaseApproved`, `handleFinalReviewCompleted`, and `handleFinalApproved` — finalizing and freezing the `MUTATIONS` map at all 17 entries, and confirming full handler coverage with a completeness assertion test.

## Context

`mutations.js` already contains 13 handlers registered in the frozen `MUTATIONS` map: 7 planning/halt handlers (T01) and 6 execution handlers (T02). The `currentPhase(state)` and `currentTask(state)` internal helpers, the `resolveTaskOutcome` and `resolvePhaseOutcome` decision table helpers, and all existing imports from `constants.js` are in place. This task adds 4 handlers for gate events, final review, and final approval, then replaces the partial `Object.freeze()` with the complete 17-entry frozen map. The test file already has 102 passing tests; this task extends it to cover the new handlers plus a completeness assertion.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib-v3/mutations.js` | Add 4 handler functions; register all 4 in MUTATIONS map (13→17 entries); remove placeholder comment |
| MODIFY | `.github/orchestration/scripts/tests-v3/mutations.test.js` | Add gate/review handler tests, 17-entry completeness assertion, `makeReviewState()` helper |

## Implementation Steps

1. **Add `handleTaskApproved` handler** — This is a gate no-op. The task is already complete (set by `handleCodeReviewCompleted` via the decision table); the gate is a human confirmation step with no state mutation. Return `{ state, mutations_applied: ['Task gate approved (no-op)'] }`.

2. **Add `handlePhaseApproved` handler** — This is a gate no-op. The phase is already complete (set by `handlePhaseReviewCompleted` via the decision table); the gate is a human confirmation step with no state mutation. Return `{ state, mutations_applied: ['Phase gate approved (no-op)'] }`.

3. **Add `handleFinalReviewCompleted` handler** — Set `state.final_review.report_doc` to `context.doc_path`. Set `state.final_review.status` to `'complete'`. Return `MutationResult` with descriptive `mutations_applied` entries.

4. **Add `handleFinalApproved` handler** — Set `state.final_review.human_approved` to `true`. Transition `state.execution.current_tier` to `PIPELINE_TIERS.COMPLETE`. Return `MutationResult` with descriptive `mutations_applied` entries. Note: `execution.status` is already `'complete'` (set by `handlePhaseReviewCompleted` when the last phase advanced) — do NOT set it again.

5. **Update the MUTATIONS map** — Replace the current partial frozen map (13 entries + placeholder comment) with the complete 17-entry frozen map. Remove the comment `// T03 will add: task_approved, phase_approved, final_review_completed, final_approved`. The final map must match the exact layout below (see Contracts section).

6. **Add `makeReviewState()` test helper** — Create a factory function that produces a state in the `review` tier with a `final_review` object. Use the structure defined in the Contracts section. Place it after the existing `makeExecutionState()` helper.

7. **Add per-handler tests** — Add `describe` blocks for `handleTaskApproved`, `handlePhaseApproved`, `handleFinalReviewCompleted`, and `handleFinalApproved`. See Test Requirements for specifics.

8. **Update the `getMutation` completeness test** — Replace the existing `'getMutation (all 13 events)'` describe block with a new `'getMutation (all 17 events)'` block that lists all 17 event names, asserts each returns a function, and asserts the total count is exactly 17.

9. **Verify all tests pass** — Run `node --test tests-v3/mutations.test.js` and confirm all tests pass (102 existing + new tests).

## Contracts & Interfaces

### MutationHandler Signature (all handlers conform to this)

```javascript
/**
 * @callback MutationHandler
 * @param {StateJson} state - deep clone of current state (safe to mutate)
 * @param {Object} context - enriched context from pre-read
 * @param {Config} config - parsed orchestration config
 * @returns {MutationResult}
 */
```

### MutationResult (return type for all handlers)

```javascript
/**
 * @typedef {Object} MutationResult
 * @property {StateJson} state - the mutated state
 * @property {string[]} mutations_applied - human-readable mutation descriptions
 */
```

### final_review State Object

The `final_review` property exists on the top-level state object (alongside `planning` and `execution`). It has this shape:

```javascript
// state.final_review
{
  status: 'not_started',   // 'not_started' | 'complete'
  report_doc: null,        // string | null — set by handleFinalReviewCompleted
  human_approved: false,   // boolean — set by handleFinalApproved
}
```

### Complete MUTATIONS Map (17 entries — final form)

```javascript
const MUTATIONS = Object.freeze({
  // Planning events (5)
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  // Plan approval (1)
  plan_approved:            handlePlanApproved,
  // Execution events (6)
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,
  // Gate events (2)
  task_approved:            handleTaskApproved,
  phase_approved:           handlePhaseApproved,
  // Review events (2)
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  // Halt (1)
  halt:                     handleHalt,
});
```

### PIPELINE_TIERS Constants (from constants.js — already imported)

```javascript
const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted',
});
```

### makeReviewState() Test Factory

```javascript
function makeReviewState() {
  return {
    planning: {
      status: 'complete',
      human_approved: true,
      current_step: 'master_plan',
      steps: [
        { name: 'research', status: 'complete', doc_path: 'RESEARCH.md' },
        { name: 'prd', status: 'complete', doc_path: 'PRD.md' },
        { name: 'design', status: 'complete', doc_path: 'DESIGN.md' },
        { name: 'architecture', status: 'complete', doc_path: 'ARCHITECTURE.md' },
        { name: 'master_plan', status: 'complete', doc_path: 'MASTER-PLAN.md' },
      ],
    },
    execution: {
      status: 'complete',
      current_tier: 'review',
      current_phase: 0,
      total_phases: 1,
      phases: [
        {
          name: 'Phase 1',
          status: 'complete',
          current_task: 1,
          total_tasks: 1,
          tasks: [
            {
              name: 'Task 1',
              status: 'complete',
              handoff_doc: 'tasks/TASK-P01-T01.md',
              report_doc: 'reports/TASK-REPORT-P01-T01.md',
              review_doc: 'reviews/REVIEW-P01-T01.md',
              review_verdict: 'approved',
              review_action: 'advanced',
              has_deviations: false,
              deviation_type: null,
              retries: 0,
            },
          ],
          phase_plan_doc: 'phases/PHASE-PLAN-P01.md',
          phase_report_doc: 'reports/PHASE-REPORT-P01.md',
          phase_review_doc: 'reviews/PHASE-REVIEW-P01.md',
          phase_review_verdict: 'approved',
          phase_review_action: 'advanced',
        },
      ],
    },
    final_review: {
      status: 'not_started',
      report_doc: null,
      human_approved: false,
    },
  };
}
```

### All 17 Event Names (for completeness assertion)

```javascript
const allEvents = [
  'research_completed',
  'prd_completed',
  'design_completed',
  'architecture_completed',
  'master_plan_completed',
  'plan_approved',
  'phase_plan_created',
  'task_handoff_created',
  'task_completed',
  'code_review_completed',
  'phase_report_created',
  'phase_review_completed',
  'task_approved',
  'phase_approved',
  'final_review_completed',
  'final_approved',
  'halt',
];
```

## Test Requirements

- [ ] **handleTaskApproved — returns state unchanged**: Invoke handler on an execution state where the current task is complete. Assert no state property changed. Assert `mutations_applied` is a non-empty array.
- [ ] **handlePhaseApproved — returns state unchanged**: Invoke handler on an execution state where the current phase is complete. Assert no state property changed. Assert `mutations_applied` is a non-empty array.
- [ ] **handleFinalReviewCompleted — sets final_review.report_doc**: Invoke on `makeReviewState()` with `context.doc_path = 'reviews/FINAL-REVIEW.md'`. Assert `state.final_review.report_doc === 'reviews/FINAL-REVIEW.md'`.
- [ ] **handleFinalReviewCompleted — sets final_review.status to complete**: Assert `state.final_review.status === 'complete'` after invocation.
- [ ] **handleFinalReviewCompleted — returns MutationResult**: Assert `mutations_applied` is a non-empty array.
- [ ] **handleFinalApproved — sets final_review.human_approved to true**: Invoke on a review state where `final_review.report_doc` is already set and `final_review.status = 'complete'`. Assert `state.final_review.human_approved === true`.
- [ ] **handleFinalApproved — transitions current_tier to complete**: Assert `state.execution.current_tier === 'complete'`.
- [ ] **handleFinalApproved — does NOT change execution.status**: Assert `state.execution.status === 'complete'` (unchanged from input).
- [ ] **handleFinalApproved — returns MutationResult**: Assert `mutations_applied` is a non-empty array.
- [ ] **getMutation completeness — returns a function for each of 17 events**: Loop through all 17 event names, assert `typeof getMutation(event) === 'function'` for each.
- [ ] **getMutation completeness — has exactly 17 registered events**: Count handlers returned for all 17 events, assert count === 17.
- [ ] **getMutation — returns undefined for unknown events**: Assert `getMutation('nonexistent_event') === undefined` (this test already exists — verify it still passes).

## Acceptance Criteria

- [ ] `mutations.js` MUTATIONS map contains exactly 17 entries (13 existing + 4 new)
- [ ] `getMutation` returns a handler function for each of the 4 new events: `task_approved`, `phase_approved`, `final_review_completed`, `final_approved`
- [ ] All 4 handler signatures conform to `(state, context, config) => MutationResult`
- [ ] `handleTaskApproved` and `handlePhaseApproved` are no-op mutations — they return state without modifications
- [ ] `handleFinalReviewCompleted` sets `final_review.report_doc` and `final_review.status`
- [ ] `handleFinalApproved` sets `final_review.human_approved = true` and `execution.current_tier = 'complete'`
- [ ] The `MUTATIONS` map is frozen with `Object.freeze()` and includes all 17 entries
- [ ] The placeholder comment `// T03 will add: ...` is removed
- [ ] All existing T01+T02 tests still pass (no regressions) — 102 tests
- [ ] All new T03 tests pass
- [ ] All tests pass: `node --test tests-v3/mutations.test.js`
- [ ] No syntax errors — module is importable via `require('./lib-v3/mutations')`

## Constraints

- Do NOT modify any existing handler functions — only add new handlers and update the MUTATIONS map
- Do NOT add handlers for events not in scope (`final_rejected`, `gate_rejected`, `plan_rejected` do not exist in v3 — all rejection/halt scenarios route through the existing `halt` event)
- Do NOT change the module's public exports (`getMutation`, `normalizeDocPath`, `_test`) — only the internal MUTATIONS map and new handler functions change
- Do NOT add new internal helpers to `_test` exports — the 4 new handlers are simple and don't require exposed test internals
- Do NOT add `final_review` to the `StateJson` typedef in `constants.js` — that is out of scope for this task (will be addressed when `scaffoldInitialState` is built in Phase 3)
- Do NOT modify `makeExecutionState()` or `makePlanningState()` test factories — add a new `makeReviewState()` factory instead
- Gate handlers (`handleTaskApproved`, `handlePhaseApproved`) must be true no-ops — do NOT add pointer advances, tier transitions, or any state changes (those are already handled by `handleCodeReviewCompleted` and `handlePhaseReviewCompleted` respectively)
