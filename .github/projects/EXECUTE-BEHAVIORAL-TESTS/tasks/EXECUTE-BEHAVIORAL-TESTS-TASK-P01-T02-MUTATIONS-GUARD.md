---
project: "EXECUTE-BEHAVIORAL-TESTS"
phase: 1
task: 2
title: "Fix Mutations Guard (Defense-in-Depth Evaluation)"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 1
---

# Fix Mutations Guard (Defense-in-Depth Evaluation)

## Objective

Verify that the existing out-of-band changes to `mutations.js` are correct, confirm Option A (skip code logic change) as the defense-in-depth approach for the null/null auto-approve guard, and document the rationale in the task report.

## Context

The triage engine fix (T01, complete) changed Row 1 to return `{ verdict: null, action: 'spawn_code_reviewer' }` instead of `{ verdict: null, action: null }`. After that fix, only Row 8 (partial report, no review) still returns null/null. Three changes have already been applied to `mutations.js` out-of-band — the Coder must verify their correctness rather than re-apply them. The Architecture evaluated two options and recommends Option A (skip code logic change to the null/null guard) because Option B (adding an explicit `APPROVED` check inside the null/null branch) is logically impossible: `verdict === null` and `verdict === APPROVED` are mutually exclusive, making the auto-approve block unreachable and breaking Row 8.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| VERIFY | `.github/orchestration/scripts/lib/mutations.js` | Verify three out-of-band changes are correct; no new code changes expected |

## Implementation Steps

1. **Read `mutations.js`** — locate the `applyTaskTriage` function (starts at ~line 419).

2. **Verify Change 1 — Null/null guard comment** — Confirm the null/null guard block (the `if (triageResult.verdict === null && triageResult.action === null)` branch) has a comment explaining that after the triage Row 1 fix, only Row 8 (partial report, no review) reaches this branch. The comment should be present above or within the null/null check. Verify the auto-approve logic inside the block is UNCHANGED: when `task.report_doc` exists, task is set to `COMPLETE`, `review_verdict` to `APPROVED`, `review_action` to `ADVANCED`, and counters reset to 0. This is correct behavior for Row 8 partial reports.

3. **Verify Change 2 — `spawn_code_reviewer` routing branch** — Confirm that inside the non-null action routing section of `applyTaskTriage`, there is an `else if` branch matching `triageResult.action === 'spawn_code_reviewer'`. This branch should set `task.status = TASK_STATUSES.COMPLETE` and push a mutation message like `'task.status → complete (routed to code review)'`. This branch is needed because after the triage fix, Row 1 and Row 1b return `action: 'spawn_code_reviewer'`, and this action is not in the `REVIEW_ACTIONS` enum — so without this branch, the action routing would fall through without setting task status, leaving the task in an incorrect state.

4. **Verify Change 3 — `handleCodeReviewCompleted` clears triage fields** — Confirm that `handleCodeReviewCompleted` (Handler 11, ~line 234) sets `task.review_verdict = null` and `task.review_action = null` in addition to setting `task.review_doc`. This is needed so that after a code review document is attached, the triage engine can re-evaluate the task (the immutability guard in the non-null path would otherwise reject a write to fields that already have values).

5. **Confirm Option A is correct** — Walk through the Row 1 + Row 8 flow to confirm:
   - **Row 1 flow (clean completed task)**: Triage returns `{ verdict: null, action: 'spawn_code_reviewer' }` → `applyTaskTriage` takes the non-null path (action is not null) → increments `triage_attempts` → writes `review_verdict: null`, `review_action: 'spawn_code_reviewer'` → matches the `'spawn_code_reviewer'` routing branch → sets `task.status = COMPLETE` → resolver evaluates T11 (`review_doc === null && review_verdict === null`) → returns `SPAWN_CODE_REVIEWER`.
   - **Row 8 flow (partial report)**: Triage returns `{ verdict: null, action: null }` → `applyTaskTriage` enters the null/null guard → `task.report_doc` exists → auto-approves with `COMPLETE` + `APPROVED` + `ADVANCED`. This behavior is correct and preserved.

6. **Confirm Option B is NOT implemented** — Verify that the null/null guard does NOT contain a check for `triageResult.verdict === REVIEW_VERDICTS.APPROVED`. Such a check would be mutually exclusive with the enclosing `verdict === null` condition, making the auto-approve block unreachable and breaking Row 8.

7. **Write the task report** documenting:
   - Option A is confirmed as correct with rationale
   - All three out-of-band changes verified as correct
   - Option B is confirmed as architecturally incorrect (mutually exclusive conditions)
   - No code changes were needed — verification-only task

## Contracts & Interfaces

### `applyTaskTriage` — Null/null guard (verified, not changed)

```javascript
// Current correct state of the null/null guard:
function applyTaskTriage(state, triageResult) {
  // Null/null case: triage engine returned no verdict/action.
  // After triage Row 1 fix, only Row 8 (partial report, no review) reaches here.
  if (triageResult.verdict === null && triageResult.action === null) {
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc) {
      task.status = TASK_STATUSES.COMPLETE;
      task.review_verdict = REVIEW_VERDICTS.APPROVED;
      task.review_action = REVIEW_ACTIONS.ADVANCED;
      task.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return { state, mutations_applied: [...] };
    }
    return { state, mutations_applied: [] };
  }
  // ...non-null path continues
}
```

### `applyTaskTriage` — `spawn_code_reviewer` routing branch (verified, not changed)

```javascript
// Inside the non-null action routing section:
  } else if (triageResult.action === 'spawn_code_reviewer') {
    // Triage routed to code review — mark task complete so resolver T11 fires
    task.status = TASK_STATUSES.COMPLETE;
    mutations.push('task.status → complete (routed to code review)');
  } else if (triageResult.action === REVIEW_ACTIONS.HALTED) {
```

### `handleCodeReviewCompleted` — Clears triage fields (verified, not changed)

```javascript
function handleCodeReviewCompleted(state, context) {
  const task = currentTask(state);
  task.review_doc = context.review_path;
  // Clear triage fields so the immutability guard allows re-triage
  task.review_verdict = null;
  task.review_action = null;
  return {
    state,
    mutations_applied: [
      `task.review_doc → ${context.review_path}`,
      'task.review_verdict → null',
      'task.review_action → null'
    ]
  };
}
```

### Constants used (from `constants.js` — read-only reference)

```javascript
const TASK_STATUSES = { COMPLETE: 'complete', /* ... */ };
const REVIEW_VERDICTS = { APPROVED: 'approved', /* ... */ };
const REVIEW_ACTIONS = { ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted' };
```

Note: `'spawn_code_reviewer'` is intentionally NOT in `REVIEW_ACTIONS`. It is a string literal used by the triage engine, the mutations routing branch, and the resolver.

## Styles & Design Tokens

N/A — backend logic verification, no UI components.

## Test Requirements

- [ ] No new tests are needed — this is a verification-only task
- [ ] Existing triage-engine tests (45/45 passing from T01) cover Row 1 and Row 8 behavior
- [ ] Confirm existing tests still pass by running: `node --test .github/orchestration/scripts/tests/triage-engine.test.js`

## Acceptance Criteria

- [ ] Row 8 (partial reports, null/null) retains auto-approve behavior — `review_verdict: APPROVED`, `review_action: ADVANCED`, `status: COMPLETE` when `report_doc` exists
- [ ] The `spawn_code_reviewer` routing branch exists in `applyTaskTriage` and sets `task.status = TASK_STATUSES.COMPLETE`
- [ ] `handleCodeReviewCompleted` clears `review_verdict` and `review_action` to `null`
- [ ] The null/null guard does NOT contain a `REVIEW_VERDICTS.APPROVED` check (Option B not implemented)
- [ ] No new branches added to `applyTaskTriage` beyond the existing `spawn_code_reviewer` branch
- [ ] Constants used for all enum comparisons (`TASK_STATUSES.COMPLETE`, `REVIEW_VERDICTS.APPROVED`, `REVIEW_ACTIONS.ADVANCED`) — not string literals
- [ ] The decision (Option A confirmed) is documented in the task report with rationale
- [ ] All three out-of-band changes are verified and documented in the task report
- [ ] Existing triage-engine tests pass (45/45)

## Constraints

- Do NOT implement Option B (adding `APPROVED` check inside null/null guard — it is mutually exclusive with `verdict === null` and breaks Row 8)
- Do NOT change the null/null guard logic — the auto-approve behavior for Row 8 MUST be preserved
- Do NOT change the `spawn_code_reviewer` routing branch — it is already correct
- Do NOT change `handleCodeReviewCompleted` — it is already correct
- Do NOT add new constants to `constants.js`
- Do NOT modify `triage-engine.js` — that was T01's scope
- This is primarily a verification + documentation task — code changes should be zero or minimal (comment-only)
