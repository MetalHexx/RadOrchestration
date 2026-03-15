---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
task: 2
title: "INTEGRATION-TESTS"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# Engine Integration Tests & Test Infrastructure

## Objective

Create the shared test infrastructure (`createMockIO` factory, state factories) and integration tests for `pipeline-engine.js` that verify all engine paths: init, cold-start, standard event happy path, pre-read failure, validation failure, unknown event, and `scaffoldInitialState` — confirming the one-write-per-event invariant and correct `PipelineResult` shapes.

## Context

Task T01 created `pipeline-engine.js` at `.github/orchestration/scripts/lib-v3/pipeline-engine.js` — a ~170-line declarative engine exporting `processEvent` and `scaffoldInitialState`. The engine wires six lib-v3 modules (pre-reads, mutations, validator, resolver, constants, state-io) into a linear recipe. All 278 existing unit tests pass. This task creates the first integration-level tests that exercise `processEvent` end-to-end through the wired module chain using dependency-injected mock I/O. The test infrastructure built here (`createMockIO`, state factories) will also be used by T03 and T04 behavioral tests (duplicated per-file, not imported — per the project's test infrastructure rules).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests-v3/helpers/test-helpers.js` | Shared test infrastructure: `createMockIO`, `createDefaultConfig`, state factories, `processAndAssert` helper |
| CREATE | `.github/orchestration/scripts/tests-v3/pipeline-engine.test.js` | Integration tests for all engine paths |

## Implementation Steps

1. **Create `tests-v3/helpers/test-helpers.js`** with the following exports:
   - `createDefaultConfig()` — returns a deep clone of the default config object (see Contracts section below)
   - `createMockIO({ state?, documents?, config? })` — returns a `MockIO` object (see Contracts section)
   - `createBaseState(overrides?)` — minimal valid v3 state in planning tier
   - `createExecutionState(overrides?)` — valid state in execution tier with 1 phase, 2 tasks (both `not_started`), planning complete + human approved
   - `createReviewState(overrides?)` — valid state in review tier, all phases complete, no top-level `final_review` object (carry-forward CF-3)
   - `processAndAssert(event, context, io, assertions)` — calls `processEvent` and runs common assertions (success, action, write count)

2. **Create `tests-v3/pipeline-engine.test.js`** importing from `./helpers/test-helpers.js` and `../lib-v3/pipeline-engine.js`.

3. **Write `describe('processEvent — init path')` tests**:
   - No state + `start` event → `success: true`, `action: 'spawn_research'`, `mutations_applied` includes `'project_initialized'`
   - Verify `io.getWrites().length === 1`
   - Verify `io.getEnsureDirsCalled() === 1`
   - Verify written state has `$schema: 'orchestration-state-v3'`

4. **Write `describe('processEvent — cold-start path')` tests**:
   - Existing state (planning tier) + `start` → `success: true`, action is a planning action, `mutations_applied` is empty array
   - Verify `io.getWrites().length === 0`
   - Existing state (execution tier, mid-task) + `start` → correct next action resolved from state

5. **Write `describe('processEvent — standard event path')` tests**:
   - `research_completed` with valid context → `success: true`, `io.getWrites().length === 1`, result has `action` and non-empty `mutations_applied`
   - `task_completed` with valid pre-read document → `success: true`, single write, correct state mutations
   - `code_review_completed` with `approved` verdict → task advances, `io.getWrites().length === 1`

6. **Write `describe('processEvent — pre-read failure')` tests**:
   - `task_completed` with missing document → `success: false`, `action: null`, `io.getWrites().length === 0`, `context.error` contains event name
   - `plan_approved` with document missing `total_phases` → `success: false`, context contains `field: 'total_phases'`

7. **Write `describe('processEvent — validation failure')` tests**:
   - Trigger a V12 violation (invalid task status transition) by crafting state where the mutation would produce an illegal transition → `success: false`, `action: null`, `io.getWrites().length === 0`, `context.violations` is a non-empty array with `invariant` field

8. **Write `describe('processEvent — unknown event')` tests**:
   - `processEvent('nonexistent_event', ...)` → `success: false`, `action: null`, `io.getWrites().length === 0`, `context.error` includes `'nonexistent_event'`

9. **Write `describe('scaffoldInitialState')` tests**:
   - Output has `$schema: 'orchestration-state-v3'`
   - Output has `project.name` matching `path.basename(projectDir)`
   - Output has 5 planning steps, all `not_started`
   - Output has `planning.current_step: 'research'`
   - Output has `execution.current_tier: 'planning'`
   - Output has no `triage_attempts` at any level (check `execution.triage_attempts === undefined` and no phase has `triage_attempts`)

10. **Write `describe('halted tier — validateTransition passthrough')` test** (carry-forward CF-5):
    - Create state with `current_tier: 'halted'` → call `processEvent` with a valid standard event → verify `validateTransition` does not produce false-positive V10 errors for halted tier (the validator's `checkV10` has no branch for `'halted'`, so it should return `[]`)

## Contracts & Interfaces

### PipelineIO (what `createMockIO` must implement)

```javascript
/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => StateJson | null} readState
 * @property {(projectDir: string, state: StateJson) => void} writeState
 * @property {(configPath?: string) => Config} readConfig
 * @property {(docPath: string) => ParsedDocument | null} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */
```

### MockIO (extended interface for test assertions)

```javascript
/**
 * @typedef {Object} MockIO
 * @property {(projectDir: string) => StateJson | null} readState
 * @property {(projectDir: string, state: StateJson) => void} writeState
 * @property {(configPath?: string) => Config} readConfig
 * @property {(docPath: string) => ParsedDocument | null} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 * @property {() => StateJson | null} getState - returns current state after last write
 * @property {() => StateJson[]} getWrites - returns array of all state snapshots written
 * @property {() => number} getEnsureDirsCalled - returns call count for ensureDirectories
 */
```

### createMockIO Implementation Contract

```javascript
function createMockIO({ state = null, documents = {}, config = null } = {}) {
  // state: initial StateJson or null (simulates no state.json)
  // documents: flat map { 'path/to/doc.md': { frontmatter: {...}, body: '...' } }
  // config: Config object; defaults to createDefaultConfig() if not provided
  //
  // All inputs and outputs MUST be deep-cloned to prevent cross-test mutation leaks.
  // readState returns deep clone of initial state (or null).
  // writeState captures deep clone into writes array AND updates internal currentState.
  // readConfig returns deep clone of config.
  // readDocument looks up docPath in documents map; returns deep clone or null.
  // ensureDirectories increments counter (no-op for filesystem).
  // getState() returns currentState (mutated by writeState calls).
  // getWrites() returns the array of all state snapshots captured by writeState.
  // getEnsureDirsCalled() returns the ensureDirectories call count integer.
}
```

### PipelineResult (what `processEvent` returns)

```javascript
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS values when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error info on failure
 * @property {string[]} mutations_applied - human-readable mutation descriptions; empty on failure
 */
```

### processEvent Signature

```javascript
/**
 * @param {string} event - pipeline event name
 * @param {string} projectDir - absolute path to project directory
 * @param {Object} context - event-specific context from Orchestrator
 * @param {PipelineIO} io - dependency-injected I/O
 * @param {string} [configPath] - path to orchestration.yml
 * @returns {PipelineResult}
 */
function processEvent(event, projectDir, context, io, configPath) { /* ... */ }
```

### scaffoldInitialState Signature

```javascript
/**
 * @param {Object} config - parsed orchestration config
 * @param {string} projectDir - absolute path to project directory
 * @returns {StateJson} - fresh v3 state object
 */
function scaffoldInitialState(config, projectDir) { /* ... */ }
```

### Default Config Shape

```javascript
function createDefaultConfig() {
  return {
    projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' },
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3,
    },
    errors: {
      severity: {
        critical: ['build_failure', 'security_vulnerability', 'architectural_violation', 'data_loss_risk'],
        minor: ['test_failure', 'lint_error', 'review_suggestion', 'missing_test_coverage', 'style_violation'],
      },
      on_critical: 'halt',
      on_minor: 'retry',
    },
    human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
  };
}
```

### State Factory Shapes

**`createBaseState(overrides?)`** — minimal valid v3 state in planning tier:

```javascript
{
  $schema: 'orchestration-state-v3',
  project: { name: 'TEST', created: '<iso>', updated: '<iso>' },
  planning: {
    status: 'not_started',
    human_approved: false,
    steps: [
      { name: 'research', status: 'not_started', doc_path: null },
      { name: 'prd', status: 'not_started', doc_path: null },
      { name: 'design', status: 'not_started', doc_path: null },
      { name: 'architecture', status: 'not_started', doc_path: null },
      { name: 'master_plan', status: 'not_started', doc_path: null },
    ],
    current_step: 'research',
  },
  execution: {
    status: 'not_started',
    current_tier: 'planning',
    current_phase: 0,
    total_phases: 0,
    phases: [],
  },
}
```

**`createExecutionState(overrides?)`** — execution tier with 1 phase, 2 tasks:

```javascript
{
  $schema: 'orchestration-state-v3',
  project: { name: 'TEST', created: '<iso>', updated: '<iso>' },
  planning: {
    status: 'complete',
    human_approved: true,
    steps: [
      { name: 'research', status: 'complete', doc_path: 'docs/research.md' },
      { name: 'prd', status: 'complete', doc_path: 'docs/prd.md' },
      { name: 'design', status: 'complete', doc_path: 'docs/design.md' },
      { name: 'architecture', status: 'complete', doc_path: 'docs/architecture.md' },
      { name: 'master_plan', status: 'complete', doc_path: 'docs/master_plan.md' },
    ],
    current_step: 'master_plan',
  },
  execution: {
    status: 'in_progress',
    current_tier: 'execution',
    current_phase: 0,
    total_phases: 1,
    phases: [{
      name: 'Phase 1',
      status: 'in_progress',
      current_task: 0,
      total_tasks: 2,
      tasks: [
        { name: 'T01', status: 'not_started', handoff_doc: null, report_doc: null, review_doc: null, review_verdict: null, review_action: null, has_deviations: false, deviation_type: null, retries: 0, report_status: null },
        { name: 'T02', status: 'not_started', handoff_doc: null, report_doc: null, review_doc: null, review_verdict: null, review_action: null, has_deviations: false, deviation_type: null, retries: 0, report_status: null },
      ],
      phase_plan_doc: 'phases/PHASE-01.md',
      phase_report_doc: null,
      phase_review_doc: null,
      phase_review_verdict: null,
      phase_review_action: null,
    }],
  },
}
```

**`createReviewState(overrides?)`** — review tier, all phases complete, NO top-level `final_review` object (CF-3):

```javascript
{
  $schema: 'orchestration-state-v3',
  project: { name: 'TEST', created: '<iso>', updated: '<iso>' },
  planning: {
    status: 'complete',
    human_approved: true,
    steps: [/* all 5 steps complete */],
    current_step: 'master_plan',
  },
  execution: {
    status: 'complete',
    current_tier: 'review',
    current_phase: 0,
    total_phases: 1,
    phases: [{
      name: 'Phase 1',
      status: 'complete',
      current_task: 1,
      total_tasks: 1,
      tasks: [{ name: 'T01', status: 'complete', handoff_doc: 'h.md', report_doc: 'r.md', review_doc: 'rv.md', review_verdict: 'approved', review_action: 'advanced', has_deviations: false, deviation_type: null, retries: 0, report_status: 'complete' }],
      phase_plan_doc: 'pp.md',
      phase_report_doc: 'pr.md',
      phase_review_doc: 'prv.md',
      phase_review_verdict: 'approved',
      phase_review_action: 'advanced',
    }],
    // NO final_review, final_review_doc, final_review_status, or final_review_approved here
    // These fields are set by mutations (handleFinalReviewCompleted, handleFinalApproved) — not scaffolded
  },
}
```

### NEXT_ACTIONS Constants (used in assertions)

```javascript
const NEXT_ACTIONS = Object.freeze({
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
});
```

### Allowed Task Status Transitions (for crafting V12 violation tests)

```javascript
const ALLOWED_TASK_TRANSITIONS = {
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    [],
  'halted':      [],
};
```

### Validator V10 Halted Tier Behavior (CF-5)

The `checkV10` function in `validator.js` has explicit branches for `execution`, `planning`, `review`, and `complete` tiers — but **no branch for `halted`**. When `current_tier === 'halted'`, none of the `if/else if` conditions match, so `checkV10` returns `[]` (no errors). The CF-5 integration test must confirm this passthrough behavior: a state with `current_tier: 'halted'` should pass validation without false-positive V10 errors regardless of phase statuses.

## Styles & Design Tokens

Not applicable — CLI test infrastructure, no UI components.

## Test Requirements

- [ ] `createMockIO` returns an object with all 8 methods: `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories`, `getState`, `getWrites`, `getEnsureDirsCalled`
- [ ] `createMockIO` deep-clones state on `readState` (mutating the returned object does not affect subsequent `readState` calls)
- [ ] `createMockIO` deep-clones state on `writeState` (mutating the original does not affect `getState`)
- [ ] `createMockIO({ state: null })` causes `readState` to return `null`
- [ ] `createBaseState()` produces valid v3 state with `$schema: 'orchestration-state-v3'`
- [ ] `createExecutionState()` produces state in execution tier with `human_approved: true`
- [ ] `createReviewState()` produces state in review tier with NO `execution.final_review` top-level object (CF-3)
- [ ] Init path: `processEvent('start', dir, {}, io)` with no state → `success: true`, `action: 'spawn_research'`, 1 write, 1 ensureDirectories call
- [ ] Cold-start path: `processEvent('start', dir, {}, io)` with existing state → `success: true`, resolved action, 0 writes
- [ ] Standard event: `processEvent('research_completed', ...)` with valid context → `success: true`, 1 write, non-empty `mutations_applied`
- [ ] Pre-read failure: missing document → `success: false`, `action: null`, 0 writes, structured error in context
- [ ] Validation failure: illegal state transition → `success: false`, `action: null`, 0 writes, `context.violations` array present
- [ ] Unknown event: → `success: false`, `action: null`, 0 writes, error message contains event name
- [ ] `scaffoldInitialState` → v3 schema, 5 planning steps, no triage_attempts
- [ ] CF-5: halted tier state passes `validateTransition` without V10 false positives

## Acceptance Criteria

- [ ] `tests-v3/helpers/test-helpers.js` exists and exports `createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `createReviewState`
- [ ] `tests-v3/pipeline-engine.test.js` exists and contains `describe` blocks for: init path, cold-start path, standard event path, pre-read failure, validation failure, unknown event, `scaffoldInitialState`, and halted tier CF-5
- [ ] Every successful-event test asserts `io.getWrites().length === 1`
- [ ] Every failure-path test asserts `io.getWrites().length === 0`
- [ ] Every test asserts the `PipelineResult` shape (`success`, `action`, `context`, `mutations_applied` keys present)
- [ ] `createReviewState()` output does NOT include `execution.final_review` (CF-3)
- [ ] Halted-tier test confirms `validateTransition` returns no V10 errors for `current_tier: 'halted'` (CF-5)
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests-v3/` completes with zero failures (existing 278 + new engine tests)
- [ ] Build succeeds: all lib-v3 modules and test-helpers importable via `require()` without errors
- [ ] Test file uses `node:test` and `node:assert/strict` only — zero external test dependencies

## Constraints

- Do NOT modify any existing `lib-v3/` source modules — this task is test-only
- Do NOT modify any existing `tests-v3/` test files from Phase 1 or Phase 2
- Do NOT import test factories across test files — `test-helpers.js` is the sole shared module; behavioral test files (T03/T04) will duplicate factories per the project's "no cross-file factory imports" rule, but engine integration tests MAY import from the helpers file since both are in the same test scope
- Do NOT use any external test frameworks — `node:test` and `node:assert/strict` only
- Do NOT test individual module units (mutations, pre-reads, resolver, validator in isolation) — those are already covered by Phase 1/2 tests; this task tests the wired engine end-to-end
- Do NOT create mock filesystem or temp directories — use the `createMockIO` DI pattern exclusively
- Keep the `createMockIO` factory generic — it will be replicated in T03/T04 behavioral test files
