---
project: "PIPELINE-SIMPLIFICATION"
phase: 3
task: 1
title: "PIPELINE-ENGINE"
status: "pending"
skills_required: ["create-task-handoff"]
skills_optional: []
estimated_files: 2
---

# Pipeline Engine Module

## Objective

Create `.github/orchestration/scripts/lib-v3/pipeline-engine.js` — the ~70-line declarative engine that wires the six existing lib-v3 modules into the linear `processEvent` recipe: load state → pre-read → mutate → validate → write → resolve → return. Also fix a carry-forward schema completeness issue in `mutations.js`.

## Context

Six modules already exist in `lib-v3/`: `constants.js` (enums/types), `state-io.js` (I/O), `pre-reads.js` (artifact extraction), `mutations.js` (18 event handlers + decision tables), `resolver.js` (external action resolution), and `validator.js` (~11 invariant checks). The engine module is the orchestration layer that calls these modules in sequence — it contains no event-specific logic itself. The current engine in `lib/pipeline-engine.js` is the v2 reference; the v3 engine eliminates the triage layer, internal action loop, and event-type branching in the standard path.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib-v3/pipeline-engine.js` | Main engine module — exports `processEvent` and `scaffoldInitialState` |
| MODIFY | `.github/orchestration/scripts/lib-v3/mutations.js` | Add `report_status: null` to task template in `handlePhasePlanCreated` (carry-forward CF-2) |

## Implementation Steps

1. **Create `pipeline-engine.js`** with `'use strict'` and require the five peer modules:
   - `{ preRead }` from `./pre-reads`
   - `{ getMutation }` from `./mutations`
   - `{ validateTransition }` from `./validator`
   - `{ resolveNextAction }` from `./resolver`
   - `{ SCHEMA_VERSION, PIPELINE_TIERS, PLANNING_STATUSES, PLANNING_STEP_STATUSES }` from `./constants`

2. **Implement `deepClone(obj)`** — JSON round-trip deep clone helper (internal, not exported).

3. **Implement `scaffoldInitialState(config, projectDir)`** — creates a fresh v3 state object:
   - Schema: `$schema: 'orchestration-state-v3'` (use `SCHEMA_VERSION` constant)
   - `project.name` derived from `path.basename(projectDir)`
   - `project.created` and `project.updated` set to `new Date().toISOString()`
   - `planning.status: 'not_started'`, `planning.human_approved: false`
   - `planning.steps`: array of 5 step objects (`research`, `prd`, `design`, `architecture`, `master_plan`), each with `{ name, status: 'not_started', doc_path: null }`
   - `planning.current_step: 'research'`
   - `execution`: `{ status: 'not_started', current_tier: 'planning', current_phase: 0, total_phases: 0, phases: [] }`
   - No `triage_attempts` fields anywhere — they are eliminated in v3

4. **Implement `handleInit(config, projectDir, io)`** — early-return init path:
   - Call `io.ensureDirectories(projectDir)`
   - Call `scaffoldInitialState(config, projectDir)` to create initial state
   - Call `io.writeState(projectDir, initialState)` — exactly one write
   - Call `resolveNextAction(initialState, config)` to get next action
   - Return `PipelineResult` with `success: true`, resolved action/context, `mutations_applied: ['project_initialized']`

5. **Implement `handleColdStart(currentState, config)`** — early-return cold-start path:
   - Call `resolveNextAction(currentState, config)` to get next action
   - Return `PipelineResult` with `success: true`, resolved action/context, `mutations_applied: []`
   - Zero writes, zero mutations

6. **Implement `processEvent(event, projectDir, context, io, configPath)`** — the main entry point:
   - Load config: `const config = io.readConfig(configPath)`
   - Load state: `const currentState = io.readState(projectDir)`
   - Init check: if `!currentState && event === 'start'` → return `handleInit(config, projectDir, io)`
   - Cold-start check: if `currentState && event === 'start'` → return `handleColdStart(currentState, config)`
   - No-state + non-start: return failure result (`'No state.json found; use --event start to initialize'`)
   - Pre-read: `const preReadResult = preRead(event, context, io.readDocument, projectDir)` — if `preReadResult.error`, return failure result with the structured error
   - Get mutation handler: `const mutationFn = getMutation(event)` — if `undefined`, return failure result (`'Unknown event: {event}'`)
   - Deep clone + mutate: `const proposed = mutationFn(deepClone(currentState), preReadResult.context, config)`
   - Validate: `const errors = validateTransition(currentState, proposed.state, config)` — if `errors.length > 0`, return failure result with `{ error: 'State validation failed', violations: errors }`
   - Write: `io.writeState(projectDir, proposed.state)` — exactly one write
   - Resolve: `const next = resolveNextAction(proposed.state, config)`
   - Return success result: `{ success: true, action: next.action, context: next.context, mutations_applied: proposed.mutations_applied }`

7. **Export** `processEvent` and `scaffoldInitialState` via `module.exports`.

8. **Modify `mutations.js`**: In the `handlePhasePlanCreated` function, add `report_status: null` to the task template object (the object literal inside the `.map()` callback), after `retries: 0`.

## Contracts & Interfaces

### processEvent — Engine Entry Point

```javascript
// .github/orchestration/scripts/lib-v3/pipeline-engine.js

/**
 * Process a single pipeline event. Implements the linear recipe:
 * load → pre-read → mutate → validate → write → resolve → return.
 *
 * @param {string} event - pipeline event name
 * @param {string} projectDir - absolute path to project directory
 * @param {Object} context - event-specific context from Orchestrator
 * @param {PipelineIO} io - dependency-injected I/O
 * @param {string} [configPath] - path to orchestration.yml; auto-discovers if omitted
 * @returns {PipelineResult}
 */
function processEvent(event, projectDir, context, io, configPath) { /* ... */ }
```

### scaffoldInitialState — New Project State

```javascript
/**
 * Create initial state for a new project.
 *
 * @param {Config} config - parsed orchestration config
 * @param {string} projectDir - absolute path to project directory
 * @returns {StateJson} - fresh v3 state object
 */
function scaffoldInitialState(config, projectDir) { /* ... */ }
```

### PipelineResult — Return Contract

```javascript
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS values when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error info on failure
 * @property {string[]} mutations_applied - human-readable mutation descriptions; empty on failure
 */
```

### PipelineIO — Dependency Injection Boundary

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

### StateJson v3 Schema — scaffoldInitialState Output Shape

```javascript
{
  "$schema": "orchestration-state-v3",
  "project": {
    "name": "<from path.basename(projectDir)>",
    "created": "<ISO timestamp>",
    "updated": "<ISO timestamp>"
  },
  "planning": {
    "status": "not_started",
    "human_approved": false,
    "steps": [
      { "name": "research", "status": "not_started", "doc_path": null },
      { "name": "prd", "status": "not_started", "doc_path": null },
      { "name": "design", "status": "not_started", "doc_path": null },
      { "name": "architecture", "status": "not_started", "doc_path": null },
      { "name": "master_plan", "status": "not_started", "doc_path": null }
    ],
    "current_step": "research"
  },
  "execution": {
    "status": "not_started",
    "current_tier": "planning",
    "current_phase": 0,
    "total_phases": 0,
    "phases": []
  }
}
```

### Pre-Read Contract — Called by Engine

```javascript
// .github/orchestration/scripts/lib-v3/pre-reads.js

/**
 * @param {string} event
 * @param {Object} context
 * @param {(docPath: string) => ParsedDocument | null} readDocument
 * @param {string} projectDir
 * @returns {{ context: Object, error: undefined } | { context: undefined, error: { error: string, event: string, field?: string } }}
 */
function preRead(event, context, readDocument, projectDir) { /* ... */ }
```

Events not in the pre-read lookup table pass through with unmodified context — no error.

### getMutation Contract — Called by Engine

```javascript
// .github/orchestration/scripts/lib-v3/mutations.js

/**
 * @param {string} event
 * @returns {((state: StateJson, context: Object, config: Config) => { state: StateJson, mutations_applied: string[] }) | undefined}
 */
function getMutation(event) { /* ... */ }
```

Returns `undefined` for unknown events. The engine must check for this and return a failure result.

### validateTransition Contract — Called by Engine

```javascript
// .github/orchestration/scripts/lib-v3/validator.js

/**
 * @param {StateJson | null} current - state before mutation (null on init)
 * @param {StateJson} proposed - state after mutation
 * @param {Config} config - parsed orchestration config (for V5, V7)
 * @returns {ValidationError[]} - empty array if valid
 */
function validateTransition(current, proposed, config) { /* ... */ }
```

Note: Takes 3 parameters (current, proposed, config). Pass `config` as the third argument.

### resolveNextAction Contract — Called by Engine

```javascript
// .github/orchestration/scripts/lib-v3/resolver.js

/**
 * @param {StateJson} state - post-mutation, post-validation state
 * @param {Config} config - parsed orchestration config
 * @returns {{ action: string, context: Object }}
 */
function resolveNextAction(state, config) { /* ... */ }
```

### Failure Result Shapes

Pre-read failure:
```javascript
{
  success: false,
  action: null,
  context: { error: 'Pre-read failed for event ...', event: '<event>', field: '<field>' },
  mutations_applied: []
}
```

Validation failure:
```javascript
{
  success: false,
  action: null,
  context: { error: 'State validation failed', violations: [/* ValidationError[] */] },
  mutations_applied: []
}
```

Unknown event:
```javascript
{
  success: false,
  action: null,
  context: { error: 'Unknown event: <event>' },
  mutations_applied: []
}
```

No state + non-start event:
```javascript
{
  success: false,
  action: null,
  context: { error: 'No state.json found; use --event start to initialize' },
  mutations_applied: []
}
```

## Styles & Design Tokens

Not applicable — no UI components. The design rules for this module are readability conventions:

- The `processEvent` function body should read top-to-bottom as a ~20-line recipe
- No inline decision logic — all event-specific logic lives in mutations/pre-reads
- No branching by event type in the standard path (init and cold-start are early returns before the standard path)
- No internal action loop — the function runs once and returns
- Each step in the standard path is a single function call: `preRead(...)`, `getMutation(...)`, `mutationFn(...)`, `validateTransition(...)`, `io.writeState(...)`, `resolveNextAction(...)`

## Test Requirements

- [ ] `processEvent` is importable via `require('./pipeline-engine')` — no syntax errors
- [ ] `scaffoldInitialState` is importable via `require('./pipeline-engine')` — no syntax errors
- [ ] All 6 peer modules (`constants`, `state-io`, `pre-reads`, `mutations`, `resolver`, `validator`) import without error from the engine
- [ ] The `handlePhasePlanCreated` task template in `mutations.js` includes `report_status: null`

## Acceptance Criteria

- [ ] `pipeline-engine.js` exists at `.github/orchestration/scripts/lib-v3/pipeline-engine.js`
- [ ] `processEvent` is exported and conforms to the signature: `(event, projectDir, context, io, configPath?) → PipelineResult`
- [ ] `scaffoldInitialState` is exported and conforms to the signature: `(config, projectDir) → StateJson`
- [ ] Init path (no state + `start` event): calls `io.ensureDirectories`, calls `scaffoldInitialState`, calls `io.writeState` exactly once, calls `resolveNextAction`, returns `PipelineResult` with `success: true`
- [ ] Cold-start path (existing state + `start` event): calls `resolveNextAction` only, zero calls to `io.writeState`, returns `PipelineResult` with `success: true` and `mutations_applied: []`
- [ ] Standard path: calls `preRead` → `getMutation` → `deepClone` + mutate → `validateTransition` → `io.writeState` → `resolveNextAction` → returns success `PipelineResult`
- [ ] Standard path calls `io.writeState` exactly once per successful event
- [ ] All failure paths (pre-read error, validation error, unknown event, no state) return `PipelineResult` with `success: false`, `action: null`, and zero calls to `io.writeState`
- [ ] Unknown event (`getMutation` returns `undefined`) returns failure result with `context.error` containing the event name
- [ ] Pre-read failure returns structured error with `event` and `field` information from the pre-read module
- [ ] Validation failure returns structured error with `violations` array from the validator
- [ ] `scaffoldInitialState` produces state with `$schema: 'orchestration-state-v3'`
- [ ] `scaffoldInitialState` output has no `triage_attempts` fields at any level
- [ ] `scaffoldInitialState` output includes `planning.steps` as an array of 5 step objects and `planning.current_step: 'research'`
- [ ] `mutations.js`: task template in `handlePhasePlanCreated` includes `report_status: null` (CF-2)
- [ ] No branching by event type in the standard path of `processEvent`
- [ ] All tests pass: `node --test .github/orchestration/scripts/tests-v3/` completes with zero failures
- [ ] Build succeeds: all 7 `lib-v3/` modules importable via `require()` without errors

## Constraints

- Do NOT add event-type-specific branching in the standard path of `processEvent` — all event-specific logic lives in `pre-reads.js` and `mutations.js`
- Do NOT import `fs` or `path` in `pipeline-engine.js` except `path.basename` for `scaffoldInitialState` project name derivation
- Do NOT modify any module other than `pipeline-engine.js` (CREATE) and `mutations.js` (CF-2 fix)
- Do NOT add a triage layer, internal action loop, or any concept of `triage_attempts`
- Do NOT add `triage_ran` or `validation_passed` fields to `PipelineResult` — the v3 result contract is `{ success, action, context, mutations_applied }` only
- Do NOT modify the existing test files — integration and behavioral tests are created in subsequent tasks (T02–T04)
- Do NOT change the signatures or behavior of any existing lib-v3 module — the engine calls them exactly as they are
