---
project: "PIPELINE-HOTFIX"
phase: 1
task: 6
title: "Regression Tests — mutations.test.js (RT-1, RT-7, RT-8, RT-9)"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 1
---

# Regression Tests — mutations.test.js (RT-1, RT-7, RT-8, RT-9)

## Objective

Add four regression tests to `.github/orchestration/scripts/tests/mutations.test.js` covering phase initialization in `handlePlanApproved` (RT-1), task-level auto-approve on null/null triage with a report (RT-7), task-level skip on null/null triage without a report (RT-8), and phase-level auto-approve on null/null triage with a phase report (RT-9). Update the existing skip-case test description to clarify it covers the RT-8 scenario.

## Context

Tasks T01 and T04 have already been completed. `handlePlanApproved` now uses `context.total_phases` to initialize `execution.phases[]`. `applyTaskTriage` and `applyPhaseTriage` now auto-approve when triage returns null/null verdict/action and a report exists (proof of execution). The existing skip-case tests in `mutations.test.js` use `makeExecutionState()` which has `report_doc: null` and `phase_report: null`, so they still pass (they test the no-report skip path). New tests must cover the with-report auto-approve path.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/mutations.test.js` | Add RT-1, RT-7, RT-8, RT-9 tests; rename existing skip-case test |

## Implementation Steps

1. **Locate the `describe('plan_approved')` block** (currently around line 390). Add a new `it` block for RT-1 that calls `getMutation('plan_approved')` with `{ total_phases: 3 }`, then asserts `execution.phases.length === 3`, each entry has `status: 'not_started'`, and `execution.total_phases === 3`.

2. **Locate the `describe('applyTaskTriage')` block** (currently around line 710). Find the existing test `it('skip case: returns mutations_applied: [] and makes no state changes', ...)`. Rename it to `'RT-8: null/null without report_doc → skip (zero mutations, state unchanged)'` to clarify it covers the no-report path. The test body stays the same — the fixture uses `makeExecutionState()` which has `report_doc: null`.

3. **Add RT-7 test** immediately after the renamed RT-8 test inside the same `describe('applyTaskTriage')` block. Create a state with `task.report_doc` set to a truthy value, call `applyTaskTriage` with null/null verdict/action, and assert the auto-approve outcome.

4. **Locate the `describe('applyPhaseTriage')` block** (currently around line 790). Find the existing test `it('skip case: returns mutations_applied: [] and makes no state changes', ...)`. Rename it to `'RT-8 analog: null/null without phase_report → skip (zero mutations, state unchanged)'`. The test body stays the same.

5. **Add RT-9 test** immediately after the renamed skip test inside the same `describe('applyPhaseTriage')` block. Create a state with `phase.phase_report` set to a truthy value, call `applyPhaseTriage` with null/null verdict/action, and assert the auto-approve outcome.

6. **Run tests** with `node --test .github/orchestration/scripts/tests/mutations.test.js` to verify all existing and new tests pass.

## Contracts & Interfaces

### `handlePlanApproved(state, context)` — mutations.js

```javascript
/**
 * @param {Object} state - Deep clone of current state
 * @param {Object} context - Event context with total_phases
 * @param {number} context.total_phases - Positive integer, number of phases to initialize
 * @returns {{ state: Object, mutations_applied: string[] }}
 */
function handlePlanApproved(state, context) {
  state.planning.human_approved = true;
  state.pipeline.current_tier = PIPELINE_TIERS.EXECUTION;
  state.execution.status = 'in_progress';
  state.execution.total_phases = context.total_phases;
  state.execution.phases = [];
  for (let i = 0; i < context.total_phases; i++) {
    state.execution.phases.push({
      status: PHASE_STATUSES.NOT_STARTED,  // 'not_started'
      tasks: [],
      current_task: 0,
      phase_doc: null,
      phase_report: null,
      phase_review: null,
      phase_review_verdict: null,
      phase_review_action: null,
      triage_attempts: 0,
      human_approved: false
    });
  }
  return {
    state,
    mutations_applied: [
      'planning.human_approved → true',
      'pipeline.current_tier → execution',
      'execution.status → in_progress',
      `execution.total_phases → ${context.total_phases}`,
      `execution.phases → [${context.total_phases} phases initialized]`
    ]
  };
}
```

### `applyTaskTriage(state, triageResult)` — mutations.js

Null/null branch (the code under test for RT-7 and RT-8):

```javascript
function applyTaskTriage(state, triageResult) {
  // Null/null case: triage engine returned no verdict/action
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when task has a report (proof of execution)
    const phase = state.execution.phases[triageResult.phase_index];
    const task = phase.tasks[triageResult.task_index];
    if (task.report_doc) {
      task.status = TASK_STATUSES.COMPLETE;            // 'complete'
      task.review_verdict = REVIEW_VERDICTS.APPROVED;  // 'approved'
      task.review_action = REVIEW_ACTIONS.ADVANCED;    // 'advanced'
      task.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [
          `task[P${triageResult.phase_index}T${triageResult.task_index}].status → complete (auto-approved: clean report, no triage action)`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].review_verdict → approved`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].review_action → advanced`,
          `task[P${triageResult.phase_index}T${triageResult.task_index}].triage_attempts → 0`,
          'execution.triage_attempts → 0'
        ]
      };
    }
    // No report → original skip (nothing to auto-approve)
    return { state, mutations_applied: [] };
  }
  // ... non-null triage routing continues below (not under test for RT-7/RT-8)
}
```

### `applyPhaseTriage(state, triageResult)` — mutations.js

Null/null branch (the code under test for RT-9):

```javascript
function applyPhaseTriage(state, triageResult) {
  if (triageResult.verdict === null && triageResult.action === null) {
    // Auto-approve when phase has a report (proof of phase work)
    const phase = state.execution.phases[triageResult.phase_index];
    if (phase.phase_report) {
      phase.phase_review_verdict = REVIEW_VERDICTS.APPROVED;       // 'approved'
      phase.phase_review_action = PHASE_REVIEW_ACTIONS.ADVANCED;   // 'advanced'
      phase.triage_attempts = 0;
      state.execution.triage_attempts = 0;
      return {
        state,
        mutations_applied: [
          `phase[P${triageResult.phase_index}].phase_review_verdict → approved (auto-approved: clean report, no triage action)`,
          `phase[P${triageResult.phase_index}].phase_review_action → advanced`,
          `phase[P${triageResult.phase_index}].triage_attempts → 0`,
          'execution.triage_attempts → 0'
        ]
      };
    }
    // No report → original skip
    return { state, mutations_applied: [] };
  }
  // ... non-null triage routing continues below (not under test for RT-9)
}
```

### Constants Used by Assertions

```javascript
const {
  PIPELINE_TIERS,         // { EXECUTION: 'execution', ... }
  PLANNING_STATUSES,      // { COMPLETE: 'complete', ... }
  TASK_STATUSES,          // { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted' }
  PHASE_STATUSES,         // { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', HALTED: 'halted' }
  REVIEW_VERDICTS,        // { APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REJECTED: 'rejected' }
  REVIEW_ACTIONS,         // { ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted' }
  PHASE_REVIEW_ACTIONS    // { ADVANCED: 'advanced', CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued', HALTED: 'halted' }
} = require('../lib/constants');
```

These constants are already imported at the top of `mutations.test.js`.

## Existing Test Patterns

### Fixture Factories (already defined at top of `mutations.test.js`)

```javascript
function makeBaseState() {
  return {
    project: { name: 'TEST-PROJECT', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T12:00:00Z' },
    pipeline: { current_tier: 'planning', human_gate_mode: 'autonomous' },
    planning: {
      status: 'in_progress',
      steps: {
        research:     { status: 'not_started', output: null },
        prd:          { status: 'not_started', output: null },
        design:       { status: 'not_started', output: null },
        architecture: { status: 'not_started', output: null },
        master_plan:  { status: 'not_started', output: null }
      },
      human_approved: false
    },
    execution: {
      status: 'not_started', current_phase: 0, total_phases: 1,
      triage_attempts: 0, phases: []
    },
    final_review: { status: 'not_started', report_doc: null, human_approved: false },
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2 }
  };
}

function makeExecutionState() {
  // Returns a state in execution tier with 1 phase, 2 tasks (both not_started).
  // Key fields for this task:
  //   - tasks[0].report_doc = null (no report)
  //   - tasks[1].report_doc = null (no report)
  //   - phase.phase_report = null (no phase report)
  //   - execution.triage_attempts = 0
  // (see full definition in test file)
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
```

### Test Style

- Framework: `node:test` (`describe`/`it`) + `node:assert/strict`
- Mutation tests call the function directly, assert post-condition state fields
- Use `clone(makeBaseState())` or `clone(makeExecutionState())` as starting point
- Override specific fields before calling the function under test
- Each `it` block tests ONE behavior with descriptive name

## Test Requirements

### RT-1: `handlePlanApproved` initializes phases from `context.total_phases`

```javascript
// Inside describe('plan_approved')
it('RT-1: initializes execution.phases array with total_phases entries, each not_started', () => {
  const state = clone(makeBaseState());
  const result = getMutation('plan_approved')(state, { total_phases: 3 });

  // Phase array length matches context.total_phases
  assert.equal(result.state.execution.phases.length, 3);

  // execution.total_phases is set
  assert.equal(result.state.execution.total_phases, 3);

  // Each phase entry has correct initial state
  for (const phase of result.state.execution.phases) {
    assert.equal(phase.status, PHASE_STATUSES.NOT_STARTED);
    assert.deepEqual(phase.tasks, []);
    assert.equal(phase.current_task, 0);
    assert.equal(phase.phase_doc, null);
    assert.equal(phase.phase_report, null);
    assert.equal(phase.phase_review, null);
    assert.equal(phase.phase_review_verdict, null);
    assert.equal(phase.phase_review_action, null);
    assert.equal(phase.triage_attempts, 0);
    assert.equal(phase.human_approved, false);
  }
});
```

### RT-7: `applyTaskTriage` auto-approve with `report_doc` (null/null + report → auto-approve)

```javascript
// Inside describe('applyTaskTriage')
it('RT-7: null/null with report_doc → auto-approve (status complete, verdict approved, action advanced)', () => {
  const state = clone(makeExecutionState());
  // Set up: task has a report (proof of execution)
  state.execution.phases[0].tasks[0].status = TASK_STATUSES.IN_PROGRESS;
  state.execution.phases[0].tasks[0].report_doc = 'reports/REPORT-T01.md';
  state.execution.triage_attempts = 2; // should be reset to 0

  const result = applyTaskTriage(state, {
    verdict: null, action: null, phase_index: 0, task_index: 0, details: null
  });

  const task = result.state.execution.phases[0].tasks[0];
  assert.equal(task.status, TASK_STATUSES.COMPLETE);
  assert.equal(task.review_verdict, REVIEW_VERDICTS.APPROVED);
  assert.equal(task.review_action, REVIEW_ACTIONS.ADVANCED);
  assert.equal(task.triage_attempts, 0);
  assert.equal(result.state.execution.triage_attempts, 0);
  assert.ok(result.mutations_applied.length > 0, 'should have non-empty mutations_applied');
});
```

### RT-8: `applyTaskTriage` skip without `report_doc` (null/null + no report → zero mutations)

The existing test already covers this scenario. Rename the existing test from:
```
'skip case: returns mutations_applied: [] and makes no state changes'
```
to:
```
'RT-8: null/null without report_doc → skip (zero mutations, state unchanged)'
```
The test body remains unchanged — `makeExecutionState()` has `report_doc: null`.

### RT-9: `applyPhaseTriage` auto-approve with `phase_report` (null/null + report → auto-approve)

```javascript
// Inside describe('applyPhaseTriage')
it('RT-9: null/null with phase_report → auto-approve (verdict approved, action advanced)', () => {
  const state = clone(makeExecutionState());
  // Set up: phase has a report (proof of phase work)
  state.execution.phases[0].phase_report = 'reports/PHASE-REPORT-01.md';
  state.execution.triage_attempts = 2; // should be reset to 0

  const result = applyPhaseTriage(state, {
    verdict: null, action: null, phase_index: 0, details: null
  });

  const phase = result.state.execution.phases[0];
  assert.equal(phase.phase_review_verdict, REVIEW_VERDICTS.APPROVED);
  assert.equal(phase.phase_review_action, PHASE_REVIEW_ACTIONS.ADVANCED);
  assert.equal(phase.triage_attempts, 0);
  assert.equal(result.state.execution.triage_attempts, 0);
  assert.ok(result.mutations_applied.length > 0, 'should have non-empty mutations_applied');
});
```

### Existing `applyPhaseTriage` skip-case test rename

Rename the existing `applyPhaseTriage` skip test from:
```
'skip case: returns mutations_applied: [] and makes no state changes'
```
to:
```
'RT-8 analog: null/null without phase_report → skip (zero mutations, state unchanged)'
```
The test body remains unchanged — `makeExecutionState()` has `phase_report: null`.

## Acceptance Criteria

- [ ] RT-1 passes: `handlePlanApproved` with `total_phases: 3` produces `execution.phases.length === 3`, each entry has `status: 'not_started'` with all correct initial fields, and `execution.total_phases === 3`
- [ ] RT-7 passes: `applyTaskTriage` with null/null verdict/action + `report_doc` truthy → task `status: 'complete'`, `review_verdict: 'approved'`, `review_action: 'advanced'`, `triage_attempts: 0`, `execution.triage_attempts: 0`
- [ ] RT-8 passes: existing skip-case test (renamed) still passes — null/null + no `report_doc` → `mutations_applied: []`, state unchanged
- [ ] RT-9 passes: `applyPhaseTriage` with null/null verdict/action + `phase_report` truthy → `phase_review_verdict: 'approved'`, `phase_review_action: 'advanced'`, `triage_attempts: 0`, `execution.triage_attempts: 0`
- [ ] Existing `applyTaskTriage` skip-case test is renamed to include "RT-8" marker
- [ ] Existing `applyPhaseTriage` skip-case test is renamed to clarify it covers the no-report path
- [ ] All existing tests in `mutations.test.js` still pass (zero regressions)
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests/mutations.test.js`

## Constraints

- Do NOT modify any source files (`mutations.js`, `constants.js`, etc.) — this is a test-only task
- Do NOT create new test files — add tests to the existing `mutations.test.js`
- Do NOT modify test logic for existing tests — only rename the two skip-case test descriptions
- Do NOT add tests for `pipeline-engine.test.js` — that is T07's scope
- Use the existing `makeBaseState()`, `makeExecutionState()`, and `clone()` factories — do NOT create new factories
- Use `node:test` `describe`/`it` and `node:assert/strict` — match the existing test framework exactly
- Assert post-condition state values, not just absence of errors (NFR-5)
