---
project: "UI-PATH-FIX"
phase: 1
task: 2
title: "Centralized Path Normalization"
status: "pending"
skills_required: ["research-codebase"]
skills_optional: ["run-tests"]
estimated_files: 1
---

# Centralized Path Normalization

## Objective

Add a centralized `normalizeContextPaths` helper function in `pipeline-engine.js` and call it inside `executePipeline` so that all `context.*_path` / `context.doc_path` fields are normalized to project-relative format before any mutation handler executes. This prevents workspace-relative paths (e.g., `.github/projects/PROJ/tasks/FILE.md`) from being stored in `state.json`, ensuring the UI can resolve document links without 404 errors.

## Context

The pipeline mutation handlers (`mutations.js`) store document paths from `context` fields into `state.json`. Currently these paths arrive in workspace-relative format (e.g., `.github/projects/UI-PATH-FIX/tasks/FILE.md`) but the UI expects project-relative format (e.g., `tasks/FILE.md`). Task T01 added a `normalizeDocPath(docPath, basePath, projectName)` helper to `mutations.js` and exported it. This task imports that helper and applies it centrally to all path-valued context fields in `executePipeline`, before the mutation handler is called. The normalization must occur AFTER the pre-read enrichment blocks (which need the original workspace-relative paths to locate files on disk) but BEFORE the `mutation(state, context)` call.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/orchestration/scripts/lib/pipeline-engine.js` | Add import, add helper function, add call site, move config read earlier |

## Implementation Steps

1. **Add `normalizeDocPath` to the import on line 3** — change the destructured import from `./mutations` to include `normalizeDocPath`:
   ```javascript
   const { getMutation, needsTriage, applyTaskTriage, applyPhaseTriage, normalizeDocPath } = require('./mutations');
   ```

2. **Add the `normalizeContextPaths` helper function** in the `// ─── Helpers ──` section, after the `deepClone` function (after the closing brace of `deepClone` around line 104). The function applies `normalizeDocPath` to every path-valued field in the context object, mutating it in place:
   ```javascript
   /**
    * Normalize all path-valued context fields from workspace-relative to project-relative.
    * Mutates context in place. Must be called AFTER pre-read enrichment but BEFORE mutation.
    * @param {Object} context - The event context object
    * @param {string} basePath - From config.projects.base_path (e.g., ".github/projects")
    * @param {string} projectName - From state.project.name (e.g., "UI-PATH-FIX")
    */
   function normalizeContextPaths(context, basePath, projectName) {
     const PATH_KEYS = ['doc_path', 'plan_path', 'handoff_path', 'report_path', 'review_path'];
     for (const key of PATH_KEYS) {
       if (key in context) {
         context[key] = normalizeDocPath(context[key], basePath, projectName);
       }
     }
   }
   ```

3. **Move the config read earlier in `executePipeline`** — in the STANDARD MUTATION PATH, after the two pre-read enrichment blocks (master plan pre-read and task report pre-read) and before the mutation call, add a config read. Then remove the duplicate `const config` declaration at the `// ── RESOLVE ──` section since the earlier declaration is in scope. Here is the exact placement:

   Find this code (right after the task report pre-read `catch` block closes):
   ```javascript
     }
   
     // Apply mutation
     const mutationResult = mutation(state, context);
   ```

   Replace with:
   ```javascript
     }
   
     // ── Load config & normalize context paths ──
     const config = io.readConfig(configPath);
     const basePath = (config.projects && config.projects.base_path) || '.github/projects';
     normalizeContextPaths(context, basePath, state.project.name);
   
     // Apply mutation
     const mutationResult = mutation(state, context);
   ```

4. **Remove the duplicate config read at the RESOLVE section** — find this exact code:
   ```javascript
     // ── RESOLVE ──
     const config = io.readConfig(configPath);
     let resolved = resolveNextAction(proposedState, config);
   ```

   Replace with:
   ```javascript
     // ── RESOLVE ──
     let resolved = resolveNextAction(proposedState, config);
   ```

   The `config` variable is already in scope from step 3.

5. **Verify no other `const config` declarations exist** in the standard mutation path that would conflict. The INIT PATH and COLD START PATH each declare `const config` inside their own `if` blocks and `return` before reaching the standard mutation path, so there is no scoping conflict.

## Contracts & Interfaces

### `normalizeDocPath` — Imported from `mutations.js` (implemented in T01)

```javascript
/**
 * Strip workspace-relative prefix from a document path, returning project-relative.
 * Idempotent: already project-relative paths pass through unchanged.
 *
 * @param {string|null|undefined} docPath - Document path from context
 * @param {string} basePath - From orchestration.yml projects.base_path (e.g., ".github/projects")
 * @param {string} projectName - Project name (e.g., "RAINBOW-HELLO")
 * @returns {string|null|undefined} Project-relative path, or null/undefined if input was null/undefined
 */
function normalizeDocPath(docPath, basePath, projectName) {
  if (!docPath) return docPath;
  const prefix = basePath + '/' + projectName + '/';
  if (docPath.startsWith(prefix)) return docPath.slice(prefix.length);
  return docPath;
}
```

Behavior table:

| Input `docPath` | `basePath` | `projectName` | Output |
|-----------------|-----------|---------------|--------|
| `.github/projects/PROJ/tasks/FILE.md` | `.github/projects` | `PROJ` | `tasks/FILE.md` |
| `tasks/FILE.md` | `.github/projects` | `PROJ` | `tasks/FILE.md` |
| `PROJ-PRD.md` | `.github/projects` | `PROJ` | `PROJ-PRD.md` |
| `.github/projects/PROJ/PROJ-PRD.md` | `.github/projects` | `PROJ` | `PROJ-PRD.md` |
| `null` | any | any | `null` |
| `undefined` | any | any | `undefined` |
| `''` | any | any | `''` |

### `normalizeContextPaths` — New function to add in `pipeline-engine.js`

```javascript
/**
 * Normalize all path-valued context fields from workspace-relative to project-relative.
 * Mutates context in place. Must be called AFTER pre-read enrichment but BEFORE mutation.
 * @param {Object} context - The event context object
 * @param {string} basePath - From config.projects.base_path (e.g., ".github/projects")
 * @param {string} projectName - From state.project.name (e.g., "UI-PATH-FIX")
 */
function normalizeContextPaths(context, basePath, projectName) {
  const PATH_KEYS = ['doc_path', 'plan_path', 'handoff_path', 'report_path', 'review_path'];
  for (const key of PATH_KEYS) {
    if (key in context) {
      context[key] = normalizeDocPath(context[key], basePath, projectName);
    }
  }
}
```

Context fields normalized and the mutation handlers that consume them:

| Context Key | Consumed By |
|-------------|-------------|
| `context.doc_path` | `completePlanningStep` (research, prd, design, architecture, master_plan) |
| `context.plan_path` | `handlePhasePlanCreated` |
| `context.handoff_path` | `handleTaskHandoffCreated` |
| `context.report_path` | `handleTaskCompleted`, `handlePhaseReportCreated` |
| `context.review_path` | `handleCodeReviewCompleted`, `handlePhaseReviewCompleted`, `handleFinalReviewCompleted` |

### Config structure (`io.readConfig` return shape — relevant fields only)

```javascript
{
  projects: {
    base_path: '.github/projects',   // string — workspace-relative path to projects dir
    naming: 'SCREAMING_CASE'
  },
  limits: { /* ... */ },
  human_gates: { /* ... */ },
  errors: { /* ... */ }
}
```

Access pattern: `config.projects.base_path` — always use `(config.projects && config.projects.base_path) || '.github/projects'` for safe access with fallback.

## Styles & Design Tokens

Not applicable — this is a backend pipeline JavaScript file with no UI component.

## Test Requirements

- [ ] `normalizeContextPaths` normalizes `context.doc_path` from workspace-relative to project-relative (e.g., `.github/projects/TEST/TEST-PRD.md` → `TEST-PRD.md`)
- [ ] `normalizeContextPaths` normalizes `context.plan_path` from workspace-relative to project-relative
- [ ] `normalizeContextPaths` normalizes `context.report_path` from workspace-relative to project-relative
- [ ] `normalizeContextPaths` normalizes `context.handoff_path` from workspace-relative to project-relative
- [ ] `normalizeContextPaths` normalizes `context.review_path` from workspace-relative to project-relative
- [ ] `normalizeContextPaths` leaves already project-relative paths unchanged (idempotent)
- [ ] `normalizeContextPaths` does not modify context keys that are not in the PATH_KEYS list (e.g., `context.total_phases`, `context.report_status` are untouched)
- [ ] `normalizeContextPaths` handles `null`/`undefined` path values in context without throwing
- [ ] Integration: `executePipeline` with event `prd_completed` and a workspace-relative `context.doc_path` stores the project-relative path in `state.planning.steps.prd.output`
- [ ] Integration: `executePipeline` with event `task_completed` and a workspace-relative `context.report_path` — pre-read enrichment succeeds (it receives the original path) AND the stored `task.report_doc` in the final state is project-relative
- [ ] Integration: `executePipeline` with event `task_completed` and an already project-relative `context.report_path` continues to work correctly (idempotent, no regression)

## Acceptance Criteria

- [ ] `normalizeDocPath` is imported from `./mutations` in `pipeline-engine.js`
- [ ] `normalizeContextPaths` function exists in `pipeline-engine.js` and normalizes `doc_path`, `plan_path`, `handoff_path`, `report_path`, `review_path`
- [ ] `normalizeContextPaths` is called in `executePipeline` AFTER the pre-read enrichment blocks (master plan pre-read and task report pre-read) and BEFORE `mutation(state, context)`
- [ ] Pre-read enrichment blocks (which use `context.report_path` and `state.planning.steps.master_plan.output` to locate files) are NOT affected — they execute before normalization
- [ ] Already project-relative paths pass through unchanged (idempotent)
- [ ] `null`, `undefined`, and empty string `context.*_path` values do not throw
- [ ] `config` is loaded via `io.readConfig(configPath)` before the normalization call — no duplicate `const config` declarations in the standard mutation path
- [ ] No changes to any mutation handler function signatures or behavior in `mutations.js`
- [ ] No changes to any other file besides `pipeline-engine.js`
- [ ] All existing pipeline-engine tests continue to pass (zero regressions)
- [ ] All new tests pass
- [ ] Build succeeds (`node --test` on all pipeline test files)

## Constraints

- Do NOT modify `mutations.js` — T01 already completed all changes to that file
- Do NOT modify any mutation handler function signatures or behavior
- Do NOT move or reorder the pre-read enrichment blocks — they must execute before normalization because they use workspace-relative paths to locate files on disk via `io.readDocument()`
- Do NOT add path normalization inside individual mutation handlers — the centralized approach in `pipeline-engine.js` is the architectural decision
- Do NOT hardcode `.github/projects` — always derive `basePath` from `config.projects.base_path` with a safe fallback
- Do NOT change the `module.exports` of `pipeline-engine.js` — only `executePipeline` is exported
- Do NOT create new files — all changes are in the single existing file

## Current File Content

Below is the complete current content of `.github/orchestration/scripts/lib/pipeline-engine.js` (the sole file to modify). This is the authoritative baseline — apply all changes to this content:

```javascript
'use strict';

const path = require('path');
const { getMutation, needsTriage, applyTaskTriage, applyPhaseTriage } = require('./mutations');
const { validateTransition } = require('./state-validator');
const { resolveNextAction } = require('./resolver');
const { executeTriage } = require('./triage-engine');
const { PIPELINE_TIERS, NEXT_ACTIONS, PHASE_STATUSES } = require('./constants');

/**
 * The 18 actions the Orchestrator's routing table handles.
 * Any resolved action not in this set is a bug.
 * @type {Set<string>}
 */
const EXTERNAL_ACTIONS = new Set([
  NEXT_ACTIONS.SPAWN_RESEARCH,
  NEXT_ACTIONS.SPAWN_PRD,
  NEXT_ACTIONS.SPAWN_DESIGN,
  NEXT_ACTIONS.SPAWN_ARCHITECTURE,
  NEXT_ACTIONS.SPAWN_MASTER_PLAN,
  NEXT_ACTIONS.REQUEST_PLAN_APPROVAL,
  NEXT_ACTIONS.CREATE_PHASE_PLAN,
  NEXT_ACTIONS.CREATE_TASK_HANDOFF,
  NEXT_ACTIONS.EXECUTE_TASK,
  NEXT_ACTIONS.SPAWN_CODE_REVIEWER,
  NEXT_ACTIONS.GENERATE_PHASE_REPORT,
  NEXT_ACTIONS.SPAWN_PHASE_REVIEWER,
  NEXT_ACTIONS.SPAWN_FINAL_REVIEWER,
  NEXT_ACTIONS.REQUEST_FINAL_APPROVAL,
  NEXT_ACTIONS.GATE_TASK,
  NEXT_ACTIONS.GATE_PHASE,
  NEXT_ACTIONS.DISPLAY_HALTED,
  NEXT_ACTIONS.DISPLAY_COMPLETE
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a fresh state.json object for a brand-new project.
 * @param {Object} config - Parsed orchestration.yml
 * @param {string} projectDir - Absolute path to project directory
 * @returns {Object} Initial state conforming to orchestration-state-v2 schema
 */
function scaffoldInitialState(config, projectDir) {
  const projectName = path.basename(projectDir);
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

/**
 * Build the error variant of PipelineResult.
 * @param {string} error - Error message
 * @param {string|null} event - Event that caused the failure
 * @param {string[]} mutationsApplied - Mutations applied before the error
 * @param {Object|null} stateSnapshot - Partial state for debugging
 * @param {boolean|null} validationPassed - Whether validation passed; null if not run
 * @returns {PipelineResultError}
 */
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

/**
 * Deep-clone a plain object via JSON round-trip.
 * @param {Object} obj
 * @returns {Object}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Pipeline Engine ────────────────────────────────────────────────────────

/**
 * Execute the orchestration pipeline for a single event.
 *
 * Linear recipe: load state → apply mutation → validate → write → triage check → resolve → return result.
 *
 * @param {PipelineRequest} request - { event, projectDir, configPath?, context? }
 * @param {PipelineIO} io - Injected I/O functions (readState, writeState, readConfig, readDocument, ensureDirectories)
 * @returns {PipelineResultSuccess|PipelineResultError}
 */
function executePipeline(request, io) {
  const { event, projectDir, configPath } = request;
  const context = request.context || {};

  // ── Load state ──
  const state = io.readState(projectDir);

  // ── INIT PATH: no state + start event ──
  if (state === null && event === 'start') {
    const config = io.readConfig(configPath);
    io.ensureDirectories(projectDir);
    const initialState = scaffoldInitialState(config, projectDir);
    io.writeState(projectDir, initialState);
    const resolved = resolveNextAction(initialState, config);
    return {
      success: true,
      action: resolved.action,
      context: resolved.context,
      mutations_applied: ['project_initialized'],
      triage_ran: false,
      validation_passed: true
    };
  }

  // ── COLD START PATH: state exists + start event ──
  if (state !== null && event === 'start') {
    const config = io.readConfig(configPath);
    const resolved = resolveNextAction(state, config);
    return {
      success: true,
      action: resolved.action,
      context: resolved.context,
      mutations_applied: [],
      triage_ran: false,
      validation_passed: true
    };
  }

  // ── NO STATE + NON-START ERROR ──
  if (state === null) {
    return makeErrorResult(
      'No state.json found; use --event start to initialize',
      event, [], null, null
    );
  }

  // ── STANDARD MUTATION PATH ──
  const mutation = getMutation(event);
  if (!mutation) {
    return makeErrorResult(`Unknown event: ${event}`, event, [], null, null);
  }

  const currentState = deepClone(state);

  // Master plan pre-read: enrich context with total_phases before mutation
  if (event === 'plan_approved') {
    const masterPlanPath = state.planning.steps.master_plan.output;
    if (!masterPlanPath) {
      return makeErrorResult(
        'Master plan path not found in state.planning.steps.master_plan.output',
        event, [], null, null
      );
    }
    try {
      const masterPlanDoc = io.readDocument(masterPlanPath);
      if (!masterPlanDoc) {
        return makeErrorResult(
          `Failed to read master plan at '${masterPlanPath}': document not found`,
          event, [], null, null
        );
      }
      const fm = masterPlanDoc.frontmatter || {};
      const totalPhases = parseInt(fm.total_phases, 10);
      if (!Number.isInteger(totalPhases) || totalPhases <= 0) {
        return makeErrorResult(
          `Master plan total_phases must be a positive integer, got '${fm.total_phases}'`,
          event, [], null, null
        );
      }
      context.total_phases = totalPhases;
    } catch (err) {
      return makeErrorResult(
        `Failed to read master plan at '${masterPlanPath}': ${err.message}`,
        event, [], null, null
      );
    }
  }

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
      // Normalize task report status vocabulary
      const STATUS_SYNONYMS = { 'pass': 'complete', 'fail': 'failed' };
      const VALID_STATUSES = ['complete', 'partial', 'failed'];
      if (context.report_status && STATUS_SYNONYMS[context.report_status]) {
        context.report_status = STATUS_SYNONYMS[context.report_status];
      }
      if (context.report_status && !VALID_STATUSES.includes(context.report_status)) {
        return makeErrorResult(
          `Unrecognized task report status: '${context.report_status}'. Expected one of: complete, partial, failed (or synonyms: pass, fail)`,
          event, [], null, null
        );
      }
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
  let resolved = resolveNextAction(proposedState, config);

  // ── INTERNAL ACTION HANDLING ──
  let internalIterations = 0;
  const MAX_INTERNAL_ITERATIONS = 2;

  while (!EXTERNAL_ACTIONS.has(resolved.action) && internalIterations < MAX_INTERNAL_ITERATIONS) {
    internalIterations++;

    if (resolved.action === NEXT_ACTIONS.ADVANCE_TASK) {
      const phase = proposedState.execution.phases[proposedState.execution.current_phase];
      phase.current_task += 1;
      allMutationsApplied.push(`phase.current_task → ${phase.current_task}`);
    } else if (resolved.action === NEXT_ACTIONS.ADVANCE_PHASE) {
      const phase = proposedState.execution.phases[proposedState.execution.current_phase];
      phase.status = PHASE_STATUSES.COMPLETE;

      const isLastPhase = (proposedState.execution.current_phase >= proposedState.execution.phases.length - 1);
      if (isLastPhase) {
        proposedState.pipeline.current_tier = PIPELINE_TIERS.REVIEW;
        proposedState.execution.status = 'complete';
        // current_phase stays at last valid index — never exceeds phases.length - 1
      } else {
        proposedState.execution.current_phase += 1;
      }

      allMutationsApplied.push(
        `phase[${resolved.context.phase_index}].status → complete`,
        isLastPhase
          ? 'pipeline.current_tier → review, execution.status → complete'
          : `execution.current_phase → ${proposedState.execution.current_phase}`
      );
    } else {
      // Unknown internal action — break to unmapped guard
      break;
    }

    // Common: re-validate, write, re-resolve
    const preAdvanceState = deepClone(proposedState);
    proposedState.project.updated = new Date().toISOString();
    const advanceValidation = validateTransition(preAdvanceState, proposedState);
    if (!advanceValidation.valid) {
      const firstError = advanceValidation.errors[0];
      return makeErrorResult(
        `Validation failed after ${resolved.action}: [${firstError.invariant}] ${firstError.message}`,
        event, allMutationsApplied,
        { current_phase: proposedState.execution.current_phase },
        false
      );
    }
    io.writeState(projectDir, proposedState);
    resolved = resolveNextAction(proposedState, config);
  }

  // ── UNMAPPED ACTION GUARD ──
  if (!EXTERNAL_ACTIONS.has(resolved.action)) {
    return makeErrorResult(
      `Pipeline resolved unmapped action '${resolved.action}'. Expected one of: ${[...EXTERNAL_ACTIONS].join(', ')}. This indicates a resolver bug or max internal iterations (${MAX_INTERNAL_ITERATIONS}) exceeded.`,
      event, allMutationsApplied,
      { current_phase: proposedState.execution.current_phase },
      true
    );
  }

  return {
    success: true,
    action: resolved.action,
    context: resolved.context,
    mutations_applied: allMutationsApplied,
    triage_ran: triageRan,
    validation_passed: true
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { executePipeline };
```

## Existing Test Setup Pattern

Tests for `pipeline-engine.js` live in `.github/orchestration/scripts/tests/pipeline-engine.test.js` and use `node:test` with `node:assert/strict`. The test file uses a mock IO factory:

```javascript
function createMockIO(opts = {}) {
  let currentState = opts.state !== undefined ? opts.state : null;
  const config = opts.config || createDefaultConfig();
  const documents = opts.documents || {};
  const writes = [];
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
    ensureDirectories(projectDir) {},
    getState() { return currentState; },
    getWrites() { return writes; }
  };
}

function createDefaultConfig() {
  return {
    limits: {
      max_phases: 10,
      max_tasks_per_phase: 8,
      max_retries_per_task: 2,
      max_consecutive_review_rejections: 3
    },
    human_gates: { after_planning: true, execution_mode: 'ask', after_final_review: true },
    errors: { severity: { critical: [], minor: [] }, on_critical: 'halt', on_minor: 'retry' },
    projects: { base_path: '.github/projects', naming: 'SCREAMING_CASE' }
  };
}
```

Add new tests to `pipeline-engine.test.js`. Use `createMockIO` with an appropriate state, config, and documents map. For integration tests that exercise `task_completed` with pre-read enrichment, the `documents` map must include the report document keyed by its **workspace-relative** path (the path the pre-read will use to find the file via `io.readDocument`).
