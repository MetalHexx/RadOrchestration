---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 1
task: 4
title: "Pipeline Engine"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Pipeline Engine

## Objective

Create `pipeline-engine.js` — the core orchestration module that implements the linear recipe: load state → apply mutation → validate → write → triage check → resolve → return result. This module receives a `PipelineIO` interface via dependency injection, making it fully testable with mocked I/O.

## Context

The pipeline engine sits in the Orchestration Layer between the CLI entry point (`pipeline.js`, T06) and the Domain Layer (mutations, resolver, validator, triage engine). It composes five already-implemented modules: `mutations.js` (18 event handlers + triage helpers), `state-io.js` (filesystem I/O), `resolver.js` (next-action resolution), `state-validator.js` (15-invariant validation), and `triage-engine.js` (decision tables). The engine handles 19 events: `start` (init/cold-start) plus 18 mutation events. All I/O flows through an injected `PipelineIO` object — the engine itself performs no direct filesystem access.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/lib/pipeline-engine.js` | ~150–200 lines, CommonJS, `'use strict'` |

## Implementation Steps

1. **Add module header**: `'use strict'`, require the five domain modules:
   ```javascript
   const { getMutation, needsTriage, applyTaskTriage, applyPhaseTriage } = require('./mutations');
   const { validateTransition } = require('./state-validator');
   const { resolveNextAction } = require('./resolver');
   const { executeTriage } = require('./triage-engine');
   const { PIPELINE_TIERS } = require('./constants');
   ```

2. **Implement `scaffoldInitialState(config)`** — a pure helper that returns a fresh state.json object:
   ```javascript
   function scaffoldInitialState(config, projectDir) {
     const projectName = require('path').basename(projectDir);
     const now = new Date().toISOString();
     return {
       "$schema": "orchestration-state-v2",
       project: { name: projectName, created: now, updated: now },
       pipeline: {
         current_tier: PIPELINE_TIERS.PLANNING,
         human_gate_mode: (config.human_gates && config.human_gates.execution_mode) || 'ask'
       },
       planning: {
         status: 'not_started',
         brainstorming_doc: null,
         steps: {
           research:     { status: 'not_started', output: null },
           prd:          { status: 'not_started', output: null },
           design:       { status: 'not_started', output: null },
           architecture: { status: 'not_started', output: null },
           master_plan:  { status: 'not_started', output: null }
         },
         human_approved: false
       },
       execution: {
         status: 'not_started',
         current_phase: 0,
         total_phases: 0,
         triage_attempts: 0,
         phases: []
       },
       final_review: { status: 'not_started', report_doc: null, human_approved: false },
       errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
       limits: {
         max_phases: config.limits.max_phases,
         max_tasks_per_phase: config.limits.max_tasks_per_phase,
         max_retries_per_task: config.limits.max_retries_per_task,
         max_consecutive_review_rejections: config.limits.max_consecutive_review_rejections || 3
       }
     };
   }
   ```

3. **Implement `makeErrorResult(error, event, mutationsApplied, stateSnapshot, validationPassed)`** — a helper that builds the error variant of `PipelineResult`:
   ```javascript
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

4. **Implement `deepClone(obj)`** — a simple deep-clone helper:
   ```javascript
   function deepClone(obj) {
     return JSON.parse(JSON.stringify(obj));
   }
   ```

5. **Implement the INIT PATH** inside `executePipeline`: when `io.readState(projectDir)` returns `null` and event is `start`:
   - Call `io.readConfig(configPath)` to get config
   - Call `io.ensureDirectories(projectDir)` to create project structure
   - Call `scaffoldInitialState(config, projectDir)` to build initial state
   - Call `io.writeState(projectDir, state)` to persist
   - Call `resolveNextAction(state, config)` to get the next action
   - Return success result with `mutations_applied: ['project_initialized']`, `triage_ran: false`, `validation_passed: true`

6. **Implement the COLD START PATH**: when state exists and event is `start`:
   - Call `io.readConfig(configPath)` to get config
   - Call `resolveNextAction(state, config)` to get the next action
   - Return success result with `mutations_applied: []`, `triage_ran: false`, `validation_passed: true`

7. **Implement the NO STATE + NON-START ERROR**: when `readState` returns `null` and event is NOT `start`:
   - Return error result: `"No state.json found; use --event start to initialize"`

8. **Implement the STANDARD MUTATION PATH** (the main body):
   - Look up mutation: `const mutation = getMutation(event)` — if `undefined`, return error: `"Unknown event: <event>"`
   - Deep-clone state: `const currentState = deepClone(state)`
   - **Task report pre-read** (step 8a): if event is `'task_completed'` and `context.report_path` exists, call `io.readDocument(context.report_path)`, extract frontmatter fields (`status`, `severity`, `deviations`/`has_deviations`), and enrich context:
     ```javascript
     if (event === 'task_completed' && context.report_path) {
       const reportDoc = io.readDocument(context.report_path);
       const fm = reportDoc.frontmatter || {};
       context.report_status = fm.status || null;
       context.report_severity = fm.severity || null;
       context.report_deviations = Boolean(fm.has_deviations !== undefined ? fm.has_deviations : fm.deviations);
     }
     ```
   - Apply mutation: `const { state: proposedState, mutations_applied } = mutation(state, context)`
   - Validate: `const validation = validateTransition(currentState, proposedState)` — if `!validation.valid`, return error result with `validation_passed: false` and error message listing the first validation error. Do NOT call `io.writeState`.
   - Write state: `io.writeState(projectDir, proposedState)`

9. **Implement the TRIAGE PATH** (after the standard write in step 8):
   - Call `needsTriage(event, proposedState)` to check if triage should run
   - If `!shouldTriage`, skip to RESOLVE (step 10)
   - If `shouldTriage`:
     a. **Check `triage_attempts`**: if `proposedState.execution.triage_attempts > 1`, return success result with `action: 'display_halted'`, `context: { message: 'Triage invariant: triage_attempts exceeded' }`, `triage_ran: false`
     b. Save a clone for validation: `const priorTriageState = deepClone(proposedState)`
     c. Call triage engine: `const triageResult = executeTriage(proposedState, level, io.readDocument)`
     d. If `!triageResult.success`, return error result with the triage error message
     e. Apply triage mutation: call `applyTaskTriage(proposedState, triageResult)` for task-level, or `applyPhaseTriage(proposedState, triageResult)` for phase-level. Capture the `mutations_applied` and append to the running list.
     f. Validate again: `const triageValidation = validateTransition(priorTriageState, proposedState)` — if invalid, return error result with `validation_passed: false`. Do NOT write.
     g. Write state: `io.writeState(projectDir, proposedState)`

10. **Implement RESOLVE**: call `io.readConfig(configPath)` for human gate mode, then `resolveNextAction(proposedState, config)`. Build and return the success result:
    ```javascript
    return {
      success: true,
      action: resolved.action,
      context: resolved.context,
      mutations_applied: allMutationsApplied,
      triage_ran: triageRan,
      validation_passed: true
    };
    ```

11. **Export**: `module.exports = { executePipeline };`

## Contracts & Interfaces

### PipelineIO (Dependency Injection Interface)

The `io` parameter passed to `executePipeline` must conform to this shape. In production, these are the five functions exported by `state-io.js`. In tests, these are mock implementations.

```javascript
/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => Object|null} readState
 *   Read and parse state.json from projectDir. Return null if not found.
 * @property {(projectDir: string, state: Object) => void} writeState
 *   Atomically write state.json. Updates project.updated timestamp before writing.
 * @property {(configPath: string) => Object} readConfig
 *   Read and parse orchestration.yml. Auto-discovers if path omitted. Falls back to defaults.
 * @property {(docPath: string) => { frontmatter: Object|null, body: string }} readDocument
 *   Read markdown document and extract frontmatter. Throws if not found.
 * @property {(projectDir: string) => void} ensureDirectories
 *   Create projectDir/, phases/, tasks/, reports/. No-op if exists.
 */
```

### PipelineRequest

```javascript
/**
 * @typedef {Object} PipelineRequest
 * @property {string} event - Event name from the 19-event closed vocabulary
 * @property {string} projectDir - Absolute path to project directory
 * @property {string} [configPath] - Path to orchestration.yml (optional, auto-discovered)
 * @property {Object} [context] - Event-specific context payload (default: {})
 */
```

### PipelineResult — Success Variant

```javascript
/**
 * Returned when the pipeline completes without error (success === true).
 * @typedef {Object} PipelineResultSuccess
 * @property {true} success
 * @property {string} action - Next action from resolver (~18 values)
 * @property {Object} context - Action-specific context from resolver
 * @property {string[]} mutations_applied - Human-readable list of state changes
 * @property {boolean} triage_ran - Whether triage was triggered during this call
 * @property {true} validation_passed - Always true on success
 */
```

### PipelineResult — Error Variant

```javascript
/**
 * Returned when the pipeline encounters an error (success === false).
 * @typedef {Object} PipelineResultError
 * @property {false} success
 * @property {string} error - Error message
 * @property {string|null} event - Event that caused the failure
 * @property {Object|null} state_snapshot - Partial state for debugging (e.g., { current_phase, current_task })
 * @property {string[]} mutations_applied - Mutations applied before the error
 * @property {boolean|null} validation_passed - Whether validation passed; null if validation didn't run
 */
```

### MutationResult (returned by mutation handlers)

```javascript
/**
 * @typedef {Object} MutationResult
 * @property {Object} state - The mutated state object (same reference, modified in place)
 * @property {string[]} mutations_applied - Human-readable list of mutations applied
 */
```

### Resolver Output

```javascript
/**
 * resolveNextAction(state, config) returns:
 * @returns {{ action: string, context: Object }}
 *   action: One of ~35 NEXT_ACTIONS enum values (pipeline engine passes through to caller)
 *   context: { tier, phase_index, task_index, phase_id, task_id, details }
 */
```

### State Validator Output

```javascript
/**
 * validateTransition(current, proposed) returns:
 * @returns {{ valid: boolean, invariants_checked: number, errors?: Array<{ invariant: string, message: string, severity: string }> }}
 */
```

### Triage Engine Output

```javascript
/**
 * executeTriage(state, level, readDocument) returns:
 *
 * On success:
 * @returns {{ success: true, level: 'task'|'phase', verdict: string|null, action: string|null,
 *             phase_index: number, task_index: number|null, row_matched: number, details: string }}
 *
 * On error:
 * @returns {{ success: false, level: 'task'|'phase', error: string, error_code: string,
 *             phase_index: number, task_index: number|null }}
 */
```

### Mutations API (imported from mutations.js)

```javascript
/**
 * getMutation(event) → handler function or undefined
 * needsTriage(event, state) → { shouldTriage: boolean, level: 'task'|'phase'|null }
 * applyTaskTriage(state, triageResult) → { state, mutations_applied }
 * applyPhaseTriage(state, triageResult) → { state, mutations_applied }
 */
```

## Styles & Design Tokens

N/A — no UI component.

## Test Requirements

No test file is created in this task. Tests are covered by T05 (Pipeline Engine Integration Tests). However, the module must be structured for testability:

- [ ] `executePipeline(request, io)` accepts a `PipelineIO` object — all I/O goes through `io.*` calls, never through direct `require('fs')` or `require('path')` in the engine
- [ ] The module performs zero direct filesystem access
- [ ] `scaffoldInitialState` produces a valid state structure that passes `validateTransition(null, state)` — though this is verified by the `checkV10` structural check in the validator (init path skips full transition validation since `current` is null)

## Acceptance Criteria

- [ ] File created at `.github/orchestration/scripts/lib/pipeline-engine.js`
- [ ] Module is CommonJS with `'use strict'` at top
- [ ] Module exports exactly `{ executePipeline }`
- [ ] `executePipeline(request, io)` handles init path: no `state.json` + `start` event → creates directories, scaffolds state (with `triage_attempts: 0`), writes state, resolves, returns success result with `action` (expected: `spawn_research`)
- [ ] `executePipeline(request, io)` handles cold start: `state.json` exists + `start` event → skips mutation, resolves from existing state, returns success result
- [ ] `executePipeline(request, io)` handles all 18 standard mutation events: looks up mutation, deep-clones state, applies mutation, validates, writes, resolves, returns success result
- [ ] Validation failure returns error result with `validation_passed: false` and does NOT call `io.writeState`
- [ ] Unknown event returns error result with descriptive message and does NOT call `io.writeState`
- [ ] No `state.json` + non-`start` event returns error result: `"No state.json found; use --event start to initialize"`
- [ ] Triage triggers after `task_completed`, `code_review_completed`, `phase_review_completed` events — calls `executeTriage`, applies triage mutation, validates a second time, writes state a second time
- [ ] `triage_attempts > 1` check: returns success result with `action: 'display_halted'` without running triage
- [ ] Triage failure (e.g., document not found) returns error result
- [ ] Task report pre-read: for `task_completed`, calls `io.readDocument(context.report_path)` and enriches context with `report_status`, `report_severity`, `report_deviations` before passing to mutation handler
- [ ] Error results include `event`, `mutations_applied`, `state_snapshot` fields
- [ ] Success results include `action`, `context`, `mutations_applied`, `triage_ran`, `validation_passed` fields
- [ ] Module imports only from: `./mutations`, `./state-validator`, `./resolver`, `./triage-engine`, `./constants`, and Node.js `path` built-in (for `scaffoldInitialState` project name extraction)
- [ ] Module loads without errors: `node -e "require('./.github/orchestration/scripts/lib/pipeline-engine')"`
- [ ] All 4 preserved lib test suites still pass unmodified

## Constraints

- Do NOT perform any direct filesystem access — all I/O goes through the `io` parameter
- Do NOT import `state-io.js` — the engine receives I/O functions via dependency injection
- Do NOT import `fs` or `path` except `path.basename` in `scaffoldInitialState` for project name extraction
- Do NOT modify any existing files — this task creates exactly one new file
- Do NOT add npm dependencies — Node.js built-ins only
- Do NOT write tests — those are T05's scope
- Keep the module between 150–200 lines (excluding blank lines and comments within reason)
- Every mutation handler call must pass a deep-cloned state — never mutate the original state object used for validation comparison
- The `context` parameter on `PipelineRequest` defaults to `{}` if omitted — handle this defensively
