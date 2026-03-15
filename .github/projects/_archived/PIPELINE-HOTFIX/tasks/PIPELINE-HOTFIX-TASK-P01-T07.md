---
project: "PIPELINE-HOTFIX"
phase: 1
task: 7
title: "Regression Tests — pipeline-engine.test.js (RT-1–RT-3, RT-5, RT-6, RT-10–RT-13)"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 1
---

# Regression Tests — pipeline-engine.test.js

## Objective

Fix all existing test failures in `pipeline-engine.test.js` caused by the T04 auto-approve and T05 unmapped-action-guard changes, then add 9 new regression tests (RT-1, RT-2, RT-3, RT-5, RT-6, RT-10, RT-11, RT-12, RT-13) covering master-plan pre-read, status normalization, resolver conditional fix, internal `advance_phase` handling, and the unmapped action guard.

## Context

Tasks T01–T05 modified `pipeline-engine.js`, `mutations.js`, and `resolver.js`. The T04 auto-approve change causes `applyTaskTriage` to set `task.status = 'complete'`, `review_verdict = 'approved'`, `review_action = 'advanced'` on null/null triage with a report present. The T05 unmapped-action-guard change rejects any resolved action not in the 18-member `EXTERNAL_ACTIONS` set. Together, these cause existing tests to fail: after auto-approve the resolver returns `advance_task` (an internal action not in `EXTERNAL_ACTIONS`), which the guard catches, producing `success: false`. The engine currently handles `advance_phase` internally but does NOT handle `advance_task`—that is deferred to a future phase. Additionally, the `advance_phase` internal handler performs a second `io.writeState` call, so tests checking `io.getWrites().length === 1` after phase-level triage paths need adjustment.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Fix failing tests + add 9 regression tests |

## Implementation Steps

### Step 1: Run the existing test suite to identify all failures

Run `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` and record every failing test name and its assertion error. Expect approximately 5–8 failures. All failures stem from one of two root causes:

- **Root Cause A — ADVANCE_TASK unmapped**: Tests that trigger `task_completed` or `code_review_completed` with a clean/approved outcome now auto-approve → resolver returns `advance_task` → unmapped action guard → `result.success === false`.
- **Root Cause B — Extra write on advance_phase path**: Tests that trigger `phase_review_completed` with an approved phase review now go through triage → `advance_phase` internal handling → **2** `io.writeState` calls instead of 1.

### Step 2: Fix each failing test

Apply the fix patterns below to each failing test. The key principle: **update assertions to match current engine behavior while preserving the test's purpose**. Each test still validates that mutations and triage ran correctly by inspecting the written state.

#### Fix Pattern A — Tests hitting ADVANCE_TASK unmapped guard

These tests used to assert `result.success === true` and `result.triage_ran === true`. After T04+T05, the pipeline proceeds through mutation → triage → auto-approve → state write → resolve → unmapped guard → error. The state IS written correctly before the guard fires.

**Changes to make:**

1. Replace `assert.equal(result.success, true)` with `assert.equal(result.success, false)`
2. Add `assert.ok(result.error.includes('advance_task'))` to verify the failure is from the unmapped action guard (not a triage or validation error)
3. Remove any `assert.equal(result.triage_ran, true)` — the error result object does not include `triage_ran`
4. Keep `assert.equal(result.validation_passed, true)` — this field IS present in the error result
5. Keep all state-inspection assertions (`io.getState()` checks) — the state was written before the guard fired
6. For tests that checked `task.review_verdict === null` / `task.review_action === null` (the old skip behavior), update to `task.review_verdict === 'approved'` / `task.review_action === 'advanced'` / `task.status === 'complete'` — reflecting the T04 auto-approve behavior

**Known affected tests (verify by running test suite):**

1. **"task_completed → sets report_doc, triggers triage, enriches from pre-read"** (Execution Events):
   - State setup: task in_progress + handoff_doc, report status 'complete', no deviations
   - Triage Row 1 → null/null → auto-approve → resolver `advance_task` → guard
   - Change: `result.success` → false, remove `result.triage_ran`, add error check, keep `report_doc` state check

2. **"code_review_completed → sets review_doc, triggers triage, sets verdict/action"** (Execution Events):
   - State setup: task in_progress + handoff + report, review verdict 'approved'
   - Triage Row 2 → approved/advanced → `applyTaskTriage` advances → resolver `advance_task` → guard
   - Change: `result.success` → false, remove `result.triage_ran`, add error check
   - Keep `review_doc`, `review_verdict`, `review_action` state checks
   - Keep `io.getWrites().length === 1` (task-level triage has only 1 write — no `advance_phase` path)

3. **"task_completed → skip triage (Row 1): complete, no deviations, no review"** (Triage Flow):
   - Triage Row 1 → null/null → auto-approve changes the behavior
   - Change: `result.success` → false, add error check
   - Update: `task.review_verdict` from `null` → `'approved'`, `task.review_action` from `null` → `'advanced'`
   - Add: `assert.equal(task.status, 'complete')` (auto-approve completes the task)

4. **"task_completed enriches context with frontmatter fields from pre-read"** (Task Report Pre-Read):
   - Report status 'partial' → Triage Row 7 (partial, no review) → null/null → auto-approve → `advance_task`
   - Change: `result.success` → false, add error check
   - Keep: `task.severity === 'minor'` state check (the pre-read enrichment still works)

#### Fix Pattern B — Phase review writes count

5. **"phase_review_completed → sets phase_review, triggers triage, sets verdict/action"** (Execution Events):
   - Phase triage → approved/advanced → write (1st) → resolve `advance_phase` → internal handler → write (2nd) → re-resolve `spawn_final_reviewer`
   - The result is `success: true` (SPAWN_FINAL_REVIEWER is external) — **do not change** `result.success`
   - Change: `io.getWrites().length` from `1` to `2` (triage write + advance_phase write)
   - Keep all other assertions

#### Additional failures

If `node --test` reveals additional failures beyond these 5, apply the same patterns. Any test where the resolver produces an action not in the 18-member `EXTERNAL_ACTIONS` set will hit the unmapped guard and return `success: false`. Inspect the error message to determine which internal action was produced, then update assertions accordingly.

### Step 3: Verify all existing tests pass

Run `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` again. All tests must pass before proceeding.

### Step 4: Add regression tests

Add a new `describe` block at the end of the file (before the closing of the file, after the "Task Report Pre-Read" section). Add 9 regression tests in two sub-`describe` blocks:

#### describe('Regression: Master Plan Pre-Read (RT-1, RT-2, RT-3)')

**RT-1: plan_approved pre-read initializes phases via engine**

```javascript
it('RT-1: plan_approved pre-read reads total_phases and initializes phases', () => {
  const state = createBaseState(s => {
    s.planning.status = 'complete';
    s.planning.steps.research = { status: 'complete', output: 'RESEARCH.md' };
    s.planning.steps.prd = { status: 'complete', output: 'PRD.md' };
    s.planning.steps.design = { status: 'complete', output: 'DESIGN.md' };
    s.planning.steps.architecture = { status: 'complete', output: 'ARCHITECTURE.md' };
    s.planning.steps.master_plan = { status: 'complete', output: 'MASTER-PLAN.md' };
  });
  const io = createMockIO({
    state,
    documents: {
      'MASTER-PLAN.md': { frontmatter: { total_phases: 3 }, body: '' }
    }
  });
  const result = executePipeline(makeRequest('plan_approved'), io);

  assert.equal(result.success, true);
  assert.equal(result.validation_passed, true);
  const written = io.getState();
  assert.equal(written.execution.phases.length, 3);
  assert.equal(written.execution.total_phases, 3);
  written.execution.phases.forEach((phase, i) => {
    assert.equal(phase.status, PHASE_STATUSES.NOT_STARTED,
      `Phase ${i} should be not_started`);
    assert.deepStrictEqual(phase.tasks, []);
    assert.equal(phase.current_task, 0);
  });
});
```

**RT-2: plan_approved with missing total_phases returns error**

```javascript
it('RT-2: plan_approved with missing total_phases returns error', () => {
  const state = createBaseState(s => {
    s.planning.status = 'complete';
    s.planning.steps.research = { status: 'complete', output: 'RESEARCH.md' };
    s.planning.steps.prd = { status: 'complete', output: 'PRD.md' };
    s.planning.steps.design = { status: 'complete', output: 'DESIGN.md' };
    s.planning.steps.architecture = { status: 'complete', output: 'ARCHITECTURE.md' };
    s.planning.steps.master_plan = { status: 'complete', output: 'MASTER-PLAN.md' };
  });
  const io = createMockIO({
    state,
    documents: {
      'MASTER-PLAN.md': { frontmatter: {}, body: '' }
    }
  });
  const result = executePipeline(makeRequest('plan_approved'), io);

  assert.equal(result.success, false);
  assert.ok(result.error.includes('total_phases'),
    `Error should mention total_phases, got: ${result.error}`);
  assert.equal(io.getWrites().length, 0);
});
```

Also add a variant for non-integer total_phases:

```javascript
it('RT-2b: plan_approved with non-integer total_phases returns error', () => {
  const state = createBaseState(s => {
    s.planning.status = 'complete';
    s.planning.steps.research = { status: 'complete', output: 'RESEARCH.md' };
    s.planning.steps.prd = { status: 'complete', output: 'PRD.md' };
    s.planning.steps.design = { status: 'complete', output: 'DESIGN.md' };
    s.planning.steps.architecture = { status: 'complete', output: 'ARCHITECTURE.md' };
    s.planning.steps.master_plan = { status: 'complete', output: 'MASTER-PLAN.md' };
  });
  const io = createMockIO({
    state,
    documents: {
      'MASTER-PLAN.md': { frontmatter: { total_phases: 'abc' }, body: '' }
    }
  });
  const result = executePipeline(makeRequest('plan_approved'), io);

  assert.equal(result.success, false);
  assert.ok(result.error.includes('total_phases'));
  assert.equal(io.getWrites().length, 0);
});
```

**RT-3: resolver returns execute_task for in_progress task with handoff but no report**

This tests the T02 resolver conditional fix through the full engine. Use `task_handoff_created` event — after the mutation, the task is `in_progress` with `handoff_doc` set and `report_doc = null`. The resolver should return `execute_task` (external), not `update_state_from_task`.

```javascript
it('RT-3: in_progress task with handoff but no report resolves to execute_task', () => {
  const state = createExecutionState();
  const io = createMockIO({ state });
  const result = executePipeline(makeRequest('task_handoff_created', {
    handoff_path: 'tasks/test-handoff.md'
  }), io);

  assert.equal(result.success, true);
  assert.equal(result.action, NEXT_ACTIONS.EXECUTE_TASK);
  const written = io.getState();
  const task = written.execution.phases[0].tasks[0];
  assert.equal(task.status, TASK_STATUSES.IN_PROGRESS);
  assert.equal(task.handoff_doc, 'tasks/test-handoff.md');
  assert.equal(task.report_doc, null);
});
```

#### describe('Regression: Status Normalization (RT-5, RT-6)')

**RT-5: status normalization pass → complete**

Use `task_completed` event with report status `'pass'`. To get a fully-successful result (avoid the ADVANCE_TASK unmapped guard), use a config with `human_gates.execution_mode = 'task'` — this causes the resolver to return `gate_task` (external) instead of `advance_task` (internal) when a task is auto-approved.

```javascript
it('RT-5: status normalization pass → complete (pipeline succeeds through gate)', () => {
  const state = createExecutionState(s => {
    s.execution.phases[0].tasks[0].status = 'in_progress';
    s.execution.phases[0].tasks[0].handoff_doc = 'tasks/test.md';
  });
  const config = createDefaultConfig();
  config.human_gates.execution_mode = 'task';
  const io = createMockIO({
    state,
    config,
    documents: {
      'reports/task-report.md': {
        frontmatter: { status: 'pass', has_deviations: false },
        body: 'Done.'
      }
    }
  });
  const result = executePipeline(makeRequest('task_completed', {
    report_path: 'reports/task-report.md'
  }), io);

  // Normalization succeeded: 'pass' → 'complete', triage ran, auto-approve, gate_task
  assert.equal(result.success, true);
  assert.equal(result.action, NEXT_ACTIONS.GATE_TASK);
  const written = io.getState();
  const task = written.execution.phases[0].tasks[0];
  // Auto-approve proves normalization worked (Row 1: complete + no deviations + no review)
  assert.equal(task.status, TASK_STATUSES.COMPLETE);
  assert.equal(task.review_verdict, REVIEW_VERDICTS.APPROVED);
});
```

**RT-6: status normalization banana → error**

```javascript
it('RT-6: status normalization banana → error', () => {
  const state = createExecutionState(s => {
    s.execution.phases[0].tasks[0].status = 'in_progress';
    s.execution.phases[0].tasks[0].handoff_doc = 'tasks/test.md';
  });
  const io = createMockIO({
    state,
    documents: {
      'reports/task-report.md': {
        frontmatter: { status: 'banana', has_deviations: false },
        body: 'Done.'
      }
    }
  });
  const result = executePipeline(makeRequest('task_completed', {
    report_path: 'reports/task-report.md'
  }), io);

  assert.equal(result.success, false);
  assert.ok(result.error.includes('banana'),
    `Error should mention 'banana', got: ${result.error}`);
  assert.ok(result.error.includes('Unrecognized task report status'));
  assert.equal(io.getWrites().length, 0);
});
```

#### describe('Regression: Internal advance_phase Handling (RT-10, RT-11, RT-12)')

These tests require a full pipeline flow: `phase_review_completed` event → phase triage → approved/advanced → resolver returns `advance_phase` → engine handles internally → re-resolves.

**Helper: create a multi-phase execution state**

Do NOT add a new helper function — inline the state construction in each test using `createExecutionState` with a mutator. Here is the pattern for a 2-phase state with phase N fully complete (all tasks done, all review fields set, phase report and review set):

```javascript
// Phase builder pattern — use inside createExecutionState mutator
function buildCompletedPhase(phaseIndex) {
  return {
    id: `P0${phaseIndex + 1}-TEST`,
    phase_number: phaseIndex + 1,
    title: `Phase ${phaseIndex + 1}`,
    status: 'in_progress',
    phase_doc: `phases/phase-${phaseIndex + 1}.md`,
    current_task: 1,
    total_tasks: 1,
    tasks: [{
      id: `T01-P0${phaseIndex + 1}`,
      task_number: 1,
      title: 'Task 1',
      status: 'complete',
      retries: 0,
      handoff_doc: 'tasks/test.md',
      report_doc: 'reports/task-report.md',
      review_doc: 'reviews/code-review.md',
      review_verdict: 'approved',
      review_action: 'advanced',
      last_error: null,
      severity: null
    }],
    phase_report: 'reports/phase-report.md',
    human_approved: false,
    phase_review: null,       // Will be set by phase_review_completed event
    phase_review_verdict: null,
    phase_review_action: null
  };
}
```

**RT-10: advance_phase non-last phase**

```javascript
it('RT-10: advance_phase non-last phase → create_phase_plan, current_phase incremented', () => {
  const state = createExecutionState(s => {
    // 2 phases: phase 0 has all tasks done, phase 1 is not_started
    s.execution.total_phases = 2;
    s.execution.current_phase = 0;

    // Phase 0: tasks complete, phase report exists, phase review will be set by event
    const p0 = s.execution.phases[0];
    p0.tasks[0].status = 'complete';
    p0.tasks[0].handoff_doc = 'tasks/test.md';
    p0.tasks[0].report_doc = 'reports/task-report.md';
    p0.tasks[0].review_doc = 'reviews/code-review.md';
    p0.tasks[0].review_verdict = 'approved';
    p0.tasks[0].review_action = 'advanced';
    p0.current_task = 1;
    p0.phase_report = 'reports/phase-report.md';

    // Phase 1: not started
    s.execution.phases.push({
      id: 'P02-TEST', phase_number: 2, title: 'Phase Two',
      status: 'not_started', phase_doc: null,
      current_task: 0, total_tasks: 0, tasks: [],
      phase_report: null, human_approved: false,
      phase_review: null, phase_review_verdict: null, phase_review_action: null
    });
  });
  const documents = {
    'reviews/phase-review.md': {
      frontmatter: { verdict: 'approved', exit_criteria_met: true },
      body: 'Phase approved.'
    }
  };
  const io = createMockIO({ state, documents });
  const result = executePipeline(makeRequest('phase_review_completed', {
    review_path: 'reviews/phase-review.md'
  }), io);

  assert.equal(result.success, true);
  assert.equal(result.action, NEXT_ACTIONS.CREATE_PHASE_PLAN);
  const written = io.getState();
  assert.equal(written.execution.current_phase, 1);
  assert.equal(written.execution.phases[0].status, PHASE_STATUSES.COMPLETE);
  assert.equal(written.execution.phases[0].phase_review_verdict, REVIEW_VERDICTS.APPROVED);
});
```

**RT-11: advance_phase last phase**

```javascript
it('RT-11: advance_phase last phase → spawn_final_reviewer, current_phase stays at last index', () => {
  const state = createExecutionState(s => {
    // 2 phases, current_phase = 1 (last). Phase 0 complete, phase 1 has tasks done.
    s.execution.total_phases = 2;
    s.execution.current_phase = 1;

    // Phase 0: fully complete
    s.execution.phases[0].status = 'complete';
    s.execution.phases[0].tasks[0].status = 'complete';
    s.execution.phases[0].tasks[0].handoff_doc = 'tasks/test.md';
    s.execution.phases[0].tasks[0].report_doc = 'reports/task-report.md';
    s.execution.phases[0].tasks[0].review_verdict = 'approved';
    s.execution.phases[0].tasks[0].review_action = 'advanced';
    s.execution.phases[0].current_task = 1;
    s.execution.phases[0].phase_report = 'reports/phase-report-p1.md';
    s.execution.phases[0].phase_review = 'reviews/phase-review-p1.md';
    s.execution.phases[0].phase_review_verdict = 'approved';
    s.execution.phases[0].phase_review_action = 'advanced';
    s.execution.phases[0].human_approved = true;

    // Phase 1: current phase — tasks done, phase report exists
    s.execution.phases.push({
      id: 'P02-TEST', phase_number: 2, title: 'Phase Two',
      status: 'in_progress', phase_doc: 'phases/phase-2.md',
      current_task: 1, total_tasks: 1,
      tasks: [{
        id: 'T01-P02', task_number: 1, title: 'Task 1',
        status: 'complete', retries: 0,
        handoff_doc: 'tasks/p2-test.md',
        report_doc: 'reports/p2-task-report.md',
        review_doc: 'reviews/p2-code-review.md',
        review_verdict: 'approved', review_action: 'advanced',
        last_error: null, severity: null
      }],
      phase_report: 'reports/phase-report-p2.md',
      human_approved: false,
      phase_review: null, phase_review_verdict: null, phase_review_action: null
    });
  });
  const documents = {
    'reviews/phase-review-p2.md': {
      frontmatter: { verdict: 'approved', exit_criteria_met: true },
      body: 'Phase 2 approved.'
    }
  };
  const io = createMockIO({ state, documents });
  const result = executePipeline(makeRequest('phase_review_completed', {
    review_path: 'reviews/phase-review-p2.md'
  }), io);

  assert.equal(result.success, true);
  assert.equal(result.action, NEXT_ACTIONS.SPAWN_FINAL_REVIEWER);
  const written = io.getState();
  // current_phase stays at last valid index (1), never exceeds phases.length - 1
  assert.equal(written.execution.current_phase, 1);
  assert.equal(written.execution.status, 'complete');
  assert.equal(written.pipeline.current_tier, PIPELINE_TIERS.REVIEW);
  assert.equal(written.execution.phases[1].status, PHASE_STATUSES.COMPLETE);
});
```

**RT-12: V1 validator passes after last-phase advancement**

Combine with RT-11 in the same test OR create as a separate test. The key assertion is that `result.success === true` AND `result.validation_passed === true` (no V1 bounds-check validation error after the last-phase advancement keeps `current_phase` within bounds).

```javascript
it('RT-12: V1 validation passes after last-phase advancement (current_phase in bounds)', () => {
  // Same state setup as RT-11
  const state = createExecutionState(s => {
    s.execution.total_phases = 2;
    s.execution.current_phase = 1;
    s.execution.phases[0].status = 'complete';
    s.execution.phases[0].tasks[0].status = 'complete';
    s.execution.phases[0].tasks[0].handoff_doc = 'tasks/test.md';
    s.execution.phases[0].tasks[0].report_doc = 'reports/task-report.md';
    s.execution.phases[0].tasks[0].review_verdict = 'approved';
    s.execution.phases[0].tasks[0].review_action = 'advanced';
    s.execution.phases[0].current_task = 1;
    s.execution.phases[0].phase_report = 'reports/phase-report-p1.md';
    s.execution.phases[0].phase_review = 'reviews/phase-review-p1.md';
    s.execution.phases[0].phase_review_verdict = 'approved';
    s.execution.phases[0].phase_review_action = 'advanced';
    s.execution.phases[0].human_approved = true;
    s.execution.phases.push({
      id: 'P02-TEST', phase_number: 2, title: 'Phase Two',
      status: 'in_progress', phase_doc: 'phases/phase-2.md',
      current_task: 1, total_tasks: 1,
      tasks: [{
        id: 'T01-P02', task_number: 1, title: 'Task 1',
        status: 'complete', retries: 0,
        handoff_doc: 'tasks/p2-test.md',
        report_doc: 'reports/p2-task-report.md',
        review_doc: 'reviews/p2-code-review.md',
        review_verdict: 'approved', review_action: 'advanced',
        last_error: null, severity: null
      }],
      phase_report: 'reports/phase-report-p2.md',
      human_approved: false,
      phase_review: null, phase_review_verdict: null, phase_review_action: null
    });
  });
  const documents = {
    'reviews/phase-review-p2.md': {
      frontmatter: { verdict: 'approved', exit_criteria_met: true },
      body: 'All good.'
    }
  };
  const io = createMockIO({ state, documents });
  const result = executePipeline(makeRequest('phase_review_completed', {
    review_path: 'reviews/phase-review-p2.md'
  }), io);

  // The critical assertion: validation passed despite advance_phase
  // setting current_phase to stay at last index (not exceeding phases.length - 1)
  assert.equal(result.success, true);
  assert.equal(result.validation_passed, true);
  const written = io.getState();
  assert.ok(
    written.execution.current_phase < written.execution.phases.length,
    `current_phase (${written.execution.current_phase}) must be < phases.length (${written.execution.phases.length})`
  );
});
```

#### describe('Regression: Unmapped Action Guard (RT-13)')

**RT-13: unmapped action guard catches non-external action**

Construct a state where the resolver returns an internal action not handled by the engine. The simplest trigger: `task_completed` with a clean report → auto-approve → resolver returns `advance_task` → unmapped guard catches it.

```javascript
it('RT-13: unmapped action guard returns error for non-external action', () => {
  const state = createExecutionState(s => {
    s.execution.phases[0].tasks[0].status = 'in_progress';
    s.execution.phases[0].tasks[0].handoff_doc = 'tasks/test.md';
  });
  const io = createMockIO({
    state,
    documents: {
      'reports/task-report.md': {
        frontmatter: { status: 'complete', has_deviations: false },
        body: 'Done.'
      }
    }
  });
  const result = executePipeline(makeRequest('task_completed', {
    report_path: 'reports/task-report.md'
  }), io);

  assert.equal(result.success, false);
  assert.ok(result.error.includes('advance_task'),
    `Error should name the unmapped action, got: ${result.error}`);
  assert.ok(result.error.includes('unmapped') || result.error.includes('Pipeline resolved'),
    `Error should indicate an unmapped/unexpected action`);
  // State was written before the guard fired (mutation + triage completed)
  assert.ok(io.getWrites().length > 0);
});
```

### Step 5: Verify all tests pass

Run `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` and confirm zero failures.

### Step 6: Verify other test suites are not broken

Run each of these and confirm zero failures:

```
node --test .github/orchestration/scripts/tests/constants.test.js
node --test .github/orchestration/scripts/tests/resolver.test.js
node --test .github/orchestration/scripts/tests/state-validator.test.js
node --test .github/orchestration/scripts/tests/triage-engine.test.js
node --test .github/orchestration/scripts/tests/mutations.test.js
```

## Contracts & Interfaces

### executePipeline function signature

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js
/**
 * @param {PipelineRequest} request - { event, projectDir, configPath?, context? }
 * @param {PipelineIO} io - { readState, writeState, readConfig, readDocument, ensureDirectories }
 * @returns {PipelineResultSuccess|PipelineResultError}
 */
function executePipeline(request, io) { ... }
```

### PipelineResultSuccess shape

```javascript
{
  success: true,
  action: string,        // One of NEXT_ACTIONS enum values
  context: object,       // { tier, phase_index, task_index, phase_id, task_id, details }
  mutations_applied: string[],
  triage_ran: boolean,
  validation_passed: true
}
```

### PipelineResultError shape

```javascript
{
  success: false,
  error: string,
  event: string|null,
  state_snapshot: object|null,
  mutations_applied: string[],
  validation_passed: boolean|null
  // NOTE: triage_ran is NOT present in error results
}
```

### EXTERNAL_ACTIONS set (18 members)

These are the only actions that `executePipeline` can return on success. Any other resolved action triggers the unmapped guard (`success: false`):

```javascript
const EXTERNAL_ACTIONS = new Set([
  'spawn_research', 'spawn_prd', 'spawn_design', 'spawn_architecture',
  'spawn_master_plan', 'request_plan_approval', 'create_phase_plan',
  'create_task_handoff', 'execute_task', 'spawn_code_reviewer',
  'generate_phase_report', 'spawn_phase_reviewer', 'spawn_final_reviewer',
  'request_final_approval', 'gate_task', 'gate_phase',
  'display_halted', 'display_complete'
]);
```

**NOT in EXTERNAL_ACTIONS** (internal actions the engine may or may not handle):

```
advance_task, advance_phase, transition_to_execution, transition_to_review,
transition_to_complete, update_state_from_task, update_state_from_review,
create_corrective_handoff, halt_task_failed, halt_from_review,
retry_from_review, triage_task, triage_phase, halt_triage_invariant,
halt_phase_triage_invariant, update_state_from_phase_review, init_project
```

Currently only `advance_phase` has an internal handler. `advance_task` does NOT — it triggers the unmapped guard.

### Key constants (import from `../lib/constants`)

```javascript
const {
  PIPELINE_TIERS,        // { PLANNING, EXECUTION, REVIEW, COMPLETE, HALTED }
  TASK_STATUSES,         // { NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED, HALTED }
  PHASE_STATUSES,        // { NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED, HALTED }
  REVIEW_VERDICTS,       // { APPROVED, CHANGES_REQUESTED, REJECTED }
  REVIEW_ACTIONS,        // { ADVANCED, CORRECTIVE_TASK_ISSUED, HALTED }
  PHASE_REVIEW_ACTIONS,  // { ADVANCED, CORRECTIVE_TASKS_ISSUED, HALTED }
  NEXT_ACTIONS           // 35 values — see full enum in constants.js
} = require('../lib/constants');
```

### Triage behavior (auto-approve paths from T04)

**Task-level triage null/null with report_doc**: `applyTaskTriage` sets:
- `task.status = 'complete'`
- `task.review_verdict = 'approved'`
- `task.review_action = 'advanced'`
- `task.triage_attempts = 0`
- `execution.triage_attempts = 0`

**Task-level triage null/null WITHOUT report_doc**: Original skip — `{ mutations_applied: [] }`

**Phase-level triage null/null with phase_report**: `applyPhaseTriage` sets:
- `phase.phase_review_verdict = 'approved'`
- `phase.phase_review_action = 'advanced'`
- `phase.triage_attempts = 0`
- `execution.triage_attempts = 0`

### Pre-read normalization (from T03)

```javascript
const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
const VALID_STATUSES = ['complete', 'partial', 'failed'];
// Unknown value after normalization → hard error:
// "Unrecognized task report status: '{raw}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)"
```

### advance_phase internal handler behavior

- Non-last phase: `phase.status → complete`, `current_phase += 1`, re-resolve → typically `create_phase_plan`
- Last phase: `phase.status → complete`, `pipeline.current_tier → review`, `execution.status → complete`, `current_phase` stays at last index, re-resolve → `spawn_final_reviewer`
- Re-resolve guard: if re-resolved action is still not in `EXTERNAL_ACTIONS` → hard error

## Styles & Design Tokens

Not applicable — this is a test-only task.

## Test Requirements

- [ ] All existing tests in pipeline-engine.test.js pass (0 failures)
- [ ] RT-1 passes: `plan_approved` pre-read creates 3 phases with correct structure
- [ ] RT-2 passes: `plan_approved` with missing/invalid `total_phases` returns `success: false`
- [ ] RT-3 passes: in_progress task with handoff + no report resolves to `execute_task`
- [ ] RT-5 passes: status `'pass'` normalized to `'complete'`, pipeline succeeds through `gate_task`
- [ ] RT-6 passes: status `'banana'` returns `success: false` with error naming `'banana'`
- [ ] RT-10 passes: non-last phase advance → `create_phase_plan`, `current_phase` incremented
- [ ] RT-11 passes: last phase advance → `spawn_final_reviewer`, `current_phase` at last index
- [ ] RT-12 passes: V1 validation succeeds after last-phase advancement
- [ ] RT-13 passes: unmapped action → `success: false`, error names the action
- [ ] Preserved test suites pass unmodified: `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`, `mutations.test.js`

## Acceptance Criteria

- [ ] `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js` — all tests pass, 0 failures
- [ ] The 9 new regression tests (RT-1, RT-2, RT-2b, RT-3, RT-5, RT-6, RT-10, RT-11, RT-12, RT-13) are present and passing
- [ ] All previously-failing tests are updated with correct assertions matching current engine behavior
- [ ] `node --test .github/orchestration/scripts/tests/constants.test.js` — passes unmodified
- [ ] `node --test .github/orchestration/scripts/tests/resolver.test.js` — passes unmodified
- [ ] `node --test .github/orchestration/scripts/tests/state-validator.test.js` — passes unmodified
- [ ] `node --test .github/orchestration/scripts/tests/triage-engine.test.js` — passes unmodified
- [ ] `node --test .github/orchestration/scripts/tests/mutations.test.js` — passes unmodified
- [ ] No lint errors
- [ ] Build succeeds

## Constraints

- Do NOT modify any source files (`pipeline-engine.js`, `mutations.js`, `resolver.js`, `constants.js`, `triage-engine.js`, `state-validator.js`)
- Do NOT modify any other test files (`mutations.test.js`, `resolver.test.js`, etc.)
- Do NOT add an `advance_task` internal handler — that is deferred to a future phase
- Do NOT delete or rename any existing test — fix assertions in place
- Use the existing `createMockIO`, `createBaseState`, `createExecutionState`, `createDefaultConfig`, and `makeRequest` helpers — do NOT create new factory functions (inline construction is fine)
- Use `node:test` (`describe`/`it`) and `node:assert/strict` — these are already imported
- Test names for new regression tests must include the RT identifier (e.g., `'RT-1: ...'`)
