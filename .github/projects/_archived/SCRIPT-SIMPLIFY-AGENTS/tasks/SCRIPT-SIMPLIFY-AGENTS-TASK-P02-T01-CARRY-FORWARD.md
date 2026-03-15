---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 1
title: "Pipeline Engine Carry-Forward Fixes"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 3
---

# Pipeline Engine Carry-Forward Fixes

## Objective

Fix all carry-forward issues from Phase 1 in the pipeline engine: resolve the critical V8/V9 pre-triage validation timing that blocks 2 of 19 event paths, fix the V1 out-of-bounds sentinel on last-phase gate approval, fix V13 timestamp ordering, replace the hardcoded `'display_halted'` string with the constant, add error handling for the task report pre-read, and remove unused imports from `mutations.js`. Update `pipeline-engine.test.js` to cover all fixed paths.

## Context

The pipeline engine (`pipeline-engine.js`) executes a linear recipe: load state → apply mutation → validate → write → triage → resolve. For three events that trigger triage (`task_completed`, `code_review_completed`, `phase_review_completed`), validation runs BEFORE triage, but the mutation only sets the doc field while triage sets the verdict. This causes V8 (task review consistency) and V9 (phase review consistency) to reject the intermediate state, making `code_review_completed` and `phase_review_completed` unreachable through the engine. Additionally, `handleGateApproved` increments `current_phase` past the phases array on the last phase (V1 failure), and the engine never sets `project.updated` before validation (V13 failure; currently masked by a test workaround).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | V8/V9 flow restructure, V13 timestamp, hardcoded string, pre-read error handling |
| MODIFY | `.github/orchestration/scripts/lib/mutations.js` | V1 last-phase sentinel fix, unused import cleanup |
| MODIFY | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Update tests for all fixed paths, remove V13 workaround |

## Implementation Steps

### Step 1: Fix V1 sentinel in `mutations.js` — `handleGateApproved`

**Current code** (`.github/orchestration/scripts/lib/mutations.js`, `handleGateApproved` function):

```javascript
} else if (context.gate_type === 'phase') {
    const phase = currentPhase(state);
    phase.status = PHASE_STATUSES.COMPLETE;
    phase.human_approved = true;
    mutations.push('phase.status → complete', 'phase.human_approved → true');

    state.execution.current_phase += 1;
    mutations.push(`execution.current_phase → ${state.execution.current_phase}`);

    if (state.execution.current_phase >= state.execution.phases.length) {
      state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      state.execution.status = 'complete';
      mutations.push('pipeline.current_tier → review', 'execution.status → complete');
    }
  }
```

**Problem**: When on the last phase (e.g., `current_phase = 0`, `phases.length = 1`), the increment sets `current_phase = 1`, which is out of bounds. V1 in `state-validator.js` requires `current_phase < phases.length`.

**Fix**: Check if the current phase is the last one BEFORE incrementing. If it is the last phase, transition to the review tier without incrementing past bounds:

```javascript
} else if (context.gate_type === 'phase') {
    const phase = currentPhase(state);
    phase.status = PHASE_STATUSES.COMPLETE;
    phase.human_approved = true;
    mutations.push('phase.status → complete', 'phase.human_approved → true');

    const isLastPhase = (state.execution.current_phase >= state.execution.phases.length - 1);
    if (isLastPhase) {
      state.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
      state.execution.status = 'complete';
      mutations.push('pipeline.current_tier → review', 'execution.status → complete');
    } else {
      state.execution.current_phase += 1;
      mutations.push(`execution.current_phase → ${state.execution.current_phase}`);
    }
  }
```

This keeps `current_phase` at the last valid index when transitioning to the review tier, satisfying V1.

### Step 2: Remove unused imports in `mutations.js`

**Current import** (line 1-13):

```javascript
const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_VERDICTS,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS,
  SEVERITY_LEVELS
} = require('./constants');
```

**Fix**: Remove `REVIEW_VERDICTS` and `SEVERITY_LEVELS` — they are never referenced in this file:

```javascript
const {
  PIPELINE_TIERS,
  PLANNING_STATUSES,
  PLANNING_STEP_STATUSES,
  TASK_STATUSES,
  PHASE_STATUSES,
  REVIEW_ACTIONS,
  PHASE_REVIEW_ACTIONS
} = require('./constants');
```

### Step 3: Add `NEXT_ACTIONS` to imports in `pipeline-engine.js`

**Current import** (line 8):

```javascript
const { PIPELINE_TIERS } = require('./constants');
```

**Fix**:

```javascript
const { PIPELINE_TIERS, NEXT_ACTIONS } = require('./constants');
```

### Step 4: Restructure the Standard Mutation Path in `pipeline-engine.js`

This is the critical V8/V9 fix. The current flow is:

```
mutate → validate → write → triage? → validate triage → write triage
```

The new flow splits into two branches based on whether triage is needed:

**Non-triage branch** (same as before, but with timestamp fix):

```
mutate → set timestamp → validate(currentState, proposedState) → write
```

**Triage branch** (defers validation to after triage):

```
mutate → save postMutationState → run triage → apply triage mutation → set timestamp → validate(postMutationState, proposedState) → write once
```

By validating the triage transition against `postMutationState` (not `currentState`):
- **V8 passes**: `review_doc` was already set in `postMutationState`; triage added `review_verdict` → both non-null ✓
- **V9 passes**: `phase_review` was already set in `postMutationState`; triage added `phase_review_verdict` → both non-null ✓
- **V14 passes**: `review_doc` didn't change between `postMutationState` and `proposedState` → `docChanged = false` → V14 doesn't fire ✓
- **V13 passes**: Timestamp is set after `postMutationState` snapshot and before validation → strictly newer ✓

**Replace the entire Standard Mutation Path** (from `// ── STANDARD MUTATION PATH ──` through the final `return` before `module.exports`). The new implementation:

```javascript
  // ── STANDARD MUTATION PATH ──
  const mutation = getMutation(event);
  if (!mutation) {
    return makeErrorResult(`Unknown event: ${event}`, event, [], null, null);
  }

  const currentState = deepClone(state);

  // Task report pre-read: enrich context before passing to mutation
  if (event === 'task_completed' && context.report_path) {
    try {
      const reportDoc = io.readDocument(context.report_path);
      if (!reportDoc) {
        return makeErrorResult(
          `Task report not found: ${context.report_path}`,
          event, [], null, null
        );
      }
      const fm = reportDoc.frontmatter || {};
      context.report_status = fm.status || null;
      context.report_severity = fm.severity || null;
      context.report_deviations = Boolean(fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations);
    } catch (err) {
      return makeErrorResult(
        `Failed to pre-read task report: ${err.message}`,
        event, [], null, null
      );
    }
  }

  // Apply mutation
  const mutationResult = mutation(state, context);
  const proposedState = mutationResult.state;
  let allMutationsApplied = [...mutationResult.mutations_applied];

  // Check if triage is needed BEFORE validation
  let triageRan = false;
  const { shouldTriage, level } = needsTriage(event, proposedState);

  if (shouldTriage) {
    // ── TRIAGE PATH ──
    // For triage-triggering events (task_completed, code_review_completed,
    // phase_review_completed), defer validation until after triage completes.
    // This avoids V8/V9 false positives where mutation sets the doc field
    // but triage hasn't set the verdict yet.

    // Guard: triage_attempts exceeded
    if (proposedState.execution.triage_attempts > 1) {
      // Validate mutation with V8/V9 filtered (triage won't run to set verdicts)
      proposedState.project.updated = new Date().toISOString();
      const guardValidation = validateTransition(currentState, proposedState);
      if (!guardValidation.valid) {
        const nonTriageErrors = guardValidation.errors.filter(
          e => e.invariant !== 'V8' && e.invariant !== 'V9'
        );
        if (nonTriageErrors.length > 0) {
          const firstError = nonTriageErrors[0];
          return makeErrorResult(
            `Validation failed: [${firstError.invariant}] ${firstError.message}`,
            event, allMutationsApplied,
            { current_phase: proposedState.execution.current_phase },
            false
          );
        }
      }
      io.writeState(projectDir, proposedState);
      return {
        success: true,
        action: NEXT_ACTIONS.DISPLAY_HALTED,
        context: { message: 'Triage invariant: triage_attempts exceeded' },
        mutations_applied: allMutationsApplied,
        triage_ran: false,
        validation_passed: true
      };
    }

    // Snapshot post-mutation state as triage validation baseline
    const postMutationState = deepClone(proposedState);

    // Run triage engine
    const triageResult = executeTriage(proposedState, level, io.readDocument);
    if (!triageResult.success) {
      return makeErrorResult(
        `Triage failed: ${triageResult.error}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        true
      );
    }

    // Apply triage mutation
    const triageMutation = level === 'task'
      ? applyTaskTriage(proposedState, triageResult)
      : applyPhaseTriage(proposedState, triageResult);
    allMutationsApplied = allMutationsApplied.concat(triageMutation.mutations_applied);

    // Set timestamp and validate triage transition against post-mutation baseline.
    // Using postMutationState as "current" avoids V14 false positives
    // (review_doc was already set in postMutationState, so V14 sees no doc change).
    proposedState.project.updated = new Date().toISOString();
    const triageValidation = validateTransition(postMutationState, proposedState);
    if (!triageValidation.valid) {
      const firstError = triageValidation.errors[0];
      return makeErrorResult(
        `Triage validation failed: [${firstError.invariant}] ${firstError.message}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        false
      );
    }

    // Write state once (combined mutation + triage)
    io.writeState(projectDir, proposedState);
    triageRan = true;
  } else {
    // ── NON-TRIAGE PATH ──
    // Set timestamp before validation (V13 fix)
    proposedState.project.updated = new Date().toISOString();

    const validation = validateTransition(currentState, proposedState);
    if (!validation.valid) {
      const firstError = validation.errors[0];
      return makeErrorResult(
        `Validation failed: [${firstError.invariant}] ${firstError.message}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        false
      );
    }

    // Write state
    io.writeState(projectDir, proposedState);
  }

  // ── RESOLVE ──
  const config = io.readConfig(configPath);
  const resolved = resolveNextAction(proposedState, config);

  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: allMutationsApplied,
    triage_ran: triageRan,
    validation_passed: true
  };
```

**Key behavioral changes**:
1. Triage-triggering events write state ONCE instead of twice
2. Validation for triage events uses `postMutationState` as baseline (not `currentState`)
3. Timestamp is set explicitly before every validation call
4. `triage_attempts > 1` guard validates with V8/V9 filtering and still writes state before returning halt
5. `display_halted` uses `NEXT_ACTIONS.DISPLAY_HALTED` constant
6. Pre-read is wrapped in try-catch with null check

### Step 5: Update `pipeline-engine.test.js`

#### 5a: Remove V13 auto-incrementing getter workaround from `createMockIO`

**Current `readState`** in `createMockIO`:

```javascript
readState(projectDir) {
  if (currentState === null) return null;
  // Deep-clone the stored state for isolation
  const clone = JSON.parse(JSON.stringify(currentState));
  // WORKAROUND for V13 (timestamp monotonicity):
  // ... (15 lines of workaround code) ...
  let counter = 0;
  const base = Date.now();
  Object.defineProperty(clone.project, 'updated', {
    get() { return new Date(base + (++counter)).toISOString(); },
    set() { /* allow writeState to set without error */ },
    enumerable: true,
    configurable: true
  });
  return clone;
},
```

**Replace with**:

```javascript
readState(projectDir) {
  if (currentState === null) return null;
  return JSON.parse(JSON.stringify(currentState));
},
```

The V13 workaround is no longer needed because the engine now sets `proposedState.project.updated = new Date().toISOString()` explicitly before every validation call.

#### 5b: Update `code_review_completed` test — now succeeds with triage

**Current test** asserts V8 failure. **Replace** with a test that asserts success:

```javascript
it('code_review_completed → sets review_doc, triggers triage, sets verdict/action', () => {
    const state = createExecutionState(s => {
      const task = s.execution.phases[0].tasks[0];
      task.status = 'in_progress';
      task.handoff_doc = 'tasks/test.md';
      task.report_doc = 'reports/task-report.md';
      // review_doc is null, review_verdict is null — code_review_completed will set review_doc
    });
    const documents = {
      'reviews/code-review.md': {
        frontmatter: { verdict: 'approved' },
        body: 'Looks good.'
      }
    };
    const io = createMockIO({ state, documents });
    const result = executePipeline(makeRequest('code_review_completed', {
      review_path: 'reviews/code-review.md'
    }), io);

    assert.equal(result.success, true);
    assert.equal(result.triage_ran, true);
    assert.equal(result.validation_passed, true);
    const written = io.getState();
    const task = written.execution.phases[0].tasks[0];
    assert.equal(task.review_doc, 'reviews/code-review.md');
    assert.notEqual(task.review_verdict, null, 'Triage should have set review_verdict');
    assert.notEqual(task.review_action, null, 'Triage should have set review_action');
    // State should be written exactly once (combined mutation + triage)
    assert.equal(io.getWrites().length, 1, 'Should write state once (combined mutation + triage)');
  });
```

Remove the `/* V8/V14 TENSION ... */` comment block above the old test.

#### 5c: Update `phase_review_completed` test in Execution Events — now succeeds with triage

**Current test** asserts V9 failure. **Replace** with:

```javascript
it('phase_review_completed → sets phase_review, triggers triage, sets verdict/action', () => {
    const state = createExecutionState(s => {
      const phase = s.execution.phases[0];
      const task = phase.tasks[0];
      task.status = 'complete';
      task.handoff_doc = 'tasks/test.md';
      task.report_doc = 'reports/task-report.md';
      task.review_verdict = 'approved';
      task.review_action = 'advanced';
      phase.current_task = 1;
      phase.phase_report = 'reports/phase-report.md';
    });
    const documents = {
      'reviews/phase-review.md': {
        frontmatter: { verdict: 'approved', exit_criteria_met: true },
        body: 'Phase looks good.'
      }
    };
    const io = createMockIO({ state, documents });
    const result = executePipeline(makeRequest('phase_review_completed', {
      review_path: 'reviews/phase-review.md'
    }), io);

    assert.equal(result.success, true);
    assert.equal(result.triage_ran, true);
    assert.equal(result.validation_passed, true);
    const written = io.getState();
    assert.equal(written.execution.phases[0].phase_review, 'reviews/phase-review.md');
    assert.notEqual(written.execution.phases[0].phase_review_verdict, null, 'Triage should have set phase_review_verdict');
    assert.notEqual(written.execution.phases[0].phase_review_action, null, 'Triage should have set phase_review_action');
    assert.equal(io.getWrites().length, 1, 'Should write state once');
  });
```

Remove the `/* V9 TENSION ... */` comment block above the old test.

#### 5d: Update `phase_review_completed` test in Triage Flow — now succeeds

The Triage Flow section has a duplicate V9 assertion test. **Replace** it with:

```javascript
it('phase_review_completed → phase-level triage advance', () => {
    const state = createExecutionState(s => {
      const phase = s.execution.phases[0];
      const task = phase.tasks[0];
      task.status = 'complete';
      task.handoff_doc = 'tasks/test.md';
      task.report_doc = 'reports/task-report.md';
      task.review_verdict = 'approved';
      task.review_action = 'advanced';
      phase.current_task = 1;
      phase.phase_report = 'reports/phase-report.md';
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
    assert.equal(result.triage_ran, true);
    const written = io.getState();
    assert.notEqual(written.execution.phases[0].phase_review_verdict, null);
    assert.notEqual(written.execution.phases[0].phase_review_action, null);
  });
```

Remove the `/* V9 TENSION ... */` comment block above the old test.

#### 5e: Add `gate_approved(phase)` last-phase test in Gate Events

Add this test to the Gate Events `describe` block:

```javascript
  it('gate_approved (phase) on last phase → transitions to review, current_phase stays in bounds', () => {
    const state = createExecutionState(s => {
      // Single phase, fully done
      const phase = s.execution.phases[0];
      const task = phase.tasks[0];
      task.status = 'complete';
      task.handoff_doc = 'tasks/test.md';
      task.report_doc = 'reports/task-report.md';
      task.review_verdict = 'approved';
      task.review_action = 'advanced';
      phase.current_task = 1;
      phase.phase_report = 'reports/phase-report.md';
      phase.phase_review = 'reviews/phase-review.md';
      phase.phase_review_verdict = 'approved';
      phase.phase_review_action = 'advanced';
      s.execution.triage_attempts = 1;
    });
    const io = createMockIO({ state });
    const result = executePipeline(makeRequest('gate_approved', { gate_type: 'phase' }), io);

    assert.equal(result.success, true);
    assert.equal(result.validation_passed, true);
    const written = io.getState();
    assert.equal(written.execution.phases[0].status, PHASE_STATUSES.COMPLETE);
    assert.equal(written.pipeline.current_tier, PIPELINE_TIERS.REVIEW);
    assert.equal(written.execution.status, 'complete');
    // current_phase stays within bounds (not incremented past phases.length)
    assert.ok(
      written.execution.current_phase < written.execution.phases.length,
      `current_phase (${written.execution.current_phase}) should be < phases.length (${written.execution.phases.length})`
    );
    assert.equal(written.execution.triage_attempts, 0);
  });
```

#### 5f: Update `createReviewTierState` helper

Remove the `/* V1 WORKAROUND ... */` comment block. The function itself can stay as-is since it already sets `current_phase = 0` (which is correct after the V1 fix — last-phase gate no longer pushes out of bounds).

Update the inline comment from:

```javascript
// Keep current_phase = 0 (within bounds) to avoid V1 violation.
// In real pipeline, gate_approved sets current_phase = phases.length which V1 rejects.
s.execution.current_phase = 0;
```

to:

```javascript
// current_phase = 0 (stays within bounds — V1 fix keeps last-phase index)
s.execution.current_phase = 0;
```

#### 5g: Add pre-read error handling test in Task Report Pre-Read section

Add this test to the `describe('Task Report Pre-Read', ...)` block:

```javascript
  it('task_completed with missing report document → returns error result', () => {
    const state = createExecutionState(s => {
      const task = s.execution.phases[0].tasks[0];
      task.status = 'in_progress';
      task.handoff_doc = 'tasks/test.md';
    });
    // No documents provided — readDocument returns null, causing pre-read to fail
    const io = createMockIO({ state });
    const result = executePipeline(makeRequest('task_completed', {
      report_path: 'reports/missing.md'
    }), io);

    assert.equal(result.success, false);
    assert.ok(result.error.includes('Task report not found'), `Expected 'Task report not found', got: ${result.error}`);
    assert.deepStrictEqual(result.mutations_applied, []);
    // No state should have been written
    assert.equal(io.getWrites().length, 0);
  });
```

#### 5h: Update triage_attempts Lifecycle comments

Remove the comments referencing V8/V9 tension being unreachable. For example, in the `'resets to 0 on gate_approved'` test, remove:

```javascript
// Triage-based "advance" resets are unreachable via the pipeline due to V8/V9
// tension (see Triage Flow tests). Instead, gate_approved always resets
// triage_attempts to 0, which provides the same lifecycle reset.
```

Replace with:

```javascript
// gate_approved always resets triage_attempts to 0
```

#### 5i: Update `V8 TENSION` comment in Triage Flow — Row 5

The Row 5 comment references V8 making it unreachable. Update this comment above the `'task_completed → corrective (Row 10)'` test. The V8 fix means `code_review_completed` now works through the pipeline, but Row 5 still requires `review_doc` to be set AND `review_verdict` to be null simultaneously, which conflicts with V8. Since the pipeline triage path validates (postMutationState → finalState), and postMutationState after a `code_review_completed` mutation has review_doc set and review_verdict null, this is now a valid baseline. BUT: for `task_completed`, the task's review_doc is null (cleared by `task_handoff_created`), so Row 5 (which requires prior review_doc) would need to be triggered via `code_review_completed` event, not `task_completed`. Update the comment to note this:

```javascript
  /*
   * Row 5 (code_review_completed → approved/changes_requested) is now
   * reachable through the pipeline engine after the V8/V9 fix. The corrective
   * path is also testable via Row 10 (failed report, minor severity) which
   * does not require a prior review_doc.
   */
```

## Contracts & Interfaces

### `PipelineResult` (returned by `executePipeline`)

```javascript
// Success variant
{
  success: true,
  action: string,        // from NEXT_ACTIONS constant or resolveNextAction
  context: Object,       // action-specific context
  mutations_applied: string[],  // human-readable mutation descriptions
  triage_ran: boolean,   // whether triage engine executed
  validation_passed: true
}

// Error variant (from makeErrorResult)
{
  success: false,
  error: string,         // descriptive error message
  event: string|null,    // the event that caused the failure
  state_snapshot: Object|null,  // partial state for debugging
  mutations_applied: string[],  // mutations applied before error
  validation_passed: boolean|null  // null if validation not reached
}
```

### `MutationResult` (from mutation handlers and triage helpers)

```javascript
{
  state: Object,              // the mutated state object (same reference)
  mutations_applied: string[] // human-readable mutation descriptions
}
```

### Constants used

```javascript
// From .github/orchestration/scripts/lib/constants.js
const NEXT_ACTIONS = {
  DISPLAY_HALTED: 'display_halted',
  // ... (other actions)
};

const PIPELINE_TIERS = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted'
};

const PHASE_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  HALTED: 'halted'
};
```

### Validator invariants (from `state-validator.js` — read-only reference, do NOT modify)

| Invariant | Rule | Relevance |
|-----------|------|-----------|
| V1 | `current_phase` must be `< phases.length` (when phases exist) | Fixed by mutations.js V1 fix |
| V8 | If `review_doc` is non-null, `review_verdict` must be non-null | Resolved by deferred triage validation |
| V9 | If `phase_review` is non-null, `phase_review_verdict` must be non-null | Resolved by deferred triage validation |
| V13 | `proposed.project.updated` must be strictly newer than `current.project.updated` | Fixed by explicit timestamp before validation |
| V14 | `review_doc` and `review_verdict/action` must not change in same write | Resolved by using `postMutationState` as baseline (doc already set) |

## Test Requirements

- [ ] `code_review_completed` → success, `triage_ran = true`, task has `review_doc`, `review_verdict`, `review_action` all set, exactly 1 state write
- [ ] `phase_review_completed` → success, `triage_ran = true`, phase has `phase_review`, `phase_review_verdict`, `phase_review_action` all set, exactly 1 state write
- [ ] `gate_approved(phase)` on single-phase state → success, `current_phase < phases.length`, `current_tier = 'review'`, `execution.status = 'complete'`
- [ ] `task_completed` with missing report → `success = false`, error contains `'Task report not found'`, 0 state writes
- [ ] All existing passing tests continue to pass (planning events, gate events, triage flow, error paths, etc.)
- [ ] No V13 auto-incrementing getter workaround in mock — engine handles timestamps natively
- [ ] `triage_attempts > 1` → action is `NEXT_ACTIONS.DISPLAY_HALTED` (constant, not string literal)
- [ ] All 4 preserved lib test suites pass unmodified: `constants.test.js` (29), `resolver.test.js` (48), `state-validator.test.js` (48), `triage-engine.test.js` (44)

## Acceptance Criteria

- [ ] All 19 events produce correct deterministic output through `pipeline-engine.js` (including `code_review_completed` and `phase_review_completed` which were previously blocked by V8/V9)
- [ ] `gate_approved(phase)` on the last phase transitions to review tier with `current_phase` within bounds
- [ ] Pipeline engine sets `proposedState.project.updated` before every `validateTransition` call
- [ ] No hardcoded `'display_halted'` string in `pipeline-engine.js` — uses `NEXT_ACTIONS.DISPLAY_HALTED`
- [ ] `io.readDocument()` failure in task report pre-read returns structured error result (not an unhandled throw)
- [ ] No unused imports (`REVIEW_VERDICTS`, `SEVERITY_LEVELS`) in `mutations.js`
- [ ] All pipeline-engine tests pass (should be 33+ after updates/additions)
- [ ] All 4 preserved lib test suites pass unmodified (141 tests total)
- [ ] Build succeeds: `node -e "require('./.github/orchestration/scripts/lib/pipeline-engine.js')"` exits 0
- [ ] Build succeeds: `node -e "require('./.github/orchestration/scripts/lib/mutations.js')"` exits 0

## Constraints

- Do NOT modify `.github/orchestration/scripts/lib/state-validator.js` — it is a preserved lib module
- Do NOT modify `.github/orchestration/scripts/lib/constants.js` — it is a preserved lib module
- Do NOT modify `.github/orchestration/scripts/lib/triage-engine.js` — it is a preserved lib module
- Do NOT modify `.github/orchestration/scripts/lib/resolver.js` — it is a preserved lib module
- Do NOT modify any preserved test suite (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- Do NOT modify `state-io.js` or `state-io.test.js`
- Do NOT add new files — only modify the three files listed in File Targets
- Do NOT change the `executePipeline` function signature or `PipelineResult` shape
- Do NOT change the `handleGateApproved` function signature
- Do NOT change any other mutation handler's logic (only `handleGateApproved` and the imports)
