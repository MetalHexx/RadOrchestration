---
project: "V3-FIXES"
phase: 1
task: 1
title: "Add corrective clearing and idempotency unit tests to mutations.test.js"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 1
---

# Add corrective clearing and idempotency unit tests to mutations.test.js

## Objective

Add two new unit tests inside the existing `describe('handleTaskHandoffCreated', ...)` block in `.github/orchestration/scripts/tests/mutations.test.js`. Test 1 verifies that corrective re-execution clears all five stale task fields and emits clearing mutation log entries. Test 2 verifies that a first-time handoff (all stale fields already null) emits zero clearing entries (idempotency guarantee). No changes to any runtime source file.

## Context

`handleTaskHandoffCreated` in `mutations.js` uses presence-based clearing: if `task.report_doc` is truthy, it nulls `report_doc` and `report_status` and emits a clearing log entry; if `task.review_doc` is truthy, it nulls `review_doc`, `review_verdict`, and `review_action` and emits a clearing log entry. After clearing, it always sets `task.handoff_doc` and `task.status = 'in_progress'` and emits two standard log entries. The handler is accessed via `getMutation('task_handoff_created')`. The existing `makeExecutionState()` helper does NOT include `report_status` on tasks — tests must set it explicitly.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/mutations.test.js` | Add 2 `it(...)` blocks inside existing `describe('handleTaskHandoffCreated', ...)` section |

## Implementation Steps

1. Open `.github/orchestration/scripts/tests/mutations.test.js`.
2. Locate the existing `describe('handleTaskHandoffCreated', ...)` block (it starts around the `// ─── handleTaskHandoffCreated` comment divider). The block currently has a `beforeEach` and three `it(...)` tests.
3. **Add Test 1** as a new `it(...)` block at the end of the `describe('handleTaskHandoffCreated', ...)` block, BEFORE the closing `});` of that describe. Use the exact test body from the **Test Requirements § T1** section below.
4. **Add Test 2** as a new `it(...)` block immediately after Test 1, still inside the same describe block. Use the exact test body from the **Test Requirements § T2** section below.
5. Do NOT modify any other file. Do NOT modify `mutations.js` or any other source file.
6. Run `node --test mutations.test.js` from the `.github/orchestration/scripts/tests/` directory to verify all tests pass.

## Contracts & Interfaces

### `getMutation(event)` — from `mutations.js`

```javascript
// Import pattern at top of mutations.test.js (already present — do NOT add again):
const { getMutation, normalizeDocPath, _test } = require('../lib/mutations');

// Usage:
const handler = getMutation('task_handoff_created');
// handler signature: (state, context, config) => { state, mutations_applied: string[] }
```

### `handleTaskHandoffCreated` — internal logic (read-only reference)

```javascript
function handleTaskHandoffCreated(state, context, config) {
  const task = currentTask(state);
  // currentTask reads: state.execution.phases[state.execution.current_phase]
  //                      .tasks[phase.current_task]
  const mutations = [];

  if (task.report_doc) {
    task.report_doc = null;
    task.report_status = null;
    mutations.push('Cleared task.report_doc and report_status (corrective re-execution)');
  }
  if (task.review_doc) {
    task.review_doc = null;
    task.review_verdict = null;
    task.review_action = null;
    mutations.push('Cleared task.review_doc, review_verdict, and review_action (corrective re-execution)');
  }

  task.handoff_doc = context.doc_path;
  task.status = TASK_STATUSES.IN_PROGRESS; // 'in_progress'
  mutations.push(`Set task.handoff_doc to "${context.doc_path}"`);
  mutations.push(`Set task.status to "${TASK_STATUSES.IN_PROGRESS}"`);

  return { state, mutations_applied: mutations };
}
```

### `makeExecutionState(opts)` — test helper (already defined in mutations.test.js)

```javascript
// Already exists in the test file — do NOT redefine.
// Creates state with execution.phases[0].tasks[0] having:
//   status: 'not_started', handoff_doc: null, report_doc: null,
//   review_doc: null, review_verdict: null, review_action: null,
//   has_deviations: false, deviation_type: null, retries: 0
//
// IMPORTANT: Does NOT set report_status on tasks.
// For Test 1, you MUST manually set task.report_status before calling the handler.
```

### `defaultConfig` — test constant (already defined in mutations.test.js)

```javascript
// Already exists in the test file — do NOT redefine.
const defaultConfig = { limits: { max_retries_per_task: 2 } };
```

### Constants (string values used in assertions)

- `TASK_STATUSES.IN_PROGRESS` = `'in_progress'`
- Clearing log entry for report: `'Cleared task.report_doc and report_status (corrective re-execution)'`
- Clearing log entry for review: `'Cleared task.review_doc, review_verdict, and review_action (corrective re-execution)'`

## Styles & Design Tokens

Not applicable — this is a test-only task with no UI.

## Test Requirements

### T1 — Corrective handoff clears stale fields

```javascript
it('clears stale report and review fields on corrective re-execution', () => {
  const state = makeExecutionState();
  const task = state.execution.phases[0].tasks[0];
  task.report_doc = 'reports/TASK-REPORT-P01-T01.md';
  task.report_status = 'complete';
  task.review_doc = 'reviews/CODE-REVIEW-P01-T01.md';
  task.review_verdict = 'changes_requested';
  task.review_action = 'corrective_task_issued';

  const handler = getMutation('task_handoff_created');
  const result = handler(state, { doc_path: 'tasks/CORRECTIVE-HANDOFF.md' }, defaultConfig);

  // All five stale fields cleared to null
  assert.strictEqual(task.report_doc, null);
  assert.strictEqual(task.report_status, null);
  assert.strictEqual(task.review_doc, null);
  assert.strictEqual(task.review_verdict, null);
  assert.strictEqual(task.review_action, null);

  // New handoff fields set correctly
  assert.strictEqual(task.handoff_doc, 'tasks/CORRECTIVE-HANDOFF.md');
  assert.strictEqual(task.status, 'in_progress');

  // Mutation log contains clearing entries
  assert.ok(
    result.mutations_applied.some(m => m.includes('Cleared task.report_doc')),
    'Expected clearing entry for report_doc',
  );
  assert.ok(
    result.mutations_applied.some(m => m.includes('Cleared task.review_doc')),
    'Expected clearing entry for review_doc',
  );
});
```

### T2 — First-time handoff emits no clearing entries (idempotency)

```javascript
it('emits no clearing entries when stale fields are already null (first-time handoff)', () => {
  const state = makeExecutionState();
  const handler = getMutation('task_handoff_created');
  const result = handler(state, { doc_path: 'tasks/HANDOFF-P01-T01.md' }, defaultConfig);

  // No clearing mutation entries emitted
  assert.ok(
    !result.mutations_applied.some(m => m.includes('Cleared task.report_doc')),
    'Unexpected clearing entry for report_doc on first-time handoff',
  );
  assert.ok(
    !result.mutations_applied.some(m => m.includes('Cleared task.review_doc')),
    'Unexpected clearing entry for review_doc on first-time handoff',
  );

  // Only the two standard entries present (handoff_doc + status)
  assert.strictEqual(result.mutations_applied.length, 2);

  // Fields set correctly
  const task = state.execution.phases[0].tasks[0];
  assert.strictEqual(task.handoff_doc, 'tasks/HANDOFF-P01-T01.md');
  assert.strictEqual(task.status, 'in_progress');
  assert.strictEqual(task.report_doc, null);
  assert.strictEqual(task.review_doc, null);
});
```

## Acceptance Criteria

- [ ] Both new tests pass when run with `node --test mutations.test.js`
- [ ] All existing tests in `mutations.test.js` pass unchanged
- [ ] Test 1 asserts all 5 stale fields (`report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`) are `null` after corrective handoff
- [ ] Test 1 asserts `mutations_applied` contains entries matching `'Cleared task.report_doc'` and `'Cleared task.review_doc'`
- [ ] Test 2 asserts `mutations_applied` contains zero clearing entries for a first-time handoff
- [ ] Test 2 asserts `mutations_applied.length` is exactly 2 (only `handoff_doc` + `status` entries)
- [ ] No changes to any file other than `mutations.test.js`

## Constraints

- Do NOT modify `mutations.js` or any other runtime source file
- Do NOT add new imports — the file already imports everything needed (`getMutation`, `assert`, `describe`, `it`, `beforeEach`)
- Do NOT redefine `makeExecutionState` or `defaultConfig` — they already exist in the test file
- Do NOT create a new `describe` block — add both `it(...)` tests inside the existing `describe('handleTaskHandoffCreated', ...)` block
- Do NOT install any dependencies or test frameworks — use only `node:test` and `node:assert/strict`
