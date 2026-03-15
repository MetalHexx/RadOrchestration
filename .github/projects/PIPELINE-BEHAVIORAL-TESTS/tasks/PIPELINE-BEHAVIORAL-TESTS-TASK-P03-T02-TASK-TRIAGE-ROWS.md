---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 3
task: 2
title: "Task-Level Triage Rows 1–11"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Task-Level Triage Rows 1–11

## Objective

Add 11 behavioral tests into the existing `describe('Behavioral: Task Triage')` block in `pipeline-behavioral.test.js`, one per task-level triage decision row, each exercising `executePipeline` end-to-end with a `task_completed` or `code_review_completed` event and asserting the correct `result.action` and state mutations.

## Context

The pipeline-behavioral test file already exists with factory functions (`createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `advancePipeline`), two happy-path tests, and an empty `describe('Behavioral: Task Triage', () => { /* T02: Rows 1-11 */ });` placeholder. The triage engine evaluates an 11-row first-match-wins decision table when `executePipeline` processes a `task_completed` or `code_review_completed` event. Each test must set up state at the execution tier with a task in the right status, stock mock documents with appropriate frontmatter, call `executePipeline`, and assert the pipeline's behavioral outcome. All tests use `withStrictDates` to avoid V13 timestamp validation collisions.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Replace the empty `describe('Behavioral: Task Triage')` placeholder with 11 tests |

## Implementation Steps

1. **Locate the empty placeholder** `describe('Behavioral: Task Triage', () => { /* T02: Rows 1-11 */ });` in the file and replace it with a full `describe` block containing 11 `it()` tests.

2. **For each test**, follow this pattern:
   - Create an execution-ready state via `createExecutionState(mutator)` with the task in the correct status and sub-state for that row
   - Stock the mock IO `documents` map with required frontmatter (task report, optionally code review)
   - Stock documents at both direct and project-relative paths where needed (triage reads task report directly via `task.report_doc`; code review via `task.review_doc` using `createProjectAwareReader`)
   - Call `executePipeline(makeRequest('task_completed', { report_path: '...' }), io)` (or `code_review_completed` for review-centric rows)
   - Assert `result.success`, `result.action`, `result.triage_ran`, and relevant state mutations on `io.getState()`

3. **Use the exact test label convention**: `"Row N: {status}, {conditions} → {expected action}"` as specified below.

4. **Wrap all test bodies in `withStrictDates(() => { ... })`** to prevent V13 timestamp validation collisions during triage + internal action loops.

5. **For Rows 1 and 7** (auto-approve skip rows): The triage engine returns `verdict=null, action=null`. The `applyTaskTriage` function then auto-approves when `task.report_doc` is set: it sets `task.status = 'complete'`, `task.review_verdict = 'approved'`, `task.review_action = 'advanced'`. The resolver then sees `review_verdict === 'approved'` → `advance_task` (internal action) → `current_task` incremented → exceeds `tasks.length` → phase lifecycle → `generate_phase_report`. So the expected `result.action` is `NEXT_ACTIONS.GENERATE_PHASE_REPORT`.

6. **For Rows 2, 3, 4** (advance rows with review): These require a `code_review_completed` event to trigger triage on a task that already has a report_doc. Set up by first calling `executePipeline` with `task_completed` (which triggers Row 1 auto-approve since no review_doc). Instead, use `createExecutionState` with task status already having a report_doc set and a review_doc set, with `review_verdict` and `review_action` still null (so triage can run). Send `code_review_completed` to trigger triage. After triage applies `REVIEW_ACTIONS.ADVANCED`, the resolver sees `review_verdict === 'approved'` → `advance_task` → `generate_phase_report`.

7. **For Rows 5, 8** (corrective task rows): Triage returns `REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED`. The `applyTaskTriage` function sets `task.status = 'failed'`, increments `task.retries`. The resolver sees `status === 'failed'` with `severity === 'minor'` (or null) and retries < max → `create_corrective_handoff`. But `create_corrective_handoff` is NOT in `EXTERNAL_ACTIONS`... wait — checking: actually, `CREATE_CORRECTIVE_HANDOFF` IS in `EXTERNAL_ACTIONS`. So the expected `result.action` is `NEXT_ACTIONS.CREATE_CORRECTIVE_HANDOFF`.

8. **For Rows 6, 9** (halt rows): Triage returns `REVIEW_ACTIONS.HALTED`. The `applyTaskTriage` sets `task.status = 'halted'`, `pipeline.current_tier = 'halted'`. Resolver sees halted → `display_halted`.

9. **For Row 10** (failed, minor, retries available): Set up task with `status` that will become `failed` via report. Actually — the `task_completed` pre-read enriches context with `report_status` from the task report frontmatter. Then the mutation (`handleTaskCompleted`) sets `task.report_doc` and `task.severity`. Then triage runs: `triageTask` reads the task report again, sees `reportStatus === 'failed'`, calls `checkRetryBudget` with`task.severity` and `task.retries`. Since `task.severity` may not be set by the mutation (only sets if `context.report_severity != null`), you need the task report to have `severity: 'minor'`. After triage, `applyTaskTriage` with `CORRECTIVE_TASK_ISSUED` sets `task.status = 'failed'`, `task.retries += 1`. Resolver sees failed + minor + retries < max → `create_corrective_handoff`.

10. **For Row 11** (failed, critical or retries exhausted): Similar to Row 10 but with `severity: 'critical'` or `retries >= max_retries_per_task`. After triage returns `HALTED`, `applyTaskTriage` sets `task.status = 'halted'`, `pipeline.current_tier = 'halted'`. Resolver → `display_halted`.

11. **Verify `context.report_deviation_type` propagation** for Rows 3 and 4 (carry-forward from Phase 2): Assert that the state's task has the correct review outcome after triage processes deviation information from frontmatter.

## Contracts & Interfaces

### `executePipeline` — Function Under Test

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js
function executePipeline(request, io) { ... }
```

**PipelineRequest**:
```javascript
{
  event: string,           // 'task_completed' or 'code_review_completed'
  projectDir: string,      // '/test/project'
  configPath: string,      // '/test/orchestration.yml'
  context: Object          // { report_path: '...' } or { review_path: '...' }
}
```

**PipelineResultSuccess**:
```javascript
{
  success: true,
  action: string,          // One of NEXT_ACTIONS
  context: Object,         // { tier, phase_index, task_index, phase_id, task_id, details }
  mutations_applied: string[],
  triage_ran: boolean,     // true for all triage-triggering events
  validation_passed: boolean
}
```

### Task Report Pre-Read (at `task_completed`)

The pipeline pre-reads the task report document at `context.report_path` and validates:
- `has_deviations` must be present (not `undefined` or `null`) → error if absent
- `deviation_type` must be present (not `undefined`) → error if absent
- `status` must be one of `'complete'`, `'partial'`, `'failed'` (or synonyms `'pass'`/`'fail'`)

Enriches context with: `report_status`, `report_severity`, `report_deviations` (boolean), `report_deviation_type`.

### Triage Engine — 11 Task-Level Decision Rows

```
Row 1:  status=complete, has_deviations=false, no review_doc    → verdict=null,               action=null (skip)
Row 2:  status=complete, has_deviations=false, verdict=approved  → verdict=approved,           action=advanced
Row 3:  status=complete, has_deviations=true, deviation_type=minor, verdict=approved → verdict=approved, action=advanced
Row 4:  status=complete, has_deviations=true, deviation_type=architectural, verdict=approved → verdict=approved, action=advanced
Row 5:  status=complete, verdict=changes_requested               → verdict=changes_requested,  action=corrective_task_issued
Row 6:  status=complete, verdict=rejected                        → verdict=rejected,           action=halted
Row 7:  status=partial, no review_doc                            → verdict=null,               action=null (skip)
Row 8:  status=partial, verdict=changes_requested                → verdict=changes_requested,  action=corrective_task_issued
Row 9:  status=partial, verdict=rejected                         → verdict=rejected,           action=halted
Row 10: status=failed, severity=minor, retries < max             → verdict=null/from-review,   action=corrective_task_issued
Row 11: status=failed, severity=critical OR retries >= max       → verdict=null/from-review,   action=halted
```

### `applyTaskTriage` — State Mutations by Triage Action

```javascript
// When verdict=null, action=null AND task.report_doc is set (Rows 1, 7):
//   task.status = 'complete'
//   task.review_verdict = 'approved'
//   task.review_action = 'advanced'
//   execution.triage_attempts = 0

// When action === 'advanced' (Rows 2, 3, 4):
//   execution.triage_attempts += 1
//   task.review_verdict = triageResult.verdict
//   task.review_action = 'advanced'
//   task.status = 'complete'
//   execution.triage_attempts = 0 (reset on advance)

// When action === 'corrective_task_issued' (Rows 5, 8, 10):
//   execution.triage_attempts += 1
//   task.review_verdict = triageResult.verdict
//   task.review_action = 'corrective_task_issued'
//   task.status = 'failed'
//   task.retries += 1
//   errors.total_retries += 1

// When action === 'halted' (Rows 6, 9, 11):
//   execution.triage_attempts += 1
//   task.review_verdict = triageResult.verdict
//   task.review_action = 'halted'
//   task.status = 'halted'
//   pipeline.current_tier = 'halted'
//   errors.total_halts += 1
//   errors.active_blockers ← 'Task halted by triage: ...'
```

### Internal Action Loop After Triage

For advance-outcome rows (1, 2, 3, 4, 7), after `applyTaskTriage` the resolver runs:
1. Sees `task.review_verdict === 'approved'` → `ADVANCE_TASK` (internal)
2. Pipeline increments `phase.current_task += 1`
3. If `current_task >= tasks.length` → phase lifecycle → `GENERATE_PHASE_REPORT`
4. If `current_task < tasks.length` → next task → `CREATE_TASK_HANDOFF`

For corrective rows (5, 8, 10), resolver sees `task.status === 'failed'`:
- If `task.severity === 'critical'` → `HALT_TASK_FAILED`
- If `task.retries >= max_retries_per_task` → `HALT_TASK_FAILED`
- Otherwise → `CREATE_CORRECTIVE_HANDOFF`

For halt rows (6, 9, 11), resolver sees `task.status === 'halted'` → `DISPLAY_HALTED`.

### Factory Functions Available (DO NOT IMPORT — already in the file)

```javascript
createMockIO(opts)           // { state?, config?, documents? }
createDefaultConfig(overrides) // Returns standard config; execution_mode defaults to 'autonomous'
createBaseState(overrides)   // Minimal state, planning not started
createExecutionState(mutator) // Execution-tier state with 1 phase, 1 task, planning complete
makeRequest(event, context)  // { event, projectDir: '/test/project', configPath: '/test/orchestration.yml', context }
withStrictDates(fn)          // Monkey-patches Date for monotonic timestamps
advancePipeline(io, events)  // Runs sequence of events, asserts success at each step
```

### Constants Available (already imported at top of file)

```javascript
NEXT_ACTIONS.GENERATE_PHASE_REPORT   // 'generate_phase_report'
NEXT_ACTIONS.CREATE_CORRECTIVE_HANDOFF // 'create_corrective_handoff'
NEXT_ACTIONS.DISPLAY_HALTED          // 'display_halted'
NEXT_ACTIONS.CREATE_TASK_HANDOFF     // 'create_task_handoff'

TASK_STATUSES.COMPLETE   // 'complete'
TASK_STATUSES.FAILED     // 'failed'
TASK_STATUSES.HALTED     // 'halted'

REVIEW_VERDICTS.APPROVED            // 'approved'
REVIEW_VERDICTS.CHANGES_REQUESTED   // 'changes_requested'
REVIEW_VERDICTS.REJECTED            // 'rejected'

REVIEW_ACTIONS.ADVANCED               // 'advanced'
REVIEW_ACTIONS.CORRECTIVE_TASK_ISSUED // 'corrective_task_issued'
REVIEW_ACTIONS.HALTED                 // 'halted'

PIPELINE_TIERS.HALTED    // 'halted'
PIPELINE_TIERS.EXECUTION // 'execution'

SEVERITY_LEVELS.MINOR    // 'minor'
SEVERITY_LEVELS.CRITICAL // 'critical'
```

## Styles & Design Tokens

Not applicable — this task produces JavaScript test code with no visual output.

## Test Requirements

- [ ] Row 1 test: `task_completed` with `status=complete`, `has_deviations=false`, no `review_doc` → auto-approve → `generate_phase_report`; verify `task.review_verdict === 'approved'`
- [ ] Row 2 test: `code_review_completed` with `status=complete`, `has_deviations=false`, `verdict=approved` → advance → `generate_phase_report`; verify `task.status === 'complete'`
- [ ] Row 3 test: `code_review_completed` with `status=complete`, `has_deviations=true`, `deviation_type=minor`, `verdict=approved` → advance → `generate_phase_report`; verify `report_deviation_type` propagated
- [ ] Row 4 test: `code_review_completed` with `status=complete`, `has_deviations=true`, `deviation_type=architectural`, `verdict=approved` → advance → `generate_phase_report`
- [ ] Row 5 test: `code_review_completed` with `status=complete`, `verdict=changes_requested` → corrective → `create_corrective_handoff`; verify `task.status === 'failed'`, `task.retries === 1`
- [ ] Row 6 test: `code_review_completed` with `status=complete`, `verdict=rejected` → halt → `display_halted`; verify `pipeline.current_tier === 'halted'`
- [ ] Row 7 test: `task_completed` with `status=partial`, no `review_doc` → auto-approve → `generate_phase_report`; verify `task.review_verdict === 'approved'`
- [ ] Row 8 test: `code_review_completed` with `status=partial`, `verdict=changes_requested` → corrective → `create_corrective_handoff`
- [ ] Row 9 test: `code_review_completed` with `status=partial`, `verdict=rejected` → halt → `display_halted`
- [ ] Row 10 test: `task_completed` with `status=failed`, `severity=minor`, `retries=0` (< max 2) → corrective → `create_corrective_handoff`
- [ ] Row 11 test: `task_completed` with `status=failed`, `severity=critical` → halt → `display_halted`; verify `errors.total_halts >= 1`
- [ ] All 11 tests pass: `node --test --test-name-pattern "Task Triage" .github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- [ ] All existing tests still pass (zero regressions)

## Acceptance Criteria

- [ ] The `describe('Behavioral: Task Triage')` block contains exactly 11 `it()` tests, one per triage row
- [ ] Each test name follows the convention `"Row N: {status}, {conditions} → {expected action}"`
- [ ] All 11 tests call `executePipeline` (not `triageTask` or other internal functions directly)
- [ ] All 11 tests pass when run with `node --test`
- [ ] Row 1 and Row 7 tests verify the auto-approve path (skip triage → `applyTaskTriage` auto-approves, then internal `advance_task` → `generate_phase_report`)
- [ ] Row 3 and Row 4 tests verify `context.report_deviation_type` propagation (carry-forward from Phase 2)
- [ ] Halt rows (6, 9, 11) verify `pipeline.current_tier === 'halted'` in final state
- [ ] Corrective rows (5, 8, 10) verify `task.retries` incremented and `task.status === 'failed'`
- [ ] No other `describe` blocks or placeholder blocks are modified (T03–T05 sections remain intact)
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT modify any `describe` block other than `'Behavioral: Task Triage'` — leave all other placeholders and existing tests untouched
- Do NOT import or call `triageTask`, `applyTaskTriage`, or any internal triage/mutation function directly — all tests must go through `executePipeline`
- Do NOT import factory functions from `pipeline-engine.test.js` — use the locally-defined versions already in `pipeline-behavioral.test.js`
- Do NOT create additional files — all 11 tests go into the single existing test file
- Do NOT add external dependencies — use only `node:test` and `node:assert/strict`
- Use `withStrictDates(() => { ... })` wrapper for every test body
- For rows that require a code review document to exist, set `task.review_doc` in state AND stock the document in the mock IO `documents` map at both the direct path and the `/test/project/` prefixed path (since triage uses `createProjectAwareReader`)
- The `createDefaultConfig()` factory sets `execution_mode: 'autonomous'` — DO NOT change this, as several rows depend on autonomous mode for auto-advance after approved verdict
