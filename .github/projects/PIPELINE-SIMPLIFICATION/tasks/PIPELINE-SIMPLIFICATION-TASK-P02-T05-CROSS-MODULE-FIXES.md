---
project: "PIPELINE-SIMPLIFICATION"
phase: 2
task: 5
title: "CROSS-MODULE-FIXES"
status: "pending"
is_correction: true
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 4
---

# CROSS-MODULE-FIXES (Corrective)

## Objective

Fix three cross-module integration issues between `mutations.js` and `resolver.js` identified during the Phase 2 review: (1) align the final review state path so both modules read/write the same location, (2) persist `report_status` in `handleTaskCompleted` so it reaches the task decision table, and (3) replace an inconsistent unreachable fallback in `resolvePlanning` with the standard `halted()` pattern.

## Context

Phase 2 built `mutations.js` (17 handlers) and `resolver.js` (18 external actions) as independent modules with independent unit test fixtures. The Phase Review found that mutations write final review state to `state.final_review.*` while the resolver reads from `state.execution.*` — these will fail when wired together in Phase 3. Additionally, `report_status` is extracted during pre-read but never stored on the task object, causing `handleCodeReviewCompleted` to silently fall back to `'complete'`. Finally, `resolvePlanning` uses a raw return instead of the `halted()` helper in its unreachable fallback path.

## Issues from Phase Review

| # | Severity | Issue | Required Fix |
|---|----------|-------|-------------|
| 1 | Medium | Final review state path mismatch — mutations write `state.final_review.report_doc` / `state.final_review.human_approved`; resolver reads `state.execution.final_review_doc` / `state.execution.final_review_approved` | Update mutations to write to `state.execution.final_review_doc` and `state.execution.final_review_approved` instead of `state.final_review.*` |
| 2 | Minor | `report_status` not persisted — `handleTaskCompleted` never stores `context.report_status` on the task; `handleCodeReviewCompleted` falls back to `'complete'` silently | Store `context.report_status` on the task object in `handleTaskCompleted`; read `task.report_status` in `handleCodeReviewCompleted` (fallback already in place) |
| 3 | Minor | `resolvePlanning` unreachable fallback returns `{ action: NEXT_ACTIONS.REQUEST_PLAN_APPROVAL, context: {} }` instead of using `halted()` like every other unreachable path | Replace with `return halted('Unreachable: planning approved but no step incomplete')` |

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib-v3/mutations.js` | Issues #1 and #2 — fix `handleFinalReviewCompleted`, `handleFinalApproved`, `handleTaskCompleted` |
| MODIFY | `.github/orchestration/scripts/lib-v3/resolver.js` | Issue #3 — fix `resolvePlanning` unreachable fallback |
| MODIFY | `.github/orchestration/scripts/tests-v3/mutations.test.js` | Update final review handler tests to assert `state.execution.*` paths; add `report_status` persistence tests |
| MODIFY | `.github/orchestration/scripts/tests-v3/resolver.test.js` | Update review tier tests to use `state.execution.*` for final review fields (already correct); add test for `resolvePlanning` unreachable fallback |

## Implementation Steps

1. **Fix `handleFinalReviewCompleted` in `mutations.js`** — Change `state.final_review.report_doc = context.doc_path` and `state.final_review.status = 'complete'` to write `state.execution.final_review_doc = context.doc_path` and `state.execution.final_review_status = 'complete'`. Update the `mutations_applied` log strings to match.

2. **Fix `handleFinalApproved` in `mutations.js`** — Change `state.final_review.human_approved = true` to `state.execution.final_review_approved = true`. Update the `mutations_applied` log string to match.

3. **Fix `handleTaskCompleted` in `mutations.js`** — After the existing line `task.deviation_type = context.deviation_type;`, add `task.report_status = context.report_status || 'complete';`. Add a corresponding entry to the `mutations_applied` array: `` `Set task.report_status to "${task.report_status}"` ``.

4. **Verify `handleCodeReviewCompleted`** — Confirm line `task.report_status || 'complete'` in the `resolveTaskOutcome` call already reads from `task.report_status`. No change needed here — the fallback is correct and now `task.report_status` will actually be populated.

5. **Fix `resolvePlanning` unreachable fallback in `resolver.js`** — Replace the final `return { action: NEXT_ACTIONS.REQUEST_PLAN_APPROVAL, context: {} };` (lines ~53-54, after the `// Planning complete but tier not yet transitioned` comment) with `return halted('Unreachable: planning approved but no step incomplete');`.

6. **Update `mutations.test.js`** — In the `handleFinalReviewCompleted` test(s), change assertions from `state.final_review.report_doc` and `state.final_review.status` to `state.execution.final_review_doc` and `state.execution.final_review_status`. In the `handleFinalApproved` test(s), change assertion from `state.final_review.human_approved` to `state.execution.final_review_approved`. Add a test for `handleTaskCompleted` that verifies `task.report_status` is set from `context.report_status`. Add a test that `report_status` defaults to `'complete'` when `context.report_status` is undefined.

7. **Update `resolver.test.js`** — The review tier tests already use `state.execution.final_review_doc` and `state.execution.final_review_approved` (the resolver's current read path), so they remain correct. Add a test for `resolvePlanning` that covers the unreachable fallback: create a state where all planning steps are complete AND `human_approved` is `true` AND tier is still `'planning'`, assert the result is `{ action: 'display_halted', context: { details: ... } }`.

8. **Run the full test suite** — Execute `node --test .github/orchestration/scripts/tests-v3/mutations.test.js .github/orchestration/scripts/tests-v3/resolver.test.js` and verify all tests pass (existing + new).

## Contracts & Interfaces

### `handleFinalReviewCompleted` — After Fix

```javascript
function handleFinalReviewCompleted(state, context, config) {
  state.execution.final_review_doc = context.doc_path;
  state.execution.final_review_status = 'complete';
  return {
    state,
    mutations_applied: [
      `Set execution.final_review_doc to "${context.doc_path}"`,
      'Set execution.final_review_status to "complete"',
    ],
  };
}
```

### `handleFinalApproved` — After Fix

```javascript
function handleFinalApproved(state, context, config) {
  state.execution.final_review_approved = true;
  state.execution.current_tier = PIPELINE_TIERS.COMPLETE;
  return {
    state,
    mutations_applied: [
      'Set execution.final_review_approved to true',
      `Set execution.current_tier to "${PIPELINE_TIERS.COMPLETE}"`,
    ],
  };
}
```

### `handleTaskCompleted` — After Fix (report_status addition)

```javascript
function handleTaskCompleted(state, context, config) {
  const task = currentTask(state);
  task.report_doc = context.doc_path;
  task.has_deviations = context.has_deviations;
  task.deviation_type = context.deviation_type;
  task.report_status = context.report_status || 'complete';
  return {
    state,
    mutations_applied: [
      `Set task.report_doc to "${context.doc_path}"`,
      `Set task.has_deviations to ${context.has_deviations}`,
      `Set task.deviation_type to ${context.deviation_type}`,
      `Set task.report_status to "${task.report_status}"`,
    ],
  };
}
```

### `resolvePlanning` unreachable fallback — After Fix

```javascript
// Planning complete but tier not yet transitioned — should not normally reach here
// because mutations would have transitioned tier already.
return halted('Unreachable: planning approved but no step incomplete');
```

### `resolveReview` — No Change Needed

```javascript
function resolveReview(state) {
  const exec = state.execution;

  if (!exec.final_review_doc) {
    return { action: NEXT_ACTIONS.SPAWN_FINAL_REVIEWER, context: {} };
  }

  if (!exec.final_review_approved) {
    return { action: NEXT_ACTIONS.REQUEST_FINAL_APPROVAL, context: {} };
  }

  return halted('Final review approved but tier still in review — expected mutation to transition');
}
```

The resolver already reads from `state.execution.final_review_doc` and `state.execution.final_review_approved`. After mutations are fixed to write to these same paths, the integration will be correct.

## Test Requirements

- [ ] `handleFinalReviewCompleted` sets `state.execution.final_review_doc` to the provided `context.doc_path`
- [ ] `handleFinalReviewCompleted` sets `state.execution.final_review_status` to `'complete'`
- [ ] `handleFinalReviewCompleted` does NOT write to `state.final_review` (property should not exist)
- [ ] `handleFinalApproved` sets `state.execution.final_review_approved` to `true`
- [ ] `handleFinalApproved` does NOT write to `state.final_review` (property should not exist)
- [ ] `handleTaskCompleted` sets `task.report_status` to `context.report_status` when provided
- [ ] `handleTaskCompleted` defaults `task.report_status` to `'complete'` when `context.report_status` is `undefined`
- [ ] `resolvePlanning` returns `display_halted` (not `request_plan_approval`) when all steps complete and `human_approved` is `true` but tier is still `'planning'`
- [ ] All 147 existing Phase 2 tests continue to pass (after fixture updates)
- [ ] Full v3 test suite passes with zero regressions

## Acceptance Criteria

- [ ] `handleFinalReviewCompleted` writes to `state.execution.final_review_doc` and `state.execution.final_review_status` (not `state.final_review.*`)
- [ ] `handleFinalApproved` writes to `state.execution.final_review_approved` (not `state.final_review.human_approved`)
- [ ] `handleTaskCompleted` persists `report_status` on the task object
- [ ] `resolvePlanning` unreachable fallback uses `halted()` helper and returns `display_halted`
- [ ] Mutations and resolver agree on final review state location (`state.execution.*`)
- [ ] All new tests pass
- [ ] All existing tests pass (updated fixtures where needed)
- [ ] Build succeeds — all lib-v3 modules importable via `require()`
- [ ] No lint errors

## Constraints

- Do NOT change the resolver's `resolveReview` function — it already reads from the correct path (`state.execution.*`); only mutations need updating for Issue #1
- Do NOT modify the decision tables (`resolveTaskOutcome`, `resolvePhaseOutcome`) — they are correct
- Do NOT add new exports to either module — public API stays the same
- Do NOT refactor or reorganize code — fix only the three identified issues
- Do NOT modify constants.js — no new enum values are needed
- Do NOT touch planning handlers, gate handlers, or phase handlers — they are unaffected
- Keep the `_test` export pattern unchanged in mutations.js
