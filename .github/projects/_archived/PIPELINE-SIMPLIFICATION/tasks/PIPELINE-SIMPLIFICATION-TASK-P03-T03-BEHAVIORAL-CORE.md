---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
task: 3
title: "BEHAVIORAL-CORE"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 1
---

# Behavioral Tests — Core Flows

## Objective

Create `tests-v3/pipeline-behavioral.test.js` — the end-to-end behavioral test suite covering the first 5 of 10 scenario categories: full happy path, multi-phase/multi-task flows, cold-start resume, pre-read validation failures, and phase lifecycle. Each test drives events through `processEvent()` sequentially, asserting on action and state after each call, and verifies the 1-write-per-event invariant.

## Context

The pipeline engine (`lib-v3/pipeline-engine.js`) wires six modules into a single `processEvent` function. Integration tests (T02) validated each engine path in isolation — init, cold-start, standard event, pre-read failure, validation failure, unknown event. Behavioral tests validate multi-event sequences that exercise the full planning→execution→review→complete lifecycle. Shared test infrastructure (`test-helpers.js`) provides `createMockIO`, state factories, and `processAndAssert`. V13 timestamp workaround: the engine does not bump `project.updated` between mutation and validation, so initial states must omit or backdate `project.updated` to prevent V13 false positives on standard event success paths.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js` | Behavioral test suite — categories 1–5 |

## Implementation Steps

1. **Set up imports**: Import `{ describe, it }` from `node:test`, `assert` from `node:assert/strict`, `{ processEvent }` from `../../lib-v3/pipeline-engine`, and `{ createMockIO, createBaseState, createExecutionState, createReviewState, createDefaultConfig, deepClone }` from `./helpers/test-helpers`.

2. **Implement V13 timestamp helper**: Create a local `backdateTimestamp(state)` function that sets `state.project.updated` to a past ISO timestamp (e.g., `'2020-01-01T00:00:00.000Z'`). Apply this to all initial states passed to `createMockIO` before driving standard events, so the engine's proposed state (with an identical unmodified timestamp) does not trigger V13 monotonicity violations. The init path does not need this (it scaffolds fresh state). Cold-start tests do not need this (no write occurs).

3. **Implement document factory**: Create a local `makeDoc(frontmatter)` helper that returns `{ frontmatter, body: '' }`. Use this to populate the `documents` map in `createMockIO` for events that require pre-reads.

4. **Category 1 — Full happy path**: Write a `describe('Category 1: Full happy path')` block that drives a single-phase, single-task project from init through completion. Use a shared `createMockIO({ state: null })` across sequential `it` blocks. Each `it` calls `processEvent` once, asserts `result.success === true`, asserts the expected `result.action`, and asserts that `io.getWrites().length` increased by exactly 1 from the prior count. See the Event Sequence Table below for the 15-event sequence and expected actions.

5. **Category 2 — Multi-phase, multi-task**: Write a `describe('Category 2: Multi-phase multi-task')` block. Set up a state where `plan_approved` has already fired with `total_phases: 2`. Drive events through phase 1 (2 tasks: plan → handoff → complete → review → handoff → complete → review → report → phase review), then through phase 2 (1 task: plan → handoff → complete → review → report → phase review), then final review → complete. Verify: pointer advances (`execution.current_phase`), phase status transitions, tier transitions (`execution → review → complete`). Each `it` block: 1 `processEvent` call, 1-write assertion.

6. **Category 3 — Cold-start resume**: Write a `describe('Category 3: Cold-start resume')` block with one `it` per resume scenario. For each: create state at a specific pipeline point, create `io = createMockIO({ state })`, call `processEvent('start', ...)`, assert `result.success === true`, `io.getWrites().length === 0`, `result.mutations_applied.length === 0`, and the correct resolved action. Cover these resume points: (a) planning tier, research not started → `spawn_research`; (b) planning complete, not approved → `request_plan_approval`; (c) execution tier, phase not started → `create_phase_plan`; (d) execution tier, task not started → `create_task_handoff`; (e) review tier, no final review → `spawn_final_reviewer`.

7. **Category 4 — Pre-read validation failures**: Write a `describe('Category 4: Pre-read validation failures')` block. For each of the 5 pre-read events, create an `it` block that provides a malformed document (missing or invalid required frontmatter field). Assert `result.success === false`, `result.action === null`, `io.getWrites().length === 0`, and that `result.context` contains a structured error with the `event` name and the missing `field`. Test these 5 events: `plan_approved` (missing `total_phases`), `task_completed` (missing `status`), `code_review_completed` (missing `verdict`), `phase_plan_created` (empty `tasks` array), `phase_review_completed` (missing `exit_criteria_met`).

8. **Category 5 — Phase lifecycle**: Write a `describe('Category 5: Phase lifecycle')` block that drives a full phase lifecycle: `phase_plan_created` → `task_handoff_created` → `task_completed` → `code_review_completed` (approved) → `phase_report_created` → `phase_review_completed` (approved) → verify phase status is `complete` and `phase_review_action` is `advanced`. Start from a state in execution tier with 2 phases (phase 1 ready for planning). After phase 1 completes, verify `execution.current_phase` advances to 1 and phase 2 status transitions appropriately. Each `it`: 1 `processEvent`, 1-write assertion.

9. **Verify all tests pass**: Run `node --test .github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js` and confirm zero failures. Then run the full suite: `node --test .github/orchestration/scripts/tests-v3/` and confirm zero regressions across all existing test files.

10. **Handle engine discrepancies**: If any `processEvent` call produces an unexpected action or result that differs from the expected behavior described below (e.g., `display_halted` instead of the expected action), investigate the root cause, document the finding as a deviation with a code comment in the test, and adjust the assertion to match the actual engine behavior. Do not modify any `lib-v3/` source files.

## Contracts & Interfaces

### processEvent — Engine Entry Point

```javascript
// .github/orchestration/scripts/lib-v3/pipeline-engine.js

/**
 * @param {string} event - pipeline event name
 * @param {string} projectDir - absolute path to project directory
 * @param {Object} context - event-specific context from Orchestrator
 * @param {PipelineIO} io - dependency-injected I/O (use createMockIO in tests)
 * @param {string} [configPath] - path to orchestration.yml
 * @returns {PipelineResult}
 */
function processEvent(event, projectDir, context, io, configPath) { /* ... */ }
```

### PipelineResult — Engine Output Contract

```javascript
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error on failure
 * @property {string[]} mutations_applied - human-readable descriptions; empty on failure
 */
```

### MockIO — Test I/O Interface

```javascript
/**
 * createMockIO({ state?, documents?, config? }) → MockIO
 *
 * MockIO methods:
 *   readState(projectDir)       → deep clone of state or null
 *   writeState(projectDir, s)   → captures snapshot into writes array; updates currentState
 *   readConfig(configPath)      → deep clone of config (defaults to createDefaultConfig())
 *   readDocument(docPath)       → looks up in documents map; deep clone or null
 *   ensureDirectories(pDir)     → no-op counter
 *   getState()                  → current state after latest write
 *   getWrites()                 → array of all state snapshots written (cumulative)
 *   getEnsureDirsCalled()       → call count
 */
```

### NEXT_ACTIONS — External Action Constants

```javascript
// Planning (6)
'spawn_research', 'spawn_prd', 'spawn_design', 'spawn_architecture',
'spawn_master_plan', 'request_plan_approval'

// Execution — Task (4)
'create_phase_plan', 'create_task_handoff', 'execute_task', 'spawn_code_reviewer'

// Execution — Phase (2)
'generate_phase_report', 'spawn_phase_reviewer'

// Gates (2)
'gate_task', 'gate_phase'

// Review (2)
'spawn_final_reviewer', 'request_final_approval'

// Terminal (2)
'display_halted', 'display_complete'
```

### Pre-Read Event Contracts (5 events requiring document validation)

| Event | Required Frontmatter Fields | Enriched Context Keys |
|-------|----------------------------|-----------------------|
| `plan_approved` | `total_phases` (positive integer) | `{ total_phases }` |
| `task_completed` | `status`, `has_deviations`, `deviation_type` | `{ report_status, has_deviations, deviation_type }` |
| `code_review_completed` | `verdict` | `{ verdict, review_doc_path }` |
| `phase_plan_created` | `tasks` (non-empty array) | `{ tasks }` |
| `phase_review_completed` | `verdict`, `exit_criteria_met` | `{ verdict, exit_criteria_met, review_doc_path }` |

Events not in this table pass through with unmodified context (no pre-read needed).

### Task Decision Table (relevant rows for happy path)

| Verdict | Report Status | Retries Left | → Task Status | → Review Action |
|---------|--------------|-------------|---------------|----------------|
| `approved` | `complete` | — | `complete` | `advanced` |

When `reviewAction === 'advanced'`: mutation bumps `phase.current_task += 1` (pointer advance within same mutation).

### Phase Decision Table (relevant rows for happy path / lifecycle)

| Verdict | Exit Criteria Met | → Phase Status | → Phase Review Action |
|---------|-------------------|----------------|----------------------|
| `approved` | `true` | `complete` | `advanced` |
| `approved` | `false` | `complete` | `advanced` |

When `phaseReviewAction === 'advanced'` and more phases remain: mutation bumps `execution.current_phase += 1`.
When `phaseReviewAction === 'advanced'` and last phase: mutation sets `execution.status = 'complete'`, `execution.current_tier = 'review'`.

### State Schema — Key Shapes

```javascript
// Task object shape (from handlePhasePlanCreated)
{
  name: 'T01',
  status: 'not_started',
  handoff_doc: null,
  report_doc: null,
  review_doc: null,
  review_verdict: null,
  review_action: null,
  has_deviations: false,
  deviation_type: null,
  retries: 0,
  report_status: null,
}

// Phase object shape (from handlePlanApproved)
{
  name: 'Phase 1',
  status: 'not_started',
  current_task: 0,
  total_tasks: 0,
  tasks: [],
  phase_plan_doc: null,
  phase_report_doc: null,
  phase_review_doc: null,
  phase_review_verdict: null,
  phase_review_action: null,
}
```

### Mutation Behavior Summary (for behavioral sequences)

| Event | Key State Changes | Notes |
|-------|-------------------|-------|
| `research_completed` | `planning.steps[0].status → complete`, `doc_path` set | Same pattern for prd, design, architecture |
| `master_plan_completed` | Steps complete + `planning.status → complete` | |
| `plan_approved` | `human_approved → true`, `current_tier → execution`, phases scaffolded | Pre-read extracts `total_phases` from document |
| `phase_plan_created` | `phase.status → in_progress`, tasks array populated | Pre-read extracts `tasks` array from document |
| `task_handoff_created` | `task.handoff_doc` set, `task.status → in_progress` | |
| `task_completed` | `task.report_doc` set, `report_status`, deviations recorded | Status stays in_progress (task finalization is at review) |
| `code_review_completed` | `task.review_doc`, `review_verdict`, `review_action` set; decision table applied | If `advanced`: `phase.current_task += 1` |
| `phase_report_created` | `phase.phase_report_doc` set | |
| `phase_review_completed` | `phase.phase_review_doc`, `phase_review_verdict`, `phase_review_action` set | If last phase + `advanced`: tier → `review` |
| `final_review_completed` | `execution.final_review_doc`, `final_review_status` set | |
| `final_approved` | `execution.final_review_approved → true`, tier → `complete` | |

## Event Sequence Table — Category 1 Happy Path

This is the full 15-event sequence for a single-phase, single-task project from init to completion. Each row is one `processEvent` call and one `it` block.

| # | Event | Context | Expected Action | Write # |
|---|-------|---------|-----------------|---------|
| 1 | `start` | `{}` (no state) | `spawn_research` | 1 |
| 2 | `research_completed` | `{ doc_path: 'research.md' }` | `spawn_prd` | 2 |
| 3 | `prd_completed` | `{ doc_path: 'prd.md' }` | `spawn_design` | 3 |
| 4 | `design_completed` | `{ doc_path: 'design.md' }` | `spawn_architecture` | 4 |
| 5 | `architecture_completed` | `{ doc_path: 'arch.md' }` | `spawn_master_plan` | 5 |
| 6 | `master_plan_completed` | `{ doc_path: 'mp.md' }` | `request_plan_approval` | 6 |
| 7 | `plan_approved` | `{ doc_path: 'mp.md' }` | `create_phase_plan` | 7 |
| 8 | `phase_plan_created` | `{ doc_path: 'pp.md' }` | `create_task_handoff` | 8 |
| 9 | `task_handoff_created` | `{ doc_path: 'th.md' }` | `execute_task` | 9 |
| 10 | `task_completed` | `{ doc_path: 'tr.md' }` | `spawn_code_reviewer` | 10 |
| 11 | `code_review_completed` | `{ doc_path: 'cr.md' }` | `generate_phase_report` | 11 |
| 12 | `phase_report_created` | `{ doc_path: 'pr.md' }` | `spawn_phase_reviewer` | 12 |
| 13 | `phase_review_completed` | `{ doc_path: 'prv.md' }` | `spawn_final_reviewer` | 13 |
| 14 | `final_review_completed` | `{ doc_path: 'fr.md' }` | `request_final_approval` | 14 |
| 15 | `final_approved` | `{}` | `display_complete` | 15 |

**Document setup**: Events 7, 8, 10, 11, 13 require pre-reads. Populate the `documents` map in `createMockIO` with `makeDoc(frontmatter)` entries at the corresponding `doc_path` keys:
- `'mp.md'` → `{ total_phases: 1 }` (for step 7)
- `'pp.md'` → `{ tasks: ['T01'] }` (for step 8)
- `'tr.md'` → `{ status: 'complete', has_deviations: false, deviation_type: null }` (for step 10)
- `'cr.md'` → `{ verdict: 'approved' }` (for step 11)
- `'prv.md'` → `{ verdict: 'approved', exit_criteria_met: true }` (for step 13)

**V13 note**: The init path (step 1) scaffolds fresh state, so V13 is not an issue. Steps 2–15 build on the written state iteratively via the shared io; the engine reads the latest written state via `io.readState()`. Because the engine does not bump `project.updated` before validation, every standard-path event would trigger V13. Workaround: after step 1 completes, backdate `project.updated` in the io's current state (e.g., via a write with modified timestamp), OR accept that the test will hit V13 validation failures and adjust approach accordingly.

## Styles & Design Tokens

Not applicable — CLI test suite, no UI components.

## Test Requirements

- [ ] **Category 1**: Full happy path — 15 `it` blocks covering `start` through `display_complete` for a single-phase, single-task project
- [ ] **Category 2**: Multi-phase, multi-task — at least 1 test driving 2+ phases with 2+ tasks in phase 1; verify `execution.current_phase` advances, phase status transitions, tier transitions through `execution → review → complete`
- [ ] **Category 3**: Cold-start resume — at least 5 `it` blocks testing `start` event with existing state at different pipeline points (planning, execution, review); verify 0 writes and correct resolved action per state
- [ ] **Category 4**: Pre-read validation failures — 5 `it` blocks, one per pre-read event, each with a malformed document; verify `success: false`, `action: null`, 0 writes, structured error with `event` and `field`
- [ ] **Category 5**: Phase lifecycle — at least 1 test driving a full phase lifecycle from `phase_plan_created` through `phase_review_completed`; verify phase status transitions and pointer advances
- [ ] Every successful standard event test asserts `io.getWrites().length` increased by exactly 1
- [ ] Every failure path test asserts `io.getWrites().length === 0` (or unchanged from prior count)
- [ ] Every test asserts `result.success` is the expected boolean
- [ ] All tests use `node:test` + `node:assert/strict` only — zero external dependencies

## Acceptance Criteria

- [ ] File `tests-v3/pipeline-behavioral.test.js` exists at `.github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js`
- [ ] Category 1 (happy path) has ≥15 tests covering every event from init to display_complete
- [ ] Category 2 (multi-phase/multi-task) has ≥1 test with 2+ phases AND 2+ tasks per phase
- [ ] Category 3 (cold-start resume) has ≥5 tests covering planning, execution, and review tier resume points
- [ ] Category 4 (pre-read failures) has ≥5 tests covering all 5 pre-read events with malformed documents
- [ ] Category 5 (phase lifecycle) has ≥1 test driving full phase lifecycle with pointer advance verification
- [ ] Every successful standard event test verifies exactly 1 additional write (`io.getWrites().length` increments by 1)
- [ ] Every failure path test verifies 0 additional writes
- [ ] Cold-start tests verify `io.getWrites().length === 0` and `result.mutations_applied.length === 0`
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests-v3/pipeline-behavioral.test.js` exits with 0 failures
- [ ] Full test suite passes: `node --test .github/orchestration/scripts/tests-v3/` exits with 0 failures (zero regressions against Phase 1 + Phase 2 + Phase 3 T01/T02 tests)
- [ ] Build succeeds: all lib-v3 modules and the new test file are loadable via `require()` without errors

## Constraints

- Do NOT modify any `lib-v3/` source module (`pipeline-engine.js`, `mutations.js`, `pre-reads.js`, `resolver.js`, `validator.js`, `constants.js`, `state-io.js`)
- Do NOT modify `tests-v3/helpers/test-helpers.js` or any existing test file
- Use `node:test` and `node:assert/strict` only — zero external test frameworks or assertion libraries
- Do NOT add configuration files, linter configs, or package.json changes
- If the engine produces unexpected behavior (e.g., resolver returns `display_halted` for a state that should produce a normal action), document the discrepancy with a `// DEVIATION:` comment in the test, adjust the assertion to match actual engine behavior, and report the finding in the task report
- Each `it` block must contain exactly one `processEvent` call — no multi-event assertions within a single test
- All state factory values and document frontmatter must use concrete values — no mocks, no stubs, no test-doubles beyond `createMockIO`
