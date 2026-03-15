---
project: "TRANSITION-TABLE"
author: "research-agent"
created: "2026-03-15T00:00:00.000Z"
---

# TRANSITION-TABLE — Research Findings

## Research Scope

Investigated the pipeline engine codebase under `.github/orchestration/scripts/` to document the full structure of the routing layer targeted for refactoring: `resolver.js`, `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `constants.js`, `validator.js`, test helpers, and the behavioral test suite. Also analyzed downstream project brainstorming documents (`PARALLEL-EXECUTION`, `CUSTOM-PIPELINE-STEP`) to understand the table shape requirements they impose.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| resolver.js | `.github/orchestration/scripts/lib/resolver.js` | **Primary refactor target.** Contains `PLANNING_STEP_ORDER`, all if/else routing logic, and the `resolveNextAction` export. ~320 lines. |
| mutations.js | `.github/orchestration/scripts/lib/mutations.js` | Contains mutation handlers keyed by event name, `resolveTaskOutcome` / `resolvePhaseOutcome` decision tables, and the `getMutation` export. ~370 lines. |
| pipeline-engine.js | `.github/orchestration/scripts/lib/pipeline-engine.js` | Contains `processEvent()` linear recipe and `scaffoldInitialState()`. Public API that must not change. ~150 lines. |
| pre-reads.js | `.github/orchestration/scripts/lib/pre-reads.js` | Per-event pre-read validation handlers keyed by event name. Independent of resolver — shares event keys only. ~130 lines. |
| constants.js | `.github/orchestration/scripts/lib/constants.js` | All frozen enums: `PIPELINE_TIERS`, `NEXT_ACTIONS`, status enums, transition maps, JSDoc typedefs. ~250 lines. |
| validator.js | `.github/orchestration/scripts/lib/validator.js` | 13 validation invariants (V1–V13). Structural + transition checks. ~220 lines. |
| state-io.js | `.github/orchestration/scripts/lib/state-io.js` | Real I/O layer (filesystem reads/writes). Not modified by this project. ~100 lines. |
| pipeline.js | `.github/orchestration/scripts/pipeline.js` | CLI entry point. Parses args, wires real I/O, calls `processEvent()`. Not modified. ~50 lines. |
| test-helpers.js | `.github/orchestration/scripts/tests/helpers/test-helpers.js` | Mock I/O factory, state factories, `processAndAssert` helper. ~230 lines. |
| pipeline-behavioral.test.js | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | 11-category acceptance test. **Must pass unmodified.** ~1000 lines. |

### File: `resolver.js` — Full Structure

#### Constants & Imports

```js
const { PIPELINE_TIERS, PLANNING_STEP_STATUSES, PHASE_STATUSES, TASK_STATUSES,
        REVIEW_ACTIONS, PHASE_REVIEW_ACTIONS, HUMAN_GATE_MODES, NEXT_ACTIONS } = require('./constants');
```

#### `PLANNING_STEP_ORDER` (lines 12–18)

```js
const PLANNING_STEP_ORDER = [
  { key: 'research',     action: NEXT_ACTIONS.SPAWN_RESEARCH },
  { key: 'prd',          action: NEXT_ACTIONS.SPAWN_PRD },
  { key: 'design',       action: NEXT_ACTIONS.SPAWN_DESIGN },
  { key: 'architecture', action: NEXT_ACTIONS.SPAWN_ARCHITECTURE },
  { key: 'master_plan',  action: NEXT_ACTIONS.SPAWN_MASTER_PLAN },
];
```

Current shape: `{ key: string, action: string }`. The brainstorming doc extends this to include `event` (completion event), `doc_type`, and pre-read requirements.

#### Helper Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `formatPhaseId` | `(phaseIndex: number) => string` | Returns `P01`, `P02`, etc. |
| `formatTaskId` | `(phaseIndex: number, taskIndex: number) => string` | Returns `P01-T01`, etc. |
| `halted` | `(details: string) => { action, context }` | Returns `{ action: NEXT_ACTIONS.DISPLAY_HALTED, context: { details } }` |

#### `resolvePlanning(state)` — Planning Tier Resolution

- Builds a `Map` of step name → step object from `state.planning.steps`
- Iterates `PLANNING_STEP_ORDER` in order
- For each step: if missing or status !== `COMPLETE`, returns `{ action, context: { step: key } }`
- If all steps complete and `!state.planning.human_approved` → returns `REQUEST_PLAN_APPROVAL`
- Else → `halted('Unreachable: planning approved but no step incomplete')`

**This is already data-driven** — it iterates a table. The refactor enriches the table with more columns.

#### `resolveExecution(state, config)` — Execution Tier Entry

- Gets `current_phase` index and phase object
- Checks phase status:
  - `HALTED` → halted
  - `NOT_STARTED` → `CREATE_PHASE_PLAN`
  - `IN_PROGRESS` → delegates to `resolvePhaseInProgress(phase, phaseIndex, config)`
  - Other → halted

#### `resolvePhaseInProgress(phase, phaseIndex, config)`

- If `current_task >= total_tasks` → delegates to `resolvePhaseCompletion(phase, phaseIndex, config)`
- Else → gets task at `current_task`, delegates to `resolveTask(task, phase, phaseIndex, taskIndex, config)`

#### `resolveTask(task, phase, phaseIndex, taskIndex, config)` — Task Lifecycle (5 conditions + fallback)

| # | Condition | Action Returned | Context Fields |
|---|-----------|-----------------|----------------|
| 1 | `status === HALTED` | `DISPLAY_HALTED` | `details` |
| 2 | `status === FAILED && review_action === CORRECTIVE_TASK_ISSUED` | `CREATE_TASK_HANDOFF` | `is_correction: true, previous_review, reason, phase_index, task_index, phase_id, task_id` |
| 3 | `status === NOT_STARTED && !handoff_doc` | `CREATE_TASK_HANDOFF` | `is_correction: false, phase_index, task_index, phase_id, task_id` |
| 4 | `status === IN_PROGRESS && handoff_doc && !report_doc` | `EXECUTE_TASK` | `handoff_doc, phase_index, task_index, phase_id, task_id` |
| 5 | `status === COMPLETE && !review_doc` | `SPAWN_CODE_REVIEWER` | `report_doc, phase_index, task_index, phase_id, task_id` |
| 6 | `status === COMPLETE && review_action === ADVANCED` | delegates to `resolveTaskGate(phaseIndex, taskIndex, config)` | — |
| fallback | none matched | `DISPLAY_HALTED` | diagnostic details |

#### `resolveTaskGate(phaseIndex, taskIndex, config)`

- If `execution_mode === TASK` → `GATE_TASK`
- Else → `halted(...)` (safety net — mutations should have advanced pointer)

#### `resolvePhaseCompletion(phase, phaseIndex, config)` — Phase Lifecycle (4 conditions + fallback)

| # | Condition | Action Returned | Context Fields |
|---|-----------|-----------------|----------------|
| 1 | `!phase_report_doc` | `GENERATE_PHASE_REPORT` | `phase_index, phase_id` |
| 2 | `!phase_review_doc` | `SPAWN_PHASE_REVIEWER` | `phase_report_doc, phase_index, phase_id` |
| 3 | `phase_review_action === ADVANCED` | delegates to `resolvePhaseGate(phaseIndex, config)` | — |
| 4 | `phase_review_action === CORRECTIVE_TASKS_ISSUED` | `DISPLAY_HALTED` | note about mutation reset |
| 5 | `phase_review_action === HALTED` | `DISPLAY_HALTED` | — |
| fallback | none matched | `DISPLAY_HALTED` | unresolvable |

#### `resolvePhaseGate(phaseIndex, config)`

- If `execution_mode === PHASE || execution_mode === TASK` → `GATE_PHASE`
- Else → `halted(...)` (safety net)

#### `resolveReview(state)` — Review Tier Resolution

| # | Condition | Action |
|---|-----------|--------|
| 1 | `!final_review_doc` | `SPAWN_FINAL_REVIEWER` |
| 2 | `!final_review_approved` | `REQUEST_FINAL_APPROVAL` |
| 3 | fallback | `halted(...)` |

#### `resolveNextAction(state, config)` — Top-Level Dispatch

| Condition | Delegated To |
|-----------|-------------|
| `tier === HALTED` | Returns `halted(halt_reason)` directly |
| `tier === COMPLETE` | Returns `DISPLAY_COMPLETE` directly |
| `tier === PLANNING` | `resolvePlanning(state)` |
| `tier === EXECUTION` | `resolveExecution(state, config)` |
| `tier === REVIEW` | `resolveReview(state)` |
| unknown tier | `halted('Unknown tier: ...')` |

#### Exports

```js
module.exports = { resolveNextAction };
```

Single export. Internal functions (`resolvePlanning`, `resolveExecution`, `resolveTask`, etc.) are not exported.

---

### File: `mutations.js` — Full Structure

#### Internal Helpers

| Function | Signature | Purpose |
|----------|-----------|---------|
| `currentPhase` | `(state) => Phase` | Returns `state.execution.phases[state.execution.current_phase]` |
| `currentTask` | `(state) => Task` | Returns `currentPhase(state).tasks[phase.current_task]` |
| `checkRetryBudget` | `(retries, maxRetries) => boolean` | Returns `retries < maxRetries` |

#### Decision Tables

**`resolveTaskOutcome(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries)`**

8-row first-match-wins table:

| Row | Verdict | Report Status | Deviation Check | Retry Check | → taskStatus | → reviewAction |
|-----|---------|---------------|-----------------|-------------|-------------|---------------|
| 1–3 | `approved` | `complete` | any | any | `COMPLETE` | `ADVANCED` |
| 4 | `changes_requested` | `complete` | any | budget ok | `FAILED` | `CORRECTIVE_TASK_ISSUED` |
| 5 | `changes_requested` | `complete` | any | budget exhausted | `HALTED` | `HALTED` |
| 6 | `changes_requested` | `failed` | any | budget ok | `FAILED` | `CORRECTIVE_TASK_ISSUED` |
| 7 | `changes_requested` | `failed` | any | budget exhausted | `HALTED` | `HALTED` |
| 8 | `rejected` | any | any | any | `HALTED` | `HALTED` |
| fallback | any | any | any | any | `HALTED` | `HALTED` |

**`resolvePhaseOutcome(verdict, exitCriteriaMet)`**

5-row first-match-wins table:

| Row | Verdict | Exit Criteria | → phaseStatus | → phaseReviewAction |
|-----|---------|---------------|--------------|---------------------|
| 1–2 | `approved` | any | `COMPLETE` | `ADVANCED` |
| 3 | `changes_requested` | any | `IN_PROGRESS` | `CORRECTIVE_TASKS_ISSUED` |
| 4–5 | `rejected` | any | `HALTED` | `HALTED` |
| fallback | any | any | `HALTED` | `HALTED` |

#### Mutation Handlers (17 events)

| Event | Handler | Key State Mutations |
|-------|---------|---------------------|
| `research_completed` | `handleResearchCompleted` | Sets step status=complete, doc_path |
| `prd_completed` | `handlePrdCompleted` | Sets step status=complete, doc_path |
| `design_completed` | `handleDesignCompleted` | Sets step status=complete, doc_path |
| `architecture_completed` | `handleArchitectureCompleted` | Sets step status=complete, doc_path |
| `master_plan_completed` | `handleMasterPlanCompleted` | Sets step status=complete, doc_path, planning.status=complete |
| `plan_approved` | `handlePlanApproved` | Sets human_approved=true, tier→execution, initializes phases array |
| `phase_plan_created` | `handlePhasePlanCreated` | Sets phase status=in_progress, populates tasks array, sets phase_plan_doc |
| `task_handoff_created` | `handleTaskHandoffCreated` | Clears stale report/review fields (corrective), sets handoff_doc, status=in_progress |
| `task_completed` | `handleTaskCompleted` | Sets report_doc, has_deviations, deviation_type, report_status, status=complete |
| `code_review_completed` | `handleCodeReviewCompleted` | Sets review_doc/verdict, calls `resolveTaskOutcome`, sets status/review_action, bumps pointer or increments retries |
| `phase_report_created` | `handlePhaseReportCreated` | Sets phase_report_doc |
| `phase_review_completed` | `handlePhaseReviewCompleted` | Sets review doc/verdict, calls `resolvePhaseOutcome`, sets phase status/action, bumps phase pointer or transitions tier |
| `task_approved` | `handleTaskApproved` | No-op (gate acknowledged) |
| `phase_approved` | `handlePhaseApproved` | No-op (gate acknowledged) |
| `final_review_completed` | `handleFinalReviewCompleted` | Sets final_review_doc, final_review_status |
| `final_approved` | `handleFinalApproved` | Sets final_review_approved=true, tier→complete |
| `halt` | `handleHalt` | Sets tier→halted |

All handlers follow the signature: `(state: StateJson, context: Object, config: Config) => { state: StateJson, mutations_applied: string[] }`

#### Exports

```js
module.exports = { getMutation, normalizeDocPath };
module.exports._test = { resolveTaskOutcome, resolvePhaseOutcome, checkRetryBudget };
```

#### MUTATIONS Map

```js
const MUTATIONS = Object.freeze({ /* 17 event→handler pairs */ });
function getMutation(event) { return MUTATIONS[event]; }
```

---

### File: `pipeline-engine.js` — Public API & Linear Recipe

#### Exports

```js
module.exports = { processEvent, scaffoldInitialState };
```

#### `processEvent(event, projectDir, context, io, configPath)` — Linear Recipe

```
1. readConfig(configPath) → config
2. readState(projectDir)  → currentState
3. Branch: init path (no state + 'start'), cold-start path (state + 'start'), error path (no state + non-start)
4. Standard path:
   a. preRead(event, context, io.readDocument, projectDir) → preReadResult
   b. getMutation(event) → mutationFn (or error if unknown)
   c. mutationFn(deepClone(currentState), preReadResult.context, config) → proposed
   d. Bump project.updated timestamp
   e. validateTransition(currentState, proposed.state, config) → errors
   f. io.writeState(projectDir, proposed.state)
   g. resolveNextAction(proposed.state, config) → next
   h. Return { success: true, action: next.action, context: next.context, mutations_applied }
```

#### Return Type: `PipelineResult`

```ts
{
  success: boolean;      // true = processed, false = pre-read or validation failure
  action: string | null; // NEXT_ACTIONS value, or null on failure
  context: Object;       // action-specific data, or error info on failure
  mutations_applied: string[]; // human-readable mutation descriptions
}
```

**Important**: `pipeline-engine.js` must not change. The refactor is internal to `resolver.js` and the new `transition-table.js`.

#### `scaffoldInitialState(config, projectDir)` — Fresh State Factory

Creates a v3 state with:
- 5 planning steps (research, prd, design, architecture, master_plan) all `not_started`
- `current_tier: 'planning'`
- Empty execution section

---

### File: `pre-reads.js` — Per-Event Pre-Read Validators

#### Handler Lookup Table

```js
const PRE_READ_HANDLERS = {
  'plan_approved':            handlePlanApproved,
  'task_completed':           handleTaskCompleted,
  'code_review_completed':    handleCodeReviewCompleted,
  'phase_plan_created':       handlePhasePlanCreated,
  'phase_review_completed':   handlePhaseReviewCompleted,
};
```

Events not in this map pass through with identity context.

#### Handler Details

| Event | Handler | Reads From Frontmatter | Validates | Enriches Context With |
|-------|---------|----------------------|-----------|----------------------|
| `plan_approved` | `handlePlanApproved` | `total_phases` | Must be positive integer. Derives doc_path from master plan step if not provided | `total_phases` |
| `task_completed` | `handleTaskCompleted` | `status`, `has_deviations`, `deviation_type` | All required, status must be in STATUS_MAP | `report_status` (normalized), `has_deviations`, `deviation_type` |
| `code_review_completed` | `handleCodeReviewCompleted` | `verdict` | Required | `verdict`, `review_doc_path` |
| `phase_plan_created` | `handlePhasePlanCreated` | `tasks`, `title` | tasks must be non-empty array | `tasks`, `title` |
| `phase_review_completed` | `handlePhaseReviewCompleted` | `verdict`, `exit_criteria_met` | Both required | `verdict`, `exit_criteria_met`, `review_doc_path` |

#### Return Shape

```js
// Success:
{ context: { ...enrichedContext }, error: undefined }
// Failure:
{ context: undefined, error: { error: string, event: string, field?: string } }
```

#### Status Normalization Map

```js
const STATUS_MAP = { 'complete': 'complete', 'pass': 'complete', 'failed': 'failed', 'fail': 'failed', 'partial': 'failed' };
```

**Key insight**: Pre-reads are deliberately decoupled from the transition table. They share event name keys but are independent systems. The brainstorming doc confirms: the transition table does not reference or import pre-read handlers.

---

### File: `constants.js` — All Constants

#### Frozen Enums

| Enum | Values | Used By |
|------|--------|---------|
| `PIPELINE_TIERS` | `PLANNING`, `EXECUTION`, `REVIEW`, `COMPLETE`, `HALTED` | resolver.js, mutations.js, validator.js |
| `PLANNING_STATUSES` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE` | mutations.js |
| `PLANNING_STEP_STATUSES` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE` | resolver.js, mutations.js |
| `PHASE_STATUSES` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `HALTED` | resolver.js, mutations.js, validator.js |
| `TASK_STATUSES` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `FAILED`, `HALTED` | resolver.js, mutations.js, validator.js |
| `REVIEW_VERDICTS` | `APPROVED`, `CHANGES_REQUESTED`, `REJECTED` | mutations.js |
| `REVIEW_ACTIONS` | `ADVANCED`, `CORRECTIVE_TASK_ISSUED`, `HALTED` | resolver.js, mutations.js |
| `PHASE_REVIEW_ACTIONS` | `ADVANCED`, `CORRECTIVE_TASKS_ISSUED`, `HALTED` | resolver.js, mutations.js |
| `SEVERITY_LEVELS` | `CRITICAL`, `MINOR` | (not used by resolver) |
| `HUMAN_GATE_MODES` | `ASK`, `PHASE`, `TASK`, `AUTONOMOUS` | resolver.js |
| `NEXT_ACTIONS` | 18 values (see below) | resolver.js |

#### `NEXT_ACTIONS` — All 18 Action Constants

| Action | Category |
|--------|----------|
| `spawn_research` | Planning |
| `spawn_prd` | Planning |
| `spawn_design` | Planning |
| `spawn_architecture` | Planning |
| `spawn_master_plan` | Planning |
| `request_plan_approval` | Planning gate |
| `create_phase_plan` | Execution |
| `create_task_handoff` | Execution |
| `execute_task` | Execution |
| `spawn_code_reviewer` | Execution |
| `generate_phase_report` | Execution |
| `spawn_phase_reviewer` | Execution |
| `gate_task` | Execution gate |
| `gate_phase` | Execution gate |
| `spawn_final_reviewer` | Review |
| `request_final_approval` | Review gate |
| `display_halted` | Terminal |
| `display_complete` | Terminal |

#### Allowed Transition Maps

```js
ALLOWED_TASK_TRANSITIONS = {
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    ['failed', 'halted'],
  'halted':      [],
};
ALLOWED_PHASE_TRANSITIONS = {
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'halted'],
  'complete':    [],
  'halted':      [],
};
```

#### JSDoc Typedefs

`StateJson`, `ProjectMeta`, `Planning`, `PlanningStep`, `Execution`, `Phase`, `Task`, `Config`, `PipelineResult`, `PipelineIO`, `ParsedDocument` — all defined in constants.js.

#### `SCHEMA_VERSION`

```js
const SCHEMA_VERSION = 'orchestration-state-v3';
```

---

### File: `validator.js` — Validation Invariants

| ID | Check | Category | Touches Resolver State? |
|----|-------|----------|-------------------------|
| V1 | `current_phase` within `[0, phases.length)` | Structural | Yes — validates pointer used by resolver |
| V2 | `current_task` within bounds (allows `=== tasks.length` when all complete) | Structural | Yes — validates pointer used by resolver |
| V3 | `total_phases === phases.length` | Structural | No |
| V4 | `total_tasks === tasks.length` per phase | Structural | No |
| V5 | phases/tasks within config limits | Structural | No |
| V6 | execution tier requires `human_approved` | Gate | Yes — validates tier transition |
| V7 | complete tier with `after_final_review` gate requires `human_approved` | Gate | No |
| V10 | phase status consistency with `current_tier` | Phase-Tier | Yes — validates phase status vs tier |
| V11 | task retries monotonically non-decreasing | Transition | No |
| V12 | status transitions follow `ALLOWED_*_TRANSITIONS` maps | Transition | Yes — validates status transitions |
| V13 | `project.updated` strictly increasing | Transition | No |

**Note**: V8 and V9 are skipped in the numbering (not implemented).

#### Signature

```js
function validateTransition(current, proposed, config) → ValidationError[]
```

Returns empty array on success. Each error has `{ invariant, message, field, current?, proposed? }`.

---

### File: `test-helpers.js` — Test Utilities

#### Exports

| Function | Signature | Purpose |
|----------|-----------|---------|
| `createDefaultConfig()` | `() => Config` | Returns default config with `execution_mode: 'ask'`, `max_retries_per_task: 2`, `max_phases: 10`, `max_tasks_per_phase: 8` |
| `createMockIO(options?)` | `({ state?, documents?, config? }) => MockIO` | Creates mock I/O with `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories`, `getState()`, `getWrites()`, `getEnsureDirsCalled()` |
| `createBaseState(overrides?)` | `(Partial<StateJson>?) => StateJson` | Fresh planning-tier state with all steps `not_started` |
| `createExecutionState(overrides?)` | `(Partial<StateJson>?) => StateJson` | Execution-tier state: planning complete, human_approved, 1 phase with 2 tasks |
| `createReviewState(overrides?)` | `(Partial<StateJson>?) => StateJson` | Review-tier state: all phases complete, tier=review |
| `processAndAssert(event, context, io, assertions)` | Calls `processEvent` and asserts `success`, `action`, `writeCount` | Convenience wrapper |
| `deepClone(obj)` | `(any) => any` | `JSON.parse(JSON.stringify(obj))` |

---

### File: `pipeline-behavioral.test.js` — 11 Test Categories

| Category | Description | # Tests | Key Scenarios |
|----------|-------------|---------|---------------|
| **1** | Full happy path | 15 | Single-phase, single-task, init through `display_complete`. All 15 events sequentially on shared io. |
| **2** | Multi-phase, multi-task | 17 | 2 phases (Phase 1: 2 tasks, Phase 2: 1 task). Verifies pointer advance, phase transitions, tier transition to review. |
| **3** | Cold-start resume | 5 | (a) planning/research, (b) planning complete/not approved, (c) execution/phase not started, (d) execution/task not started, (e) review/no final review. All verify 0 writes, 0 mutations. |
| **4** | Pre-read validation failures | 5 | Missing `total_phases`, missing `status`, missing `verdict`, empty `tasks`, missing `exit_criteria_met`. All verify `success: false`, `action: null`, 0 writes. |
| **5** | Phase lifecycle | 6 | Full phase lifecycle from `phase_plan_created` through `phase_review_completed` with 2 phases. Verifies phase status transitions and pointer advance. |
| **6** | Halt paths | 3 sub-describes | (a) Task rejected → halted, (b) Task retry budget exhausted → halted, (c) Phase rejected → halted. |
| **7** | Pre-read failure flows | 2 | (a) Missing document → `success: false`, (b) Null frontmatter → `success: false`. |
| **8** | Review tier | 2 | (a) `final_review_completed` → `request_final_approval`, (b) `final_approved` → `display_complete`. |
| **9** | CF-1 review tier end-to-end | 2 | Sequential `final_review_completed` + `final_approved` on shared io. |
| **10** | Edge cases | 3 | (a) Unknown event, (b) Non-start with no state, (c) Cold-start on halted pipeline. |
| **11** | Corrective task flow | 2 | Failed task → corrective `task_handoff_created` clears stale fields → `task_completed`. |

**Total test scenarios**: ~62 individual `it()` blocks.

**Key testing patterns**:
- Uses `backdateTimestamp(state)` to delete `project.updated` for V13 safety
- Uses `makeDoc(frontmatter)` to create minimal parsed documents
- Uses `makeExecutionStartState(totalPhases)` for execution-tier starting states
- Categories 1, 2, 5, 9, 11 use shared `io` + sequential events (stateful across tests)
- Categories 3, 4, 6, 7, 8, 10 create fresh io per test

---

## Existing Patterns

- **First-match-wins decision tables**: Already used in `resolveTaskOutcome` and `resolvePhaseOutcome` in mutations.js. The refactor generalizes this pattern to the resolver.
- **Data-driven iteration**: `PLANNING_STEP_ORDER` is already a data array iterated by `resolvePlanning()`. The refactor enriches its columns and extends the pattern to task/phase lifecycles.
- **Frozen enum maps**: All constants use `Object.freeze()` for immutability. The new `transition-table.js` should follow this convention for exported table arrays (or leave them unfrozen per the brainstorming doc's note about downstream mutation).
- **Event→handler lookup maps**: Both `MUTATIONS` (mutations.js) and `PRE_READ_HANDLERS` (pre-reads.js) use `Object.freeze()` plain-object maps. `TIER_DISPATCH` follows this same pattern.
- **Dependency injection for I/O**: `pipeline-engine.js` accepts an `io` parameter with `readState`/`writeState`/`readConfig`/`readDocument`/`ensureDirectories`. Tests inject mock I/O. This pattern is not affected by the refactor.
- **JSDoc typedefs in constants.js**: All types are documented via JSDoc `@typedef`. New types (`TaskLifecycleRule`, `PhaseLifecycleRule`, `TierDispatchEntry`) should follow this pattern.
- **Internal `_test` exports**: mutations.js exports `_test` object for unit-testable internals. The new transition-table.js may not need this since its exports are the primary public surface.
- **No circular dependencies**: The dependency graph is: `pipeline-engine.js` → `{ pre-reads.js, mutations.js, validator.js, resolver.js, constants.js }`. resolver.js → constants.js only. Adding `transition-table.js` → constants.js and resolver.js → transition-table.js preserves the acyclic property.

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | ≥18 (inferred) | Uses `node:test`, `node:assert/strict` |
| Module system | CommonJS | — | `require()` / `module.exports` throughout |
| Test runner | node:test | built-in | `describe()` / `it()` blocks |
| Dependencies | None (zero-dep) | — | Must remain zero external dependencies |
| State format | JSON | v3 schema | `state.json` written/read by state-io.js |
| Config format | YAML | — | `orchestration.yml` parsed by state-io.js |

---

## Dependency Graph (Current)

```
pipeline.js (CLI)
  └── pipeline-engine.js
        ├── pre-reads.js ──→ (fs-helpers from validate skill)
        ├── mutations.js ──→ constants.js
        ├── validator.js ──→ constants.js
        ├── resolver.js  ──→ constants.js
        └── constants.js
```

### Dependency Graph (After Refactor)

```
pipeline.js (CLI)
  └── pipeline-engine.js
        ├── pre-reads.js ──→ (fs-helpers from validate skill)
        ├── mutations.js ──→ constants.js
        ├── validator.js ──→ constants.js
        ├── resolver.js  ──→ constants.js, transition-table.js  [CHANGED]
        ├── transition-table.js ──→ constants.js                 [NEW]
        └── constants.js
```

`transition-table.js` is a leaf node — it imports from `constants.js` only. No circular dependencies possible.

---

## Downstream Project Requirements

### PARALLEL-EXECUTION Dependencies on Table Shape

| Requirement | Implication for `transition-table.js` |
|-------------|--------------------------------------|
| Evaluate `TASK_LIFECYCLE_RULES` for **multiple ready tasks** per resolver call | Rule `condition` and `buildContext` closures must be **stateless** — no shared mutable context between evaluations |
| Each rule receives task identity as a parameter | Rule condition signature: `(ctx) => bool` where ctx includes `{ task, phase, phaseIndex, taskIndex, config }` |
| Task lifecycle rules evaluated in a loop per task | Rules must be a plain array, iterable with `for...of` or `.find()` |

### CUSTOM-PIPELINE-STEP Dependencies on Table Shape

| Requirement | Implication for `transition-table.js` |
|-------------|--------------------------------------|
| Insert/remove/reorder rows by reference | Each rule row needs a stable **`id`** field usable as an insertion anchor |
| Splice `PLANNING_STEP_ORDER` entries by name | Each planning step entry needs a stable **`name`** (or the existing `key`) field |
| Add `skip: true` to planning steps | Planning step entries should support additional optional fields |
| Clone-and-extend without fighting the API | Exports should be **plain object of named arrays**, not frozen, not wrapped in accessors |
| `require()` the table module directly | `transition-table.js` must be its own module with stable exports |

### Combined Design Constraints

- Rule `id` fields: stable string identifiers per rule (e.g., `'task-halted'`, `'task-corrective'`, `'task-fresh-handoff'`, `'task-execute'`, `'task-review'`, `'task-gate'`)
- Planning step `key` field serves as the name reference — already exists
- Export shape: `{ PLANNING_STEPS, TASK_LIFECYCLE_RULES, PHASE_LIFECYCLE_RULES, TIER_DISPATCH }`
- Arrays are **not frozen** — downstream projects clone and extend them
- Functions in rule rows (`condition`, `buildContext`) receive a uniform context bag at evaluation time, no imports needed

---

## Mapping: Events → Valid Tiers

This mapping is essential for the `TIER_DISPATCH.validEvents` sets:

| Event | Valid During Tier |
|-------|------------------|
| `research_completed` | planning |
| `prd_completed` | planning |
| `design_completed` | planning |
| `architecture_completed` | planning |
| `master_plan_completed` | planning |
| `plan_approved` | planning |
| `phase_plan_created` | execution |
| `task_handoff_created` | execution |
| `task_completed` | execution |
| `code_review_completed` | execution |
| `phase_report_created` | execution |
| `phase_review_completed` | execution |
| `task_approved` | execution |
| `phase_approved` | execution |
| `final_review_completed` | review |
| `final_approved` | review |
| `halt` | any (or special — sets tier to halted) |

Note: `start` is handled as a special case in `processEvent()` before reaching the standard path. It is not in `TIER_DISPATCH`.

---

## Constraints Discovered

- **`pipeline-engine.js` must not change**: The `processEvent()` linear recipe calls `resolveNextAction(proposed.state, config)` — this signature and return shape must remain identical.
- **`mutations.js` must not change**: The brainstorming doc explicitly scopes `mutations.js` as unchanged. The existing decision tables (`resolveTaskOutcome`, `resolvePhaseOutcome`) stay where they are.
- **`pre-reads.js` must not change**: Pre-reads are deliberately decoupled from the transition table.
- **`validator.js` must not change**: All 13 invariants (V1–V13) remain unchanged. The validator does not reference resolver internals.
- **`state.json` schema v3 unchanged**: No new fields, no schema migration.
- **Resolver internal tests may need updating**: `tests/resolver.test.js` may test internal functions like `resolveTask()` that will be replaced by table evaluation. The brainstorming doc acknowledges this. However, `pipeline-behavioral.test.js` must not be modified.
- **Zero external dependencies**: No npm packages. The transition table uses only constants from `constants.js`.
- **`PLANNING_STEP_ORDER` has embryonic table shape**: Currently `{ key, action }`. The refactor extends to `{ key, action, event?, doc_type? }` but the key/action structure stays.
- **Condition functions in the table must be pure**: They receive `(state, config)` or a context bag and return a boolean. No side effects, no imports from pipeline lib modules.
- **The `halt` event is special**: mutations.js handles it, but it applies to any tier. The `TIER_DISPATCH` validEvents approach must either include `halt` in all tiers or handle it as a pre-dispatch check.
- **The `start` event is outside `TIER_DISPATCH`**: Initialization/cold-start logic stays in `processEvent()`.
- **`resolveNextAction` is called post-mutation, post-validation**: It inspects the proposed (written) state — not the pre-mutation state. The `TIER_DISPATCH` concept as described in the brainstorming also includes a pre-mutation `validEvents` check, but this check would need to be integrated into `processEvent()` (which is scoped as unchanged). The brainstorming doc resolves this: `validEvents` check happens **conceptually** but the engine's physical flow may not add a pre-mutation check in v1.

---

## Recommendations

- **Start with `transition-table.js` as the first deliverable**: Define `PLANNING_STEPS`, `TASK_LIFECYCLE_RULES`, `PHASE_LIFECYCLE_RULES`, and `TIER_DISPATCH` structures. This is pure data with no engine logic — easy to review and test in isolation.
- **Use stable string `id` fields on every rule row**: Essential for `CUSTOM-PIPELINE-STEP` insertion anchors. Suggested IDs: `task-halted`, `task-corrective-handoff`, `task-fresh-handoff`, `task-execute`, `task-review`, `task-gate` for task lifecycle; `phase-report`, `phase-review`, `phase-gate-advanced`, `phase-corrective`, `phase-halted` for phase lifecycle.
- **Uniform condition bag signatures**: Task rules receive `{ task, phase, phaseIndex, taskIndex, config }`. Phase rules receive `{ phase, phaseIndex, config }`. This matches the brainstorming doc's resolved question.
- **Keep `formatPhaseId` and `formatTaskId` in `resolver.js`**: These are presentation helpers, not routing data. They belong in the engine, not the table.
- **Keep `halted()` helper in `resolver.js`**: It's a convenience wrapper for the engine's fallback action, not routing logic.
- **Do not freeze the exported table arrays**: The brainstorming doc specifies downstream consumers clone-and-extend. Use plain arrays/objects, not `Object.freeze()`.
- **The `TIER_DISPATCH` resolve functions should delegate to table iteration in the resolver**: The table defines `{ validEvents, resolve }` per tier, but the `resolve` function can be thin — it calls into the resolver's table-evaluation loop, passing the appropriate rule table.
- **Run `pipeline-behavioral.test.js` as the primary CI gate**: Any refactor step that breaks these 62 tests is incorrect by definition.
- **Consider adding unit tests for `transition-table.js`**: Test rule conditions in isolation (given a task state, verify which rule ID fires). These are new tests, not modifications to the behavioral suite.
