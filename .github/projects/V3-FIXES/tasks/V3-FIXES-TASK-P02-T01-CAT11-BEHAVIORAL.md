---
project: "V3-FIXES"
phase: 2
task: 1
title: "Add Category 11 — Corrective Task Flow behavioral test"
status: "pending"
skills: []
estimated_files: 1
---

# Add Category 11 — Corrective Task Flow Behavioral Test

## Objective

Append a new `describe('Category 11 — Corrective Task Flow', ...)` block at the end of `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` that exercises the full corrective task retry flow end-to-end through the live pipeline engine: inject a task in `failed`/`corrective_task_issued` state with stale fields populated → signal `task_handoff_created` → assert stale fields cleared, status reset to `in_progress`, and `handoff_doc` set → optionally continue to `task_completed` → assert `spawn_code_reviewer`.

## Context

`handleTaskHandoffCreated` in `mutations.js` uses presence-based clearing: if `task.report_doc` is truthy it nulls `report_doc` and `report_status`; if `task.review_doc` is truthy it nulls `review_doc`, `review_verdict`, and `review_action`. It then sets `task.handoff_doc` and `task.status = 'in_progress'`. This clearing is exercised by unit tests in `mutations.test.js` (Phase 1), but no behavioral test drives it through the full pipeline engine (`processEvent` → pre-reads → mutation → validation → resolver). Category 11 closes that gap. The test file already has 10 categories using a shared-IO sequential `describe` pattern with `node:test` + `node:assert/strict`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Append Category 11 `describe` block after the existing Category 10 closing `});` |

## Implementation Steps

1. Open `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`.

2. Locate the end of the file — the closing `});` of Category 10 is the last code. All new code goes AFTER this line.

3. Add a comment divider following the file's convention:
   ```javascript
   // ─── Category 11: Corrective Task Flow ───────────────────────────────────
   ```

4. Add a new `describe('Category 11 — Corrective Task Flow', () => { ... });` block. Inside it:

5. **Build the initial state** using `createExecutionState` with an override that sets a single task in `failed` status with all five stale fields populated. Use the inline override pattern from Categories 6–8 (pass an `execution` override object to `createExecutionState`). The task object must be:
   ```javascript
   {
     name: 'T01',
     status: 'failed',
     handoff_doc: 'c11-original-handoff.md',
     report_doc: 'c11-report.md',
     report_status: 'complete',
     review_doc: 'c11-review.md',
     review_verdict: 'changes_requested',
     review_action: 'corrective_task_issued',
     has_deviations: false,
     deviation_type: null,
     retries: 1,
   }
   ```

6. **Apply the V13 bypass**: Call `delete state.project.updated;` on the state object BEFORE passing it to `createMockIO`. This prevents the V13 monotonicity check from firing (same pattern as Categories 6–9).

7. **Set up documents map**: Create a documents object containing a task report document for the continuation step:
   ```javascript
   const documents = {
     'c11-corrective-report.md': makeDoc({ status: 'complete', has_deviations: false, deviation_type: null }),
   };
   ```

8. **Create shared IO**: `const io = createMockIO({ state, documents });` and `let writeCount = 0;` — same shared-IO pattern as other categories.

9. **Write `it` block — Step 1**: Signal `task_handoff_created` with `{ doc_path: 'c11-corrective-handoff.md' }`. Assert:
   - `result.success === true`
   - `result.action === 'execute_task'`
   - `io.getWrites().length === ++writeCount` (one state write)
   - Read the task from state: `io.getState().execution.phases[0].tasks[0]`
   - `task.status === 'in_progress'`
   - `task.handoff_doc === 'c11-corrective-handoff.md'`
   - All five stale fields are `null`: `task.report_doc`, `task.report_status`, `task.review_doc`, `task.review_verdict`, `task.review_action`

10. **Write `it` block — Step 2**: Signal `task_completed` with `{ doc_path: 'c11-corrective-report.md' }`. Assert:
    - `result.success === true`
    - `result.action === 'spawn_code_reviewer'`
    - `io.getWrites().length === ++writeCount`

## Contracts & Interfaces

### `processEvent` — from `pipeline-engine.js`

```javascript
// Already imported at top of file — do NOT add again:
const { processEvent } = require('../lib/pipeline-engine');

// Signature:
function processEvent(event, projectDir, context, io) → PipelineResult

// PipelineResult shape:
{
  success: boolean,
  action: string | null,
  mutations_applied: string[],
  context: object,
}
```

### `createMockIO` — from `./helpers/test-helpers.js`

```javascript
// Already imported at top of file — do NOT add again:
const { createMockIO, createExecutionState, deepClone } = require('./helpers/test-helpers');

// Signature:
function createMockIO({ state, documents, config }) → MockIO

// MockIO methods:
//   .getState()   → current state object (mutable reference)
//   .getWrites()  → array of state snapshots written
```

### `createExecutionState` — from `./helpers/test-helpers.js`

```javascript
// Creates a state object at execution tier (planning complete, human approved).
// Default: 1 phase, 2 tasks (T01, T02), all not_started.
// Accepts an overrides object that is deep-merged into the base.
function createExecutionState(overrides) → state

// Override pattern for mid-flight state (used in Categories 6–8):
const state = createExecutionState({
  execution: {
    total_phases: 1,
    phases: [{
      name: 'Phase 1',
      status: 'in_progress',
      current_task: 0,
      total_tasks: 1,
      tasks: [{ /* full task object */ }],
      phase_plan_doc: 'pp.md',
      phase_report_doc: null,
      phase_review_doc: null,
      phase_review_verdict: null,
      phase_review_action: null,
    }],
  },
});
```

### `handleTaskHandoffCreated` — clearing logic (read-only reference)

```javascript
// From mutations.js — this is the handler exercised by Category 11:
function handleTaskHandoffCreated(state, context, config) {
  const task = currentTask(state);
  const mutations = [];

  // Presence-based clearing — fires on corrective re-execution
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
  task.status = 'in_progress';  // TASK_STATUSES.IN_PROGRESS
  mutations.push(`Set task.handoff_doc to "${context.doc_path}"`);
  mutations.push(`Set task.status to "in_progress"`);

  return { state, mutations_applied: mutations };
}
```

### Local helpers already in the test file (do NOT redefine)

```javascript
// V13 bypass — delete project.updated before writing state
function backdateTimestamp(state) {
  delete state.project.updated;
  return state;
}

// Minimal parsed-document mock
function makeDoc(frontmatter) {
  return { frontmatter, body: '' };
}

// PROJECT_DIR constant
const PROJECT_DIR = '/test/project';
```

## Styles & Design Tokens

Not applicable — this is a pure test file with no UI.

## Test Requirements

### Category 11 — Step 1: Corrective `task_handoff_created` clears stale fields

```javascript
it('Step 1: task_handoff_created (corrective) → execute_task; stale fields cleared', () => {
  const result = processEvent('task_handoff_created', PROJECT_DIR, { doc_path: 'c11-corrective-handoff.md' }, io);
  writeCount++;
  assert.equal(result.success, true);
  assert.equal(result.action, 'execute_task');
  assert.equal(io.getWrites().length, writeCount);

  const task = io.getState().execution.phases[0].tasks[0];
  // Status and handoff_doc set correctly
  assert.equal(task.status, 'in_progress');
  assert.equal(task.handoff_doc, 'c11-corrective-handoff.md');

  // All five stale fields cleared to null
  assert.equal(task.report_doc, null);
  assert.equal(task.report_status, null);
  assert.equal(task.review_doc, null);
  assert.equal(task.review_verdict, null);
  assert.equal(task.review_action, null);
});
```

### Category 11 — Step 2: Continuation after corrective handoff

```javascript
it('Step 2: task_completed → spawn_code_reviewer', () => {
  const result = processEvent('task_completed', PROJECT_DIR, { doc_path: 'c11-corrective-report.md' }, io);
  writeCount++;
  assert.equal(result.success, true);
  assert.equal(result.action, 'spawn_code_reviewer');
  assert.equal(io.getWrites().length, writeCount);
});
```

## Acceptance Criteria

- [ ] A `describe('Category 11 — Corrective Task Flow', ...)` block exists at the end of `pipeline-behavioral.test.js`, after Category 10
- [ ] Step 1 asserts `result.action === 'execute_task'` after corrective `task_handoff_created`
- [ ] Step 1 asserts all five stale fields are `null`: `report_doc`, `report_status`, `review_doc`, `review_verdict`, `review_action`
- [ ] Step 1 asserts `task.status === 'in_progress'` and `task.handoff_doc === 'c11-corrective-handoff.md'`
- [ ] Step 2 asserts `result.action === 'spawn_code_reviewer'` after `task_completed`
- [ ] All existing Categories 1–10 pass unchanged (no modifications to any existing code)
- [ ] No state leaks between Category 11 and other categories (Category 11 has its own `createMockIO` with isolated state)
- [ ] Only `pipeline-behavioral.test.js` is modified — no other files touched
- [ ] All tests pass (`node --test pipeline-behavioral.test.js`)
- [ ] No lint errors

## Constraints

- Do NOT modify any existing Categories 1–10 or their helpers
- Do NOT add new helper functions or utility abstractions — inline the state setup
- Do NOT create any new files — all additions go inside `pipeline-behavioral.test.js`
- Do NOT modify `mutations.js`, `pipeline-engine.js`, or any other runtime script
- Do NOT add any imports — all needed imports (`processEvent`, `createMockIO`, `createExecutionState`, `makeDoc`, `assert`, `describe`, `it`) are already at the top of the file
- Do NOT redefine `PROJECT_DIR`, `backdateTimestamp`, `makeDoc`, or `makeExecutionStartState` — they already exist as local helpers
- Use `node:test` + `node:assert/strict` — no external test frameworks
- Follow the exact shared-IO sequential pattern: state + documents + `createMockIO` at describe scope, `let writeCount = 0`, sequential `it` blocks sharing `io` and `writeCount`
