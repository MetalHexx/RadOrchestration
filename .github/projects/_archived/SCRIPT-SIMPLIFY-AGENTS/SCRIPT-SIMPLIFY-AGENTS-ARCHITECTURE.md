---
project: "SCRIPT-SIMPLIFY-AGENTS"
status: "draft"
author: "architect-agent"
created: "2026-03-12T00:00:00Z"
---

# SCRIPT-SIMPLIFY-AGENTS — Architecture

## Technical Overview

This project refactors the orchestration system's control flow by introducing a unified event-driven pipeline script (`pipeline.js`) that internalizes all state mutations, validation, triage, and next-action resolution into a single deterministic CLI call. The architecture composes four new modules (CLI entry point, pipeline engine, mutations table, state I/O) on top of four preserved pure-function library modules (`constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`). All code is CommonJS with Node.js 18+ built-ins only — zero npm dependencies. The result eliminates three standalone scripts, strips the Tactical Planner to a pure planning agent, and reduces the Orchestrator to a thin ~18-action event-driven controller.

## System Layers

```
┌─────────────────────────────────────────────────────┐
│  CLI Layer (Entry Point)                            │  Arg parsing, JSON output, exit codes
│  pipeline.js                                        │
├─────────────────────────────────────────────────────┤
│  Orchestration Layer (Pipeline Engine)              │  Event dispatch, linear recipe, composition
│  pipeline-engine.js                                 │
├─────────────────────────────────────────────────────┤
│  Domain Layer (Business Logic)                      │  Mutations, resolution, validation, triage
│  mutations.js, resolver.js, state-validator.js,     │
│  triage-engine.js, constants.js                     │
├─────────────────────────────────────────────────────┤
│  Infrastructure Layer (I/O)                         │  Filesystem reads/writes, YAML/frontmatter parsing
│  state-io.js, fs-helpers.js, yaml-parser.js,        │
│  frontmatter.js                                     │
└─────────────────────────────────────────────────────┘
```

- **CLI Layer**: Thin entry point. Parses CLI flags, calls the pipeline engine, prints JSON to stdout, exits with 0 or 1.
- **Orchestration Layer**: Linear recipe that composes domain and infrastructure modules. Load state → apply mutation → validate → write → triage check → resolve → return result.
- **Domain Layer**: Pure functions with no I/O. Mutations are event-specific state transformations. Resolver, validator, triage engine, and constants are preserved unchanged.
- **Infrastructure Layer**: All filesystem access. Mockable boundary for testing. Reuses shared utilities from `validate-orchestration` skill.

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `pipeline.js` | CLI | `.github/orchestration/scripts/pipeline.js` | CLI entry point — parse args, call engine, print JSON, exit |
| `pipeline-engine.js` | Orchestration | `.github/orchestration/scripts/lib/pipeline-engine.js` | Linear recipe: load → mutate → validate → write → triage → resolve → return |
| `mutations.js` | Domain | `.github/orchestration/scripts/lib/mutations.js` | Event-to-mutation lookup table — one named pure function per event type |
| `state-io.js` | Infrastructure | `.github/orchestration/scripts/lib/state-io.js` | Filesystem I/O isolation — read/write state, read config, read documents, create dirs |
| `constants.js` | Domain | `.github/orchestration/scripts/lib/constants.js` | **PRESERVED** — Frozen enums, JSDoc types (12 enums, 35 NEXT_ACTIONS) |
| `resolver.js` | Domain | `.github/orchestration/scripts/lib/resolver.js` | **PRESERVED** — `resolveNextAction(state, config)` — pure next-action resolution |
| `state-validator.js` | Domain | `.github/orchestration/scripts/lib/state-validator.js` | **PRESERVED** — `validateTransition(current, proposed)` — 15 invariants (V1–V15) |
| `triage-engine.js` | Domain | `.github/orchestration/scripts/lib/triage-engine.js` | **PRESERVED** — `executeTriage(state, level, readDocument)` — decision table engine |

### Agent Definitions (Modified)

| File | Layer | Path | Change |
|------|-------|------|--------|
| Orchestrator | Agent | `.github/agents/orchestrator.agent.md` | Rewrite: event-driven loop, ~18-action table, remove STATUS.md |
| Tactical Planner | Agent | `.github/agents/tactical-planner.agent.md` | Strip Modes 1 & 2, remove `execute` tool, remove STATUS.md/triage |
| Reviewer | Agent | `.github/agents/reviewer.agent.md` | Update `review-code` → `review-task` reference |
| All 7 other agents | Agent | `.github/agents/*.agent.md` | Remove "only the Tactical Planner does that" / STATUS.md language |

### Skills (Modified)

| Skill | Path | Change |
|-------|------|--------|
| `triage-report` | `.github/skills/triage-report/` | **DELETED** — content moved to code + planning skills |
| `review-code` → `review-task` | `.github/skills/review-task/` | **RENAMED** — directory, frontmatter, SKILL.md updated |
| `create-task-handoff` | `.github/skills/create-task-handoff/SKILL.md` | Add "Prior Context" section for corrective handling |
| `create-phase-plan` | `.github/skills/create-phase-plan/SKILL.md` | Add "Prior Context" section for corrective handling |

### Documents (Deleted)

| Document | Path | Reason |
|----------|------|--------|
| `state-json-schema.md` | `.github/orchestration/schemas/state-json-schema.md` | Prose shadow of `constants.js` + `state-validator.js` |
| `state-management.instructions.md` | `.github/instructions/state-management.instructions.md` | All 6 sections become wrong/redundant post-refactor |
| `schemas/` directory | `.github/orchestration/schemas/` | Empty after schema deletion |
| `STATUS.md` | `{project-dir}/STATUS.md` | Redundant — dashboard reads `state.json` directly |

### Scripts (Deleted)

| Script | Path | Replaced By |
|--------|------|-------------|
| `next-action.js` | `.github/orchestration/scripts/next-action.js` | `pipeline.js` (`start` event) |
| `triage.js` | `.github/orchestration/scripts/triage.js` | `pipeline.js` (internal triage step) |
| `validate-state.js` | `.github/orchestration/scripts/validate-state.js` | `pipeline.js` (internal validation step) |

## Contracts & Interfaces

### Pipeline Engine Interface

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

'use strict';

/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => Object|null} readState - Read and parse state.json; null if not found
 * @property {(projectDir: string, state: Object) => void} writeState - Atomically write state.json
 * @property {(configPath: string) => Object} readConfig - Read and parse orchestration.yml
 * @property {(docPath: string) => { frontmatter: Object, body: string }} readDocument - Read markdown doc with frontmatter
 * @property {(projectDir: string) => void} ensureDirectories - Create project dir + phases/, tasks/, reports/
 */

/**
 * @typedef {Object} PipelineRequest
 * @property {string} event - Event name from the closed vocabulary
 * @property {string} projectDir - Absolute path to project directory
 * @property {string} [configPath] - Path to orchestration.yml (optional, auto-discovered)
 * @property {Object} [context] - Event-specific context payload
 */

/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - Whether pipeline completed without error
 * @property {string} [action] - Next action from the ~18-value reduced vocabulary (present if success)
 * @property {Object} [context] - Action-specific context for the Orchestrator (present if success)
 * @property {string[]} [mutations_applied] - Human-readable list of state changes (present if success)
 * @property {boolean} [triage_ran] - Whether triage was triggered (present if success)
 * @property {boolean} [validation_passed] - Whether validation passed (present if success)
 * @property {string} [error] - Error message (present if !success)
 * @property {string} [event] - Event that caused failure (present if !success)
 * @property {Object} [state_snapshot] - Partial state for debugging (present if !success)
 */

/**
 * Execute the pipeline for a given event.
 *
 * Linear recipe:
 *   1. Load state (or detect init)
 *   2. Apply mutation (or scaffold state for init)
 *   3. Validate transition
 *   4. Write state
 *   5. Check triage trigger → run triage if needed → apply triage mutation → validate → write
 *   6. Resolve next action
 *   7. Return result
 *
 * @param {PipelineRequest} request - The pipeline request
 * @param {PipelineIO} io - Injected I/O functions (mockable boundary)
 * @returns {PipelineResult}
 */
function executePipeline(request, io) { /* ... */ }

module.exports = { executePipeline };
```

### Mutations Interface

```javascript
// .github/orchestration/scripts/lib/mutations.js

'use strict';

/**
 * @typedef {Object} MutationResult
 * @property {import('./constants').StateJson} state - The mutated state object
 * @property {string[]} mutations_applied - Human-readable list of mutations applied
 */

/**
 * Lookup table: event name → mutation handler function.
 * Each handler is a pure function: (state, context) → MutationResult
 *
 * Handler contract:
 * @param {import('./constants').StateJson} state - Deep clone of current state.json
 * @param {Object} context - Event context payload from --context CLI flag
 * @returns {MutationResult} - Mutated state + list of mutations applied
 *
 * All handlers are pure functions — no I/O, no side effects.
 * Each handler is ≤15 lines.
 */

/** @type {Record<string, (state: Object, context: Object) => MutationResult>} */
const MUTATIONS = {
  // start: handled specially by pipeline-engine (cold-start vs. init)
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,
  plan_rejected:            handlePlanRejected,
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,
  gate_approved:            handleGateApproved,
  gate_rejected:            handleGateRejected,
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  final_rejected:           handleFinalRejected
};

/**
 * Look up the mutation handler for an event name.
 * @param {string} event - Event name
 * @returns {((state: Object, context: Object) => MutationResult)|undefined}
 */
function getMutation(event) { /* ... */ }

/**
 * Determine whether triage should run after this event + state combination.
 * @param {string} event - Event name
 * @param {import('./constants').StateJson} state - Current state
 * @returns {{ shouldTriage: boolean, level: 'task'|'phase'|null }}
 */
function needsTriage(event, state) { /* ... */ }

// ─── Individual Mutation Handlers ───────────────────────────────────────────

/**
 * Handle research_completed event.
 * Sets planning.steps.research to complete, stores doc path.
 * @param {import('./constants').StateJson} state - Deep clone of state
 * @param {{ doc_path: string }} context
 * @returns {MutationResult}
 */
function handleResearchCompleted(state, context) { /* ... */ }

/**
 * Handle prd_completed event.
 * Sets planning.steps.prd to complete, stores doc path.
 * @param {import('./constants').StateJson} state
 * @param {{ doc_path: string }} context
 * @returns {MutationResult}
 */
function handlePrdCompleted(state, context) { /* ... */ }

/**
 * Handle design_completed event.
 * Sets planning.steps.design to complete, stores doc path.
 * @param {import('./constants').StateJson} state
 * @param {{ doc_path: string }} context
 * @returns {MutationResult}
 */
function handleDesignCompleted(state, context) { /* ... */ }

/**
 * Handle architecture_completed event.
 * Sets planning.steps.architecture to complete, stores doc path.
 * @param {import('./constants').StateJson} state
 * @param {{ doc_path: string }} context
 * @returns {MutationResult}
 */
function handleArchitectureCompleted(state, context) { /* ... */ }

/**
 * Handle master_plan_completed event.
 * Sets planning.steps.master_plan to complete, stores doc path. Sets planning.status to complete.
 * @param {import('./constants').StateJson} state
 * @param {{ doc_path: string }} context
 * @returns {MutationResult}
 */
function handleMasterPlanCompleted(state, context) { /* ... */ }

/**
 * Handle plan_approved event.
 * Sets planning.human_approved to true. Transitions pipeline.current_tier to execution.
 * Sets execution.status to in_progress. Initializes first phase if needed.
 * @param {import('./constants').StateJson} state
 * @param {Object} context
 * @returns {MutationResult}
 */
function handlePlanApproved(state, context) { /* ... */ }

/**
 * Handle plan_rejected event.
 * Sets pipeline.current_tier to halted. Adds active blocker.
 * @param {import('./constants').StateJson} state
 * @param {Object} context
 * @returns {MutationResult}
 */
function handlePlanRejected(state, context) { /* ... */ }

/**
 * Handle phase_plan_created event.
 * Sets phase.phase_doc to plan path. Initializes tasks array from plan.
 * Sets phase.status to in_progress if not already.
 * @param {import('./constants').StateJson} state
 * @param {{ plan_path: string }} context
 * @returns {MutationResult}
 */
function handlePhasePlanCreated(state, context) { /* ... */ }

/**
 * Handle task_handoff_created event.
 * Sets task.handoff_doc to handoff path. Sets task.status to in_progress.
 * @param {import('./constants').StateJson} state
 * @param {{ handoff_path: string }} context
 * @returns {MutationResult}
 */
function handleTaskHandoffCreated(state, context) { /* ... */ }

/**
 * Handle task_completed event.
 * Reads task report frontmatter (via pipeline engine pre-read).
 * Sets task.status to complete, task.report_doc to report path.
 * Sets task.severity from report frontmatter.
 * @param {import('./constants').StateJson} state
 * @param {{ report_path: string, report_status: string, report_severity: string|null, report_deviations: boolean }} context
 * @returns {MutationResult}
 */
function handleTaskCompleted(state, context) { /* ... */ }

/**
 * Handle code_review_completed event.
 * Sets task.review_doc to review path.
 * @param {import('./constants').StateJson} state
 * @param {{ review_path: string }} context
 * @returns {MutationResult}
 */
function handleCodeReviewCompleted(state, context) { /* ... */ }

/**
 * Handle phase_report_created event.
 * Sets phase.phase_report to report path.
 * @param {import('./constants').StateJson} state
 * @param {{ report_path: string }} context
 * @returns {MutationResult}
 */
function handlePhaseReportCreated(state, context) { /* ... */ }

/**
 * Handle phase_review_completed event.
 * Sets phase.phase_review to review path.
 * @param {import('./constants').StateJson} state
 * @param {{ review_path: string }} context
 * @returns {MutationResult}
 */
function handlePhaseReviewCompleted(state, context) { /* ... */ }

/**
 * Handle gate_approved event.
 * For task gates: advances task (increments current_task or marks phase tasks complete).
 * For phase gates: advances phase (increments current_phase or transitions tier).
 * @param {import('./constants').StateJson} state
 * @param {{ gate_type: 'task'|'phase' }} context
 * @returns {MutationResult}
 */
function handleGateApproved(state, context) { /* ... */ }

/**
 * Handle gate_rejected event.
 * Sets pipeline.current_tier to halted. Adds active blocker.
 * @param {import('./constants').StateJson} state
 * @param {{ gate_type: 'task'|'phase' }} context
 * @returns {MutationResult}
 */
function handleGateRejected(state, context) { /* ... */ }

/**
 * Handle final_review_completed event.
 * Sets final_review.report_doc to review path. Sets final_review.status to complete.
 * @param {import('./constants').StateJson} state
 * @param {{ review_path: string }} context
 * @returns {MutationResult}
 */
function handleFinalReviewCompleted(state, context) { /* ... */ }

/**
 * Handle final_approved event.
 * Sets final_review.human_approved to true. Sets pipeline.current_tier to complete.
 * @param {import('./constants').StateJson} state
 * @param {Object} context
 * @returns {MutationResult}
 */
function handleFinalApproved(state, context) { /* ... */ }

/**
 * Handle final_rejected event.
 * Sets pipeline.current_tier to halted. Adds active blocker.
 * @param {import('./constants').StateJson} state
 * @param {Object} context
 * @returns {MutationResult}
 */
function handleFinalRejected(state, context) { /* ... */ }

// ─── Triage Mutation Helpers ────────────────────────────────────────────────

/**
 * Apply task-level triage result to state.
 * Sets task.review_verdict, task.review_action.
 * Manages triage_attempts: increment on triage, reset on advance.
 * Routes: advanced → advance task, corrective → leave for planner, halted → halt pipeline.
 * @param {import('./constants').StateJson} state
 * @param {import('./triage-engine').TriageResult} triageResult
 * @returns {MutationResult}
 */
function applyTaskTriage(state, triageResult) { /* ... */ }

/**
 * Apply phase-level triage result to state.
 * Sets phase.phase_review_verdict, phase.phase_review_action.
 * Manages triage_attempts: increment on triage, reset on advance.
 * Routes: advanced → advance phase, corrective → leave for planner, halted → halt pipeline.
 * @param {import('./constants').StateJson} state
 * @param {import('./triage-engine').TriageResult} triageResult
 * @returns {MutationResult}
 */
function applyPhaseTriage(state, triageResult) { /* ... */ }

module.exports = { getMutation, needsTriage, applyTaskTriage, applyPhaseTriage, MUTATIONS };
```

### State I/O Interface

```javascript
// .github/orchestration/scripts/lib/state-io.js

'use strict';

/**
 * Read and parse state.json from a project directory.
 * @param {string} projectDir - Absolute path to project directory
 * @returns {import('./constants').StateJson|null} Parsed state object, or null if file does not exist
 * @throws {Error} If file exists but cannot be parsed
 */
function readState(projectDir) { /* ... */ }

/**
 * Atomically write state.json to a project directory.
 * Updates project.updated timestamp before writing.
 * Uses writeFileSync for atomic (non-interleaved) writes.
 * @param {string} projectDir - Absolute path to project directory
 * @param {import('./constants').StateJson} state - State object to write
 * @returns {void}
 */
function writeState(projectDir, state) { /* ... */ }

/**
 * Read and parse orchestration.yml.
 * Falls back to built-in defaults if file not found.
 * @param {string} [configPath] - Path to orchestration.yml; auto-discovers if omitted
 * @returns {{ limits: Object, human_gates: Object, errors: Object, projects: Object }}
 */
function readConfig(configPath) { /* ... */ }

/**
 * Read a markdown document and extract frontmatter.
 * Used as the readDocument callback for triage-engine.executeTriage().
 * @param {string} docPath - Absolute path to markdown document
 * @returns {{ frontmatter: Object, body: string }}
 * @throws {Error} If document not found (DOCUMENT_NOT_FOUND)
 */
function readDocument(docPath) { /* ... */ }

/**
 * Create project directory structure: projectDir/, phases/, tasks/, reports/.
 * No-op for directories that already exist.
 * @param {string} projectDir - Absolute path to project directory
 * @returns {void}
 */
function ensureDirectories(projectDir) { /* ... */ }

module.exports = { readState, writeState, readConfig, readDocument, ensureDirectories };
```

### Pipeline CLI Interface

```javascript
// .github/orchestration/scripts/pipeline.js

#!/usr/bin/env node
'use strict';

/**
 * CLI entry point for the unified event-driven pipeline.
 *
 * Usage:
 *   node pipeline.js --event <name> --project-dir <path> [--config <path>] [--context <json>]
 *
 * Flags:
 *   --event        (required) Event name from the closed vocabulary
 *   --project-dir  (required) Absolute path to project directory
 *   --config       (optional) Path to orchestration.yml
 *   --context      (optional) JSON string with event-specific context
 *
 * Output:
 *   stdout: JSON PipelineResult
 *   stderr: Diagnostic messages
 *   Exit 0: Success
 *   Exit 1: Error
 */

/**
 * Parse CLI arguments from process.argv.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ event: string, projectDir: string, configPath?: string, context?: Object }}
 * @throws {Error} If required flags are missing or context is invalid JSON
 */
function parseArgs(argv) { /* ... */ }

// require.main === module guard
// Exports parseArgs for testing
module.exports = { parseArgs };
```

### Preserved Module Interfaces (Unchanged)

```javascript
// .github/orchestration/scripts/lib/resolver.js (PRESERVED)

/**
 * @param {import('./constants').StateJson|null|undefined} state
 * @param {OrchestratorConfig} [config]
 * @returns {{ action: string, context: Object }}
 */
function resolveNextAction(state, config) { /* ... */ }
```

```javascript
// .github/orchestration/scripts/lib/state-validator.js (PRESERVED)

/**
 * @param {import('./constants').StateJson} current
 * @param {import('./constants').StateJson} proposed
 * @returns {{ valid: boolean, invariants_checked: number, errors?: Array<{ invariant: string, message: string }> }}
 */
function validateTransition(current, proposed) { /* ... */ }
```

```javascript
// .github/orchestration/scripts/lib/triage-engine.js (PRESERVED)

/**
 * @param {import('./constants').StateJson} state
 * @param {'task'|'phase'} level
 * @param {(docPath: string) => { frontmatter: Object, body: string }} readDocument
 * @returns {{ success: boolean, level: string, verdict?: string, action?: string, ... }}
 */
function executeTriage(state, level, readDocument) { /* ... */ }
```

## API Endpoints

> This project has no HTTP API. The "API" is the CLI interface of `pipeline.js`. The Orchestrator agent calls this script via terminal execution.

### CLI Contract

```
node .github/orchestration/scripts/pipeline.js --event <name> --project-dir <path> [--config <path>] [--context <json>]
```

### Event Vocabulary (Closed Enum — 19 Events)

| Event | Context Payload | Trigger |
|-------|----------------|---------|
| `start` | `{}` | Cold start / compaction recovery / first run |
| `research_completed` | `{ "doc_path": "<path>" }` | Research agent finished |
| `prd_completed` | `{ "doc_path": "<path>" }` | Product Manager finished |
| `design_completed` | `{ "doc_path": "<path>" }` | UX Designer finished |
| `architecture_completed` | `{ "doc_path": "<path>" }` | Architect finished |
| `master_plan_completed` | `{ "doc_path": "<path>" }` | Architect finished |
| `plan_approved` | `{}` | Human approved master plan |
| `plan_rejected` | `{}` | Human rejected master plan |
| `phase_plan_created` | `{ "plan_path": "<path>" }` | Tactical Planner finished phase plan |
| `task_handoff_created` | `{ "handoff_path": "<path>" }` | Tactical Planner finished task handoff |
| `task_completed` | `{ "report_path": "<path>" }` | Coder finished task |
| `code_review_completed` | `{ "review_path": "<path>" }` | Reviewer finished code review |
| `phase_report_created` | `{ "report_path": "<path>" }` | Tactical Planner finished phase report |
| `phase_review_completed` | `{ "review_path": "<path>" }` | Reviewer finished phase review |
| `gate_approved` | `{ "gate_type": "task\|phase" }` | Human approved gate |
| `gate_rejected` | `{ "gate_type": "task\|phase" }` | Human rejected gate |
| `final_review_completed` | `{ "review_path": "<path>" }` | Final reviewer finished |
| `final_approved` | `{}` | Human approved final review |
| `final_rejected` | `{}` | Human rejected final review |

### Success Result Schema (stdout, exit 0)

```json
{
  "success": true,
  "action": "<NEXT_ACTION enum value>",
  "context": {
    "phase": 0,
    "task": 2,
    "doc_path": "/path/to/relevant/doc",
    "corrective": false,
    "message": "Human-readable description of what to do next"
  },
  "mutations_applied": ["task_status → complete", "review_verdict → approved"],
  "triage_ran": true,
  "validation_passed": true
}
```

### Error Result Schema (stdout, exit 1)

```json
{
  "success": false,
  "error": "Validation failed: V6 — multiple in_progress tasks",
  "event": "task_completed",
  "state_snapshot": { "current_phase": 0, "current_task": 1 },
  "mutations_applied": ["task_status → complete"],
  "validation_passed": false
}
```

### Reduced Action Vocabulary (~18 Actions Returned to Orchestrator)

| # | Action | Category | Orchestrator Operation | Event to Signal |
|---|--------|----------|----------------------|-----------------|
| 1 | `spawn_research` | Agent spawn | Spawn Research agent | `research_completed` |
| 2 | `spawn_prd` | Agent spawn | Spawn Product Manager | `prd_completed` |
| 3 | `spawn_design` | Agent spawn | Spawn UX Designer | `design_completed` |
| 4 | `spawn_architecture` | Agent spawn | Spawn Architect | `architecture_completed` |
| 5 | `spawn_master_plan` | Agent spawn | Spawn Architect | `master_plan_completed` |
| 6 | `create_phase_plan` | Agent spawn | Spawn Tactical Planner (phase plan) | `phase_plan_created` |
| 7 | `create_task_handoff` | Agent spawn | Spawn Tactical Planner (handoff) | `task_handoff_created` |
| 8 | `execute_task` | Agent spawn | Spawn Coder | `task_completed` |
| 9 | `spawn_code_reviewer` | Agent spawn | Spawn Reviewer (task) | `code_review_completed` |
| 10 | `spawn_phase_reviewer` | Agent spawn | Spawn Reviewer (phase) | `phase_review_completed` |
| 11 | `generate_phase_report` | Agent spawn | Spawn Tactical Planner (report) | `phase_report_created` |
| 12 | `spawn_final_reviewer` | Agent spawn | Spawn Reviewer (final) | `final_review_completed` |
| 13 | `request_plan_approval` | Human gate | Present master plan | `plan_approved` / `plan_rejected` |
| 14 | `request_final_approval` | Human gate | Present final review | `final_approved` / `final_rejected` |
| 15 | `gate_task` | Human gate | Present task gate | `gate_approved` / `gate_rejected` |
| 16 | `gate_phase` | Human gate | Present phase gate | `gate_approved` / `gate_rejected` |
| 17 | `display_halted` | Terminal | Display halt message | *(none — terminal)* |
| 18 | `display_complete` | Terminal | Display completion message | *(none — terminal)* |

### Actions Internalized by Pipeline Script

The following ~17 actions from the current 35-action vocabulary are no longer visible to the Orchestrator — they execute internally within the pipeline script:

`init_project`, `transition_to_execution`, `update_state_from_task`, `update_state_from_review`, `update_state_from_phase_review`, `triage_task`, `triage_phase`, `halt_triage_invariant`, `halt_phase_triage_invariant`, `retry_from_review`, `halt_from_review`, `advance_task`, `advance_phase`, `halt_task_failed`, `transition_to_review`, `transition_to_complete`, `create_corrective_handoff`

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| *(none)* | — | Zero npm dependencies — Node.js built-ins only |

### Node.js Built-in Modules Used

| Module | Used By | Purpose |
|--------|---------|---------|
| `node:fs` | `state-io.js` | `readFileSync`, `writeFileSync`, `mkdirSync`, `existsSync` |
| `node:path` | `state-io.js`, `pipeline.js` | Path resolution and joining |
| `node:process` | `pipeline.js` | `process.argv`, `process.stdout`, `process.stderr`, `process.exit` |
| `node:test` | Test files | Test framework |
| `node:assert` | Test files | Assertions |

### Internal Dependencies (module → module)

```
pipeline.js
  └─→ pipeline-engine.js
        ├─→ mutations.js
        │     └─→ constants.js
        ├─→ state-io.js
        │     ├─→ fs-helpers.js  (from validate-orchestration utils)
        │     ├─→ yaml-parser.js (from validate-orchestration utils)
        │     └─→ frontmatter.js (from validate-orchestration utils)
        ├─→ resolver.js
        │     └─→ constants.js
        ├─→ state-validator.js
        │     └─→ constants.js
        └─→ triage-engine.js
              └─→ constants.js
```

### Shared Utilities (Reused from `validate-orchestration`)

| Utility | Import Path | Used By |
|---------|-------------|---------|
| `readFile`, `exists` | `../../skills/validate-orchestration/scripts/lib/utils/fs-helpers` | `state-io.js` |
| `parseYaml` | `../../skills/validate-orchestration/scripts/lib/utils/yaml-parser` | `state-io.js` |
| `extractFrontmatter` | `../../skills/validate-orchestration/scripts/lib/utils/frontmatter` | `state-io.js` |

These are the same utilities the existing standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) already import. The pipeline script consolidates these imports into `state-io.js`.

## File Structure

### Target State: `.github/orchestration/`

```
.github/orchestration/
├── orchestration.yml                          # PRESERVED — system configuration
└── scripts/
    ├── pipeline.js                            # NEW — CLI entry point (~20 lines)
    ├── lib/
    │   ├── constants.js                       # PRESERVED (260 lines)
    │   ├── resolver.js                        # PRESERVED (495 lines)
    │   ├── state-validator.js                 # PRESERVED (500 lines)
    │   ├── triage-engine.js                   # PRESERVED (526 lines)
    │   ├── pipeline-engine.js                 # NEW — orchestration recipe (~150-200 lines)
    │   ├── mutations.js                       # NEW — event mutation table (~300-400 lines)
    │   └── state-io.js                        # NEW — I/O isolation (~80-120 lines)
    └── tests/
        ├── constants.test.js                  # PRESERVED (343 lines)
        ├── resolver.test.js                   # PRESERVED (794 lines)
        ├── state-validator.test.js            # PRESERVED (709 lines)
        ├── triage-engine.test.js              # PRESERVED (747 lines)
        ├── pipeline.test.js                   # NEW — CLI integration tests
        ├── pipeline-engine.test.js            # NEW — engine integration tests (mocked I/O)
        ├── mutations.test.js                  # NEW — unit tests per mutation function
        ├── state-io.test.js                   # NEW — I/O module tests
        ├── agents.test.js                     # UPDATED — agent definition changes
        ├── config.test.js                     # PRESERVED
        ├── cross-refs.test.js                 # UPDATED — skill rename, file deletions
        ├── frontmatter.test.js                # PRESERVED
        ├── fs-helpers.test.js                 # PRESERVED
        ├── instructions.test.js               # UPDATED — state-management.instructions.md deleted
        ├── prompts.test.js                    # PRESERVED
        ├── reporter.test.js                   # PRESERVED
        ├── skills.test.js                     # UPDATED — triage deleted, review-code → review-task
        ├── structure.test.js                  # UPDATED — directory changes
        └── yaml-parser.test.js                # PRESERVED
```

### Files Removed from `.github/orchestration/`

```
.github/orchestration/
├── schemas/                                   # DELETED — directory removed
│   └── state-json-schema.md                   # DELETED — prose shadow of code
└── scripts/
    ├── next-action.js                         # DELETED — replaced by pipeline.js
    ├── triage.js                              # DELETED — replaced by pipeline.js
    ├── validate-state.js                      # DELETED — replaced by pipeline.js
    └── tests/
        ├── next-action.test.js                # DELETED — replaced by pipeline.test.js
        ├── triage.test.js                     # DELETED — replaced by pipeline.test.js
        └── validate-state.test.js             # DELETED — replaced by pipeline.test.js
```

### Files Removed/Changed Outside `.github/orchestration/`

```
.github/
├── instructions/
│   └── state-management.instructions.md       # DELETED
├── skills/
│   ├── triage-report/                         # DELETED (entire directory)
│   ├── review-code/                           # RENAMED → review-task/
│   │   └── SKILL.md                           # UPDATED — name, description
│   ├── create-task-handoff/
│   │   └── SKILL.md                           # UPDATED — add Prior Context section
│   └── create-phase-plan/
│       └── SKILL.md                           # UPDATED — add Prior Context section
├── agents/
│   ├── orchestrator.agent.md                  # REWRITTEN — event-driven loop, ~18 actions
│   ├── tactical-planner.agent.md              # REWRITTEN — 3 modes, no execute tool, no state writes
│   ├── reviewer.agent.md                      # UPDATED — review-code → review-task
│   └── *.agent.md (7 others)                  # UPDATED — remove STATUS.md / sole-writer language
├── copilot-instructions.md                    # UPDATED — pipeline script as state authority
└── instructions/
    └── project-docs.instructions.md           # UPDATED — state.json ownership, STATUS.md removed
```

### Documentation Updates

```
README.md                                      # UPDATED — pipeline description, agent roles
docs/
├── agents.md                                  # UPDATED — Tactical Planner, Orchestrator descriptions
├── pipeline.md                                # MAJOR REWRITE — event-driven loop, pipeline script
├── scripts.md                                 # MAJOR REWRITE — pipeline.js replaces 3 scripts
├── skills.md                                  # UPDATED — triage deleted, review-task, skill changes
├── project-structure.md                       # UPDATED — schemas/ removed, STATUS.md removed
├── configuration.md                           # UPDATED — state-write authority
├── validation.md                              # UPDATED — remove stale references
├── getting-started.md                         # UPDATED — remove STATUS.md references
└── dashboard.md                               # REVIEWED — verify no STATUS.md dependency
```

## `state.json` Schema Change

One addition to the existing schema — all other fields unchanged:

```javascript
/**
 * Addition to the execution section of StateJson:
 *
 * @property {number} execution.triage_attempts - Persisted triage retry counter (default: 0)
 *
 * Lifecycle:
 *   - Init (new project): 0
 *   - Triage trigger event: increment by 1
 *   - triage_attempts > 1: pipeline returns display_halted (triage invariant violation)
 *   - Advance event (task or phase moves forward): reset to 0
 *   - Cold start: preserve existing value from state.json
 */
```

The `triage_attempts` field is placed in the `execution` section of `state.json` because triage only occurs during the execution tier. This replaces the runtime-local counter previously maintained by the Orchestrator agent (which was lost on context compaction).

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | Pipeline engine catches errors at each step. On validation failure, state is NOT written — previous valid state is preserved. Error results include the event, mutations attempted, and state snapshot for debugging. Exit code 1 on any error. |
| **Validation** | `state-validator.validateTransition(current, proposed)` runs after every mutation and after every triage mutation (two validation passes per triage event). On validation failure the pipeline halts immediately — no partial writes. |
| **Diagnostics / Logging** | stderr for diagnostic output (event received, mutation invoked, validation result, triage decision, resolver input). stdout is exclusively valid JSON. This extends the existing convention from the 3 standalone scripts. |
| **State management** | All state flows through `state-io.js`. No agent directly writes `state.json`. The pipeline script is the sole writer. Deep-clone before mutation ensures the original state is available for validation comparison. |
| **Determinism** | Same event + same `state.json` → same result. No `Date.now()` calls except for `project.updated` timestamp (set in `writeState`). No random values. No ambient runtime state. `triage_attempts` is persisted, not held in memory. |
| **Atomicity** | `writeFileSync` ensures non-interleaved writes. The pipeline validates before writing — invalid state never hits disk. On triage events, two validate-write cycles occur (post-mutation and post-triage). |
| **Recovery** | The Orchestrator recovers from context compaction by calling `pipeline.js --event start`. All state is in `state.json` (including `triage_attempts`). No runtime counters, no agent memory required. |
| **Extensibility** | Adding a new event type requires: (1) add a mutation function in `mutations.js`, (2) optionally add a triage trigger rule. No changes to existing mutations, CLI entry point, or Orchestrator definition (unless the event maps to a new external action). |
| **Test isolation** | The `PipelineIO` interface injected into `executePipeline()` is the sole I/O boundary. Tests provide mock implementations of `readState`, `writeState`, `readConfig`, `readDocument`, and `ensureDirectories`. Domain modules (`mutations.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) are pure functions testable without mocks. |

## Pipeline Engine Internal Flow

The pipeline engine follows a deterministic linear recipe. This diagram shows the step-by-step flow within a single `executePipeline()` call:

```
executePipeline(request, io)
│
├─ 1. Parse request: { event, projectDir, configPath, context }
│
├─ 2. io.readState(projectDir)
│     ├─ state == null AND event == 'start'
│     │   └─ INIT PATH:
│     │       ├─ io.readConfig(configPath)
│     │       ├─ io.ensureDirectories(projectDir)
│     │       ├─ scaffoldInitialState(config)       ← builds state from template + config
│     │       ├─ io.writeState(projectDir, state)
│     │       └─ goto step 6 (resolve)
│     ├─ state == null AND event != 'start'
│     │   └─ ERROR: "No state.json found; use --event start"
│     └─ state exists → continue
│
├─ 3. event == 'start' (cold start, state exists)
│     └─ Skip mutation → goto step 6 (resolve)
│
├─ 4. MUTATE:
│     ├─ currentState = deepClone(state)
│     ├─ mutation = mutations.getMutation(event)
│     │   └─ not found → ERROR: "Unknown event"
│     ├─ { state: proposedState, mutations_applied } = mutation(state, enrichedContext)
│     │   └─ For task_completed: pipeline engine pre-reads report frontmatter via io.readDocument()
│     │      and enriches context with { report_status, report_severity, report_deviations }
│     ├─ VALIDATE: stateValidator.validateTransition(currentState, proposedState)
│     │   └─ invalid → ERROR: state NOT written, return validation errors
│     └─ io.writeState(projectDir, proposedState)
│
├─ 5. TRIAGE CHECK:
│     ├─ { shouldTriage, level } = mutations.needsTriage(event, proposedState)
│     ├─ shouldTriage == false → goto step 6
│     ├─ Check triage_attempts:
│     │   └─ proposedState.execution.triage_attempts > 1 → return { action: 'display_halted' }
│     ├─ priorState = deepClone(proposedState)
│     ├─ triageResult = triageEngine.executeTriage(proposedState, level, io.readDocument)
│     │   └─ !triageResult.success → ERROR
│     ├─ triageMutation = mutations.applyTaskTriage(proposedState, triageResult)
│     │   (or applyPhaseTriage for phase level)
│     ├─ VALIDATE: stateValidator.validateTransition(priorState, proposedState)
│     │   └─ invalid → ERROR
│     └─ io.writeState(projectDir, proposedState)
│
├─ 6. RESOLVE:
│     ├─ io.readConfig(configPath)                   ← for human gate mode resolution
│     └─ result = resolver.resolveNextAction(proposedState, config)
│
└─ 7. OUTPUT:
      └─ return { success: true, action: result.action, context: result.context,
                  mutations_applied, triage_ran, validation_passed: true }
```

### Triage Trigger Rules

| Event | Triggers Triage? | Level |
|-------|-----------------|-------|
| `task_completed` | Yes | `task` |
| `code_review_completed` | Yes | `task` |
| `phase_review_completed` | Yes | `phase` |
| All other events | No | — |

### Task Report Pre-Read

When handling `task_completed`, the pipeline engine enriches the context before passing it to the mutation function:

1. Pipeline engine calls `io.readDocument(context.report_path)`
2. Extracts from frontmatter: `status`, `severity`, `deviations`
3. Adds to context: `report_status`, `report_severity`, `report_deviations`
4. Passes enriched context to `handleTaskCompleted(state, enrichedContext)`

This keeps the mutation function pure (no I/O) while allowing it to use report data for state updates.

## Agent Definition Changes

### Orchestrator Agent (`.github/agents/orchestrator.agent.md`)

**Rewrite** to an event-driven controller:

- **Tools**: `read`, `search`, `agent`, `execute` (unchanged)
- **Agents**: unchanged agent list
- **Event loop**: 
  1. Call `pipeline.js --event <name> --project-dir <path> [--context <json>]`
  2. Parse JSON result from stdout
  3. Route on `result.action` against ~18-entry action table
  4. If agent spawn → spawn agent → signal completion event → go to 1
  5. If human gate → present to human → signal gate result event → go to 1
  6. If terminal → display message → stop
- **Recovery**: Call `pipeline.js --event start --project-dir <path>` to recover from any state
- **Remove**: `STATUS.md` references, runtime `triage_attempts` counter, 35-action table, all intermediate mechanical actions
- **Add**: Event signaling reference (which event to signal after each action completes)

### Tactical Planner Agent (`.github/agents/tactical-planner.agent.md`)

**Rewrite** to a pure planning agent with 3 modes:

- **Tools**: `read`, `search`, `edit`, `todo` — **remove `execute`**
- **Mode 1**: Create Phase Plan (reads Master Plan, Architecture, Design, `state.json` read-only)
- **Mode 2**: Create Task Handoff (reads Phase Plan, Architecture, Design, `state.json` read-only)
- **Mode 3**: Generate Phase Report (reads Phase Plan, Task Reports, Code Reviews, `state.json` read-only)
- **Remove**: Mode 1 (Initialize Project), Mode 2 (Update State), triage invocation from all modes, `STATUS.md` references, all state-write instructions, `triage-report` skill reference
- **Add**: "Prior Context" reading pattern — each mode reads `state.json` for computed fields (`review_action`, `phase_review_action`) and adjusts output accordingly

### Reviewer Agent (`.github/agents/reviewer.agent.md`)

- Update `review-code` skill reference to `review-task`

### All Other Agents (7 agent files)

- Remove "only the Tactical Planner does that" language referencing `state.json` / `STATUS.md`
- Replace with updated sole-writer language: "No agent directly writes `state.json` — all state mutations flow through the pipeline script"

## Skill Changes

### `triage-report` Skill — DELETED

The entire `.github/skills/triage-report/` directory is deleted. Its content disposition:

| Content | Disposition |
|---------|-------------|
| Decision tables (task-level 11 rows, phase-level 5 rows) | Already in `triage-engine.js` (code is canonical) |
| State write contract | Moves to `mutations.js` (applyTaskTriage, applyPhaseTriage) |
| Write ordering rules | Enforced by pipeline engine sequencing |
| Immutability rules | Enforced by `state-validator.js` (V14, V15) |
| Planning-relevant guidance | Folds into `create-task-handoff` and `create-phase-plan` skills |

### `review-code` → `review-task` — RENAMED

- Rename directory: `.github/skills/review-code/` → `.github/skills/review-task/`
- Update `SKILL.md`: name, description to reflect task-level scope
- Update all cross-references: `reviewer.agent.md`, `docs/skills.md`, `docs/agents.md`, `cross-refs.test.js`

### `create-task-handoff` — UPDATED

Add a "Prior Context" section to the SKILL.md workflow:

```
## Prior Context (Corrective Handling)

Before creating the task handoff:

1. Read state.json → current task's review_action field
2. If review_action == "corrective_task_issued":
   a. Read the code review at the task's review_doc path
   b. Extract the Issues table from the review
   c. These issues become the primary objective of the corrective handoff
3. If review_action == "advanced" or null: proceed with normal handoff creation
```

### `create-phase-plan` — UPDATED

Add a "Prior Context" section to the SKILL.md workflow:

```
## Prior Context (Corrective Handling)

Before creating the phase plan:

1. Read state.json → current phase's phase_review_action field
2. If phase_review_action == "corrective_tasks_issued":
   a. Read the phase review at the phase's phase_review path
   b. Extract the Cross-Task Issues section
   c. Create corrective tasks targeting those issues
3. If phase_review_action == "advanced" or null: proceed with normal phase plan creation
```

## Phasing Recommendations

> These are advisory suggestions. The Tactical Planner makes final phasing decisions.

### Phase 1: Pipeline Script Core

**Goal**: Build the new pipeline script with full event handling, replacing the 3 standalone scripts.

**Scope**:
- Create `state-io.js` — I/O isolation module
- Create `mutations.js` — all 18 event mutation handlers + triage mutation helpers + `needsTriage()` + `getMutation()`
- Create `pipeline-engine.js` — linear recipe composing mutations, validator, triage engine, resolver
- Create `pipeline.js` — CLI entry point with arg parsing
- Add `triage_attempts` to `state.json` scaffolding (init path)
- Unit tests for all mutation functions (`mutations.test.js`)
- Integration tests for pipeline engine with mocked I/O (`pipeline-engine.test.js`)
- I/O module tests (`state-io.test.js`)
- CLI integration tests (`pipeline.test.js`)

**Exit criteria**: All new tests pass. All 4 preserved lib test suites pass unchanged. Pipeline script handles all 19 events correctly with deterministic output.

### Phase 2: Agent & Skill Refactor

**Goal**: Update agent definitions and skills to match the new pipeline architecture.

**Scope**:
- Rewrite Orchestrator agent definition — event-driven loop, ~18-action table
- Rewrite Tactical Planner agent definition — 3 modes, no `execute` tool, no state writes
- Update Reviewer agent definition — `review-code` → `review-task`
- Update all 7 other agent definitions — remove STATUS.md / sole-writer language
- Rename `review-code` skill directory to `review-task`, update SKILL.md
- Delete `triage-report` skill directory
- Update `create-task-handoff` skill — add Prior Context section
- Update `create-phase-plan` skill — add Prior Context section
- Update `copilot-instructions.md` — pipeline script as state authority
- Update `project-docs.instructions.md` — state.json ownership, STATUS.md removed

**Exit criteria**: All agent definitions reference the pipeline script. No agent mentions `STATUS.md`. Tactical Planner has no state-write instructions. Orchestrator has ~18-action table. Updated validation tests pass.

### Phase 3: Cleanup & Deletion

**Goal**: Remove deprecated files and directories.

**Scope**:
- Delete `next-action.js`, `triage.js`, `validate-state.js`
- Delete `next-action.test.js`, `triage.test.js`, `validate-state.test.js`
- Delete `state-json-schema.md` and `schemas/` directory
- Delete `state-management.instructions.md`
- Update validation test files (`agents.test.js`, `cross-refs.test.js`, `skills.test.js`, `instructions.test.js`, `structure.test.js`) to reflect deletions and renames

**Exit criteria**: No deleted files exist. All validation tests pass. No dangling cross-references.

### Phase 4: Documentation

**Goal**: Comprehensive documentation update to reflect the new architecture.

**Scope**:
- Major rewrite: `docs/scripts.md` (pipeline.js replaces 3 scripts, new CLI interface, reduced action vocabulary)
- Major rewrite: `docs/pipeline.md` (event-driven loop, pipeline script flow)
- Update: `docs/agents.md` (Tactical Planner 3 modes, Orchestrator event loop)
- Update: `docs/skills.md` (triage deleted, review-task, skill changes)
- Update: `docs/project-structure.md` (schemas/ removed, STATUS.md removed, new files)
- Update: `docs/configuration.md`, `docs/validation.md`, `docs/getting-started.md`
- Review: `docs/dashboard.md` (verify no STATUS.md dependency)
- Update: `README.md` (pipeline description, agent roles, key rules)

**Exit criteria**: All documentation accurately reflects the post-refactor architecture. No references to deleted files, STATUS.md, or the old 3-script architecture. Documentation validation tests pass.
