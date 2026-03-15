---
project: "STATE-TRANSITION-SCRIPTS"
status: "draft"
author: "architect-agent"
created: "2026-03-08T00:00:00Z"
---

# STATE-TRANSITION-SCRIPTS — Architecture

## Technical Overview

Three deterministic JavaScript CLI scripts replace the LLM-derived routing, triage, and state-validation logic in the orchestration pipeline's execution phase. Each script is a zero-dependency Node.js CommonJS module following the existing `validate-orchestration` CLI pattern: shebang, `parseArgs()`, async `main()`, `if (require.main === module)` guard, and structured JSON on stdout. Core logic is exported as pure functions for direct `require()` in tests; dependency injection (a `readDocument` callback) keeps the triage engine filesystem-free in test contexts. All shared enums live in a single constants module to prevent string-literal drift.

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI Layer (Entry Points)                                       │
│  src/next-action.js · src/triage.js · src/validate-state.js     │
│  parseArgs, main(), process.exit, stdout/stderr I/O             │
├─────────────────────────────────────────────────────────────────┤
│  Domain Logic Layer (Pure Functions)                             │
│  src/lib/resolver.js · src/lib/triage-engine.js                 │
│  src/lib/state-validator.js                                     │
│  Decision trees, decision tables, invariant checks              │
├─────────────────────────────────────────────────────────────────┤
│  Shared Constants Layer                                         │
│  src/lib/constants.js                                           │
│  Enums: tiers, statuses, verdicts, actions, NextAction vocab    │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure / Utilities Layer (Reused)                      │
│  .github/skills/validate-orchestration/scripts/lib/utils/       │
│  fs-helpers.js · frontmatter.js · yaml-parser.js                │
└─────────────────────────────────────────────────────────────────┘
```

**Layer separation rationale**: CLI entry points handle I/O (file reads, stdout writes, exit codes). Domain logic is pure-function — it accepts parsed objects and returns result objects, never touches the filesystem. The constants layer is shared by all domain modules and tests. Infrastructure utilities are reused from validate-orchestration via relative import — no duplication.

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| `next-action` | CLI | `src/next-action.js` | CLI entry point for the Next-Action Resolver. Parses `--state` and `--config` flags, reads files, calls `resolveNextAction()`, emits JSON to stdout. |
| `triage` | CLI | `src/triage.js` | CLI entry point for the Triage Executor. Parses `--state`, `--level`, `--project-dir` flags, wires `readDocument` to real filesystem, calls `executeTriage()`, writes state.json, emits JSON to stdout. |
| `validate-state` | CLI | `src/validate-state.js` | CLI entry point for the State Transition Validator. Parses `--current` and `--proposed` flags, reads both files, calls `validateTransition()`, emits JSON to stdout. |
| `resolver` | Domain | `src/lib/resolver.js` | Pure function `resolveNextAction(state, config?)` implementing the full ~30-branch routing decision tree. Returns `NextActionResult`. |
| `triage-engine` | Domain | `src/lib/triage-engine.js` | Pure function `executeTriage(state, level, readDocument)` implementing both task-level (11-row) and phase-level (5-row) decision tables. Uses dependency-injected `readDocument(path)` for document access. Returns `TriageResult`. |
| `state-validator` | Domain | `src/lib/state-validator.js` | Pure function `validateTransition(current, proposed)` checking all 15 invariants (V1–V15). Returns `ValidationResult`. |
| `constants` | Shared | `src/lib/constants.js` | Single source of truth for all enum values: pipeline tiers, planning statuses, planning step statuses, task/phase statuses, review verdicts, review actions, phase review actions, severity levels, human gate modes, next-action vocabulary, triage levels. |
| `fs-helpers` | Infrastructure (reused) | `.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` | `readFile(path)`, `exists(path)`, `isDirectory(path)`, `listFiles(dir, suffix)`, `listDirs(dir)`. Imported by CLI entry points only. |
| `frontmatter` | Infrastructure (reused) | `.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` | `extractFrontmatter(content)` — returns `{ frontmatter, body }`. Used by the triage CLI to extract review verdicts from markdown documents. |
| `yaml-parser` | Infrastructure (reused) | `.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` | `parseYaml(yamlString)` — returns parsed object. Used by the next-action CLI to read `orchestration.yml`. |

## Contracts & Interfaces

All interfaces use JSDoc `@typedef` annotations (the project is CommonJS JavaScript, not TypeScript). These are the exact contracts that implementation and tests must conform to.

### StateJson Shape

```javascript
// src/lib/constants.js — referenced by all modules
// This formalizes the shape scripts consume from state.json.

/**
 * @typedef {Object} StateJson
 * @property {Object} project
 * @property {string} project.name
 * @property {string} project.created - ISO 8601 timestamp
 * @property {string} project.updated - ISO 8601 timestamp
 * @property {Object} pipeline
 * @property {'planning'|'execution'|'review'|'complete'|'halted'} pipeline.current_tier
 * @property {'ask'|'phase'|'task'|'autonomous'} pipeline.human_gate_mode
 * @property {Object} planning
 * @property {'not_started'|'in_progress'|'complete'} planning.status
 * @property {Object} planning.steps
 * @property {PlanningStep} planning.steps.research
 * @property {PlanningStep} planning.steps.prd
 * @property {PlanningStep} planning.steps.design
 * @property {PlanningStep} planning.steps.architecture
 * @property {PlanningStep} planning.steps.master_plan
 * @property {boolean} planning.human_approved
 * @property {Object} execution
 * @property {'not_started'|'in_progress'|'complete'|'halted'} execution.status
 * @property {number} execution.current_phase - 0-based index into phases[]
 * @property {number} execution.total_phases
 * @property {Phase[]} execution.phases
 * @property {Object} final_review
 * @property {'not_started'|'in_progress'|'complete'|'failed'} final_review.status
 * @property {string|null} final_review.report_doc
 * @property {boolean} final_review.human_approved
 * @property {Object} errors
 * @property {number} errors.total_retries
 * @property {number} errors.total_halts
 * @property {string[]} errors.active_blockers
 * @property {Object} limits
 * @property {number} limits.max_phases
 * @property {number} limits.max_tasks_per_phase
 * @property {number} limits.max_retries_per_task
 */

/**
 * @typedef {Object} PlanningStep
 * @property {'not_started'|'in_progress'|'complete'|'failed'|'skipped'} status
 * @property {string|null} output - Relative path to output document
 */

/**
 * @typedef {Object} Phase
 * @property {number} phase_number - 1-based
 * @property {string} title
 * @property {'not_started'|'in_progress'|'complete'|'failed'|'halted'} status
 * @property {string|null} phase_doc
 * @property {number} current_task - 0-based index into tasks[]
 * @property {number} total_tasks
 * @property {Task[]} tasks
 * @property {string|null} phase_report
 * @property {boolean} human_approved
 * @property {string|null} phase_review
 * @property {'approved'|'changes_requested'|'rejected'|null} phase_review_verdict
 * @property {'advanced'|'corrective_tasks_issued'|'halted'|null} phase_review_action
 */

/**
 * @typedef {Object} Task
 * @property {number} task_number - 1-based
 * @property {string} title
 * @property {'not_started'|'in_progress'|'complete'|'failed'|'halted'} status
 * @property {string|null} handoff_doc
 * @property {string|null} report_doc
 * @property {number} retries
 * @property {string|null} last_error
 * @property {'minor'|'critical'|null} severity
 * @property {string|null} review_doc
 * @property {'approved'|'changes_requested'|'rejected'|null} review_verdict
 * @property {'advanced'|'corrective_task_issued'|'halted'|null} review_action
 */
```

### Next-Action Resolver Interfaces

```javascript
// src/lib/resolver.js

/**
 * @typedef {Object} NextActionResult
 * @property {string} action - One of NEXT_ACTIONS enum values (~30 possible values)
 * @property {Object} context
 * @property {string} context.tier - Current pipeline tier (PIPELINE_TIERS enum)
 * @property {number|null} context.phase_index - 0-based index, null if not in execution tier
 * @property {number|null} context.task_index - 0-based index, null if not task-scoped
 * @property {string|null} context.phase_id - Human-readable e.g. "P01", null if N/A
 * @property {string|null} context.task_id - Human-readable e.g. "P01-T03", null if N/A
 * @property {string} context.details - Explanation of the resolution path taken
 */

/**
 * @typedef {Object} OrchestratorConfig
 * @property {Object} [human_gates]
 * @property {'ask'|'phase'|'task'|'autonomous'} [human_gates.execution_mode]
 * @property {Object} [projects]
 * @property {string} [projects.base_path]
 */

/**
 * Resolve the next action the Orchestrator should take.
 * Pure function: same inputs always produce same output.
 *
 * @param {StateJson} state - Parsed state.json object
 * @param {OrchestratorConfig} [config] - Parsed orchestration.yml (optional; needed for human_gate_mode resolution)
 * @returns {NextActionResult}
 */
function resolveNextAction(state, config) { /* ... */ }
```

### Triage Engine Interfaces

```javascript
// src/lib/triage-engine.js

/**
 * @typedef {Object} TriageSuccess
 * @property {true} success
 * @property {'task'|'phase'} level
 * @property {'approved'|'changes_requested'|'rejected'|null} verdict
 * @property {'advanced'|'corrective_task_issued'|'halted'|null} action - Task-level action enum
 * @property {number} phase_index - 0-based
 * @property {number|null} task_index - 0-based, null for phase-level
 * @property {number} row_matched - 1-indexed decision table row
 * @property {string} details - Why this row matched
 */

/**
 * @typedef {Object} TriageError
 * @property {false} success
 * @property {'task'|'phase'} level
 * @property {string} error - Structured error message
 * @property {'DOCUMENT_NOT_FOUND'|'INVALID_VERDICT'|'IMMUTABILITY_VIOLATION'|'INVALID_STATE'|'INVALID_LEVEL'} error_code
 * @property {number} phase_index - 0-based
 * @property {number|null} task_index - 0-based, null for phase-level
 */

/**
 * @typedef {TriageSuccess|TriageError} TriageResult
 */

/**
 * @callback ReadDocumentFn
 * @param {string} docPath - Absolute or project-relative path to the document
 * @returns {string|null} Document content as string, or null if not found
 */

/**
 * Execute triage for the current task or phase.
 * Pure function with dependency injection for document reading.
 * Does NOT write to state.json — returns the resolved verdict/action for the caller to write.
 *
 * @param {StateJson} state - Parsed state.json object
 * @param {'task'|'phase'} level - Which decision table to evaluate
 * @param {ReadDocumentFn} readDocument - Injected callback for reading review/report documents
 * @returns {TriageResult}
 */
function executeTriage(state, level, readDocument) { /* ... */ }

/**
 * Check retry budget for Row 10 logic.
 * Named function for readability and targeted testability.
 *
 * @param {Task} task - The current task object from state.json
 * @param {Object} limits - The limits object from state.json
 * @param {number} limits.max_retries_per_task
 * @returns {'corrective_task_issued'|'halted'} The resolved action
 */
function checkRetryBudget(task, limits) { /* ... */ }
```

### State Validator Interfaces

```javascript
// src/lib/state-validator.js

/**
 * @typedef {Object} InvariantError
 * @property {string} invariant - Invariant identifier: "V1" through "V15"
 * @property {string} message - Human-readable description with specific field paths and values
 * @property {'critical'} severity - Always "critical" — all invariant violations are blocking
 */

/**
 * @typedef {Object} ValidationPass
 * @property {true} valid
 * @property {number} invariants_checked - Always 15
 */

/**
 * @typedef {Object} ValidationFail
 * @property {false} valid
 * @property {number} invariants_checked - Always 15
 * @property {InvariantError[]} errors - One entry per violated invariant
 */

/**
 * @typedef {ValidationPass|ValidationFail} ValidationResult
 */

/**
 * Validate a proposed state.json transition against all 15 documented invariants.
 * Pure function: compares current and proposed state objects.
 *
 * @param {StateJson} current - The current (committed) state.json object
 * @param {StateJson} proposed - The proposed (uncommitted) state.json object
 * @returns {ValidationResult}
 */
function validateTransition(current, proposed) { /* ... */ }
```

### Shared Constants Interface

```javascript
// src/lib/constants.js

/**
 * @type {Readonly<{PLANNING: 'planning', EXECUTION: 'execution', REVIEW: 'review', COMPLETE: 'complete', HALTED: 'halted'}>}
 */
const PIPELINE_TIERS = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete'}>}
 */
const PLANNING_STATUSES = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', SKIPPED: 'skipped'}>}
 */
const PLANNING_STEP_STATUSES = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'}>}
 */
const PHASE_STATUSES = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete', FAILED: 'failed', HALTED: 'halted'}>}
 */
const TASK_STATUSES = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{APPROVED: 'approved', CHANGES_REQUESTED: 'changes_requested', REJECTED: 'rejected'}>}
 */
const REVIEW_VERDICTS = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{ADVANCED: 'advanced', CORRECTIVE_TASK_ISSUED: 'corrective_task_issued', HALTED: 'halted'}>}
 */
const REVIEW_ACTIONS = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{ADVANCED: 'advanced', CORRECTIVE_TASKS_ISSUED: 'corrective_tasks_issued', HALTED: 'halted'}>}
 * Note: Uses plural "corrective_tasks_issued" — intentionally different from task-level REVIEW_ACTIONS.
 */
const PHASE_REVIEW_ACTIONS = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{MINOR: 'minor', CRITICAL: 'critical'}>}
 */
const SEVERITY_LEVELS = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{ASK: 'ask', PHASE: 'phase', TASK: 'task', AUTONOMOUS: 'autonomous'}>}
 */
const HUMAN_GATE_MODES = Object.freeze({ /* ... */ });

/**
 * @type {Readonly<{TASK: 'task', PHASE: 'phase'}>}
 */
const TRIAGE_LEVELS = Object.freeze({ /* ... */ });

/**
 * Complete closed enum of next-action values (~30 values).
 * @type {Readonly<{
 *   INIT_PROJECT: 'init_project',
 *   DISPLAY_HALTED: 'display_halted',
 *   SPAWN_RESEARCH: 'spawn_research',
 *   SPAWN_PRD: 'spawn_prd',
 *   SPAWN_DESIGN: 'spawn_design',
 *   SPAWN_ARCHITECTURE: 'spawn_architecture',
 *   SPAWN_MASTER_PLAN: 'spawn_master_plan',
 *   REQUEST_PLAN_APPROVAL: 'request_plan_approval',
 *   TRANSITION_TO_EXECUTION: 'transition_to_execution',
 *   CREATE_PHASE_PLAN: 'create_phase_plan',
 *   CREATE_TASK_HANDOFF: 'create_task_handoff',
 *   EXECUTE_TASK: 'execute_task',
 *   UPDATE_STATE_FROM_TASK: 'update_state_from_task',
 *   CREATE_CORRECTIVE_HANDOFF: 'create_corrective_handoff',
 *   HALT_TASK_FAILED: 'halt_task_failed',
 *   SPAWN_CODE_REVIEWER: 'spawn_code_reviewer',
 *   UPDATE_STATE_FROM_REVIEW: 'update_state_from_review',
 *   TRIAGE_TASK: 'triage_task',
 *   HALT_TRIAGE_INVARIANT: 'halt_triage_invariant',
 *   RETRY_FROM_REVIEW: 'retry_from_review',
 *   HALT_FROM_REVIEW: 'halt_from_review',
 *   ADVANCE_TASK: 'advance_task',
 *   GATE_TASK: 'gate_task',
 *   GENERATE_PHASE_REPORT: 'generate_phase_report',
 *   SPAWN_PHASE_REVIEWER: 'spawn_phase_reviewer',
 *   UPDATE_STATE_FROM_PHASE_REVIEW: 'update_state_from_phase_review',
 *   TRIAGE_PHASE: 'triage_phase',
 *   HALT_PHASE_TRIAGE_INVARIANT: 'halt_phase_triage_invariant',
 *   GATE_PHASE: 'gate_phase',
 *   ADVANCE_PHASE: 'advance_phase',
 *   TRANSITION_TO_REVIEW: 'transition_to_review',
 *   SPAWN_FINAL_REVIEWER: 'spawn_final_reviewer',
 *   REQUEST_FINAL_APPROVAL: 'request_final_approval',
 *   TRANSITION_TO_COMPLETE: 'transition_to_complete',
 *   DISPLAY_COMPLETE: 'display_complete'
 * }>}
 */
const NEXT_ACTIONS = Object.freeze({ /* ... */ });
```

### CLI Entry Point Signatures

Each CLI entry point exports `parseArgs` and the core logic import for testability:

```javascript
// src/next-action.js
/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ state: string, config: string|null }}
 */
function parseArgs(argv) { /* ... */ }

module.exports = { parseArgs };
// Core logic exported from src/lib/resolver.js


// src/triage.js
/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ state: string, level: 'task'|'phase', projectDir: string }}
 */
function parseArgs(argv) { /* ... */ }

module.exports = { parseArgs };
// Core logic exported from src/lib/triage-engine.js


// src/validate-state.js
/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{ current: string, proposed: string }}
 */
function parseArgs(argv) { /* ... */ }

module.exports = { parseArgs };
// Core logic exported from src/lib/state-validator.js
```

## API Endpoints

Not applicable. These are CLI scripts, not HTTP services. There are no REST/GraphQL endpoints. The "API" is the CLI flag interface and JSON stdout contract, both fully specified in the Contracts & Interfaces section above and in the Design document's CLI Interface Design section.

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| *(none)* | — | Zero external dependencies. All scripts use only Node.js built-ins (`fs`, `path`, `process`). |

### Internal Dependencies (module → module)

```
src/next-action.js (CLI)
  → src/lib/resolver.js (domain)
  → src/lib/constants.js (shared)
  → .github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js (infra)
  → .github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js (infra)

src/triage.js (CLI)
  → src/lib/triage-engine.js (domain)
  → src/lib/constants.js (shared)
  → .github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js (infra)
  → .github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js (infra)

src/validate-state.js (CLI)
  → src/lib/state-validator.js (domain)
  → src/lib/constants.js (shared)
  → .github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js (infra)

src/lib/resolver.js (domain)
  → src/lib/constants.js (shared)

src/lib/triage-engine.js (domain)
  → src/lib/constants.js (shared)
  (does NOT import fs-helpers or frontmatter — uses injected readDocument callback)

src/lib/state-validator.js (domain)
  → src/lib/constants.js (shared)

src/lib/constants.js (shared)
  → (no dependencies — leaf module)
```

**Key constraint**: Domain logic modules (`resolver.js`, `triage-engine.js`, `state-validator.js`) never import filesystem utilities directly. Only CLI entry points perform I/O. This keeps domain logic pure and testable.

### Utility Import Paths

The existing utils are imported via relative path from `src/` to `.github/skills/validate-orchestration/scripts/lib/utils/`:

```javascript
// From src/next-action.js (example)
const { readFile, exists } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { parseYaml } = require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser');

// From src/triage.js (example)
const { readFile } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { extractFrontmatter } = require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter');
```

## File Structure

```
src/
├── next-action.js                # Script 1: Next-Action Resolver CLI entry point
├── triage.js                     # Script 2: Triage Executor CLI entry point
├── validate-state.js             # Script 3: State Transition Validator CLI entry point
└── lib/
    ├── resolver.js               # Core routing logic: resolveNextAction(state, config?)
    ├── triage-engine.js          # Core triage logic: executeTriage(state, level, readDocument)
    ├── state-validator.js        # Core validation logic: validateTransition(current, proposed)
    └── constants.js              # Shared enums — single source of truth for all values

tests/
├── resolver.test.js              # ~30 resolution path tests (all NextAction values)
├── triage-engine.test.js         # 16 decision table row tests + error cases
├── state-validator.test.js       # 15 invariant tests (positive + negative per invariant)
└── constants.test.js             # Enum completeness, no value overlap, freeze checks
```

**Placement rationale**: Scripts go under `src/` because they are core system infrastructure invoked by agents during pipeline execution. This contrasts with `validate-orchestration` which lives under `.github/skills/` as skill-specific tooling. The `src/` placement signals "runtime pipeline dependency" vs. `.github/skills/` which signals "development-time validation aid".

**Test file naming**: Test files mirror domain module names (`resolver.test.js` tests `lib/resolver.js`), consistent with the existing convention where `agents.test.js` tests `checks/agents.js`.

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Error handling** | Scripts never throw unhandled exceptions. Domain functions return structured error results (e.g., `{ success: false, error_code: '...', error: '...' }` for triage, `{ valid: false, errors: [...] }` for validation). CLI wrappers catch unexpected errors in the `main().catch()` safety net and write `[ERROR] <script>: <message>` to stderr before calling `process.exit(1)`. Expected failures exit with code `1` and structured JSON on stdout; unexpected crashes exit with code `1` and diagnostic on stderr. |
| **Logging** | Diagnostic output goes to stderr only via `console.error()`. stdout is reserved exclusively for structured JSON output. No `console.log()` calls except the final `JSON.stringify` result write. This preserves machine-readability — agents parse stdout with `JSON.parse()`. |
| **Output formatting** | No ANSI colors in output. JSON output uses `JSON.stringify(result, null, 2)` for human-debuggable formatting with deterministic key ordering. All JSON keys are sorted or follow a fixed declaration order to ensure identical output for identical inputs. |
| **State management** | Only the triage CLI entry point (`src/triage.js`) writes to `state.json` and only for verdict/action fields. It uses the atomic write pattern: read full file → modify in-memory object → `JSON.stringify(state, null, 2)` → `fs.writeFileSync()`. The validator CLI reads but never writes `state.json`. The resolver CLI reads but never writes `state.json`. |
| **Immutability enforcement** | The triage engine checks that target verdict/action fields are `null` before allowing a write. The state validator independently enforces V15 (cross-task immutability) as a second layer of defense. |
| **Write ordering enforcement** | The triage engine writes verdict + action in a single atomic JSON rewrite — no partial writes. The state validator independently enforces V14 (verdict before handoff ordering) on the current→proposed diff. |
| **Determinism** | Domain functions are pure: no `Date.now()`, no `Math.random()`, no ambient state reads. The CLI entry points handle timestamps (the Tactical Planner sets `project.updated`, not these scripts). Decision table evaluation is order-stable (first matching row wins, rows evaluated sequentially). |
| **Null treatment** | Absent fields are treated as `null` per V10. All field access uses defensive patterns: `(task.review_doc ?? null) !== null` rather than truthy checks, to avoid `0` or `""` false negatives. |

## Agent & Skill Prose Changes

This section specifies which agent and skill files must be modified so they invoke the scripts instead of re-deriving logic from prose. The Coder agent implementing these changes will modify the markdown content of these files.

### Orchestrator Agent — `orchestrator.agent.md`

**File**: `.github/agents/orchestrator.agent.md`

**What changes**: The prose decision tree (currently Steps 2a–2f or equivalent branching logic) is replaced with a workflow that:

1. Calls the Next-Action Resolver:
   ```
   node src/next-action.js --state {project_dir}/state.json --config .github/orchestration.yml
   ```
2. Parses the JSON output: `result = JSON.parse(stdout)`
3. Pattern-matches on `result.action` to determine which agent/skill to spawn
4. Manages a runtime-local `triage_attempts` counter:
   - Increments on `triage_task` or `triage_phase` actions
   - Resets to 0 on `advance_task` or `advance_phase` actions
   - Halts if `triage_attempts > 1` (instead of spawning triage again)

**What does NOT change**: The Orchestrator still never writes `state.json`. It still spawns agents via Copilot Chat. It still manages the human conversation. Only the routing decision logic is delegated to the script.

### Tactical Planner Agent — `tactical-planner.agent.md`

**File**: `.github/agents/tactical-planner.agent.md`

**Changes in Mode 3** (Phase-Level Planning/Triage):
- Replace "Execute `triage-report` skill (phase-level)" with:
  ```
  node src/triage.js --state {state_path} --level phase --project-dir {project_dir}
  ```
- Parse result; if `success === false`, record error in `errors.active_blockers` and halt

**Changes in Mode 4** (Task-Level Handoff/Triage):
- Replace "Execute `triage-report` skill (task-level)" with:
  ```
  node src/triage.js --state {state_path} --level task --project-dir {project_dir}
  ```
- Parse result; if `success === false`, record error in `errors.active_blockers` and halt

**Changes in all state-writing modes** (Mode 2, 3, 4, 5):
- Before every `state.json` write, call the validator:
  ```
  node src/validate-state.js --current {state_path} --proposed {temp_path}
  ```
- If `valid === false`, record `errors` array in `errors.active_blockers`, delete temp file, halt — do NOT commit the write
- If `valid === true`, replace `state.json` with the proposed file

**What does NOT change**: The Tactical Planner remains the sole writer of `state.json` and `STATUS.md`. Its mode structure (Modes 1–5) and document creation responsibilities are unchanged.

### Triage Report Skill — `triage-report/SKILL.md`

**File**: `.github/skills/triage-report/SKILL.md`

**What changes**: Add a notice section at the top (below frontmatter) stating:
- The decision tables in this document are now **documentation only**
- The authoritative executor is the Triage Executor script at `src/triage.js`
- The tables remain for human readability and as the specification the script implements
- Agents should call the script rather than interpreting the tables directly

**What does NOT change**: The decision tables themselves remain as-is. The markdown content is not removed or restructured — it serves as the human-readable specification.

### State Management Instructions — `state-management.instructions.md`

**File**: `.github/instructions/state-management.instructions.md`

**What changes**: Add an instruction block:
- The Tactical Planner must call the State Transition Validator before every `state.json` write
- Document the CLI interface: `node src/validate-state.js --current <path> --proposed <path>`
- Document the expected output format: `{ "valid": true }` or `{ "valid": false, "errors": [...] }`
- On validation failure: record errors in `errors.active_blockers`, halt, do NOT commit the write

### Files NOT Changed

| File | Reason |
|------|--------|
| `.github/agents/coder.agent.md` | Reads only Task Handoff; no routing or triage logic |
| `.github/agents/reviewer.agent.md` | Produces verdicts in frontmatter; no routing or triage logic |
| `.github/agents/research.agent.md` | Planning-only agent |
| `.github/agents/product-manager.agent.md` | Planning-only agent |
| `.github/agents/ux-designer.agent.md` | Planning-only agent |
| `.github/agents/architect.agent.md` | Planning-only agent |
| `.github/agents/brainstormer.agent.md` | Standalone, outside pipeline |
| `plan/schemas/state-json-schema.md` | No schema changes — scripts consume the existing shape |
| `.github/orchestration.yml` | No configuration changes |

## Dependency Injection Design

The triage engine's core function accepts a `readDocument` callback instead of performing filesystem I/O directly. This is the critical testability seam for the most complex script.

### Production Wiring (in `src/triage.js`)

```javascript
// src/triage.js — CLI entry point wires real filesystem access
const { readFile } = require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers');
const { extractFrontmatter } = require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter');

/**
 * Production readDocument implementation.
 * Reads a markdown file from disk and extracts its frontmatter.
 *
 * @param {string} docPath - Absolute path to the document
 * @returns {{ frontmatter: Record<string, any> | null, body: string } | null}
 */
function readDocument(docPath) {
  const content = readFile(docPath);
  if (content === null) return null;
  return extractFrontmatter(content);
}
```

### Test Wiring (in test files)

```javascript
// tests/triage-engine.test.js — tests inject mock readDocument
function mockReadDocument(mockDocs) {
  return (docPath) => {
    const entry = mockDocs[docPath];
    if (!entry) return null;
    return { frontmatter: entry.frontmatter, body: entry.body || '' };
  };
}

// Usage:
const result = executeTriage(mockState, 'task', mockReadDocument({
  '/project/reports/TASK-REPORT-P01-T01.md': {
    frontmatter: { status: 'complete', verdict: 'approved' },
    body: '...'
  }
}));
```

## No State Schema Changes

The `state.json` schema (`plan/schemas/state-json-schema.md`) remains unchanged. Specifically:

- No new fields are added to `state.json`
- No existing fields change type or meaning
- The `triage_attempts` counter is intentionally NOT added to `state.json` — it remains a runtime-local variable in the Orchestrator agent's context
- The `limits` object in `state.json` (copied from `orchestration.yml` at project init) provides all limit values the scripts need — Scripts 2 and 3 read limits from `state.json`, not from `orchestration.yml`
- Script 1 may optionally read `orchestration.yml` for `human_gates.execution_mode` if not already reflected in `state.json → pipeline.human_gate_mode`

## Phasing Recommendations

The Tactical Planner will make final phasing decisions. These are advisory suggestions based on dependency ordering and risk.

1. **Phase 1 — Foundation**: Shared constants module + state validator
   - `src/lib/constants.js` — all enums (leaf dependency, blocks everything)
   - `src/lib/state-validator.js` — invariant checks (depends only on constants)
   - `src/validate-state.js` — CLI wrapper
   - `tests/constants.test.js` — enum completeness
   - `tests/state-validator.test.js` — all 15 invariants (positive + negative)
   - **Exit criteria**: All 15 invariants tested, validator CLI runs end-to-end, constants module frozen

2. **Phase 2 — Next-Action Resolver**: Routing logic + Orchestrator prose update
   - `src/lib/resolver.js` — full ~30-branch decision tree
   - `src/next-action.js` — CLI wrapper
   - `tests/resolver.test.js` — all ~30 resolution paths
   - Orchestrator agent prose rewrite (`.github/agents/orchestrator.agent.md`)
   - **Exit criteria**: Every NextAction value has a test, Orchestrator calls script instead of prose routing

3. **Phase 3 — Triage Executor**: Decision tables + Tactical Planner prose update
   - `src/lib/triage-engine.js` — 11-row task table + 5-row phase table + `checkRetryBudget()`
   - `src/triage.js` — CLI wrapper with filesystem wiring + state.json write
   - `tests/triage-engine.test.js` — all 16 rows + error cases
   - Tactical Planner agent prose rewrite (`.github/agents/tactical-planner.agent.md`)
   - Triage-report skill update (`.github/skills/triage-report/SKILL.md`)
   - State-management instructions update (`.github/instructions/state-management.instructions.md`)
   - **Exit criteria**: All 16 rows tested, Row 10 branching fully covered, triage CLI writes state.json correctly, Tactical Planner calls scripts

4. **Phase 4 — Integration & Polish**: End-to-end checks + existing test regression
   - Verify all three scripts work together in a simulated pipeline sequence
   - Run existing `validate-orchestration` test suite to confirm no regressions
   - Confirm updated agent prose is internally consistent (no residual prose-derived routing or triage)
   - **Exit criteria**: All tests pass, no regressions in existing test suite, agent prose review confirms no residual inline logic
