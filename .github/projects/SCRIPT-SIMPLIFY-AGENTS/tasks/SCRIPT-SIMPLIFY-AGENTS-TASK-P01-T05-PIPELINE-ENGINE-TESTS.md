---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
task: 5
title: "Pipeline Engine Integration Tests"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Pipeline Engine Integration Tests

## Objective

Create comprehensive integration tests for `pipeline-engine.js` using a mock `PipelineIO` factory, covering all 19 events (init, cold start, 17 standard events), triage flow integration, `triage_attempts` lifecycle, error paths, and task report pre-read enrichment.

## Context

The pipeline engine (`pipeline-engine.js`) is a single-export module (`executePipeline(request, io)`) that implements a linear recipe: load state → apply mutation → validate transition → write state → triage check → resolve next action → return result. All I/O flows through an injected `PipelineIO` interface, making the engine fully testable with mocks. The engine composes five domain/infrastructure modules: `mutations.js`, `state-validator.js`, `resolver.js`, `triage-engine.js`, and `constants.js`. The test suite must exercise the real implementations of ALL these modules (no mocking of domain logic) — only PipelineIO methods are mocked.

**IMPORTANT — V8/V14 Tension for `code_review_completed`**: The `code_review_completed` mutation sets only `review_doc` on the task. Validator invariant V8 requires that when `review_doc` is non-null, `review_verdict` must also be non-null. V14 prohibits changing both `review_doc` and `review_verdict` in the same write. The pipeline validates BEFORE triage runs, so the intermediate state after `code_review_completed` mutation has `review_doc` set but `review_verdict` null — V8 fires. The integration test should verify this: if the event fails V8 validation, assert the error result and document it as a known V8/V14 tension with a code comment. If it passes (implementation changes), test the success path.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | ~400–500 lines, integration test suite |

## Implementation Steps

1. **Set up imports**: Require `node:test` (`describe`, `it`, `beforeEach`), `node:assert/strict`, and `../lib/pipeline-engine` (`executePipeline`). Also require `../lib/constants` for `PIPELINE_TIERS`, `TASK_STATUSES`, `PHASE_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `NEXT_ACTIONS`.

2. **Create mock `PipelineIO` factory** (`createMockIO`): Returns an object with in-memory implementations of all 5 PipelineIO methods:
   - `readState(projectDir)` → returns a stored state object (default `null`)
   - `writeState(projectDir, state)` → stores the state in a closure variable, push to a `writes` array for assertion
   - `readConfig(configPath)` → returns a stored config object
   - `readDocument(docPath)` → looks up a `documents` map keyed by docPath, returns `{ frontmatter, body }` or throws
   - `ensureDirectories(projectDir)` → no-op, increments a `ensureDirsCalled` counter
   - Factory accepts `{ state, config, documents }` options to preload data
   - Expose: `io.getState()` (last written state), `io.getWrites()` (all write calls), `io.getEnsureDirsCalled()` (counter)

3. **Create fixture state factory** (`createBaseState`): Returns a minimal valid `state.json` object:
   ```javascript
   {
     "$schema": "orchestration-state-v2",
     project: { name: "TEST", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z" },
     pipeline: { current_tier: "planning", human_gate_mode: "ask" },
     planning: {
       status: "not_started",
       brainstorming_doc: null,
       steps: {
         research:     { status: "not_started", output: null },
         prd:          { status: "not_started", output: null },
         design:       { status: "not_started", output: null },
         architecture: { status: "not_started", output: null },
         master_plan:  { status: "not_started", output: null }
       },
       human_approved: false
     },
     execution: {
       status: "not_started",
       current_phase: 0,
       total_phases: 0,
       triage_attempts: 0,
       phases: []
     },
     final_review: { status: "not_started", report_doc: null, human_approved: false },
     errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
     limits: {
       max_phases: 10,
       max_tasks_per_phase: 8,
       max_retries_per_task: 2,
       max_consecutive_review_rejections: 3
     }
   }
   ```
   Accept an override function/object parameter for easy customization (e.g., `createBaseState(overrides)` using deep merge or callback mutation).

4. **Create execution-ready state helper** (`createExecutionState`): Returns a state configured for execution-tier testing:
   - `pipeline.current_tier = "execution"`, `planning.status = "complete"`, all 5 planning steps complete, `planning.human_approved = true`, `execution.status = "in_progress"`
   - One phase `{ id: "P01-TEST", status: "in_progress", current_task: 0, phase_doc: "phases/test.md", phase_report: null, phase_review: null, phase_review_verdict: null, phase_review_action: null, tasks: [<one task>] }`
   - One task: `{ id: "T01-TEST", title: "Test Task", status: "not_started", retries: 0, handoff_doc: null, report_doc: null, review_doc: null, review_verdict: null, review_action: null }`
   - `triage_attempts: 0`

5. **Create a default mock config** to be returned by `readConfig`:
   ```javascript
   {
     limits: { max_phases: 10, max_tasks_per_phase: 8, max_retries_per_task: 2, max_consecutive_review_rejections: 3 },
     human_gates: { after_planning: true, execution_mode: "ask", after_final_review: true },
     errors: { severity: { critical: [], minor: [] }, on_critical: "halt", on_minor: "retry" },
     projects: { base_path: ".github/projects", naming: "SCREAMING_CASE" }
   }
   ```

6. **Write Init Path tests** (`describe('Init Path')`):
   - Test: no state + `start` event → `success: true`, `action` is `'spawn_research'`, `mutations_applied` contains `'project_initialized'`, `triage_ran: false`, `validation_passed: true`
   - Assert `io.getEnsureDirsCalled() === 1`
   - Assert `io.getState()` has `$schema`, `pipeline.current_tier === 'planning'`, `execution.triage_attempts === 0`, `planning.status === 'not_started'`
   - Assert `io.getWrites().length === 1`

7. **Write Cold Start tests** (`describe('Cold Start')`):
   - Test: existing planning-tier state + `start` → `success: true`, correct next action based on planning progress, `mutations_applied` is empty, `triage_ran: false`
   - Test: existing execution-tier state + `start` → resolves correct next action for execution progress
   - Assert `io.getWrites().length === 0` (no write on cold start)

8. **Write Planning Event tests** (`describe('Planning Events')`):
   - For each of the 7 planning events (`research_completed`, `prd_completed`, `design_completed`, `architecture_completed`, `master_plan_completed`, `plan_approved`, `plan_rejected`):
     - Set up appropriate pre-mutation state (e.g., for `prd_completed`, research must already be complete)
     - Call `executePipeline` with correct event and context
     - Assert `success: true`
     - Assert the correct mutations were applied (state field changes)
     - Assert `triage_ran: false` (no triage for planning events)
     - Assert `validation_passed: true`
   - For `plan_approved`: verify state transitions to `execution` tier, `planning.human_approved → true`, `execution.status → 'in_progress'`
   - For `plan_rejected`: verify `pipeline.current_tier → 'halted'`, active blockers contain rejection message

9. **Write Execution Event tests** (`describe('Execution Events')`):
   - **`phase_plan_created`**: execution-tier state with not-started phase → sets `phase_doc`, initializes tasks array, sets phase to `in_progress`. Context must include `{ plan_path: "phases/test.md", tasks: [{ id: "T01", title: "Task 1" }] }`
   - **`task_handoff_created`**: phase with not_started task → sets `handoff_doc`, sets task status to `in_progress`, clears review fields. Context: `{ handoff_path: "tasks/test.md" }`
   - **`task_completed`**: task in `in_progress` status with report path → sets `report_doc`, enriches context from report frontmatter, triage triggers. This test needs a mock document for the report AND the task report. Document map must include a task report document with frontmatter `{ status: "complete", severity: null, has_deviations: false }`. Assert `triage_ran: true`. The triage engine reads the task report (via `readDocument`) — provide the report doc in the documents map.
   - **`code_review_completed`**: task that already has a report_doc and is complete (via previous triage). See V8/V14 note — test what actually happens. If validation fails with V8, assert the error result and add a comment documenting the tension. If it passes, verify triage runs and sets verdict/action.
   - **`phase_report_created`**: phase with all tasks complete, `current_task >= tasks.length` → sets `phase_report`. Context: `{ report_path: "reports/test.md" }`
   - **`phase_review_completed`**: phase with `phase_report` set → sets `phase_review`, triggers phase-level triage. Provide a mock phase review document with frontmatter `{ verdict: "approved", exit_criteria_met: true }`.

10. **Write Gate Event tests** (`describe('Gate Events')`):
    - **`gate_approved` (task)**: context `{ gate_type: "task" }` → `phase.current_task` increments, `triage_attempts` resets to 0
    - **`gate_approved` (phase)**: context `{ gate_type: "phase" }` → phase status → complete, `execution.current_phase` increments, `triage_attempts` resets to 0
    - **`gate_rejected`**: context `{ gate_type: "task" }` → `pipeline.current_tier → 'halted'`, active blocker added

11. **Write Final Review Event tests** (`describe('Final Review Events')`):
    - **`final_review_completed`**: state in review tier → sets `final_review.report_doc`, `final_review.status → 'complete'`
    - **`final_approved`**: state with final_review complete → `final_review.human_approved → true`, `pipeline.current_tier → 'complete'`
    - **`final_rejected`**: → `pipeline.current_tier → 'halted'`, active blocker added

12. **Write Triage Flow integration tests** (`describe('Triage Flow')`):
    - **`task_completed` with triage → approved/advanced**: Set up an in-progress task. Provide a task report doc with `{ status: "complete", has_deviations: false }` and NO `review_doc` on the task. Triage engine Row 1 should match (complete, no deviations, no review → skip). Assert triage ran but verdict/action are null (skip path).
    - **`task_completed` with triage → corrective**: Provide a task report doc with `{ status: "complete", has_deviations: false }`, set `review_doc` on the task (previous review exists), provide a review doc with `{ verdict: "changes_requested" }`. Triage Row 5 should match → corrective. Assert `review_verdict = 'changes_requested'`, `review_action = 'corrective_task_issued'`, `task.status = 'failed'`, `triage_attempts` incremented.
    - **`phase_review_completed` with triage → advanced**: Provide phase review doc with `{ verdict: "approved", exit_criteria_met: true }`. Assert `phase_review_verdict = 'approved'`, `phase_review_action = 'advanced'`, `triage_attempts` reset to 0.

13. **Write `triage_attempts` lifecycle tests** (`describe('triage_attempts Lifecycle')`):
    - **Increment on triage**: After `task_completed` triggers triage with a non-skip result, `triage_attempts` should increment from 0 to 1.
    - **Reset on advance**: After triage results in `ADVANCED`, `triage_attempts` should reset to 0.
    - **Halt on > 1**: Set `triage_attempts` to 2 in pre-state. Call `task_completed`. Assert the result is `success: true` with `action: 'display_halted'` and `triage_ran: false` (triage did NOT run).
    - **Init sets to 0**: Verify the scaffolded initial state from init path has `execution.triage_attempts === 0`.

14. **Write Error Path tests** (`describe('Error Paths')`):
    - **Unknown event**: `event: "nonexistent_event"` → `success: false`, `error` contains `"Unknown event"`, `mutations_applied` is empty
    - **No state + non-start event**: `readState` returns null, event is `research_completed` → `success: false`, `error` contains `"No state.json found"`
    - **Validation failure**: Construct a state that will fail validation after mutation (e.g., a state where applying a mutation would create two `in_progress` tasks to trigger V6). Assert `success: false`, `validation_passed: false`, `io.getWrites().length` is 0 after the pre-mutation write count (state NOT written for invalid mutation).

15. **Write Task Report Pre-Read test** (`describe('Task Report Pre-Read')`):
    - Set up `task_completed` event with `context.report_path = 'reports/task-report.md'`
    - Provide a mock document at `'reports/task-report.md'` with frontmatter `{ status: "partial", severity: "minor", has_deviations: true }`
    - After `executePipeline`, check that the written state has `task.severity` set (confirming the pre-read enriched context was used by the mutation)

## Contracts & Interfaces

### PipelineIO Interface (to be mocked)

```javascript
/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => Object|null} readState
 * @property {(projectDir: string, state: Object) => void} writeState
 * @property {(configPath: string) => Object} readConfig
 * @property {(docPath: string) => { frontmatter: Object, body: string }} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */
```

### PipelineRequest (input to executePipeline)

```javascript
/**
 * @typedef {Object} PipelineRequest
 * @property {string} event - Event name from closed vocabulary
 * @property {string} projectDir - Absolute path to project directory
 * @property {string} [configPath] - Path to orchestration.yml (optional)
 * @property {Object} [context] - Event-specific context payload
 */
```

### PipelineResult — Success Shape

```javascript
{
  success: true,
  action: "<NEXT_ACTIONS value>",
  context: { tier, phase_index, task_index, phase_id, task_id, details },
  mutations_applied: ["field_path → value", ...],
  triage_ran: Boolean,
  validation_passed: true
}
```

### PipelineResult — Error Shape

```javascript
{
  success: false,
  error: "descriptive error message",
  event: "<event name>" | null,
  state_snapshot: { current_phase: N } | null,
  mutations_applied: ["field_path → value", ...],
  validation_passed: Boolean | null
}
```

### Mock PipelineIO Factory Signature

```javascript
/**
 * @param {Object} opts
 * @param {Object|null} opts.state - Pre-loaded state (null = no state.json)
 * @param {Object} opts.config - Config object returned by readConfig
 * @param {Record<string, { frontmatter: Object, body: string }>} opts.documents - Document map keyed by path
 * @returns {{
 *   readState: Function, writeState: Function, readConfig: Function,
 *   readDocument: Function, ensureDirectories: Function,
 *   getState: () => Object|null,
 *   getWrites: () => Object[],
 *   getEnsureDirsCalled: () => number
 * }}
 */
function createMockIO(opts) { /* ... */ }
```

### Event Context Payloads (for reference)

| Event | Context |
|-------|---------|
| `start` | `{}` |
| `research_completed` | `{ doc_path: "<path>" }` |
| `prd_completed` | `{ doc_path: "<path>" }` |
| `design_completed` | `{ doc_path: "<path>" }` |
| `architecture_completed` | `{ doc_path: "<path>" }` |
| `master_plan_completed` | `{ doc_path: "<path>" }` |
| `plan_approved` | `{}` |
| `plan_rejected` | `{}` |
| `phase_plan_created` | `{ plan_path: "<path>", tasks: [{ id, title }] }` |
| `task_handoff_created` | `{ handoff_path: "<path>" }` |
| `task_completed` | `{ report_path: "<path>" }` |
| `code_review_completed` | `{ review_path: "<path>" }` |
| `phase_report_created` | `{ report_path: "<path>" }` |
| `phase_review_completed` | `{ review_path: "<path>" }` |
| `gate_approved` | `{ gate_type: "task" \| "phase" }` |
| `gate_rejected` | `{ gate_type: "task" \| "phase" }` |
| `final_review_completed` | `{ review_path: "<path>" }` |
| `final_approved` | `{}` |
| `final_rejected` | `{}` |

### State Validator Invariants (for error path testing)

| Invariant | Rule | Relevance |
|-----------|------|-----------|
| V1 | `current_phase` within bounds | Error path testing |
| V2 | `current_task` within bounds | Error path testing |
| V6 | Only one `in_progress` task | Validation failure test |
| V8 | `review_doc` non-null → `review_verdict` non-null | V8/V14 tension test |
| V9 | `phase_review` non-null → `phase_review_verdict` non-null | Phase triage test |
| V12 | Valid task status transitions | Error path testing |
| V13 | `project.updated` timestamp monotonicity | Automatically handled by `writeState` mock |
| V14 | `review_doc` and `review_verdict` cannot both change in same write | V8/V14 tension test |

### Constants Used (import from `../lib/constants`)

```javascript
const {
  PIPELINE_TIERS,    // { PLANNING, EXECUTION, REVIEW, COMPLETE, HALTED }
  TASK_STATUSES,     // { NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED, HALTED }
  PHASE_STATUSES,    // { NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED, HALTED }
  REVIEW_VERDICTS,   // { APPROVED, CHANGES_REQUESTED, REJECTED }
  REVIEW_ACTIONS,    // { ADVANCED, CORRECTIVE_TASK_ISSUED, HALTED }
  PHASE_REVIEW_ACTIONS, // { ADVANCED, CORRECTIVE_TASKS_ISSUED, HALTED }
  NEXT_ACTIONS       // 35-value enum
} = require('../lib/constants');
```

## Styles & Design Tokens

N/A — no UI component.

## Test Requirements

- [ ] Mock `PipelineIO` factory creates in-memory I/O with state, config, and documents preloading
- [ ] Init path: no state → `start` → scaffolds state with `triage_attempts: 0`, returns `spawn_research`
- [ ] Cold start: existing state → `start` → returns correct action, zero writes
- [ ] All 7 planning events produce correct mutations and correct next action
- [ ] `plan_approved` transitions tier to execution
- [ ] `plan_rejected` halts pipeline
- [ ] `phase_plan_created` initializes phase tasks from context
- [ ] `task_handoff_created` sets task to in_progress, clears review fields
- [ ] `task_completed` triggers triage, enriches context from pre-read
- [ ] `code_review_completed` behavior documented (V8/V14 tension — either passes or fails V8; either outcome is asserted)
- [ ] `phase_report_created` sets phase_report
- [ ] `phase_review_completed` triggers phase-level triage
- [ ] `gate_approved` (task) advances task, resets triage_attempts
- [ ] `gate_approved` (phase) advances phase, resets triage_attempts
- [ ] `gate_rejected` halts pipeline
- [ ] `final_review_completed` sets report_doc and status
- [ ] `final_approved` completes pipeline
- [ ] `final_rejected` halts pipeline
- [ ] Triage flow: `task_completed` → skip triage (Row 1) when no deviations, no review
- [ ] Triage flow: `task_completed` → corrective (Row 5) when review has changes_requested
- [ ] Triage flow: `phase_review_completed` → advanced when approved
- [ ] `triage_attempts` increments on non-skip triage
- [ ] `triage_attempts` resets to 0 on advance
- [ ] `triage_attempts > 1` returns `display_halted` without running triage
- [ ] Unknown event → error result
- [ ] No state + non-start → error result
- [ ] Validation failure → error result, state NOT written
- [ ] Task report pre-read enriches context with frontmatter fields

## Acceptance Criteria

- [ ] File created at `.github/orchestration/scripts/tests/pipeline-engine.test.js`
- [ ] All 19 events have at least one integration test
- [ ] Triage flow tested end-to-end through mocked I/O (at least the skip, corrective, and advance paths)
- [ ] `triage_attempts` lifecycle fully tested (init=0, increment on triage, reset on advance, >1 triggers halt)
- [ ] Error paths tested: unknown event, no state + non-start, validation failure
- [ ] Task report pre-read verified: `io.readDocument` called with report path, context enriched
- [ ] V8/V14 tension for `code_review_completed` is tested and documented with a code comment explaining the tension
- [ ] No filesystem access — all I/O uses mock `PipelineIO`
- [ ] Uses `node:test` (`describe`, `it`) and `node:assert/strict` — no npm dependencies
- [ ] CommonJS with `'use strict'` at top
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests/pipeline-engine.test.js`
- [ ] All 4 preserved lib test suites still pass unmodified (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`)
- [ ] Build passes — module loads without errors

## Constraints

- Do NOT modify any existing source files (`pipeline-engine.js`, `mutations.js`, `state-validator.js`, `resolver.js`, `triage-engine.js`, `constants.js`, `state-io.js`)
- Do NOT modify any existing test files
- Do NOT mock domain modules (`mutations.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) — use the real implementations
- Do NOT use npm dependencies — `node:test` and `node:assert` only
- Do NOT access the filesystem in tests — all I/O through mock `PipelineIO`
- Do NOT skip the V8/V14 tension test — either assert the error or assert success, and document which path the current implementation takes
- The `writeState` mock must update `project.updated` to a new ISO timestamp (like the real `state-io.writeState` does) to avoid V13 (timestamp monotonicity) failures in validation
