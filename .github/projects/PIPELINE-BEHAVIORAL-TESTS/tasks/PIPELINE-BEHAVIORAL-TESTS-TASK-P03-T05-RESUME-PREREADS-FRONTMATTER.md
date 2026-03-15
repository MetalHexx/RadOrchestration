---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 3
task: 5
title: "Cold-Start Resume, Pre-Read Failures & Frontmatter-Driven Flows"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 1
---

# Cold-Start Resume, Pre-Read Failures & Frontmatter-Driven Flows

## Objective

Add behavioral tests covering cold-start resume from various pipeline states, pre-read validation failures (missing documents AND missing required frontmatter fields), and frontmatter-driven flow integration. Tests are added into the three existing placeholder `describe` blocks: `'Behavioral: Cold-Start Resume'`, `'Behavioral: Pre-Read Failures'`, and `'Behavioral: Frontmatter-Driven Flows'`.

## Context

The file `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` already exists with factory functions (`createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `advancePipeline`), 2 happy-path tests, 11 task triage row tests, 5 phase triage row tests, gate mode tests, retry/corrective cycle tests, and halt path tests. Three empty placeholder `describe` blocks exist at lines 1847, 1849, and 1851 for this task's tests. The `executePipeline` function handles the `start` event specially: no state → scaffolds initial state and resolves `spawn_research`; existing state → calls `resolveNextAction(state, config)` which reads `pipeline.current_tier` and routes through planning/execution/review/halted/complete resolution. The pipeline engine has pre-read blocks for `phase_plan_created` (validates `tasks` array in frontmatter) and `task_completed` (validates `has_deviations` and `deviation_type` in frontmatter). The triage engine validates `exit_criteria_met` in phase review frontmatter. The `createProjectAwareReader` wrapper tries direct path first, then project-relative fallback, returning `null` if both fail. The mock `readDocument` in `createMockIO` returns `null` for unstocked paths and deep-cloned documents for stocked paths.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Replace three empty placeholder `describe` blocks with populated test suites |

## Implementation Steps

1. **Replace the empty `describe('Behavioral: Cold-Start Resume', () => { /* T05 */ });` block** with a populated `describe` block containing the 5 cold-start resume tests described below. Each test creates a pre-existing `state.json` via factory functions and sends `event: 'start'` to `executePipeline`. The cold-start path reads state but makes zero writes — assert `io.getWrites().length === 0` (the `start`-with-existing-state path returns immediately from `resolveNextAction` without calling `writeState`). Note: the exact write count may be 0 since the cold-start path returns before any `writeState` call — verify by checking the implementation: the `start`+existing-state branch calls `resolveNextAction` and returns immediately without writing.

2. **New project (no state) → `spawn_research`**: Pass `state: null` to `createMockIO`. Send `start` event. Assert `result.success === true` and `result.action === NEXT_ACTIONS.SPAWN_RESEARCH`. This verifies the INIT PATH — `executePipeline` scaffolds initial state (planning tier, all steps `not_started`) and resolves the first planning step. The init path DOES write state once (assert `io.getWrites().length === 1`).

3. **Mid-execution task in_progress with handoff → `execute_task`**: Use `createExecutionState` with task `status: 'in_progress'`, `handoff_doc: 'tasks/task-01.md'`, `report_doc: null`. Send `start` event. Assert `result.action === NEXT_ACTIONS.EXECUTE_TASK`. This verifies the resolver routes to `resolveTaskLifecycle` → task is `in_progress` with handoff but no report → `EXECUTE_TASK`. Assert `io.getWrites().length === 0`.

4. **Between phases (phase complete, next not started) → `create_phase_plan`**: Use `createExecutionState` and set phase 0 `status: 'complete'`, `current_task` at tasks length, all tasks complete with `review_verdict: 'approved'`, `review_action: 'advanced'`, `phase_review_verdict: 'approved'`, `phase_review_action: 'advanced'`, `phase_report` and `phase_review` set. Set `execution.current_phase = 1`. Add a second phase with `status: 'not_started'`. Set `execution.total_phases = 2`. Send `start` event. Assert `result.action === NEXT_ACTIONS.CREATE_PHASE_PLAN`. Assert `io.getWrites().length === 0`.

5. **Halted project → `display_halted`**: Use `createBaseState` and set `pipeline.current_tier = 'halted'`. Send `start` event. Assert `result.action === NEXT_ACTIONS.DISPLAY_HALTED`. Assert `io.getWrites().length === 0`.

6. **Completed project → `display_complete`**: Use `createBaseState` and set `pipeline.current_tier = 'complete'`. Send `start` event. Assert `result.action === NEXT_ACTIONS.DISPLAY_COMPLETE`. Assert `io.getWrites().length === 0`.

7. **Replace the empty `describe('Behavioral: Pre-Read Failures', () => { /* T05 */ });` block** with a populated `describe` block containing the pre-read failure tests below. All pre-read failure tests use `createExecutionState` to reach the appropriate pipeline position and then trigger the relevant event with missing or malformed mock documents.

8. **`phase_plan_created` with non-existent file → error**: Use `createExecutionState` with phase `in_progress`. Stock NO documents. Send `phase_plan_created` with `context: { plan_path: 'phases/PHASE-01.md', phase_plan_path: 'phases/nonexistent.md' }`. Assert `result.success === false` and `result.error` contains `'Phase plan not found'`.

9. **`phase_plan_created` with missing `tasks` field → error**: Stock the phase plan document at both direct and project-relative paths with frontmatter that has NO `tasks` field: `{ frontmatter: { title: 'Test Phase' }, body: 'No tasks field' }`. Send `phase_plan_created` with `phase_plan_path` pointing to the stocked path. Assert `result.success === false` and `result.error` contains `"Required frontmatter field 'tasks' missing from phase plan document"`.

10. **`phase_plan_created` with empty `tasks` array → error**: Stock the phase plan document with `{ frontmatter: { tasks: [] }, body: 'Empty tasks' }` at both direct and project-relative paths. Send `phase_plan_created` with the stocked path. Assert `result.success === false` and `result.error` contains `"Phase plan 'tasks' array must not be empty"`.

11. **`task_completed` with report missing `has_deviations` → error**: Use `createExecutionState` with task `status: 'in_progress'`, `handoff_doc` set. Stock a task report document with `{ frontmatter: { status: 'complete', deviation_type: null }, body: 'Missing has_deviations' }` (note: `has_deviations` is intentionally absent). Send `task_completed` with `report_path` pointing to the stocked document. Assert `result.success === false` and `result.error` contains `"Required frontmatter field 'has_deviations' missing from task report"`.

12. **`task_completed` with report missing `deviation_type` → error**: Stock a task report document with `{ frontmatter: { status: 'complete', has_deviations: false }, body: 'Missing deviation_type' }` (note: `deviation_type` is intentionally absent — `undefined`, not `null`). Send `task_completed` with the stocked path. Assert `result.success === false` and `result.error` contains `"Required frontmatter field 'deviation_type' missing from task report"`.

13. **`readDocument` null-return path coverage**: Use `createExecutionState`. Do NOT stock any documents. Send `task_completed` with `report_path: 'reports/nonexistent.md'`. Assert `result.success === false` and `result.error` contains `'Task report not found'`. This exercises the `io.readDocument()` → `null` return → error branch in the `task_completed` pre-read. Also verifies that the pipeline does NOT throw — it returns a structured error.

14. **`createProjectAwareReader` both-paths-null**: Use `createExecutionState` with phase `in_progress`. Do NOT stock any documents. Send `phase_plan_created` with `phase_plan_path: 'phases/does-not-exist.md'`. The `createProjectAwareReader` tries `readDocument('phases/does-not-exist.md')` → `null`, then `readDocument('/test/project/phases/does-not-exist.md')` → `null`, returns `null`. Assert `result.success === false` and `result.error` contains `'Phase plan not found'`. This covers the both-paths-null fallback path carried forward from Phase 1.

15. **Replace the empty `describe('Behavioral: Frontmatter-Driven Flows', () => { /* T05 */ });` block** with a populated `describe` block containing the frontmatter-driven flow tests below. These tests verify that required frontmatter fields flow through the pipeline correctly.

16. **`tasks` array from phase plan flows into state**: Use `createExecutionState`. Stock a phase plan document with `{ frontmatter: { tasks: [{ id: 'T01-NEW', title: 'New Task' }, { id: 'T02-NEW', title: 'Second Task' }] }, body: 'Phase plan' }` at both direct and project-relative paths. Send `phase_plan_created` with `plan_path` and `phase_plan_path` pointing to the stocked path. Assert `result.success === true`. Verify the resulting state's current phase has tasks initialized: `state.execution.phases[0].tasks.length === 2`, `state.execution.phases[0].tasks[0].id === 'T01-NEW'`, `state.execution.phases[0].tasks[1].id === 'T02-NEW'`. This verifies the pre-read extracts `context.tasks` and the `handlePhasePlanCreated` mutation uses it to initialize tasks in state.

17. **`has_deviations`/`deviation_type` drive correct triage row through full pipeline**: Use `createExecutionState` with task `status: 'in_progress'` and `handoff_doc` set. Stock a task report with `{ frontmatter: { status: 'complete', has_deviations: true, deviation_type: 'minor' }, body: 'Report' }` at `'reports/task-report.md'`. Send `task_completed` with `report_path: 'reports/task-report.md'`. Assert `result.success === true` and `result.triage_ran === true`. Since there's no `review_doc`, triage will NOT match Row 1 (Row 1 requires `!hasDeviations`). Instead, triage has no matching row for `complete + hasDeviations + no review_doc` — check the actual behavior. Actually: Row 1 is `complete && !hasDeviations && !review_doc`. With `hasDeviations=true` and no review, no row matches complete+deviations+noReview → falls to the "no row matched" error. So instead: stock the task report with `has_deviations: true, deviation_type: 'minor'` AND set `task.report_doc` to the report path AND stock a code review with `verdict: 'approved'`. Send `code_review_completed` with `review_path`. This exercises Row 3 (complete, minor deviations, approved → advance). Assert `result.action === NEXT_ACTIONS.GENERATE_PHASE_REPORT` (advancing through all tasks → phase lifecycle). Verify `context.report_deviation_type` was extracted correctly by checking that triage ran and the task was marked complete with `review_verdict: 'approved'`.

18. **`exit_criteria_met` drives correct phase triage outcome**: Drive a phase to phase review. Use `createExecutionState` with task complete, `review_verdict: 'approved'`, `review_action: 'advanced'`, `current_task = 1`, `phase_report` set. Add a second phase (so this isn't the last). Stock a phase review with `{ frontmatter: { verdict: 'approved', exit_criteria_met: true }, body: 'Review' }` at both direct and project-relative paths. Send `phase_review_completed` with the stocked path. Assert `result.action === NEXT_ACTIONS.CREATE_PHASE_PLAN` (Phase Row 2: approved + exit_criteria_met → advance → not last phase → create_phase_plan). Then do a second test with `exit_criteria_met: false`. Assert the pipeline still advances (Phase Row 3: approved + !exit_criteria_met → advance with carry-forward) and `result.action === NEXT_ACTIONS.CREATE_PHASE_PLAN`.

19. **`exit_criteria_met` absent from phase review → triage error**: Drive a phase to phase review (same state setup as step 18). Stock a phase review with `{ frontmatter: { verdict: 'approved' }, body: 'No exit_criteria_met' }` — `exit_criteria_met` intentionally absent. Send `phase_review_completed`. The triage engine's `triagePhase` sees `exit_criteria_met === undefined` and returns the `makeError` result. The pipeline propagates this as `{ success: false }`. Assert `result.success === false` and `result.error` contains `"Required frontmatter field 'exit_criteria_met' missing from phase review"`.

20. **`context.report_deviation_type` extraction verified**: Use `createExecutionState` with task `in_progress`, `handoff_doc` set. Stock a task report with `{ frontmatter: { status: 'complete', has_deviations: true, deviation_type: 'architectural' }, body: 'Report' }`. Send `task_completed` with the report path. The pre-read extracts `context.report_deviation_type = 'architectural'`. Since no `review_doc` and `hasDeviations=true`, triage won't match Row 1. To verify propagation, also set `task.report_doc` to the report before calling, and stock a code review with `verdict: 'approved'`, then send `code_review_completed`. This hits Row 4 (complete, architectural deviations, approved → advance). Assert `result.success === true` and `result.triage_ran === true`. Verify the task's final `review_verdict === 'approved'` and `status === 'complete'`.

## Contracts & Interfaces

### `executePipeline` — Start Event Handling

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

// INIT PATH: no state + start event
if (state === null && event === 'start') {
  const config = io.readConfig(configPath);
  io.ensureDirectories(projectDir);
  const initialState = scaffoldInitialState(config, projectDir);
  io.writeState(projectDir, initialState);             // ONE write
  const resolved = resolveNextAction(initialState, config);
  return {
    success: true,
    action: resolved.action,                           // spawn_research
    context: resolved.context,
    mutations_applied: ['project_initialized'],
    triage_ran: false,
    validation_passed: true
  };
}

// COLD START PATH: state exists + start event
if (state !== null && event === 'start') {
  const config = io.readConfig(configPath);
  const resolved = resolveNextAction(state, config);   // ZERO writes
  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: [],
    triage_ran: false,
    validation_passed: true
  };
}
```

### `resolveNextAction` — State-Based Dispatch

```javascript
// .github/orchestration/scripts/lib/resolver.js

function resolveNextAction(state, config) {
  if (state == null) return { action: 'init_project', context: {...} };

  const tier = state.pipeline.current_tier;
  if (tier === 'halted')    return { action: 'display_halted', context: {...} };
  if (tier === 'complete')  return { action: 'display_complete', context: {...} };
  if (tier === 'planning')  return resolvePlanning(state);        // → spawn_research if first step not done
  if (tier === 'execution') return resolveExecution(state, mode); // → create_phase_plan or execute_task etc.
  if (tier === 'review')    return resolveReview(state);
}
```

For cold-start resume, the key dispatch paths are:
- **planning tier, research not_started** → `spawn_research`
- **execution tier, phase not_started** → `create_phase_plan`
- **execution tier, task in_progress with handoff, no report** → `execute_task`
- **halted tier** → `display_halted`
- **complete tier** → `display_complete`

### `createProjectAwareReader` — Null-Check Fallback

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

function createProjectAwareReader(readDocument, projectDir) {
  return function(docPath) {
    if (!docPath) return null;
    const result = readDocument(docPath);       // try direct path
    if (result !== null) return result;          // found → return
    const resolved = path.join(projectDir, docPath);
    return readDocument(resolved);              // try project-relative → returns doc or null
  };
}
```

### `phase_plan_created` Pre-Read — Required Field Validation

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

if (event === 'phase_plan_created' && context.phase_plan_path) {
  const projectAwareReader = createProjectAwareReader(io.readDocument, projectDir);
  const phasePlanDoc = projectAwareReader(context.phase_plan_path);
  if (!phasePlanDoc) {
    return { success: false, error: `Phase plan not found: ${context.phase_plan_path}`, ... };
  }
  const fm = phasePlanDoc.frontmatter || {};
  if (!Array.isArray(fm.tasks)) {
    return { success: false, error: "Required frontmatter field 'tasks' missing from phase plan document", ... };
  }
  if (fm.tasks.length === 0) {
    return { success: false, error: "Phase plan 'tasks' array must not be empty", ... };
  }
  context.tasks = fm.tasks;
}
```

### `task_completed` Pre-Read — Required Field Validation

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

if (event === 'task_completed' && context.report_path) {
  const reportDoc = io.readDocument(context.report_path);
  if (!reportDoc) {
    return { success: false, error: `Task report not found: ${context.report_path}`, ... };
  }
  const fm = reportDoc.frontmatter || {};
  if (fm.has_deviations === undefined || fm.has_deviations === null) {
    return { success: false, error: "Required frontmatter field 'has_deviations' missing from task report", ... };
  }
  if (fm.deviation_type === undefined) {
    return { success: false, error: "Required frontmatter field 'deviation_type' missing from task report", ... };
  }
  context.report_deviations = Boolean(fm.has_deviations);
  context.report_deviation_type = fm.deviation_type;
}
```

### Triage Engine — `exit_criteria_met` Validation

```javascript
// .github/orchestration/scripts/lib/triage-engine.js

// Inside triagePhase:
if (reviewFm.exit_criteria_met === undefined || reviewFm.exit_criteria_met === null) {
  return makeError(
    'phase',
    "Required frontmatter field 'exit_criteria_met' missing from phase review",
    'MISSING_REQUIRED_FIELD',
    phaseIndex,
    null
  );
}
const allExitCriteriaMet = reviewFm.exit_criteria_met === true;
```

### `makeErrorResult` Return Shape

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

function makeErrorResult(error, event, mutationsApplied, stateSnapshot, validationPassed) {
  return {
    success: false,
    error,
    event: event || null,
    state_snapshot: stateSnapshot || null,
    mutations_applied: mutationsApplied || [],
    validation_passed: validationPassed !== undefined ? validationPassed : null
  };
}
```

### Factory Functions Available in Test File

```javascript
// All factory functions are locally defined in pipeline-behavioral.test.js

// createMockIO({ state, config, documents }) — returns mock PipelineIO
//   .readDocument(docPath) returns null if docPath not in documents map, else deep-cloned doc
//   .getState() returns current state
//   .getWrites() returns array of state snapshots from writeState calls

// createDefaultConfig(overrides) — returns config with limits, human_gates, errors, projects

// createBaseState(overridesOrMutator) — returns state with planning tier, all not_started

// createExecutionState(mutator) — returns state with execution tier, 1 phase, 1 task (not_started)

// makeRequest(event, context) — returns { event, projectDir: '/test/project', configPath, context }

// withStrictDates(fn) — wraps fn to ensure monotonically increasing Date.now() (avoids V13 timestamp collisions)

// advancePipeline(io, events) — drives pipeline through a sequence of events, asserting success at each step
```

### Constants Used in Assertions

```javascript
const {
  NEXT_ACTIONS,         // SPAWN_RESEARCH, EXECUTE_TASK, CREATE_PHASE_PLAN, DISPLAY_HALTED,
                        // DISPLAY_COMPLETE, GENERATE_PHASE_REPORT, CREATE_TASK_HANDOFF, etc.
  PIPELINE_TIERS,       // PLANNING, EXECUTION, REVIEW, COMPLETE, HALTED
  TASK_STATUSES,        // NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED, HALTED
  PHASE_STATUSES,       // NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED, HALTED
  REVIEW_VERDICTS,      // APPROVED, CHANGES_REQUESTED, REJECTED
  REVIEW_ACTIONS,       // ADVANCED, CORRECTIVE_TASK_ISSUED, HALTED
  PHASE_REVIEW_ACTIONS  // ADVANCED, CORRECTIVE_TASKS_ISSUED, HALTED
} = require('../lib/constants');
```

## Styles & Design Tokens

Not applicable — this is a test-only task with no UI.

## Test Requirements

- [ ] 5 cold-start resume tests covering: new project, mid-execution task, between-phases, halted, and completed
- [ ] 7 pre-read failure tests covering: missing phase plan file, missing `tasks` field, empty `tasks` array, missing `has_deviations`, missing `deviation_type`, `readDocument` null-return path, and `createProjectAwareReader` both-paths-null
- [ ] 5 frontmatter-driven flow tests covering: `tasks` array initialization in state, `has_deviations`/`deviation_type` through triage, `exit_criteria_met` true and false paths, `exit_criteria_met` absent → error, and `context.report_deviation_type` extraction
- [ ] All new tests call `executePipeline()` end-to-end (behavioral tests, not unit tests)
- [ ] All new tests use factory functions from the test file (no new imports except `executePipeline` and constants already imported)
- [ ] All existing tests continue to pass — zero regressions
- [ ] Full test suite (`node --test pipeline-behavioral.test.js`) completes in under 5 seconds

## Acceptance Criteria

- [ ] The `describe('Behavioral: Cold-Start Resume')` block contains at least 5 tests covering new project, mid-execution, between-phases, halted, and completed states
- [ ] The `describe('Behavioral: Pre-Read Failures')` block contains at least 7 tests covering missing documents and missing required frontmatter fields
- [ ] The `describe('Behavioral: Frontmatter-Driven Flows')` block contains at least 5 tests covering tasks array, has_deviations/deviation_type, exit_criteria_met (true, false, absent), and deviation_type extraction
- [ ] Cold-start resume tests verify zero writes for existing state (`io.getWrites().length === 0`) except the new-project test which has exactly 1 write
- [ ] Pre-read failure tests assert `result.success === false` and verify error message contains the expected field name or document reference
- [ ] Frontmatter-driven flow tests assert `result.success === true` and verify the correct state mutations resulted from the frontmatter values
- [ ] `exit_criteria_met` absent test asserts `result.success === false` with error containing `'exit_criteria_met'`
- [ ] All tests pass (`node --test pipeline-behavioral.test.js`)
- [ ] No lint errors
- [ ] No regressions in existing tests

## Constraints

- Do NOT add new imports — use only `executePipeline` and constants already imported at the top of the file
- Do NOT modify any existing tests or factory functions — only replace the three empty placeholder `describe` blocks
- Do NOT test YAML parsing — all mock documents use pre-parsed `{ frontmatter: {...}, body: '...' }` objects
- Do NOT create helper functions outside the `describe` blocks — use inline setup within each test
- Do NOT reference any planning documents (PRD, Architecture, Design, Master Plan) from the test code
- Use `withStrictDates` wrapper for any test that triggers triage or internal-action loops
- Each `describe` block must be self-contained; tests must not depend on execution order across blocks
