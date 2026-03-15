---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 3
task: 1
title: "Test Scaffold, Factory Functions & Happy Path"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Test Scaffold, Factory Functions & Happy Path

## Objective

Create the behavioral test file at `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` with locally-duplicated factory functions, helper utilities for multi-step scenario setup, a full single-phase single-task happy path test (start → complete), a multi-phase multi-task happy path test, and empty `describe` block placeholders for the test sections that T02–T05 will populate.

## Context

The orchestration pipeline engine (`executePipeline`) processes events against state through a linear recipe: load state → apply mutation → validate → triage (if applicable) → resolve next action → return result. Phases 1 and 2 of this project changed `readDocument` to null-return, added required-field validation for `tasks`, `has_deviations`/`deviation_type`, and `exit_criteria_met`, and removed fallback chains in the triage engine. This task creates the behavioral test scaffold that validates complete pipeline execution paths by calling `executePipeline` directly with mock IO — these are integration/behavioral tests, not unit tests of individual modules. The existing unit tests in `pipeline-engine.test.js` use factory functions (`createMockIO`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `createDefaultConfig`) that must be duplicated locally in this file to avoid cross-file coupling.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | New behavioral test file — single file for all behavioral tests |

## Implementation Steps

1. **Create the file** with `'use strict'` and imports: `describe`, `it`, `beforeEach` from `node:test`; `assert` from `node:assert/strict`; `executePipeline` from `../lib/pipeline-engine`; all needed constants from `../lib/constants` (`NEXT_ACTIONS`, `PIPELINE_TIERS`, `TASK_STATUSES`, `PHASE_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`).

2. **Duplicate factory functions locally** — copy these functions into the file (do NOT import from `pipeline-engine.test.js`):

   - `createMockIO(opts)` — creates mock `PipelineIO` with in-memory state, config, and documents. Signature:
     ```javascript
     function createMockIO(opts = {}) {
       let currentState = opts.state !== undefined ? opts.state : null;
       const config = opts.config || createDefaultConfig();
       const documents = opts.documents || {};
       const writes = [];
       let ensureDirsCalled = 0;
       return {
         readState(projectDir) {
           if (currentState === null) return null;
           return JSON.parse(JSON.stringify(currentState));
         },
         writeState(projectDir, state) {
           const snapshot = JSON.parse(JSON.stringify(state));
           currentState = snapshot;
           writes.push(JSON.parse(JSON.stringify(snapshot)));
         },
         readConfig(configPath) {
           return JSON.parse(JSON.stringify(config));
         },
         readDocument(docPath) {
           const doc = documents[docPath];
           if (!doc) return null;
           return JSON.parse(JSON.stringify(doc));
         },
         ensureDirectories(projectDir) { ensureDirsCalled++; },
         getState() { return currentState; },
         getWrites() { return writes; },
         getEnsureDirsCalled() { return ensureDirsCalled; }
       };
     }
     ```

   - `createDefaultConfig()` — returns a config object:
     ```javascript
     function createDefaultConfig(overrides = {}) {
       return {
         limits: {
           max_phases: 10,
           max_tasks_per_phase: 8,
           max_retries_per_task: 2,
           max_consecutive_review_rejections: 3
         },
         human_gates: {
           after_planning: true,
           execution_mode: 'ask',
           after_final_review: true
         },
         errors: {
           severity: { critical: [], minor: [] },
           on_critical: 'halt',
           on_minor: 'retry'
         },
         projects: {
           base_path: '.github/projects',
           naming: 'SCREAMING_CASE'
         },
         ...overrides
       };
     }
     ```

   - `createBaseState(overrides)` — returns a minimal valid `state.json` object with planning not started, execution not started, and standard limits. Apply overrides via shallow merge or callback.

   - `createExecutionState(mutator)` — returns a state at execution tier with planning complete + human approved, 1 phase with 1 task, all planning steps complete with output docs. Accepts optional mutator callback.

   - `makeRequest(event, context)` — returns `{ event, projectDir: '/test/project', configPath: '/test/orchestration.yml', context }`.

   - `withStrictDates(fn)` — monkey-patches `Date` so each `new Date()` yields a strictly increasing ms value, avoiding V13 timestamp validation collisions:
     ```javascript
     function withStrictDates(fn) {
       const _Orig = Date;
       let _tick = _Orig.now();
       global.Date = class extends _Orig {
         constructor(...args) { if (args.length === 0) super(_tick++); else super(...args); }
         static now() { return _tick++; }
         static parse(s) { return _Orig.parse(s); }
         static UTC(...a) { return _Orig.UTC(...a); }
       };
       try { return fn(); } finally { global.Date = _Orig; }
     }
     ```

3. **Create a helper function `advancePipeline(io, events)`** that takes a mock IO and an array of `{ event, context }` objects, calls `executePipeline(makeRequest(event, context), io)` for each in sequence, and returns the array of results. This enables multi-step scenario setup by replaying a sequence of events. It should assert `result.success === true` for each intermediate step and throw if any fails (fail-fast for test setup).

4. **Write the `describe("Behavioral: Full Happy Path")` block** — a single test that walks through the complete single-phase single-task pipeline lifecycle by calling `executePipeline` repeatedly:
   - Step 1: `start` event (no state) → expect `spawn_research`
   - Step 2: `research_completed` with `{ doc_path: 'RESEARCH.md' }` → expect `spawn_prd`
   - Step 3: `prd_completed` with `{ doc_path: 'PRD.md' }` → expect `spawn_design`
   - Step 4: `design_completed` with `{ doc_path: 'DESIGN.md' }` → expect `spawn_architecture`
   - Step 5: `architecture_completed` with `{ doc_path: 'ARCHITECTURE.md' }` → expect `spawn_master_plan`
   - Step 6: `master_plan_completed` with `{ doc_path: 'MASTER-PLAN.md' }` → expect `request_plan_approval`
   - Step 7: `plan_approved` → expect `create_phase_plan`. The mock IO must have a master plan document at `MASTER-PLAN.md` (and/or the project-relative path `.github/projects/TEST/MASTER-PLAN.md`) with frontmatter `{ total_phases: 1 }`. The `plan_approved` pre-read reads this doc.
   - Step 8: `phase_plan_created` with `{ plan_path: 'phases/PHASE-01.md', phase_plan_path: 'phases/PHASE-01.md' }` → expect `create_task_handoff`. The mock IO must have a phase plan document at the path with frontmatter `{ tasks: [{ id: 'T01-TEST', title: 'Test Task' }] }`.
   - Step 9: `task_handoff_created` with `{ handoff_path: 'tasks/TASK-01.md' }` → expect `execute_task`
   - Step 10: `task_completed` with `{ report_path: 'reports/TASK-REPORT-01.md' }` → expect `spawn_code_reviewer`. The mock IO must have a task report document with frontmatter `{ status: 'complete', has_deviations: false, deviation_type: null }`. This event triggers task-level triage (Row 1: complete, no deviations, no review → auto-approve → `advance_task` internal action → task index exceeds task count → phase lifecycle → `generate_phase_report`). Wait — triage reads the task report and since `review_doc` is null at this point, Row 1 matches (complete, no deviations, no review → skip triage → `applyTaskTriage` auto-approves → task status = complete, review_verdict = approved, review_action = advanced). Then resolver advances task (internal action) → `current_task` becomes 1 → exceeds `tasks.length` (1) → phase lifecycle → no phase_report → `generate_phase_report`. So the expected action is `generate_phase_report`.
   - Step 11: `phase_report_created` with `{ report_path: 'reports/PHASE-REPORT-01.md' }` → expect `spawn_phase_reviewer`
   - Step 12: `phase_review_completed` with `{ review_path: 'reviews/PHASE-REVIEW-01.md' }` → triggers phase-level triage. The mock IO must have a phase review document with frontmatter `{ verdict: 'approved', exit_criteria_met: true }`. Phase Row 2 matches (approved, all exit criteria met → advance). Then `applyPhaseTriage` sets `phase_review_verdict = approved`, `phase_review_action = advanced`. Resolver sees approved verdict → `advance_phase` (internal) → last phase → `pipeline.current_tier = review` → `spawn_final_reviewer`. Expected action: `spawn_final_reviewer`.
   - Step 13: `final_review_completed` with `{ review_path: 'reviews/FINAL-REVIEW.md' }` → expect `request_final_approval`
   - Step 14: `final_approved` → expect `display_complete`
   - **Assertions**: Verify `result.success === true` at every step. Verify `result.action` matches expected action at every step. At the end, verify the final state has `pipeline.current_tier === 'complete'`, `final_review.human_approved === true`.
   - **Wrap the entire test body in `withStrictDates()`** to avoid V13 collisions on triage + internal action loops.

5. **Write the `describe("Behavioral: Multi-Phase Multi-Task")` block** — a test with ≥2 phases × ≥2 tasks:
   - Use `total_phases: 2` in the master plan frontmatter.
   - Phase 1 has 2 tasks, Phase 2 has 2 tasks (set via `phase_plan_created` frontmatter `tasks` arrays).
   - Walk through the full lifecycle for both phases: phase plan → task handoff → task completed → (triage auto-approves, advance_task internal action) → second task handoff → second task completed → (triage auto-approves, advance_task → phase lifecycle) → phase report → phase review → (triage advance_phase internal action) → second phase plan → repeat → final review → approved → complete.
   - **Assertions**: Verify `current_phase` increments correctly (0 → 1 after phase 1 advance). Verify all 4 tasks are processed. Verify final state reaches `pipeline.current_tier === 'complete'`.
   - **Wrap in `withStrictDates()`**.

6. **Add empty `describe` placeholders** for T02–T05 sections (these will be populated by subsequent tasks):
   - `describe('Behavioral: Task Triage', () => { /* T02: Rows 1-11 */ });`
   - `describe('Behavioral: Phase Triage', () => { /* T03: Rows 1-5 */ });`
   - `describe('Behavioral: Human Gate Modes', () => { /* T04 */ });`
   - `describe('Behavioral: Retry & Corrective Cycles', () => { /* T04 */ });`
   - `describe('Behavioral: Halt Paths', () => { /* T04 */ });`
   - `describe('Behavioral: Cold-Start Resume', () => { /* T05 */ });`
   - `describe('Behavioral: Pre-Read Failures', () => { /* T05 */ });`
   - `describe('Behavioral: Frontmatter-Driven Flows', () => { /* T05 */ });`

7. **Verify** the file runs with `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` and all tests pass. Also verify existing tests still pass.

## Contracts & Interfaces

### `executePipeline` — Function Under Test

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

/**
 * @param {PipelineRequest} request - { event, projectDir, configPath?, context? }
 * @param {PipelineIO} io - { readState, writeState, readConfig, readDocument, ensureDirectories }
 * @returns {PipelineResultSuccess|PipelineResultError}
 */
function executePipeline(request, io) { ... }
```

**PipelineRequest**:
```javascript
{
  event: string,           // e.g., 'start', 'research_completed', 'task_completed'
  projectDir: string,      // e.g., '/test/project'
  configPath: string,      // e.g., '/test/orchestration.yml'
  context: Object          // Event-specific context (doc_path, report_path, etc.)
}
```

**PipelineResultSuccess**:
```javascript
{
  success: true,
  action: string,          // One of NEXT_ACTIONS (e.g., 'spawn_research', 'display_complete')
  context: Object,         // { tier, phase_index, task_index, phase_id, task_id, details }
  mutations_applied: string[],
  triage_ran: boolean,
  validation_passed: boolean
}
```

**PipelineResultError**:
```javascript
{
  success: false,
  error: string,           // Human-readable error message
  event: string|null,
  state_snapshot: Object|null,
  mutations_applied: string[],
  validation_passed: boolean|null
}
```

### PipelineIO Interface (Mock)

```javascript
{
  readState(projectDir: string): Object|null,
  writeState(projectDir: string, state: Object): void,
  readConfig(configPath: string): Object,
  readDocument(docPath: string): { frontmatter: Object, body: string }|null,
  ensureDirectories(projectDir: string): void
}
```

### Event → Pre-Read → Document Requirements

| Event | Pre-Read | Document Path Source | Required Frontmatter |
|-------|----------|---------------------|---------------------|
| `plan_approved` | Master plan | `state.planning.steps.master_plan.output` | `{ total_phases: <integer> }` |
| `phase_plan_created` | Phase plan | `context.phase_plan_path` | `{ tasks: [{ id: string, title: string }, ...] }` (non-empty) |
| `task_completed` | Task report | `context.report_path` | `{ status: 'complete'|'partial'|'failed', has_deviations: boolean, deviation_type: string|null }` |
| `phase_review_completed` | Phase review | triage reads `phase.phase_review` from state | `{ verdict: 'approved'|'changes_requested'|'rejected', exit_criteria_met: boolean }` |

### Triage Behavior Summary (for Happy Path)

**Task-level triage** (triggered by `task_completed` or `code_review_completed`):
- Row 1: `status=complete`, `has_deviations=false`, no `review_doc` → verdict=null, action=null → `applyTaskTriage` auto-approves (sets `review_verdict=approved`, `review_action=advanced`, `status=complete`)

**Phase-level triage** (triggered by `phase_review_completed`):
- Row 2: `verdict=approved`, `exit_criteria_met=true` → `PHASE_REVIEW_ACTIONS.ADVANCED` → `applyPhaseTriage` sets `phase_review_verdict=approved`, `phase_review_action=advanced`

### Internal Action Handling

After triage and resolve, `executePipeline` may execute internal actions in a loop (max 2 iterations):
- `advance_task`: increments `phase.current_task` by 1
- `advance_phase`: marks current phase as `complete`; if last phase → `current_tier = review`, else increments `current_phase`

Each internal action re-validates and re-writes state with a strictly increasing timestamp.

### Constants Used for Assertions

```javascript
const NEXT_ACTIONS = {
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
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  DISPLAY_COMPLETE: 'display_complete',
  DISPLAY_HALTED: 'display_halted',
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  ADVANCE_TASK: 'advance_task',        // internal
  ADVANCE_PHASE: 'advance_phase'       // internal
};

const PIPELINE_TIERS = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted'
};
```

## Styles & Design Tokens

Not applicable — no visual interface.

## Test Requirements

- [ ] `describe("Behavioral: Full Happy Path")` contains at least one `it(...)` test that walks through all 14 pipeline steps from `start` → `display_complete`
- [ ] The happy path test asserts `result.success === true` and `result.action` at every step
- [ ] The happy path test verifies final state: `pipeline.current_tier === 'complete'`, `final_review.human_approved === true`
- [ ] `describe("Behavioral: Multi-Phase Multi-Task")` contains at least one `it(...)` test with ≥2 phases × ≥2 tasks
- [ ] The multi-phase test verifies `execution.current_phase` increments correctly after phase advancement
- [ ] The multi-phase test verifies final state reaches `pipeline.current_tier === 'complete'`
- [ ] All triage-triggering steps are wrapped in `withStrictDates()` to prevent V13 collisions
- [ ] The file runs cleanly with `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- [ ] All existing tests continue to pass (`node --test` from repository root)

## Acceptance Criteria

- [ ] File exists at `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`
- [ ] File uses `node:test` (`describe`, `it`) and `node:assert/strict` — no external dependencies
- [ ] Factory functions (`createMockIO`, `createDefaultConfig`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`) are defined locally in the file, not imported from other test files
- [ ] `advancePipeline` helper function exists for multi-step scenario setup
- [ ] Happy path test passes: 14-step single-phase single-task lifecycle start → display_complete
- [ ] Multi-phase multi-task test passes: ≥2 phases × ≥2 tasks, verifies phase advancement and completion
- [ ] Empty `describe` placeholders exist for: Task Triage, Phase Triage, Human Gate Modes, Retry & Corrective Cycles, Halt Paths, Cold-Start Resume, Pre-Read Failures, Frontmatter-Driven Flows
- [ ] All tests pass with `node --test`
- [ ] Build succeeds
- [ ] No lint errors

## Constraints

- Do NOT import factory functions from `pipeline-engine.test.js` — duplicate them locally to avoid cross-file coupling
- Do NOT test individual modules (mutations, resolver, triage) directly — call ONLY `executePipeline` for all behavioral tests
- Do NOT add external test dependencies — use only `node:test` and `node:assert/strict`
- Do NOT modify any existing files — this task creates one new file only
- Do NOT implement tests for T02–T05 sections (task triage rows, phase triage rows, gates, retries, halts, resume, pre-reads, frontmatter flows) — leave those as empty `describe` placeholders
- All mock documents returned by `readDocument` must use the `{ frontmatter: {...}, body: '...' }` shape
- The `plan_approved` pre-read resolves the master plan path via `createProjectAwareReader`, which tries the path as-is first, then falls back to `path.join(projectDir, path)`. Stock the mock IO documents under both the direct path and the project-relative path (e.g., `'MASTER-PLAN.md'` AND `'/test/project/MASTER-PLAN.md'`) to ensure the pre-read succeeds regardless of which resolution path fires
- The `phase_plan_created` pre-read also uses `createProjectAwareReader` — apply the same dual-path stocking for phase plan documents
- Use `autonomous` gate mode in the default config for happy path tests (set `human_gates.execution_mode: 'autonomous'`) so the pipeline auto-advances without gate actions
