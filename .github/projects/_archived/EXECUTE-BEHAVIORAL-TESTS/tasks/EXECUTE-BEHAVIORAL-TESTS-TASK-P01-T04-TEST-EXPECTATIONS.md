---
project: "EXECUTE-BEHAVIORAL-TESTS"
phase: 1
task: 4
title: "Update test expectations for new triage behavior"
status: "pending"
skills_required: ["code"]
skills_optional: []
estimated_files: 1
---

# Update Test Expectations for New Triage Behavior

## Objective

Update assertion values and setup state values in the behavioral test suite (`pipeline-behavioral.test.js`) so they match the corrected triage engine behavior — clean completed tasks now route to `spawn_code_reviewer` instead of being auto-approved, and all triage row numbers shifted (original 2–11 → 3–12) due to the insertion of Row 1b.

## Context

The triage engine (`triage-engine.js`) has been modified: Row 1 now returns `{ verdict: null, action: 'spawn_code_reviewer' }` instead of `{ verdict: null, action: null }`, and a new Row 1b was inserted for complete tasks with deviations but no review. This caused all subsequent rows to renumber (original Row 2 → Row 3, Row 3 → Row 4, ... Row 11 → Row 12). The mutations guard in `mutations.js` was evaluated (T02) and left structurally unchanged — only a clarifying comment was added; Row 8 (partial, no review — formerly Row 7) still auto-approves through the null/null guard. The behavioral test file still asserts the OLD auto-approve behavior and OLD row numbers.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Update assertion values and setup states only — no structural changes |

## Implementation Steps

1. **Read the full behavioral test file** to understand all test assertions and setup states.

2. **Update the Row 1 isolation test** (line ~622–654). The test is currently named `'Row 1: complete, no deviations, no review_doc → auto-approve → generate_phase_report'`. Changes needed:
   - The `it()` description string: change `auto-approve → generate_phase_report` to `spawn code reviewer → spawn_code_reviewer`.
   - The comment above it: update to match the new description.
   - The `result.action` assertion: change from `NEXT_ACTIONS.GENERATE_PHASE_REPORT` to `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`.
   - The `task.review_verdict` assertion: change from `REVIEW_VERDICTS.APPROVED` to `null`.
   - The `task.review_action` assertion: change from `REVIEW_ACTIONS.ADVANCED` to `'spawn_code_reviewer'`.
   - The `task.status` assertion: change from `TASK_STATUSES.COMPLETE` to `TASK_STATUSES.IN_PROGRESS` (task is not yet complete — it's waiting for code review).

3. **Update the Row 2–11 test labels** to reflect the new numbering (Row 2 → Row 3, Row 3 → Row 4, ... Row 11 → Row 12). For each of these tests, update:
   - The comment line above the `it()`: `// ── Row N:` → `// ── Row N+1:`
   - The `it()` description string: `'Row N:` → `'Row N+1:`
   - These tests do NOT need assertion value changes — only the row number label changes. The test **conditions** and **expected behavior** for rows 3–12 (formerly 2–11) remain identical because their triage logic is unchanged.

   Specific renaming:
   - `Row 2:` → `Row 3:` (line ~656–657)
   - `Row 3:` → `Row 4:` (line ~697–698)
   - `Row 4:` → `Row 5:` (line ~737–738)
   - `Row 5:` → `Row 6:` (line ~777–778)
   - `Row 6:` → `Row 7:` (line ~819–820)
   - `Row 7:` → `Row 8:` (line ~862–863)
   - `Row 8:` → `Row 9:` (line ~896–897)
   - `Row 9:` → `Row 10:` (line ~938–939)
   - `Row 10:` → `Row 11:` (line ~980–981)
   - `Row 11:` → `Row 12:` (line ~1014–1015)

4. **Update the Full Happy Path test** (line ~229). Currently, Step 10 sends `task_completed` and expects `NEXT_ACTIONS.GENERATE_PHASE_REPORT` because the old Row 1 auto-approved and the internal `advance_task` action ran. After the fix, Step 10 should expect `NEXT_ACTIONS.SPAWN_CODE_REVIEWER` instead. Then a **new Step 10b** must be inserted to simulate the code review cycle:
   - Add a `codeReviewDoc` to the `documents` object: `{ frontmatter: { verdict: 'approved' }, body: 'Code review body' }` stocked at `'reviews/code-review.md'` and `'/test/project/reviews/code-review.md'`.
   - After the existing Step 10, add a new pipeline call: `executePipeline(makeRequest('code_review_completed', { review_path: 'reviews/code-review.md' }), io)`.
   - This new step should assert `result.success === true` and `result.action === NEXT_ACTIONS.GENERATE_PHASE_REPORT` (the code review approves → triage Row 3 fires → advance_task internal → phase lifecycle → generate_phase_report).
   - Update the Step 10 comment to reflect the new flow: `task_completed → triage Row 1 → spawn_code_reviewer`.
   - Renumber subsequent step comments (Step 11 → Step 12, Step 12 → Step 13, Step 13 → Step 14, Step 14 → Step 15) and update variable names accordingly (r11 → r12, r12 → r13, etc., or add r10b and keep existing names).
   - Update the step count in the test name: `'walks through all 14 pipeline steps'` → `'walks through all 15 pipeline steps'` (or equivalent).

5. **Update the Multi-Phase Multi-Task test** (line ~379). This test has 4 task completions (2 phases × 2 tasks), each expecting auto-approve behavior. After the fix, each `task_completed` event for a clean task now returns `SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step after each `task_completed` step:
   - Add a `codeReviewDoc` to the `documents` object (same pattern as Full Happy Path).
   - **Phase 1, Task 1 completed** (line ~481): change expected action from `NEXT_ACTIONS.CREATE_TASK_HANDOFF` to `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step after it that expects `NEXT_ACTIONS.CREATE_TASK_HANDOFF`.
   - **Phase 1, Task 2 completed** (line ~500): change expected action from `NEXT_ACTIONS.GENERATE_PHASE_REPORT` to `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step after it that expects `NEXT_ACTIONS.GENERATE_PHASE_REPORT`.
   - **Phase 2, Task 1 completed** (line ~549): change expected action from `NEXT_ACTIONS.CREATE_TASK_HANDOFF` to `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step after it that expects `NEXT_ACTIONS.CREATE_TASK_HANDOFF`.
   - **Phase 2, Task 2 completed** (line ~564): change expected action from `NEXT_ACTIONS.GENERATE_PHASE_REPORT` to `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step after it that expects `NEXT_ACTIONS.GENERATE_PHASE_REPORT`.

6. **Update the Human Gate Modes tests** (line ~1346). Three tests send `task_completed` for clean tasks and expect auto-approve flow:
   - **autonomous mode** (line ~1359): change `result.action` assertion from `NEXT_ACTIONS.GENERATE_PHASE_REPORT` to `NEXT_ACTIONS.SPAWN_CODE_REVIEWER`. Remove the `assert.notEqual(result.action, NEXT_ACTIONS.GATE_TASK)` and `assert.notEqual(result.action, NEXT_ACTIONS.GATE_PHASE)` lines (they would assert against `SPAWN_CODE_REVIEWER` which is not a gate action — these lines are now misleading).
   - **task mode** (line ~1413): the first step (`task_completed`) changes from expecting `GATE_TASK` to `SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step to complete the review cycle, then the result of that should be `GATE_TASK`. Then `gate_approved` proceeds to `CREATE_TASK_HANDOFF` as before.
   - **phase mode** (line ~1485): Step 1 (`task_completed`) changes from expecting `GENERATE_PHASE_REPORT` to `SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step that expects `GENERATE_PHASE_REPORT`. Subsequent steps remain unchanged.
   - **ask mode** (line ~1561): same pattern as autonomous mode — change expected action to `SPAWN_CODE_REVIEWER`. Remove the `assert.notEqual` lines for gate actions.
   - **gate_rejected** (line ~1595): the first step (`task_completed`) changes from expecting `GATE_TASK` to `SPAWN_CODE_REVIEWER`. Insert a `code_review_completed` step, then a second `task_completed` is not needed — the flow after code review with approval in task-gate mode should hit `GATE_TASK`. Then `gate_rejected` proceeds as before.

7. **Update the Retry & Corrective Cycles test** (line ~1603). The "single corrective cycle" test has a Step 3 where the task succeeds after correction: `task_completed` with a clean report expects `GENERATE_PHASE_REPORT`. Change this to expect `SPAWN_CODE_REVIEWER`. Add a `code_review_completed` step after it that expects `GENERATE_PHASE_REPORT`.

8. **Update the Halt Paths tests** — only if any rely on auto-approve for clean tasks in their setup sequences. Review each:
   - **Task rejected by reviewer (Row 6)** (line ~1703): uses `code_review_completed` event with `verdict: 'rejected'` — unchanged (this test already uses the post-review flow).
   - **Task critical failure (Row 11)** (line ~1743): uses `task_completed` with `status: 'failed'` — unchanged (failed tasks don't hit Row 1).
   - **Phase rejected** (line ~1776): setup state has task already `status: 'complete'` with `review_verdict: 'approved'` — unchanged (pre-built state, no pipeline steps depend on auto-approve).
   - **Gate rejected** (line ~1839): uses `gate_rejected` event — unchanged.
   - Update row number references in comments: `Row 6` → `Row 7`, `Row 11` → `Row 12`.

9. **Update the Frontmatter-Driven Flows test** — `'has_deviations/deviation_type drive correct triage row (Row 3: minor, approved → advance)'` (line ~2137): update the comment/description row reference from `Row 3` to `Row 4` (since this tests minor deviations with approved verdict, which is now Row 4).

10. **Run the full behavioral test suite** to verify all updates are correct:
    ```bash
    node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js
    ```

## Contracts & Interfaces

### Triage Engine Decision Table (Current — After T01 Fix)

The triage engine returns results via `makeSuccess(level, verdict, action, phaseIndex, taskIndex, rowMatched, details)`:

```javascript
// Row 1: complete, no deviations, no review → spawn code reviewer
// Returns: { verdict: null, action: 'spawn_code_reviewer', row_matched: 1 }

// Row 1b (row_matched=2): complete, deviations, no review → spawn code reviewer  
// Returns: { verdict: null, action: 'spawn_code_reviewer', row_matched: 2 }

// Row 3: complete, no deviations, approved → advance
// Returns: { verdict: 'approved', action: 'advanced', row_matched: 3 }

// Row 4: complete, minor deviations, approved → advance
// Returns: { verdict: 'approved', action: 'advanced', row_matched: 4 }

// Row 5: complete, architectural deviations, approved → advance
// Returns: { verdict: 'approved', action: 'advanced', row_matched: 5 }

// Row 6: complete, changes requested → corrective task
// Returns: { verdict: 'changes_requested', action: 'corrective_task_issued', row_matched: 6 }

// Row 7: complete, rejected → halt
// Returns: { verdict: 'rejected', action: 'halted', row_matched: 7 }

// Row 8: partial, no review → skip triage (null/null)
// Returns: { verdict: null, action: null, row_matched: 8 }

// Row 9: partial, changes requested → corrective task
// Returns: { verdict: 'changes_requested', action: 'corrective_task_issued', row_matched: 9 }

// Row 10: partial, rejected → halt
// Returns: { verdict: 'rejected', action: 'halted', row_matched: 10 }

// Row 11: failed, minor, retries available → corrective task
// Returns: { verdict: <transcribed>, action: 'corrective_task_issued', row_matched: 11 }

// Row 12: failed, critical or exhausted → halt
// Returns: { verdict: <transcribed>, action: 'halted', row_matched: 12 }
```

### Mutations Behavior After Triage Fix

```javascript
// When triage returns { verdict: null, action: 'spawn_code_reviewer' } (Row 1):
//   - Enters the NON-null path (action !== null)
//   - Increments triage_attempts
//   - Writes task.review_verdict = null
//   - Writes task.review_action = 'spawn_code_reviewer'
//   - Action routing switch: 'spawn_code_reviewer' not in REVIEW_ACTIONS enum
//     → falls through without setting task.status
//   - Task status remains 'in_progress'
//   - Resolver T11 fires: review_doc === null && review_verdict === null → SPAWN_CODE_REVIEWER

// When triage returns { verdict: null, action: null } (Row 8 — partial):
//   - Enters the null/null guard path
//   - If task.report_doc exists → auto-approve:
//     task.status = 'complete', review_verdict = 'approved', review_action = 'advanced'
//   - Row 8 auto-approve behavior is UNCHANGED
```

### Constants Used in Assertions

```javascript
// From constants.js — use these constants, not string literals, in assertions
const NEXT_ACTIONS = {
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  EXECUTE_TASK: 'execute_task',
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  // ... others
};

const REVIEW_VERDICTS = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected'
};

const REVIEW_ACTIONS = {
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted'
};

const TASK_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted'
};
```

### Test Infrastructure Patterns

```javascript
// Mock IO factory
const io = createMockIO({ state, documents, config });

// Pipeline execution
const result = executePipeline(makeRequest(eventName, contextObject), io);

// State retrieval after pipeline execution
const finalState = io.getState();

// Code review document pattern (for insertion into documents objects)
const codeReviewDoc = {
  frontmatter: { verdict: 'approved' },
  body: 'Code review body'
};
// Stock at both direct and project-relative paths:
documents['reviews/code-review.md'] = codeReviewDoc;
documents['/test/project/reviews/code-review.md'] = codeReviewDoc;

// Code review completion event
executePipeline(makeRequest('code_review_completed', {
  review_path: 'reviews/code-review.md'
}), io);
```

## Styles & Design Tokens

Not applicable — this is a test file modification task with no UI components.

## Test Requirements

- [ ] Run `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` — all tests pass
- [ ] Row 1 test asserts `result.action === NEXT_ACTIONS.SPAWN_CODE_REVIEWER`
- [ ] Row 1 test asserts `task.review_verdict === null` (not `REVIEW_VERDICTS.APPROVED`)
- [ ] Row 1 test asserts `task.review_action === 'spawn_code_reviewer'` (not `REVIEW_ACTIONS.ADVANCED`)
- [ ] Row 8 test (formerly Row 7) retains auto-approve assertions with `REVIEW_VERDICTS.APPROVED` and `REVIEW_ACTIONS.ADVANCED`
- [ ] Full Happy Path test passes with the code review step inserted
- [ ] Multi-Phase Multi-Task test passes with code review steps inserted after each task completion

## Acceptance Criteria

- [ ] Row 1 isolation test asserts `action: SPAWN_CODE_REVIEWER` (not `GENERATE_PHASE_REPORT` or auto-approve)
- [ ] Row 1 isolation test asserts `review_verdict: null` and `review_action: 'spawn_code_reviewer'` (not `APPROVED`/`ADVANCED`)
- [ ] Row 1 isolation test asserts `task.status: IN_PROGRESS` (not `COMPLETE`)
- [ ] Full Happy Path test includes a `code_review_completed` step after `task_completed` and passes
- [ ] Multi-Phase Multi-Task test includes `code_review_completed` steps after each `task_completed` and passes
- [ ] Row 8 test (formerly Row 7) retains auto-approve assertions — `review_verdict: APPROVED`, `review_action: ADVANCED`, `status: COMPLETE` — with updated row number label (7 → 8)
- [ ] All row number references in test comments and `it()` descriptors reflect the new numbering (original 2–11 → 3–12)
- [ ] Human Gate Modes tests pass with updated task_completed → spawn_code_reviewer flow
- [ ] Retry & Corrective Cycles single-corrective test passes with code review step inserted on the success path
- [ ] Halt Paths test comments updated for row renumbering (Row 6 → Row 7, Row 11 → Row 12)
- [ ] Frontmatter-Driven Flows row reference updated (Row 3 → Row 4)
- [ ] No new `describe` blocks, `it` blocks, or helper functions added
- [ ] No test structure changes — only assertion values, setup state values, and inserted pipeline steps within existing `it()` blocks
- [ ] All assertions use `assert.strictEqual` / `assert.deepStrictEqual` / `assert.equal` pattern (consistent with existing style)
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js`

## Constraints

- Do NOT add new `describe` blocks or `it` blocks — only modify existing ones
- Do NOT add new helper functions or test utilities
- Do NOT modify `createMockIO`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, or `advancePipeline` factory/utility functions
- Do NOT change the test runner command or test infrastructure
- Do NOT modify any source files (`triage-engine.js`, `mutations.js`, `constants.js`, `resolver.js`, `pipeline-engine.js`) — this task is test-file-only
- Do NOT modify the triage engine unit tests (`triage-engine.test.js`) — those were already updated in T01
- Do NOT change assertion patterns (e.g., switching from `assert.equal` to `assert.deepEqual`) — match the existing style in each test
- Row 8 (partial, no review — formerly Row 7) MUST retain its auto-approve behavior assertions unchanged (only the row number label changes from 7 → 8)
- When inserting code review steps into multi-step tests (Happy Path, Multi-Phase, Human Gates), add the `code_review_completed` pipeline call and assertion immediately after the `task_completed` call — do not reorder other steps
- Stock code review documents at BOTH direct and project-relative paths (`'reviews/code-review.md'` AND `'/test/project/reviews/code-review.md'`) following the existing dual-path pattern in the test file
