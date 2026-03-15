---
project: "PIPELINE-SIMPLIFICATION"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-14T00:00:00Z"
---

# PIPELINE-SIMPLIFICATION — Design

## Design Overview

This design defines the developer experience of the refactored pipeline engine — the module API surfaces that maintainers program against, the CLI interface that the Orchestrator invokes, the JSON result contract that drives agent routing, and the test authoring patterns that verify correctness. The interaction model is: one CLI invocation → one event processed → one JSON result returned → one agent spawned. Every developer-facing surface is designed to make the one-event-one-write-one-action guarantee self-evident from the code, the output, and the tests.

## Developer Flows

### Flow 1: Standard Event Processing (Pipeline Maintainer)

```
Orchestrator invokes CLI
  → pipeline.js parses args (--event, --project-dir, --context)
  → processEvent(event, projectDir, context, io)
  → loadState(io, projectDir)
  → preRead(event, context, io.readDocument, projectDir)   // enrich context from agent output docs
  → mutate(event, state, enrichedContext, config)           // single atomic mutation
  → validate(currentState, proposedState)                   // structural + transition guards
  → io.writeState(projectDir, proposedState)                // exactly one write
  → resolve(proposedState, config)                          // determine next external action
  → return { success, action, context, mutations_applied }
```

The maintainer reads the entry point top-to-bottom and sees the full pipeline in ~20 lines. No branching into triage vs. non-triage. No internal action loop. No deferred validation.

### Flow 2: Init Event (New Project)

```
CLI receives --event start, no state.json exists
  → loadState returns null
  → scaffoldInitialState(config, projectDir)
  → io.writeState(projectDir, initialState)
  → resolve(initialState, config) → spawn_research
  → return { success: true, action: 'spawn_research', context: {}, mutations_applied: [...] }
```

### Flow 3: Cold-Start Resume (Existing Project, Start Event)

```
CLI receives --event start, state.json exists
  → loadState returns existing state
  → no mutation, no pre-read, no write
  → resolve(existingState, config) → next action based on current state
  → return { success: true, action: '<resolved>', context: {}, mutations_applied: [] }
```

### Flow 4: Pre-Read Validation Failure

```
CLI receives --event task_completed with malformed task report
  → loadState returns state
  → preRead('task_completed', context, io.readDocument, projectDir)
  → document missing required frontmatter field (e.g., no 'status')
  → return { success: false, action: null, context: { error: 'Pre-read failed: ...', event, field }, mutations_applied: [] }
```

No mutation, no write, no state change. The error is structured and identifies the missing field.

### Flow 5: Test Authoring (Pipeline Maintainer Writing Tests)

```
Create mock I/O        → createMockIO({ state, documents, config })
Create initial state   → createBaseState() with spreads for scenario-specific overrides
Invoke pipeline        → processEvent('task_completed', projectDir, context, io)
Assert result          → assert.deepStrictEqual(result.action, 'spawn_code_reviewer')
Assert single write    → assert.strictEqual(io.getWrites().length, 1)
Assert state mutation  → assert.strictEqual(io.getState().execution.phases[0].tasks[0].status, 'complete')
```

Every test follows: arrange (factory + overrides) → act (one processEvent call) → assert (result + write count + state).

### Flow 6: Task Decision Table Execution (Within Mutation)

```
Event: code_review_completed
  → preRead extracts: { verdict, review_doc_path }
  → mutate('code_review_completed', state, enrichedContext, config)
    → sets task.review_doc, task.review_verdict
    → calls resolveTaskOutcome(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries)
    → decision table returns: { taskStatus, reviewAction }
    → mutation applies: task.status, task.review_action
    → if reviewAction === 'advanced': bumps phase.current_task (pointer advance within same mutation)
    → if reviewAction === 'corrective_task_issued': leaves pointer, sets is_correction context
    → if reviewAction === 'halted': sets task.status = 'halted'
  → single write captures all changes
```

### Flow 7: Phase Lifecycle Completion (Within Mutation)

```
Event: phase_review_completed
  → preRead extracts: { verdict, exit_criteria_met }
  → mutate('phase_review_completed', state, enrichedContext, config)
    → sets phase.phase_review, phase.phase_review_verdict
    → calls resolvePhaseOutcome(verdict, exitCriteriaMet)
    → decision table returns: { phaseStatus, phaseReviewAction }
    → mutation applies: phase.status, phase.phase_review_action
    → if phaseReviewAction === 'advanced' and more phases remain: bumps execution.current_phase, sets next phase status
    → if phaseReviewAction === 'advanced' and last phase: sets execution.status = 'complete', tier → 'review'
    → if phaseReviewAction === 'halted': sets phase.status = 'halted'
  → single write captures all changes
```

## Module API Surfaces

### Module: `pipeline.js` (CLI Entry Point)

**Role**: Arg parsing + DI construction + delegation. The recipe that a reader follows in ~20 lines.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `parseArgs` | `(argv: string[]) → { event, projectDir, configPath?, context? }` | Parsed CLI args | Throws on missing `--event` or `--project-dir` |
| `main` | `() → void` | Writes JSON to stdout, exits 0/1 | Constructs real I/O, calls `processEvent` |

**CLI Flags** (unchanged from current):

| Flag | Required | Type | Description |
|------|----------|------|-------------|
| `--event` | Yes | string | Pipeline event name (one of ~18 event types) |
| `--project-dir` | Yes | string | Absolute path to project directory |
| `--config` | No | string | Path to `orchestration.yml`; auto-discovers if omitted |
| `--context` | No | JSON string | Event-specific context (e.g., `{ "doc_path": "..." }`) |

### Module: `pipeline-engine.js` (Engine Core)

**Role**: The declarative recipe. Orchestrates the load → pre-read → mutate → validate → write → resolve → return sequence.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `processEvent` | `(event, projectDir, context, io, configPath?) → PipelineResult` | `{ success, action, context, mutations_applied }` | Single entry point for all events |
| `scaffoldInitialState` | `(config, projectDir) → StateJson` | Fresh v3 state object | Used only for init path |

**Internal flow** (not exported, but visible in the ~20-line recipe):

```
1. config   = io.readConfig(configPath)
2. state    = io.readState(projectDir)
3. if (!state && event === 'start') → init path
4. if (state && event === 'start')  → cold-start path (resolve only)
5. enriched = preRead(event, context, io.readDocument, projectDir)
6. proposed = mutate(event, deepClone(state), enriched, config)
7. errors   = validate(state, proposed)
8. if (errors.length) → return failure
9. io.writeState(projectDir, proposed)
10. result  = resolve(proposed, config)
11. return { success: true, ...result, mutations_applied }
```

### Module: `pre-reads.js` (NEW — Artifact Extraction)

**Role**: Read agent output documents and extract/validate required frontmatter fields before mutation. Pure functions — no state mutation, no side effects beyond I/O reads.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `preRead` | `(event, context, readDocument, projectDir) → { enrichedContext } \| { error }` | Enriched context or structured error | Dispatches to per-event handlers via lookup table |

**Per-event pre-read contracts** (the 5 events requiring document validation):

| Event | Document Read | Required Fields | Enriched Context Keys |
|-------|--------------|----------------|-----------------------|
| `plan_approved` | Master plan at `context.doc_path` | `total_phases` (positive integer) | `{ total_phases }` |
| `task_completed` | Task report at `context.doc_path` | `status`, `has_deviations`, `deviation_type` | `{ report_status, has_deviations, deviation_type }` |
| `code_review_completed` | Code review at `context.doc_path` | `verdict` | `{ verdict, review_doc_path }` |
| `phase_plan_created` | Phase plan at `context.doc_path` | `tasks` (non-empty array) | `{ tasks }` |
| `phase_review_completed` | Phase review at `context.doc_path` | `verdict`, `exit_criteria_met` | `{ verdict, exit_criteria_met, review_doc_path }` |

**Status normalization** (applied during pre-read for `task_completed`):

| Raw Value | Normalized To |
|-----------|---------------|
| `complete`, `pass` | `complete` |
| `failed`, `fail`, `partial` | `failed` |

Events not in the lookup table pass through with unmodified context (no pre-read).

### Module: `mutations.js` (Event Handlers + Decision Logic)

**Role**: Each event maps to a mutation handler that produces the final state in one operation. Decision table logic (formerly in triage engine) is absorbed here.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `getMutation` | `(event) → MutationHandler \| undefined` | Handler function or undefined | Lookup table dispatch |
| `normalizeDocPath` | `(docPath, basePath, projectName) → string` | Project-relative path | Unchanged from current |

**Mutation handler signature** (uniform for all handlers):

```
(state: StateJson, context: EnrichedContext, config: Config) → MutationResult
```

Where `MutationResult` is:

```
{ state: StateJson, mutations_applied: string[] }
```

**Decision table helpers** (internal, called by mutation handlers):

| Helper | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `resolveTaskOutcome` | `(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries) → TaskOutcome` | `{ taskStatus, reviewAction }` | 8-row decision table (down from 11) |
| `resolvePhaseOutcome` | `(verdict, exitCriteriaMet) → PhaseOutcome` | `{ phaseStatus, phaseReviewAction }` | 5-row decision table |
| `checkRetryBudget` | `(retries, maxRetries) → boolean` | `true` if retries remain | Unchanged logic |

**Task decision table** (8 rows — `partial` mapped to `failed` by pre-read):

| # | Verdict | Report Status | Has Deviations | Deviation Type | Retries Left | → Task Status | → Review Action |
|---|---------|--------------|----------------|----------------|-------------|---------------|----------------|
| 1 | approved | complete | false | — | — | complete | advanced |
| 2 | approved | complete | true | minor | — | complete | advanced |
| 3 | approved | complete | true | critical | — | complete | advanced |
| 4 | changes_requested | complete | — | — | yes | failed | corrective_task_issued |
| 5 | changes_requested | complete | — | — | no | halted | halted |
| 6 | changes_requested | failed | — | — | yes | failed | corrective_task_issued |
| 7 | changes_requested | failed | — | — | no | halted | halted |
| 8 | rejected | — | — | — | — | halted | halted |

**Phase decision table** (5 rows):

| # | Verdict | Exit Criteria Met | → Phase Status | → Phase Review Action |
|---|---------|-------------------|----------------|----------------------|
| 1 | approved | true | complete | advanced |
| 2 | approved | false | complete | advanced |
| 3 | changes_requested | — | in_progress | corrective_tasks_issued |
| 4 | rejected | true | halted | halted |
| 5 | rejected | false | halted | halted |

### Module: `resolver.js` (State → External Action)

**Role**: Pure inspector. Given the final (post-mutation) state, returns the single external action the Orchestrator should execute next.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `resolveNextAction` | `(state, config) → { action, context }` | External action + routing context | No internal actions; ~19 possible return values |

**Action set** (~19 external-only, down from 35):

| Category | Actions |
|----------|---------|
| Planning | `spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan`, `request_plan_approval` |
| Execution — Task | `create_phase_plan`, `create_task_handoff`, `execute_task`, `spawn_code_reviewer` |
| Execution — Phase | `generate_phase_report`, `spawn_phase_reviewer` |
| Gates | `gate_task`, `gate_phase` |
| Review | `spawn_final_reviewer`, `request_final_approval` |
| Terminal | `display_halted`, `display_complete` |

**Removed actions** (16 internal actions eliminated):

`advance_task`, `advance_phase`, `transition_to_execution`, `transition_to_review`, `transition_to_complete`, `update_state_from_task`, `update_state_from_review`, `update_state_from_phase_review`, `triage_task`, `triage_phase`, `halt_triage_invariant`, `halt_phase_triage_invariant`, `retry_from_review`, `halt_from_review`, `halt_task_failed`, `create_corrective_handoff`

**Merged actions**:

| Old Action(s) | New Action | Distinguishing Context |
|---------------|-----------|----------------------|
| `create_task_handoff` + `create_corrective_handoff` | `create_task_handoff` | `context.is_correction: true/false`, `context.previous_review`, `context.reason` |
| `halt_task_failed` + `halt_from_review` + `halt_triage_invariant` + `halt_phase_triage_invariant` | `display_halted` | `context.details` describes the halt reason |

### Module: `validator.js` (State Invariant Checks)

**Role**: Structural and transition guards. Runs once per event (not twice). Returns structured errors with invariant IDs.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `validateTransition` | `(current, proposed) → ValidationError[]` | Array of errors (empty = valid) | current-vs-proposed comparison |

**Invariant catalog** (~10–11 invariants, down from 15):

| ID | Category | Check | Status |
|----|----------|-------|--------|
| V1 | Structural | `current_phase` within `[0, phases.length)` | Keep |
| V2 | Structural | `current_task` within `[0, tasks.length)` for active phase | Keep |
| V3 | Structural | `total_phases` matches `phases.length` | Keep |
| V4 | Structural | `total_tasks` matches `tasks.length` per phase | Keep |
| V5 | Structural | Phase/task counts within config limits | Keep |
| V6 | Gate | Human approval required before execution tier | Keep |
| V7 | Gate | Human approval required before completion (per config) | Keep |
| V8 | ~~Split-write~~ | ~~review_doc set implies verdict set~~ | **Remove** — atomic write makes this impossible to violate |
| V9 | ~~Split-write~~ | ~~phase_review set implies verdict set~~ | **Remove** — atomic write makes this impossible to violate |
| V10 | Structural | Active phase `status` is valid for current tier | Keep |
| V11 | Transition | `retries` only increases monotonically | Keep (current→proposed) |
| V12 | Transition | Task/phase status transitions follow allowed map | Keep (current→proposed) |
| V13 | Transition | `project.updated` timestamp advances | Keep (simplified — no racing workaround) |
| V14 | ~~Split-write~~ | ~~review_doc + verdict written in same operation~~ | **Remove** — atomic write by construction |
| V15 | ~~Split-write~~ | ~~cross-task immutability within a write~~ | **Remove** — one task changes per event by construction |

**Validation error structure**:

```javascript
{
  invariant: 'V12',           // invariant ID
  message: 'Invalid task status transition: not_started → complete',
  field: 'execution.phases[0].tasks[0].status',
  current: 'not_started',
  proposed: 'complete'
}
```

### Module: `constants.js` (Enums + Type Definitions)

**Role**: Single source of truth for all enum values and JSDoc type definitions.

**Changes from current**:

| Change | Detail |
|--------|--------|
| `NEXT_ACTIONS` shrinks from 35 to ~19 | Remove all 16 internal actions |
| `TRIAGE_LEVELS` enum removed | No triage layer |
| `$schema` value changes | `orchestration-state-v2` → `orchestration-state-v3` |
| `execution.triage_attempts` removed from `StateJson` typedef | Field no longer exists |
| `phase.triage_attempts` removed from `Phase` typedef | Field no longer exists |

All other enums (`PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `PHASE_STATUSES`, `TASK_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`) remain unchanged.

### Module: `state-io.js` (Filesystem I/O)

**Role**: Read/write state, config, and documents. Dependency-injected into the engine.

| Export | Signature | Returns | Notes |
|--------|-----------|---------|-------|
| `readState` | `(projectDir) → StateJson \| null` | Parsed state or null | Unchanged |
| `writeState` | `(projectDir, state) → void` | — | Sets `project.updated` before write |
| `readConfig` | `(configPath?) → Config` | Merged config with defaults | Unchanged |
| `readDocument` | `(docPath) → { frontmatter, body } \| null` | Parsed document or null | Unchanged |
| `ensureDirectories` | `(projectDir) → void` | — | Unchanged |

**Rationalization**: `writeState` is the sole setter of `project.updated`. The engine no longer sets this timestamp before calling `writeState` (eliminates the current double-write pattern).

## JSON Result Contract

The pipeline result is the primary interface between the engine and the Orchestrator. It is written to stdout as JSON and parsed by the Orchestrator to determine routing.

### Success Result

```json
{
  "success": true,
  "action": "spawn_code_reviewer",
  "context": {
    "review_doc_path": "CODE-REVIEW-P01-T02.md",
    "task_number": 2,
    "phase_number": 1
  },
  "mutations_applied": [
    "execution.phases[0].tasks[1].status → complete",
    "execution.phases[0].tasks[1].report_doc → TASK-REPORT-P01-T02.md"
  ]
}
```

### Failure Result (Pre-Read Error)

```json
{
  "success": false,
  "action": null,
  "context": {
    "error": "Pre-read failed for event 'task_completed': missing required field 'status' in task report frontmatter",
    "event": "task_completed",
    "field": "status"
  },
  "mutations_applied": []
}
```

### Failure Result (Validation Error)

```json
{
  "success": false,
  "action": null,
  "context": {
    "error": "State validation failed",
    "violations": [
      {
        "invariant": "V12",
        "message": "Invalid task status transition: not_started → complete",
        "field": "execution.phases[0].tasks[0].status",
        "current": "not_started",
        "proposed": "complete"
      }
    ]
  },
  "mutations_applied": []
}
```

### Halt Result (Task Failed, Review Rejected, etc.)

```json
{
  "success": true,
  "action": "display_halted",
  "context": {
    "details": "Task P01-T02 halted: code review rejected after exhausting retry budget (2/2 retries used)",
    "phase_number": 1,
    "task_number": 2,
    "reason": "rejected"
  },
  "mutations_applied": [
    "execution.phases[0].tasks[1].status → halted",
    "execution.phases[0].tasks[1].review_verdict → rejected",
    "execution.phases[0].tasks[1].review_action → halted"
  ]
}
```

### Corrective Task Handoff Result

```json
{
  "success": true,
  "action": "create_task_handoff",
  "context": {
    "is_correction": true,
    "previous_review": "CODE-REVIEW-P01-T02.md",
    "reason": "changes_requested",
    "phase_number": 1,
    "task_number": 2
  },
  "mutations_applied": [
    "execution.phases[0].tasks[1].status → failed",
    "execution.phases[0].tasks[1].review_verdict → changes_requested",
    "execution.phases[0].tasks[1].review_action → corrective_task_issued",
    "execution.phases[0].tasks[1].retries → 1"
  ]
}
```

### Contract Rules

| Rule | Detail |
|------|--------|
| `success` is boolean | `true` = event processed, action resolved. `false` = event rejected (pre-read or validation failure) |
| `action` is string or null | One of the ~19 external actions when `success: true`; `null` when `success: false` |
| `context` is always an object | Contains action-specific routing data. On failure, contains structured error info |
| `mutations_applied` is always an array | Human-readable strings showing what changed. Empty on failure or cold-start |
| Exit code 0 when `success: true` | Exit code 1 when `success: false` |

## Error Output Formats

### CLI-Level Error (Bad Arguments)

Written to stderr, exit code 1:

```
[ERROR] pipeline: Missing required flag: --event
```

```
[ERROR] pipeline: Invalid --context JSON: Unexpected token x in JSON at position 0
```

### Pre-Read Error (Agent Output Validation)

Returned in the JSON result (stdout), `success: false`:

| Field | Content |
|-------|---------|
| `context.error` | Human-readable message: `Pre-read failed for event '{event}': {detail}` |
| `context.event` | The event that triggered the pre-read |
| `context.field` | The specific frontmatter field that was missing or invalid (when applicable) |

### Validation Error (State Invariant Violation)

Returned in the JSON result (stdout), `success: false`:

| Field | Content |
|-------|---------|
| `context.error` | `"State validation failed"` |
| `context.violations` | Array of `{ invariant, message, field, current, proposed }` objects |

Each violation includes the invariant ID (e.g., `V12`) for direct cross-reference with the validator source code.

## Test Authoring Patterns

### Mock I/O Factory

The `createMockIO` factory is the sole means of injecting dependencies into the engine during tests. It replaces filesystem access with in-memory state, documents, and config.

**Signature**:

```javascript
function createMockIO({ state?, documents?, config? }) → MockIO
```

**MockIO interface**:

| Method | Behavior |
|--------|----------|
| `readState(projectDir)` | Returns deep clone of initial `state` (or `null`) |
| `writeState(projectDir, state)` | Captures snapshot into writes array; updates currentState |
| `readConfig(configPath)` | Returns deep clone of `config` |
| `readDocument(docPath)` | Looks up `docPath` in `documents` map; returns deep clone or `null` |
| `ensureDirectories(projectDir)` | Increments counter (no-op) |
| `getState()` | Returns current state after writes |
| `getWrites()` | Returns array of all state snapshots written |
| `getEnsureDirsCalled()` | Returns call count |

**Key design rules**:
- All inputs and outputs are deep-cloned to prevent cross-test mutation leaks
- `documents` is a flat map: `{ 'path/to/doc.md': { frontmatter: {...}, body: '...' } }`
- `config` defaults to `createDefaultConfig()` if not provided
- Tests spy on writes via `getWrites()` and verify exactly 1 write per standard event

### State Factory Functions

State factories produce valid v3 state objects with scenario-specific overrides via spread syntax.

```javascript
function createBaseState(overrides?) → StateJson       // minimal valid v3 state (planning tier)
function createExecutionState(overrides?) → StateJson   // state in execution tier with 1 phase, 2 tasks
function createReviewState(overrides?) → StateJson      // state in review tier (all phases complete)
```

**Usage pattern**:

```javascript
const state = createExecutionState({
  execution: {
    phases: [{
      ...basePhase,
      tasks: [{
        ...baseTask,
        status: 'in_progress',
        report_doc: 'TASK-REPORT-P01-T01.md'
      }]
    }]
  }
});
```

Factories produce `$schema: 'orchestration-state-v3'` — no v2 schema in new tests.

### Assertion Patterns

| What to Assert | How |
|---------------|-----|
| Correct action returned | `assert.strictEqual(result.action, NEXT_ACTIONS.SPAWN_CODE_REVIEWER)` |
| Single write per event | `assert.strictEqual(io.getWrites().length, 1)` |
| Success/failure | `assert.strictEqual(result.success, true)` |
| Specific state mutation | `assert.strictEqual(io.getState().execution.phases[0].tasks[0].status, 'complete')` |
| Mutations list includes entry | `assert.ok(result.mutations_applied.some(m => m.includes('status → complete')))` |
| Pre-read rejection | `assert.strictEqual(result.success, false); assert.ok(result.context.error.includes('Pre-read failed'))` |
| Validation rejection | `assert.strictEqual(result.success, false); assert.ok(result.context.violations.length > 0)` |
| No state change on failure | `assert.strictEqual(io.getWrites().length, 0)` |
| Decision table row coverage | One test per row, named by row number: `it('task row 4: changes_requested + complete + retries left → corrective')` |

### Test Organization

| Test File | Scope | Describe Blocks |
|-----------|-------|-----------------|
| `pipeline-behavioral.test.js` | End-to-end scenarios via `processEvent` | Happy path, multi-phase/multi-task, retry & corrective cycles, halt paths, cold-start resume, pre-read failures, human gate modes, phase lifecycle, frontmatter-driven flows |
| `mutations.test.js` | Per-handler unit tests + decision table | One `describe` per event handler; dedicated `describe('task decision table')` with 8 row tests; dedicated `describe('phase decision table')` with 5 row tests |
| `pre-reads.test.js` | Pre-read extraction + validation | One `describe` per event type; tests for missing fields, invalid values, normalization |
| `resolver.test.js` | Action resolution from state | One `describe` per tier (planning, execution, review); tests all ~19 external actions |
| `validator.test.js` | Invariant checks | One `it` per invariant (V1–V7, V10–V13); tests that removed invariants (V8, V9, V14, V15) are not checked |
| `constants.test.js` | Enum freeze + completeness | Verify all enums are frozen; verify `NEXT_ACTIONS` has exactly ~19 entries |
| `pipeline.test.js` | CLI arg parsing | Flag parsing, missing args, invalid JSON context |
| `state-io.test.js` | I/O operations | Unchanged |

### Test Infrastructure Rules

| Rule | Rationale |
|------|-----------|
| `node:test` + `node:assert/strict` only | Zero external test dependencies (NFR-3) |
| No cross-file factory imports | Each test file self-contains its factories (prevents coupling) |
| Deep clone all state in factories | Prevents mutation leaks between tests |
| One `processEvent` call per `it` block (behavioral tests) | Enforces one-event-one-write; makes failures atomic |
| Decision table tests name their row | `it('task row 4: ...')` makes coverage auditable |

## Pipeline Entry Point Readability

The top-level engine function — the "declarative recipe" — must be readable without jumping into any implementation module. A maintainer should understand the full pipeline flow by reading this one function.

### Target Structure (~20 lines)

```javascript
function processEvent(event, projectDir, context, io, configPath) {
  const config = io.readConfig(configPath);
  const currentState = io.readState(projectDir);

  // Init: no state + start event
  if (!currentState && event === 'start') {
    return handleInit(config, projectDir, io);
  }

  // Cold start: state exists + start event
  if (currentState && event === 'start') {
    return handleColdStart(currentState, config);
  }

  // Standard path: load → pre-read → mutate → validate → write → resolve
  const preReadResult = preRead(event, context, io.readDocument, projectDir);
  if (preReadResult.error) return failure(preReadResult.error);

  const mutationFn = getMutation(event);
  const proposed = mutationFn(deepClone(currentState), preReadResult.context, config);

  const errors = validate(currentState, proposed.state);
  if (errors.length) return failure({ error: 'State validation failed', violations: errors });

  io.writeState(projectDir, proposed.state);
  const next = resolve(proposed.state, config);

  return { success: true, action: next.action, context: next.context, mutations_applied: proposed.mutations_applied };
}
```

### Readability Rules

| Rule | Detail |
|------|--------|
| No inline decision logic | All event-specific logic lives in mutations; all pre-read logic lives in pre-reads |
| No branching by event type | The standard path is the same for all 16+ standard events |
| No internal action loop | The function runs once and returns |
| Validation runs exactly once | After mutation, before write |
| Write happens exactly once | After validation passes |
| Each step is a single function call | `preRead(...)`, `getMutation(...)`, `validate(...)`, `resolve(...)` |
| Init and cold-start are early returns | Simple paths exit before the standard path begins |

## State Schema v3 Changes

### Fields Removed

| Field | Reason |
|-------|--------|
| `execution.triage_attempts` | Triage layer eliminated; atomic writes make double-triage impossible by construction |
| `phase.triage_attempts` | Same — per-phase triage counter no longer needed |

### Fields Changed

| Field | Old Value | New Value |
|-------|-----------|-----------|
| `$schema` | `orchestration-state-v2` | `orchestration-state-v3` |

### Fields Unchanged

All other fields in `StateJson`, `Phase`, `Task`, `PlanningStep` retain their current types and semantics. The `task.retries` counter remains the sole retry budget mechanism.

## Dependency Injection Contract

The `PipelineIO` interface is the dependency injection boundary. The engine never touches the filesystem directly.

```
PipelineIO {
  readState(projectDir: string) → StateJson | null
  writeState(projectDir: string, state: StateJson) → void
  readConfig(configPath?: string) → Config
  readDocument(docPath: string) → { frontmatter: Object | null, body: string } | null
  ensureDirectories(projectDir: string) → void
}
```

**Production**: `state-io.js` provides real implementations.
**Test**: `createMockIO()` provides in-memory implementations.

This boundary ensures every module can be tested as a pure function with no filesystem, no process state, and no environment coupling.

## Delivery Structure

### Parallel Write Strategy

| Phase | Directory | Content |
|-------|-----------|---------|
| Development | `lib-v3/` | New modules: `constants.js`, `mutations.js`, `pre-reads.js`, `resolver.js`, `validator.js`, `state-io.js`, `pipeline-engine.js` |
| Development | `tests-v3/` (or `tests/` with new filenames) | New test suite targeting `lib-v3/` |
| Swap | `lib/` → `lib-old/`, `lib-v3/` → `lib/` | `pipeline.js` require paths updated |
| Cleanup | Delete `lib-old/` | After verification in production use |

### File Inventory (New Modules)

| File | Approx Lines | Role |
|------|-------------|------|
| `lib-v3/constants.js` | ~170 | Enums (reduced), JSDoc types (updated for v3) |
| `lib-v3/mutations.js` | ~280 | Event handlers + absorbed decision table helpers |
| `lib-v3/pre-reads.js` | ~100 | Artifact extraction/validation (new module) |
| `lib-v3/resolver.js` | ~200 | External-only action resolution |
| `lib-v3/validator.js` | ~150 | ~10 invariant checks |
| `lib-v3/state-io.js` | ~130 | Largely unchanged I/O |
| `lib-v3/pipeline-engine.js` | ~70 | Declarative recipe entry point |
| **Total** | **~1,100** | Down from ~2,620 in current engine |

## Design System Additions

Not applicable — this project has no UI components. The "design system" for this project is the set of conventions defined above: the module API signatures, the JSON result contract, the error output formats, the test factory patterns, and the entry point readability rules. These conventions serve the same purpose as visual design tokens: they establish a consistent, documented vocabulary that all modules and tests must follow.
