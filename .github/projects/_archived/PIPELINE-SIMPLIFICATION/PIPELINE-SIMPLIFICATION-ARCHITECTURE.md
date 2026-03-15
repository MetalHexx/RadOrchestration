---
project: "PIPELINE-SIMPLIFICATION"
status: "draft"
author: "architect-agent"
created: "2026-03-14T00:00:00Z"
---

# PIPELINE-SIMPLIFICATION — Architecture

## Technical Overview

The pipeline simplification replaces the current 7-module, ~2,620-line engine with a 7-module, ~1,100-line engine that enforces a single invariant: one event → one mutation → one validation → one write → one external action. The triage layer is eliminated by absorbing its ~80 lines of decision-table logic into mutation handlers; the 16 internal actions are eliminated by making mutations produce final state (including pointer advances and tier transitions); the validator drops from 15 invariants to ~11 by removing split-write guards that are impossible to violate under atomic writes. Modules live in `.github/orchestration/scripts/lib/`. The technology stack is unchanged: zero-dependency Node.js with `node:test`, JSDoc types, frozen enum objects, and dependency-injected I/O.

## System Layers

This is a CLI pipeline engine, not a web application. The layer model maps to pipeline concerns rather than traditional presentation/application/domain/infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│  Entry Point (CLI)          pipeline.js                         │
│  Arg parsing, DI construction, stdout/stderr, exit codes        │
├─────────────────────────────────────────────────────────────────┤
│  Engine (Orchestration)     pipeline-engine.js                  │
│  Declarative recipe: load → pre-read → mutate → validate →     │
│  write → resolve → return                                       │
├─────────────────────────────────────────────────────────────────┤
│  Domain (Pipeline Logic)    mutations.js, pre-reads.js,         │
│                             resolver.js, validator.js,          │
│                             constants.js                        │
│  Event handlers, decision tables, artifact validation,          │
│  action resolution, state invariant checks, enums/types         │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure (I/O)       state-io.js                         │
│  Filesystem reads/writes, config loading, document parsing      │
│  (dependency-injected via PipelineIO interface)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `pipeline.js` | Entry Point | `.github/orchestration/scripts/pipeline.js` | CLI arg parsing, DI construction (real I/O), delegates to `processEvent`, writes JSON result to stdout, sets exit code |
| `pipeline-engine.js` | Engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Declarative recipe (~70 lines): init/cold-start early returns, then linear load→pre-read→mutate→validate→write→resolve→return. Exports `processEvent` and `scaffoldInitialState` |
| `mutations.js` | Domain | `.github/orchestration/scripts/lib/mutations.js` | 17 event→handler lookup table. Each handler produces final state in one operation. Absorbs decision-table logic via `resolveTaskOutcome` and `resolvePhaseOutcome` helpers. Includes pointer advances and tier transitions within the mutation |
| `pre-reads.js` | Domain | `.github/orchestration/scripts/lib/pre-reads.js` | Artifact extraction and validation for 5 event types. Pure functions: reads agent output documents, validates required frontmatter fields, returns enriched context or structured error. No state mutation |
| `resolver.js` | Domain | `.github/orchestration/scripts/lib/resolver.js` | Pure state inspector. Given post-mutation state and config, returns the single external action the Orchestrator should execute next. ~19 external-only actions, zero internal actions |
| `validator.js` | Domain | `.github/orchestration/scripts/lib/validator.js` | ~11 structural and transition invariant checks. Runs once per event (not twice). Returns structured errors with invariant IDs. Compares current-vs-proposed for transition guards |
| `constants.js` | Domain | `.github/orchestration/scripts/lib/constants.js` | Frozen enum objects (reduced `NEXT_ACTIONS` to ~19), JSDoc `@typedef` definitions for `StateJson`, `Phase`, `Task`, `PlanningStep`, `PipelineResult`, `Config`. Schema version `orchestration-state-v3` |
| `state-io.js` | Infrastructure | `.github/orchestration/scripts/lib/state-io.js` | `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories`. Dependency-injected into the engine. Sole setter of `project.updated` timestamp. Largely unchanged from current |

## Contracts & Interfaces

### PipelineIO — Dependency Injection Boundary

```javascript
// .github/orchestration/scripts/lib/state-io.js

/**
 * @typedef {Object} PipelineIO
 * @property {(projectDir: string) => StateJson | null} readState
 * @property {(projectDir: string, state: StateJson) => void} writeState
 * @property {(configPath?: string) => Config} readConfig
 * @property {(docPath: string) => ParsedDocument | null} readDocument
 * @property {(projectDir: string) => void} ensureDirectories
 */

/**
 * @typedef {Object} ParsedDocument
 * @property {Object | null} frontmatter
 * @property {string} body
 */
```

### PipelineResult — Engine Output Contract

```javascript
// .github/orchestration/scripts/lib/constants.js

/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success - true = event processed; false = pre-read or validation failure
 * @property {string | null} action - one of NEXT_ACTIONS values when success; null on failure
 * @property {Object} context - action-specific routing data, or structured error info on failure
 * @property {string[]} mutations_applied - human-readable mutation descriptions; empty on failure
 */
```

### StateJson — State Schema v3

```javascript
// .github/orchestration/scripts/lib/constants.js

/**
 * @typedef {Object} StateJson
 * @property {'orchestration-state-v3'} $schema
 * @property {ProjectMeta} project
 * @property {Planning} planning
 * @property {Execution} execution
 */

/**
 * @typedef {Object} ProjectMeta
 * @property {string} name
 * @property {string} created
 * @property {string} updated
 */

/**
 * @typedef {Object} Planning
 * @property {string} status - one of PLANNING_STATUSES
 * @property {boolean} human_approved
 * @property {PlanningStep[]} steps
 * @property {string} current_step
 */

/**
 * @typedef {Object} PlanningStep
 * @property {string} name
 * @property {string} status - one of PLANNING_STEP_STATUSES
 * @property {string | null} doc_path
 */

/**
 * @typedef {Object} Execution
 * @property {string} status - one of PHASE_STATUSES or 'not_started' | 'complete'
 * @property {string} current_tier - one of PIPELINE_TIERS
 * @property {number} current_phase - 0-indexed
 * @property {number} total_phases
 * @property {Phase[]} phases
 */
// NOTE: execution.triage_attempts REMOVED in v3

/**
 * @typedef {Object} Phase
 * @property {string} name
 * @property {string} status - one of PHASE_STATUSES
 * @property {number} current_task - 0-indexed
 * @property {number} total_tasks
 * @property {Task[]} tasks
 * @property {string | null} phase_plan_doc
 * @property {string | null} phase_report_doc
 * @property {string | null} phase_review_doc
 * @property {string | null} phase_review_verdict
 * @property {string | null} phase_review_action
 */
// NOTE: phase.triage_attempts REMOVED in v3

/**
 * @typedef {Object} Task
 * @property {string} name
 * @property {string} status - one of TASK_STATUSES
 * @property {string | null} handoff_doc
 * @property {string | null} report_doc
 * @property {string | null} review_doc
 * @property {string | null} review_verdict
 * @property {string | null} review_action
 * @property {boolean} has_deviations
 * @property {string | null} deviation_type
 * @property {number} retries
 */
```

### processEvent — Engine Entry Point

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

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

/**
 * Create initial state for a new project.
 *
 * @param {Config} config - parsed orchestration config
 * @param {string} projectDir - absolute path to project directory
 * @returns {StateJson} - fresh v3 state object
 */
function scaffoldInitialState(config, projectDir) { /* ... */ }
```

### Pre-Read Contracts

```javascript
// .github/orchestration/scripts/lib/pre-reads.js

/**
 * @typedef {Object} PreReadSuccess
 * @property {Object} context - enriched context with extracted frontmatter fields
 * @property {undefined} error
 */

/**
 * @typedef {Object} PreReadFailure
 * @property {undefined} context
 * @property {{ error: string, event: string, field?: string }} error
 */

/**
 * Pre-read agent output documents and extract/validate required frontmatter.
 * Events not in the lookup table pass through with unmodified context.
 *
 * @param {string} event
 * @param {Object} context
 * @param {(docPath: string) => ParsedDocument | null} readDocument
 * @param {string} projectDir
 * @returns {PreReadSuccess | PreReadFailure}
 */
function preRead(event, context, readDocument, projectDir) { /* ... */ }
```

**Per-event pre-read contracts (5 events requiring document validation):**

| Event | Document Source | Required Frontmatter Fields | Enriched Context Keys |
|-------|---------------|----------------------------|----------------------|
| `plan_approved` | Master plan at `context.doc_path` | `total_phases` (positive integer) | `{ total_phases }` |
| `task_completed` | Task report at `context.doc_path` | `status`, `has_deviations`, `deviation_type` | `{ report_status, has_deviations, deviation_type }` |
| `code_review_completed` | Code review at `context.doc_path` | `verdict` | `{ verdict, review_doc_path }` |
| `phase_plan_created` | Phase plan at `context.doc_path` | `tasks` (non-empty array) | `{ tasks }` |
| `phase_review_completed` | Phase review at `context.doc_path` | `verdict`, `exit_criteria_met` | `{ verdict, exit_criteria_met, review_doc_path }` |

**Status normalization (applied during `task_completed` pre-read):**

| Raw Value | Normalized To |
|-----------|---------------|
| `complete`, `pass` | `complete` |
| `failed`, `fail`, `partial` | `failed` |

### Mutation Contracts

```javascript
// .github/orchestration/scripts/lib/mutations.js

/**
 * @typedef {Object} MutationResult
 * @property {StateJson} state - the mutated state
 * @property {string[]} mutations_applied - human-readable mutation descriptions
 */

/**
 * @callback MutationHandler
 * @param {StateJson} state - deep clone of current state (safe to mutate)
 * @param {Object} context - enriched context from pre-read
 * @param {Config} config - parsed orchestration config
 * @returns {MutationResult}
 */

/**
 * Look up the mutation handler for a given event.
 *
 * @param {string} event
 * @returns {MutationHandler | undefined}
 */
function getMutation(event) { /* ... */ }

/**
 * Normalize a document path to project-relative form.
 *
 * @param {string} docPath
 * @param {string} basePath
 * @param {string} projectName
 * @returns {string}
 */
function normalizeDocPath(docPath, basePath, projectName) { /* ... */ }
```

**Decision-table helpers (internal to mutations.js, not exported):**

```javascript
// .github/orchestration/scripts/lib/mutations.js (internal)

/**
 * @typedef {Object} TaskOutcome
 * @property {string} taskStatus - 'complete' | 'failed' | 'halted'
 * @property {string} reviewAction - 'advanced' | 'corrective_task_issued' | 'halted'
 */

/**
 * 8-row task decision table. Determines task outcome from code review results.
 *
 * @param {string} verdict - 'approved' | 'changes_requested' | 'rejected'
 * @param {string} reportStatus - 'complete' | 'failed' (normalized by pre-read)
 * @param {boolean} hasDeviations
 * @param {string | null} deviationType - 'minor' | 'critical' | null
 * @param {number} retries - current retry count
 * @param {number} maxRetries - from config
 * @returns {TaskOutcome}
 */
function resolveTaskOutcome(verdict, reportStatus, hasDeviations, deviationType, retries, maxRetries) { /* ... */ }

/**
 * @typedef {Object} PhaseOutcome
 * @property {string} phaseStatus - 'complete' | 'in_progress' | 'halted'
 * @property {string} phaseReviewAction - 'advanced' | 'corrective_tasks_issued' | 'halted'
 */

/**
 * 5-row phase decision table. Determines phase outcome from phase review results.
 *
 * @param {string} verdict - 'approved' | 'changes_requested' | 'rejected'
 * @param {boolean} exitCriteriaMet
 * @returns {PhaseOutcome}
 */
function resolvePhaseOutcome(verdict, exitCriteriaMet) { /* ... */ }

/**
 * @param {number} retries
 * @param {number} maxRetries
 * @returns {boolean} true if retries < maxRetries
 */
function checkRetryBudget(retries, maxRetries) { /* ... */ }
```

**Task decision table (8 rows):**

| Row | Verdict | Report Status | Has Deviations | Deviation Type | Retries Left | → Task Status | → Review Action |
|-----|---------|--------------|----------------|----------------|-------------|---------------|----------------|
| 1 | `approved` | `complete` | `false` | — | — | `complete` | `advanced` |
| 2 | `approved` | `complete` | `true` | `minor` | — | `complete` | `advanced` |
| 3 | `approved` | `complete` | `true` | `critical` | — | `complete` | `advanced` |
| 4 | `changes_requested` | `complete` | — | — | yes | `failed` | `corrective_task_issued` |
| 5 | `changes_requested` | `complete` | — | — | no | `halted` | `halted` |
| 6 | `changes_requested` | `failed` | — | — | yes | `failed` | `corrective_task_issued` |
| 7 | `changes_requested` | `failed` | — | — | no | `halted` | `halted` |
| 8 | `rejected` | — | — | — | — | `halted` | `halted` |

**Phase decision table (5 rows):**

| Row | Verdict | Exit Criteria Met | → Phase Status | → Phase Review Action |
|-----|---------|-------------------|----------------|----------------------|
| 1 | `approved` | `true` | `complete` | `advanced` |
| 2 | `approved` | `false` | `complete` | `advanced` |
| 3 | `changes_requested` | — | `in_progress` | `corrective_tasks_issued` |
| 4 | `rejected` | `true` | `halted` | `halted` |
| 5 | `rejected` | `false` | `halted` | `halted` |

### Resolver Contracts

```javascript
// .github/orchestration/scripts/lib/resolver.js

/**
 * @typedef {Object} ResolverResult
 * @property {string} action - one of NEXT_ACTIONS (external only)
 * @property {Object} context - action-specific routing context
 */

/**
 * Pure state inspector. Given post-mutation state 
 * and config, returns the next external action.
 *
 * @param {StateJson} state - post-mutation, post-validation state
 * @param {Config} config - parsed orchestration config
 * @returns {ResolverResult}
 */
function resolveNextAction(state, config) { /* ... */ }
```

**External action set (~19 actions):**

| Category | Action Constant | Description |
|----------|----------------|-------------|
| Planning | `SPAWN_RESEARCH` | Spawn Research agent to gather context |
| Planning | `SPAWN_PRD` | Spawn Product Manager to create PRD |
| Planning | `SPAWN_DESIGN` | Spawn UX Designer to create Design doc |
| Planning | `SPAWN_ARCHITECTURE` | Spawn Architect to create Architecture doc |
| Planning | `SPAWN_MASTER_PLAN` | Spawn Architect to create Master Plan |
| Planning | `REQUEST_PLAN_APPROVAL` | Request human approval of Master Plan |
| Execution — Task | `CREATE_PHASE_PLAN` | Spawn Tactical Planner to create phase plan |
| Execution — Task | `CREATE_TASK_HANDOFF` | Spawn Tactical Planner to create task handoff (fresh or corrective, distinguished by `context.is_correction`) |
| Execution — Task | `EXECUTE_TASK` | Spawn Coder to execute task |
| Execution — Task | `SPAWN_CODE_REVIEWER` | Spawn Reviewer to review task code |
| Execution — Phase | `GENERATE_PHASE_REPORT` | Spawn Tactical Planner to generate phase report |
| Execution — Phase | `SPAWN_PHASE_REVIEWER` | Spawn Reviewer to review phase |
| Gates | `GATE_TASK` | Human gate for task approval (per config) |
| Gates | `GATE_PHASE` | Human gate for phase approval (per config) |
| Review | `SPAWN_FINAL_REVIEWER` | Spawn Reviewer for final project review |
| Review | `REQUEST_FINAL_APPROVAL` | Request human approval of final review |
| Terminal | `DISPLAY_HALTED` | Display halt reason (generic — reason in `context.details`) |
| Terminal | `DISPLAY_COMPLETE` | Display project completion |

**Removed actions (16 internal):**

`ADVANCE_TASK`, `ADVANCE_PHASE`, `TRANSITION_TO_EXECUTION`, `TRANSITION_TO_REVIEW`, `TRANSITION_TO_COMPLETE`, `UPDATE_STATE_FROM_TASK`, `UPDATE_STATE_FROM_REVIEW`, `UPDATE_STATE_FROM_PHASE_REVIEW`, `TRIAGE_TASK`, `TRIAGE_PHASE`, `HALT_TRIAGE_INVARIANT`, `HALT_PHASE_TRIAGE_INVARIANT`, `RETRY_FROM_REVIEW`, `HALT_FROM_REVIEW`, `HALT_TASK_FAILED`, `CREATE_CORRECTIVE_HANDOFF`

**Merged actions:**

| Old Action(s) | New Action | Distinguishing Context |
|---------------|-----------|----------------------|
| `CREATE_TASK_HANDOFF` + `CREATE_CORRECTIVE_HANDOFF` | `CREATE_TASK_HANDOFF` | `context.is_correction: true/false`, `context.previous_review`, `context.reason` |
| `HALT_TASK_FAILED` + `HALT_FROM_REVIEW` + `HALT_TRIAGE_INVARIANT` + `HALT_PHASE_TRIAGE_INVARIANT` | `DISPLAY_HALTED` | `context.details` describes halt reason |

### Validator Contracts

```javascript
// .github/orchestration/scripts/lib/validator.js

/**
 * @typedef {Object} ValidationError
 * @property {string} invariant - invariant ID (e.g., 'V1', 'V12')
 * @property {string} message - human-readable description
 * @property {string} field - dotpath to the violating field
 * @property {*} [current] - current value (for transition checks)
 * @property {*} [proposed] - proposed value (for transition checks)
 */

/**
 * Validate a state transition. Runs structural and transition guards.
 * Returns empty array if valid.
 *
 * @param {StateJson} current - state before mutation
 * @param {StateJson} proposed - state after mutation
 * @param {Config} config - parsed orchestration config
 * @returns {ValidationError[]}
 */
function validateTransition(current, proposed, config) { /* ... */ }
```

**Invariant catalog (~11 invariants):**

| ID | Category | Check | Current→Proposed? |
|----|----------|-------|-------------------|
| V1 | Structural | `current_phase` within `[0, phases.length)` | No — proposed only |
| V2 | Structural | `current_task` within `[0, tasks.length)` for active phase | No — proposed only |
| V3 | Structural | `total_phases` matches `phases.length` | No — proposed only |
| V4 | Structural | `total_tasks` matches `tasks.length` per phase | No — proposed only |
| V5 | Structural | Phase/task counts within config limits (`max_phases`, `max_tasks_per_phase`) | No — proposed only |
| V6 | Gate | Human approval required before execution tier | No — proposed only |
| V7 | Gate | Human approval required before completion (per config `after_final_review`) | No — proposed only |
| V10 | Structural | Active phase `status` is valid for current tier | No — proposed only |
| V11 | Transition | `retries` only increases monotonically | Yes |
| V12 | Transition | Task/phase status transitions follow allowed map | Yes |
| V13 | Transition | `project.updated` timestamp advances | Yes |

**Removed invariants (4):**

| ID | Reason for Removal |
|----|-------------------|
| V8 | `review_doc` set implies `verdict` set — impossible to violate under atomic writes |
| V9 | `phase_review` set implies `verdict` set — impossible to violate under atomic writes |
| V14 | `review_doc` + `verdict` written in same operation — atomic writes by construction |
| V15 | Cross-task immutability within a write — one task changes per event by construction |

### Constants — Enums

```javascript
// .github/orchestration/scripts/lib/constants.js

const PIPELINE_TIERS = Object.freeze({
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const PLANNING_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

const PLANNING_STEP_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

const PHASE_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  HALTED: 'halted',
});

const TASK_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FAILED: 'failed',
  HALTED: 'halted',
});

const REVIEW_VERDICTS = Object.freeze({
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
});

const REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASK_ISSUED: 'corrective_task_issued',
  HALTED: 'halted',
});

const PHASE_REVIEW_ACTIONS = Object.freeze({
  ADVANCED: 'advanced',
  CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued',
  HALTED: 'halted',
});

const SEVERITY_LEVELS = Object.freeze({
  CRITICAL: 'critical',
  MINOR: 'minor',
});

const HUMAN_GATE_MODES = Object.freeze({
  ASK: 'ask',
  PHASE: 'phase',
  TASK: 'task',
  AUTONOMOUS: 'autonomous',
});

const NEXT_ACTIONS = Object.freeze({
  // Planning (6)
  SPAWN_RESEARCH: 'spawn_research',
  SPAWN_PRD: 'spawn_prd',
  SPAWN_DESIGN: 'spawn_design',
  SPAWN_ARCHITECTURE: 'spawn_architecture',
  SPAWN_MASTER_PLAN: 'spawn_master_plan',
  REQUEST_PLAN_APPROVAL: 'request_plan_approval',
  // Execution — Task (4)
  CREATE_PHASE_PLAN: 'create_phase_plan',
  CREATE_TASK_HANDOFF: 'create_task_handoff',
  EXECUTE_TASK: 'execute_task',
  SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
  // Execution — Phase (2)
  GENERATE_PHASE_REPORT: 'generate_phase_report',
  SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
  // Gates (2)
  GATE_TASK: 'gate_task',
  GATE_PHASE: 'gate_phase',
  // Review (2)
  SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
  REQUEST_FINAL_APPROVAL: 'request_final_approval',
  // Terminal (2)
  DISPLAY_HALTED: 'display_halted',
  DISPLAY_COMPLETE: 'display_complete',
});
// 18 total external actions
// TRIAGE_LEVELS enum: REMOVED (no triage layer)
```

### Mutation Event→Handler Map

```javascript
// .github/orchestration/scripts/lib/mutations.js

const MUTATIONS = Object.freeze({
  // Planning events
  research_completed:       handleResearchCompleted,
  prd_completed:            handlePrdCompleted,
  design_completed:         handleDesignCompleted,
  architecture_completed:   handleArchitectureCompleted,
  master_plan_completed:    handleMasterPlanCompleted,
  plan_approved:            handlePlanApproved,
  // Execution events
  phase_plan_created:       handlePhasePlanCreated,
  task_handoff_created:     handleTaskHandoffCreated,
  task_completed:           handleTaskCompleted,
  code_review_completed:    handleCodeReviewCompleted,
  phase_report_created:     handlePhaseReportCreated,
  phase_review_completed:   handlePhaseReviewCompleted,
  // Gate events
  task_approved:            handleTaskApproved,
  phase_approved:           handlePhaseApproved,
  // Review events
  final_review_completed:   handleFinalReviewCompleted,
  final_approved:           handleFinalApproved,
  // Halt
  halt:                     handleHalt,
});
```

### Allowed Status Transitions

```javascript
// .github/orchestration/scripts/lib/validator.js (internal constant)

const ALLOWED_TASK_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'failed', 'halted'],
  'failed':      ['in_progress'],
  'complete':    [],
  'halted':      [],
});

const ALLOWED_PHASE_TRANSITIONS = Object.freeze({
  'not_started': ['in_progress'],
  'in_progress': ['complete', 'halted'],
  'complete':    [],
  'halted':      [],
});
```

## CLI Interface

The pipeline engine is invoked as a CLI tool. There are no REST API endpoints. The Orchestrator calls the pipeline via `node pipeline.js` with the following flags:

| Flag | Required | Type | Description |
|------|----------|------|-------------|
| `--event` | Yes | `string` | Pipeline event name (one of 17 event types) |
| `--project-dir` | Yes | `string` | Absolute path to project directory |
| `--config` | No | `string` | Path to `orchestration.yml`; auto-discovers if omitted |
| `--context` | No | `JSON string` | Event-specific context (e.g., `{ "doc_path": "..." }`) |

**Output**: JSON to stdout conforming to `PipelineResult` contract. Exit code 0 on success, 1 on failure.

## Dependencies

### External Dependencies

None. The pipeline engine is a zero-external-dependency Node.js system. No `package.json` for scripts.

### Standard Library Dependencies

| Module | Usage |
|--------|-------|
| `node:fs` | File read/write in `state-io.js` |
| `node:path` | Path manipulation in `state-io.js`, `pipeline.js` |
| `node:test` | Test runner (`describe`, `it`, `beforeEach`) |
| `node:assert/strict` | Test assertions |

### Cross-Module Dependencies (within `lib/`)

| Module | Imports From | Purpose |
|--------|-------------|---------|
| `pipeline-engine.js` | `pre-reads.js` | `preRead()` for artifact validation |
| `pipeline-engine.js` | `mutations.js` | `getMutation()` for event dispatch |
| `pipeline-engine.js` | `validator.js` | `validateTransition()` for state guards |
| `pipeline-engine.js` | `resolver.js` | `resolveNextAction()` for action resolution |
| `pipeline-engine.js` | `constants.js` | Schema version, action constants |
| `mutations.js` | `constants.js` | Enum values for statuses, actions, verdicts |
| `pre-reads.js` | `constants.js` | Status normalization values |
| `resolver.js` | `constants.js` | `NEXT_ACTIONS`, `PIPELINE_TIERS`, `HUMAN_GATE_MODES` |
| `validator.js` | `constants.js` | Status enums, tier enums |

### External Code Dependencies (outside `lib/`)

| Module | Imports From | Purpose |
|--------|-------------|---------|
| `state-io.js` | `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` | `readFileSync`/`writeFileSync` wrappers |
| `state-io.js` | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | YAML config parsing |
| `state-io.js` | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` | Markdown frontmatter extraction |
| `pipeline.js` | `lib/pipeline-engine.js` | `processEvent` entry point |
| `pipeline.js` | `lib/state-io.js` | Real I/O construction |

### Internal Dependency Graph

```
pipeline.js (Entry Point)
  ├── state-io.js (I/O)
  │     └── validate-orchestration/scripts/lib/utils/*  (fs-helpers, yaml-parser, frontmatter)
  └── pipeline-engine.js (Engine)
        ├── pre-reads.js (Artifact Validation)
        │     └── constants.js
        ├── mutations.js (Event Handlers)
        │     └── constants.js
        ├── resolver.js (Action Resolution)
        │     └── constants.js
        ├── validator.js (State Guards)
        │     └── constants.js
        └── constants.js (Enums & Types)
```

## File Structure

```
.github/orchestration/scripts/
├── pipeline.js                          # CLI entry point
├── lib/                                 # Active v3 modules
│   ├── pipeline-engine.js               # Declarative recipe (~70 lines)
│   ├── mutations.js                     # Event handlers + decision tables (~280 lines)
│   ├── pre-reads.js                     # Artifact extraction/validation (~100 lines)
│   ├── resolver.js                      # External-only action resolution (~200 lines)
│   ├── validator.js                     # ~11 invariant checks (~150 lines)
│   ├── constants.js                     # Reduced enums + v3 types (~170 lines)
│   └── state-io.js                      # I/O (largely unchanged) (~130 lines)
└── tests/                               # Active test files
    ├── pipeline-behavioral.test.js      # End-to-end scenarios via processEvent
    ├── pipeline-engine.test.js          # Engine integration tests
    ├── mutations.test.js                # Per-handler + decision table unit tests
    ├── pre-reads.test.js                # Artifact extraction + validation tests
    ├── resolver.test.js                 # ~18 external action resolution tests
    ├── validator.test.js                # ~11 invariant tests
    ├── pipeline.test.js                 # CLI tests
    ├── constants.test.js                # Enum freeze + completeness tests
    └── state-io.test.js                 # State I/O tests
```

### Delivery Swap Sequence

| Step | Action | Result |
|------|--------|--------|
| 1 | Rename `lib/` → `lib-old/` | Old modules preserved as rollback |
| 2 | Rename `lib-v3/` → `lib/` | New modules become active |
| 3 | Update `pipeline.js` require paths | Entry point references new modules (path stays `./lib/...`) |
| 4 | Copy `tests-v3/*.test.js` → `tests/` (overwrite) | New tests become active |
| 5 | Delete `tests/triage-engine.test.js` | No triage module to test |
| 6 | Run full test suite | Verify new pipeline passes all tests |
| 7 | Delete `lib-old/` | After verification (separate cleanup task) |

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | Three error categories with distinct handling: (1) CLI arg errors → stderr + exit 1; (2) Pre-read failures → `PipelineResult` with `success: false`, structured error with event and field names; (3) Validation failures → `PipelineResult` with `success: false`, array of `ValidationError` objects with invariant IDs. No state write occurs on any failure path. |
| **State integrity** | Single-write guarantee: `io.writeState()` is called exactly once per successful event, after validation passes. `writeState` is the sole setter of `project.updated`. No mutation can produce a partial write. Deep-clone state before mutation to prevent accidental in-place corruption on validation failure. |
| **Dependency injection** | All I/O flows through `PipelineIO` interface. Production uses `state-io.js`; tests use `createMockIO()`. Engine modules never import `fs` or `path` directly. This enables pure unit testing without filesystem access. |
| **Testability** | Factory functions (`createBaseState`, `createExecutionState`, `createReviewState`) produce valid v3 state with spread overrides. `createMockIO` provides in-memory I/O. All inputs and outputs are deep-cloned to prevent cross-test mutation leaks. Each test runs one `processEvent` call per `it` block. |
| **Determinism** | The pipeline is the deterministic authority over agent sequencing. No agent makes process-flow decisions. Mutations are pure functions of `(state, context, config)`. The resolver is a pure function of `(state, config)`. Given the same inputs, the pipeline always produces the same output. |
| **Logging/diagnostics** | Mutation results include `mutations_applied` array with human-readable descriptions (e.g., `"execution.phases[0].tasks[1].status → complete"`). Validation errors include invariant IDs (`V1`–`V13`) for direct cross-reference with validator source. Pre-read errors identify the missing field. |
| **Configuration** | Read from `orchestration.yml` via `io.readConfig()`. Config values used: `limits.max_retries_per_task`, `limits.max_phases`, `limits.max_tasks_per_phase`, `limits.max_consecutive_review_rejections`, `human_gates.execution_mode`, `human_gates.after_final_review`. Config is read once per event at the engine level and passed through to mutations and resolver. |
| **Schema versioning** | State schema bumps from `orchestration-state-v2` to `orchestration-state-v3`. The engine checks `$schema` on load. Existing v2 projects are not migrated in-place — they restart with the new engine. `scaffoldInitialState` produces v3 schema. |
| **Backward compatibility** | The `PipelineResult` contract (`{ success, action, context, mutations_applied }`) is unchanged. The Orchestrator parses this JSON from stdout. The event signaling protocol (17 event types) is unchanged. The only Orchestrator-visible changes are: reduced action set (~18 from 35), `create_corrective_handoff` merged into `create_task_handoff` with `is_correction` context, specific halt actions merged into `display_halted` with `details` context. |
| **Rollback safety** | Old modules preserved in `lib-old/` after swap. If the new engine has issues, restore by renaming `lib/` → `lib-v3/`, `lib-old/` → `lib/`, and reverting `pipeline.js` require paths. Old modules retain their own passing test suite until final cleanup. |

## Phasing Recommendations

The following phasing is advisory — the Tactical Planner makes final phasing decisions.

### Phase 1: Foundation — Constants, Types, and State I/O

**Goal**: Establish the v3 type system, reduced enum set, and I/O layer that all other modules depend on.

**Scope**:
- `lib/constants.js` — all enums (with `NEXT_ACTIONS` reduced to ~18 external-only, `TRIAGE_LEVELS` removed), all JSDoc `@typedef` definitions (updated for v3 schema: removed `triage_attempts` fields)
- `lib/state-io.js` — largely ported from current `state-io.js`, rationalized `writeState` as sole `project.updated` setter
- `tests/constants.test.js` — enum freeze, entry count, completeness
- No dependency on other new modules

**Exit criteria**: `constants.js` and `state-io.js` pass their unit tests. All enums frozen. `NEXT_ACTIONS` has exactly 18 entries. JSDoc types define the v3 schema.

### Phase 2: Core Logic — Pre-Reads, Mutations, Validator

**Goal**: Build the three domain modules that contain all pipeline logic: artifact validation, event handling with decision tables, and state invariant checking.

**Scope**:
- `lib/pre-reads.js` — 5-event lookup table, per-event extraction/validation, status normalization
- `lib/mutations.js` — 17-event handler map, `resolveTaskOutcome` (8-row table), `resolvePhaseOutcome` (5-row table), `checkRetryBudget`, pointer advances and tier transitions within mutations
- `lib/validator.js` — ~11 invariants (V1-V7, V10-V13), structured error output
- `tests/pre-reads.test.js` — per-event extraction, missing fields, invalid values, normalization
- `tests/mutations.test.js` — per-handler tests, decision table row coverage (8+5 rows), pointer advance verification
- `tests/validator.test.js` — per-invariant tests, confirm V8/V9/V14/V15 not checked

**Exit criteria**: All three modules pass their unit tests. Every decision table row has a named test. Pre-read contracts match the 5-event specification. Validator has exactly ~11 invariant checks.

### Phase 3: Engine Assembly — Resolver, Engine, Behavioral Tests

**Goal**: Wire the modules together into the engine recipe. Build the resolver and the full behavioral test suite.

**Scope**:
- `lib/resolver.js` — `resolveNextAction` with ~18 external actions, planning/execution/review/gate resolution, corrective context enrichment, halt consolidation
- `lib/pipeline-engine.js` — the ~20-line declarative recipe, `processEvent`, `scaffoldInitialState`, init/cold-start paths
- `tests/resolver.test.js` — all ~18 actions, per-tier resolution, corrective handoff context, halt context
- `tests/pipeline-engine.test.js` — engine integration (init, cold-start, standard path)
- `tests/pipeline-behavioral.test.js` — end-to-end scenarios: happy path, multi-phase/multi-task, retry/corrective cycles, halt paths, cold-start, pre-read failures, human gate modes, phase lifecycle

**Exit criteria**: `processEvent` follows the linear recipe (no branching by event type in the standard path). Behavioral test suite covers all 10 scenario categories. Every test verifies exactly one write per successful standard event. Full test suite passes.

### Phase 4: Swap, Alignment, and Documentation

**Goal**: Swap new modules into production position. Align agent/skill prompts. Update documentation.

**Scope**:
- Execute swap sequence (complete): `lib/` now contains v3 modules, `pipeline.js` require paths updated, new tests active
- Update Orchestrator agent definition (routing table: remove `create_corrective_handoff`, update halt actions, update action count)
- Update Tactical Planner agent/skill (`is_correction` context flag)
- Update skills referencing triage engine (`generate-task-report`, `review-phase`)
- Update `state-management.instructions.md` (remove "after every triage mutation" clause)
- Update documentation (`docs/scripts.md`, `docs/pipeline.md`, `docs/validation.md`, `docs/agents.md`)
- Delete `lib-old/` after verification

**Exit criteria**: Pipeline runs against its own project. Agent definitions reference no deleted actions. No `.agent.md`, `SKILL.md`, or template references `triage_engine`, `create_corrective_handoff`, or `triage_attempts` as live concepts. Documentation reflects the simplified architecture. `lib-old/` deleted.
