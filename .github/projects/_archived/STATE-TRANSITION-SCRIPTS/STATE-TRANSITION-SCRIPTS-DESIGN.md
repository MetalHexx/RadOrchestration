---
project: "STATE-TRANSITION-SCRIPTS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-08T00:00:00Z"
---

# STATE-TRANSITION-SCRIPTS — Design

## Design Overview

This design specifies the machine interface for three deterministic CLI scripts that replace prose-derived routing and triage logic in the orchestration pipeline. The "users" are agents (Orchestrator, Tactical Planner) invoking scripts via the VS Code terminal and parsing structured JSON from stdout. The interaction model is: agent calls script with flags → script reads `state.json` (and optionally documents) → script emits JSON to stdout → agent pattern-matches on the result to determine its next action.

---

## Agent Workflows

These workflows replace the "user flows" concept — they describe how agents invoke scripts and consume their output.

### Flow 1: Orchestrator Resolves Next Action

```
Orchestrator reads state.json path
  → Orchestrator calls `resolve-next-action` via terminal
    → Script reads state.json (+ orchestration.yml if needed)
    → Script evaluates routing decision tree
    → Script emits JSON to stdout
  → Orchestrator captures stdout
  → Orchestrator calls JSON.parse() on stdout
  → Orchestrator pattern-matches on `result.action`
  → Orchestrator spawns the indicated agent/skill
```

**Preconditions**: `state.json` exists at known path (or does not exist, in which case action is `init_project`).

**Postconditions**: Orchestrator has a single, unambiguous action string from a closed enum.

**Error path**: If script exits with code `1`, Orchestrator reads stderr for diagnostic message and halts pipeline.

**Triage loop guard**: Orchestrator maintains a runtime-local `triage_attempts` counter (not persisted). If reading `triage_task` or `triage_phase` as the action and `triage_attempts > 0`, Orchestrator halts instead of re-invoking triage. Counter resets on task/phase advancement.

### Flow 2: Tactical Planner Executes Task-Level Triage

```
Tactical Planner enters Mode 4 (task-level triage)
  → Planner calls `execute-triage --state <path> --level task --project-dir <dir>`
    → Script reads state.json
    → Script reads task report at state.json → current task's report_doc path
    → Script reads code review at state.json → current task's review_doc path (if non-null)
    → Script evaluates 11-row task-level decision table
    → Script writes review_verdict + review_action to state.json (enforcing write ordering + immutability)
    → Script emits result JSON to stdout
  → Planner captures stdout
  → Planner calls JSON.parse() on stdout
  → If result.success == true: Planner proceeds with resolved action
  → If result.success == false: Planner records result.error in errors.active_blockers, halts
```

**Preconditions**: Current task has a `report_doc` path. `state.json` is readable and writable.

**Postconditions**: `review_verdict` and `review_action` are written to the current task in `state.json`. Script stdout contains the resolved verdict/action.

**Write ordering enforced by script**: verdict/action written BEFORE any subsequent handoff_doc.

**Immutability enforced by script**: Script refuses to overwrite non-null verdict/action for a different task.

### Flow 3: Tactical Planner Executes Phase-Level Triage

```
Tactical Planner enters Mode 3 (phase-level triage)
  → Planner calls `execute-triage --state <path> --level phase --project-dir <dir>`
    → Script reads state.json
    → Script reads phase report at state.json → current phase's phase_report path
    → Script reads phase review at state.json → current phase's phase_review path (if non-null)
    → Script evaluates 5-row phase-level decision table
    → Script writes phase_review_verdict + phase_review_action to state.json
    → Script emits result JSON to stdout
  → Planner captures stdout, parses JSON
  → If result.success == true: Planner proceeds with resolved action
  → If result.success == false: Planner records error, halts
```

**Preconditions**: Current phase has a `phase_report` path (skip if first phase with no report). `state.json` is readable and writable.

**Postconditions**: `phase_review_verdict` and `phase_review_action` written to current phase in `state.json`.

### Flow 4: Tactical Planner Validates State Transition

```
Tactical Planner prepares proposed state.json changes
  → Planner writes proposed state to a temporary file
  → Planner calls `validate-state-transition --current <state.json> --proposed <temp-file>`
    → Script reads both files
    → Script evaluates all 15 invariants (V1–V15)
    → Script emits validation result JSON to stdout
  → Planner captures stdout, parses JSON
  → If result.valid == true: Planner commits proposed state (replaces state.json)
  → If result.valid == false: Planner reads result.errors array
    → Planner records invariant violations in errors.active_blockers
    → Planner halts — does NOT commit the write
```

**Preconditions**: Both current `state.json` and proposed state file exist at valid paths.

**Postconditions**: Planner knows whether the transition is legal and which invariants (if any) are violated.

**Integration with other writes**: Every Mode 2 (state update), Mode 3 (phase plan), Mode 4 (task handoff), and Mode 5 (phase report) write must call the validator before committing.

### Flow 5: Developer Runs Test Suite

```
Developer opens terminal
  → Runs `node tests/resolve-next-action.test.js`
    → Tests import core logic via require()
    → Tests exercise all ~30 resolution paths
    → Tests report pass/fail via node:test output
  → Runs `node tests/execute-triage.test.js`
    → Tests exercise all 16 decision table rows
  → Runs `node tests/validate-state-transition.test.js`
    → Tests exercise all 15 invariants (positive + negative cases)
```

**Preconditions**: Node.js 18+ installed. No npm install required.

**Postconditions**: All tests pass with exit code `0`. No LLM or external service required.

---

## CLI Interface Design

### Script 1: Next-Action Resolver

**File**: `resolve-next-action.js`

**Purpose**: Pure function that reads `state.json` and returns the exact next action for the Orchestrator.

#### Arguments & Flags

| Flag | Required | Type | Default | Description |
|------|----------|------|---------|-------------|
| `--state` | Yes | `string` (file path) | — | Path to `state.json`. If the file does not exist, the script returns action `init_project`. |
| `--config` | No | `string` (file path) | — | Path to `orchestration.yml`. Required only when `state.json → pipeline.human_gate_mode` needs to be resolved from config. If omitted, the script reads `human_gate_mode` from `state.json → pipeline.human_gate_mode` directly. |

#### Invocation Example

```bash
node resolve-next-action.js --state .github/projects/MYAPP/state.json --config .github/orchestration.yml
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — valid JSON written to stdout |
| `1` | Error — diagnostic message written to stderr |

#### Determinism Contract

Given identical `state.json` content (and identical `orchestration.yml` if provided), the output is always identical. No randomness, no time-dependence, no ambient state.

---

### Script 2: Triage Executor

**File**: `execute-triage.js`

**Purpose**: Evaluates the appropriate triage decision table and writes verdict/action to `state.json`.

#### Arguments & Flags

| Flag | Required | Type | Default | Description |
|------|----------|------|---------|-------------|
| `--state` | Yes | `string` (file path) | — | Path to `state.json`. Script both reads and writes this file. |
| `--level` | Yes | `string` enum | — | Triage level: `task` or `phase`. Determines which decision table to evaluate. |
| `--project-dir` | Yes | `string` (directory path) | — | Base directory of the project. Used to resolve relative document paths stored in `state.json` (e.g., `report_doc`, `review_doc`). |

#### Invocation Examples

```bash
# Task-level triage
node execute-triage.js --state .github/projects/MYAPP/state.json --level task --project-dir .github/projects/MYAPP

# Phase-level triage
node execute-triage.js --state .github/projects/MYAPP/state.json --level phase --project-dir .github/projects/MYAPP
```

#### Document Resolution

The script derives document paths from `state.json` fields — the caller does NOT pass document paths as flags:

| Triage Level | Document | State Field | Required |
|---|---|---|---|
| `task` | Task Report | `phases[current_phase].tasks[current_task].report_doc` | Always |
| `task` | Code Review | `phases[current_phase].tasks[current_task].review_doc` | Only if non-null |
| `phase` | Phase Report | `phases[current_phase].phase_report` | Always (skip if null on first phase) |
| `phase` | Phase Review | `phases[current_phase].phase_review` | Only if non-null |

Paths stored in `state.json` are resolved relative to `--project-dir`.

#### State Write Behavior

The script writes directly to `state.json` (the file at `--state`). Specifically:

- **Task-level**: Writes `review_verdict` and `review_action` on the current task object
- **Phase-level**: Writes `phase_review_verdict` and `phase_review_action` on the current phase object
- **Write ordering**: verdict and action are written atomically in a single `JSON.stringify` + `fs.writeFileSync` call — no partial writes
- **Immutability check**: Before writing, the script verifies that the target verdict/action fields are currently `null`. If non-null, the script refuses the write and returns an error.

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — triage resolved, state.json updated, result JSON on stdout |
| `1` | Error — triage failed (missing document, invalid verdict, immutability violation). Error JSON on stdout, diagnostic on stderr. State.json NOT modified. |

---

### Script 3: State Transition Validator

**File**: `validate-state-transition.js`

**Purpose**: Validates a proposed `state.json` against all 15 documented invariants by comparing current and proposed state.

#### Arguments & Flags

| Flag | Required | Type | Default | Description |
|------|----------|------|---------|-------------|
| `--current` | Yes | `string` (file path) | — | Path to the current (committed) `state.json`. |
| `--proposed` | Yes | `string` (file path) | — | Path to the proposed (uncommitted) `state.json`. The Tactical Planner writes the proposed state to a temporary file before calling the validator. |

#### Invocation Example

```bash
node validate-state-transition.js --current .github/projects/MYAPP/state.json --proposed /tmp/proposed-state.json
```

#### Validation Scope

The validator checks ALL 15 invariants (V1–V15). Some invariants require only the proposed state; others require comparing current vs. proposed:

| Category | Invariants | Inputs Needed |
|---|---|---|
| Structural bounds | V1, V2, V4, V5 | Proposed only |
| Value limits | V3 | Proposed only |
| Uniqueness | V6 | Proposed only |
| Preconditions | V7 | Proposed only |
| Triage consistency | V8, V9 | Proposed only |
| Null treatment | V10 | Proposed only |
| Monotonicity | V11 | Current + Proposed |
| State machine | V12 | Current + Proposed |
| Timestamp | V13 | Current + Proposed |
| Write ordering | V14 | Current + Proposed |
| Immutability | V15 | Current + Proposed |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All invariants pass — valid JSON on stdout with `"valid": true` |
| `1` | One or more invariants violated — JSON on stdout with `"valid": false` and error details. OR unexpected error (diagnostic on stderr). |

---

### Shared Constants Module

**File**: `constants.js`

**Purpose**: Single source of truth for all enum values used across all three scripts and their tests.

#### Exported Enums

| Enum Name | Values | Used By |
|---|---|---|
| `PIPELINE_TIERS` | `planning`, `execution`, `review`, `complete`, `halted` | All scripts |
| `PLANNING_STATUSES` | `not_started`, `in_progress`, `complete` | Script 1, Script 3 |
| `PLANNING_STEP_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `skipped` | Script 1, Script 3 |
| `PHASE_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` | All scripts |
| `TASK_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` | All scripts |
| `REVIEW_VERDICTS` | `approved`, `changes_requested`, `rejected` | Script 2, Script 3 |
| `REVIEW_ACTIONS` | `advanced`, `corrective_task_issued`, `halted` | Script 2, Script 3 |
| `PHASE_REVIEW_ACTIONS` | `advanced`, `corrective_tasks_issued`, `halted` | Script 2, Script 3 |
| `SEVERITY_LEVELS` | `minor`, `critical` | Script 2, Script 3 |
| `HUMAN_GATE_MODES` | `ask`, `phase`, `task`, `autonomous` | Script 1 |
| `NEXT_ACTIONS` | All ~30 action strings from the NextAction vocabulary | Script 1 |
| `TRIAGE_LEVELS` | `task`, `phase` | Script 2 |

**Note**: `REVIEW_ACTIONS` uses singular `corrective_task_issued`; `PHASE_REVIEW_ACTIONS` uses plural `corrective_tasks_issued`. This distinction is intentional and must NOT be normalized.

---

## JSON Output Schemas

### Script 1: Next-Action Resolver — Success Output

```json
{
  "action": "<NextAction enum value>",
  "context": {
    "tier": "<current pipeline tier>",
    "phase_index": "<number | null>",
    "task_index": "<number | null>",
    "phase_id": "<string | null>",
    "task_id": "<string | null>",
    "details": "<human-readable explanation of why this action was chosen>"
  }
}
```

#### Field Definitions

| Field | Type | Description |
|---|---|---|
| `action` | `string` (NEXT_ACTIONS enum) | The resolved next action. Always exactly one value from the closed vocabulary (~30 values). |
| `context.tier` | `string` (PIPELINE_TIERS enum) | Current pipeline tier at time of resolution. |
| `context.phase_index` | `number \| null` | 0-based index of the relevant phase, or `null` if not in execution tier. |
| `context.task_index` | `number \| null` | 0-based index of the relevant task within the phase, or `null` if not task-scoped. |
| `context.phase_id` | `string \| null` | Human-readable phase identifier (e.g., `"P01"`), or `null`. |
| `context.task_id` | `string \| null` | Human-readable task identifier (e.g., `"P01-T03"`), or `null`. |
| `context.details` | `string` | Explanation of the resolution path taken. For agent diagnostics and logging, not for branching logic. |

#### NextAction Value Reference

The complete closed enum (agents must pattern-match on these exact strings):

**Planning tier actions:**
- `init_project` — No state.json found
- `display_halted` — Pipeline is halted
- `spawn_research` — Research step incomplete
- `spawn_prd` — PRD step incomplete
- `spawn_design` — Design step incomplete
- `spawn_architecture` — Architecture step incomplete
- `spawn_master_plan` — Master Plan step incomplete
- `request_plan_approval` — All planning complete, needs human approval
- `transition_to_execution` — Planning approved, transition to execution

**Execution tier actions — task lifecycle:**
- `create_phase_plan` — Phase not started
- `create_task_handoff` — Task not started, no handoff doc
- `execute_task` — Task not started, handoff doc exists
- `update_state_from_task` — Coder finished, task report produced
- `create_corrective_handoff` — Task failed, retries available, minor severity
- `halt_task_failed` — Task failed, no retries or critical severity
- `spawn_code_reviewer` — Task complete, no review doc
- `update_state_from_review` — Reviewer finished, review doc produced
- `triage_task` — Review doc exists but verdict is null
- `halt_triage_invariant` — Task triage re-spawn failed
- `retry_from_review` — Review verdict is `changes_requested`
- `halt_from_review` — Review verdict is `rejected`
- `advance_task` — Review verdict is `approved`
- `gate_task` — Human gate mode is `task`

**Execution tier actions — phase lifecycle:**
- `generate_phase_report` — All tasks in phase complete
- `spawn_phase_reviewer` — Phase report exists, no phase review
- `update_state_from_phase_review` — Phase Reviewer finished
- `triage_phase` — Phase review exists but verdict is null
- `halt_phase_triage_invariant` — Phase triage re-spawn failed
- `gate_phase` — Human gate mode is `phase`
- `advance_phase` — Phase complete, advance to next
- `transition_to_review` — All phases complete

**Review tier actions:**
- `spawn_final_reviewer` — Final review not complete
- `request_final_approval` — Final review done, needs approval
- `transition_to_complete` — Final review approved

**Terminal actions:**
- `display_complete` — Project complete
- `display_halted` — Pipeline halted (reused across tiers)

---

### Script 2: Triage Executor — Success Output

```json
{
  "success": true,
  "level": "task | phase",
  "verdict": "<verdict enum value | null>",
  "action": "<action enum value | null>",
  "phase_index": "<number>",
  "task_index": "<number | null>",
  "row_matched": "<number>",
  "details": "<human-readable explanation of the matched row>"
}
```

#### Field Definitions

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` — triage resolved successfully, state.json updated. |
| `level` | `string` | `"task"` or `"phase"` — echoes the `--level` flag. |
| `verdict` | `string \| null` | The verdict written to state.json. One of REVIEW_VERDICTS enum or `null` (for rows that skip verdict). |
| `action` | `string \| null` | The action written to state.json. Task-level: REVIEW_ACTIONS enum. Phase-level: PHASE_REVIEW_ACTIONS enum. `null` for rows that skip action. |
| `phase_index` | `number` | 0-based index of the phase that was triaged. |
| `task_index` | `number \| null` | 0-based index of the task that was triaged (task-level only). `null` for phase-level. |
| `row_matched` | `number` | The decision table row number (1-indexed) that matched. For debugging and traceability. |
| `details` | `string` | Human-readable description of why this row matched and what action was taken. |

### Script 2: Triage Executor — Error Output

```json
{
  "success": false,
  "level": "task | phase",
  "error": "<structured error message>",
  "error_code": "<error classification>",
  "phase_index": "<number>",
  "task_index": "<number | null>"
}
```

#### Error Codes

| Code | Meaning | Cause |
|---|---|---|
| `DOCUMENT_NOT_FOUND` | Required document missing | `report_doc` or `review_doc` path in state.json points to non-existent file |
| `INVALID_VERDICT` | Verdict value not in enum | Frontmatter `verdict` field contains unrecognized value |
| `IMMUTABILITY_VIOLATION` | Target fields already written | Attempted to write verdict/action to a task/phase that already has non-null values |
| `INVALID_STATE` | State.json unreadable or malformed | `state.json` at `--state` is not valid JSON or missing required fields |
| `INVALID_LEVEL` | `--level` flag value invalid | `--level` is not `task` or `phase` |

---

### Script 3: State Transition Validator — Pass Output

```json
{
  "valid": true,
  "invariants_checked": 15
}
```

### Script 3: State Transition Validator — Fail Output

```json
{
  "valid": false,
  "invariants_checked": 15,
  "errors": [
    {
      "invariant": "V6",
      "message": "Multiple tasks have status 'in_progress': P01-T02, P02-T01",
      "severity": "critical"
    },
    {
      "invariant": "V3",
      "message": "Task P01-T03 retries (4) exceeds max_retries_per_task (3)",
      "severity": "critical"
    }
  ]
}
```

#### Error Object Fields

| Field | Type | Description |
|---|---|---|
| `invariant` | `string` | Invariant identifier: `V1` through `V15`. |
| `message` | `string` | Human-readable description of the violation, including specific field paths and values. |
| `severity` | `string` | Always `"critical"` — all invariant violations are blocking. |

#### Invariant Check Details

| Invariant | Check Description | Comparison Type |
|---|---|---|
| V1 | `current_phase` is valid index into `phases[]` (0-based), or 0 if no phases | Proposed only |
| V2 | Each phase's `current_task` is valid index into that phase's `tasks[]` | Proposed only |
| V3 | No task's `retries` exceeds `limits.max_retries_per_task` | Proposed only |
| V4 | `phases.length` does not exceed `limits.max_phases` | Proposed only |
| V5 | Each phase's `tasks.length` does not exceed `limits.max_tasks_per_phase` | Proposed only |
| V6 | At most one task across entire project has `status: "in_progress"` | Proposed only |
| V7 | `planning.human_approved == true` if `current_tier == "execution"` | Proposed only |
| V8 | No task has `review_doc != null AND review_verdict == null` (triage skipped) | Proposed only |
| V9 | No phase has `phase_review != null AND phase_review_verdict == null` (triage skipped) | Proposed only |
| V10 | Absent fields treated as `null`; `null != null` → `false` (no false triggers) | Proposed only |
| V11 | No task's `retries` decreased compared to current state | Current → Proposed |
| V12 | Task status transitions follow allowed paths: `not_started → in_progress → complete \| failed \| halted` | Current → Proposed |
| V13 | `project.updated` timestamp in proposed is newer than in current | Current → Proposed |
| V14 | If `review_doc` changed from null to non-null, `review_verdict`/`review_action` must not have changed in the same write (ordering: verdict before handoff) | Current → Proposed |
| V15 | If triage wrote verdict/action for task N, the same write must not change verdict/action for a different task M | Current → Proposed |

---

## Error Output Format (stderr)

All three scripts follow the same stderr convention for unexpected errors (crashes, file I/O failures, JSON parse failures):

```
[ERROR] <script-name>: <message>
```

Examples:

```
[ERROR] resolve-next-action: Failed to read state.json: ENOENT: no such file or directory
[ERROR] execute-triage: Failed to parse state.json: Unexpected token at position 42
[ERROR] validate-state-transition: Failed to read proposed state: EACCES: permission denied
```

**stderr is for diagnostics only** — agents do NOT parse stderr for decision-making. Agents parse stdout JSON exclusively. stderr is logged for human debugging.

**Distinction from stdout errors**: Expected failure conditions (validation failures, triage errors) are returned as structured JSON on stdout with exit code `1`. stderr is reserved for unexpected crashes where structured output cannot be produced.

---

## Exit Code Semantics

All three scripts follow identical exit code conventions:

| Exit Code | Meaning | stdout Content | stderr Content |
|---|---|---|---|
| `0` | Success | Structured JSON result | Empty (or optional diagnostics) |
| `1` | Expected failure (validation error, triage error, missing file) | Structured JSON with error details | Optional diagnostic context |
| `1` | Unexpected crash (unhandled exception) | May be empty or partial | `[ERROR] <script>: <message>` |

**Agents differentiate expected vs. unexpected failure** by attempting `JSON.parse(stdout)`:
- If stdout parses as valid JSON → expected failure; read error fields from the result
- If stdout is empty or not valid JSON → unexpected crash; read stderr for diagnostics

---

## Agent Integration Patterns

### Pattern 1: Orchestrator Script Invocation

The Orchestrator agent invokes the Next-Action Resolver in its decision loop. The integration replaces the current prose decision tree (Steps 2a–2f).

**Before** (current prose-based):
```
Read state.json → Interpret 30+ branching conditions in natural language → Derive action
```

**After** (script-based):
```
Call: node resolve-next-action.js --state {state_path} --config {config_path}
Parse: result = JSON.parse(stdout)
Branch: switch(result.action) {
  case "spawn_research":     → spawn @Research
  case "spawn_prd":          → spawn @Product Manager
  case "spawn_design":       → spawn @UX Designer
  case "spawn_architecture": → spawn @Architect
  case "spawn_master_plan":  → spawn @Architect (master plan mode)
  case "create_phase_plan":  → spawn @Tactical Planner Mode 3
  case "create_task_handoff": → spawn @Tactical Planner Mode 4
  case "execute_task":       → spawn @Coder
  case "spawn_code_reviewer": → spawn @Reviewer Mode 1
  case "triage_task":        → check triage_attempts; spawn @Tactical Planner Mode 4
  case "triage_phase":       → check triage_attempts; spawn @Tactical Planner Mode 3
  ...
}
```

**Triage attempt guard** (Orchestrator-side logic, not in script):
```
if (result.action === "triage_task" || result.action === "triage_phase") {
  triage_attempts++
  if (triage_attempts > 1) {
    halt pipeline — triage invariant persists after re-spawn
  }
}
if (result.action === "advance_task" || result.action === "advance_phase") {
  triage_attempts = 0  // reset on advancement
}
```

### Pattern 2: Tactical Planner Pre-Write Validation

Every `state.json` write by the Tactical Planner follows this pattern:

```
1. Prepare proposed state changes in memory
2. Write proposed state to temporary file (e.g., state.json.proposed)
3. Call: node validate-state-transition.js --current {state_path} --proposed {temp_path}
4. Parse: result = JSON.parse(stdout)
5. If result.valid === true:
     Move proposed file to state.json (atomic replace)
6. If result.valid === false:
     Record result.errors in errors.active_blockers
     Delete temporary file
     Halt — do NOT commit the write
```

### Pattern 3: Tactical Planner Triage Delegation

In Mode 3 (phase-level) and Mode 4 (task-level), the Tactical Planner delegates triage to the script:

```
1. Call: node execute-triage.js --state {state_path} --level {task|phase} --project-dir {project_dir}
2. Parse: result = JSON.parse(stdout)
3. If result.success === true:
     state.json is already updated by the script
     Use result.action to determine next step:
       "advanced"                → proceed to next task/phase
       "corrective_task_issued"  → create corrective handoff
       "corrective_tasks_issued" → create corrective tasks (phase-level)
       "halted"                  → halt pipeline
4. If result.success === false:
     Record result.error in errors.active_blockers
     Halt — state.json was NOT modified by the script
```

### Pattern 4: Test Invocation

Tests import core logic directly — no subprocess spawning needed:

```javascript
// In test file
const { resolveNextAction } = require('../src/resolve-next-action');

// Call core logic with mock state
const result = resolveNextAction(mockState, mockConfig);
assert.strictEqual(result.action, 'spawn_prd');
```

Each script exports its core logic function alongside the CLI main():

| Script | Exported Function | Signature |
|---|---|---|
| `resolve-next-action.js` | `resolveNextAction(state, config?)` | `(object, object?) → { action, context }` |
| `execute-triage.js` | `executeTriage(state, level, readDocument)` | `(object, string, function) → { success, verdict?, action?, error? }` |
| `validate-state-transition.js` | `validateTransition(current, proposed)` | `(object, object) → { valid, errors? }` |

**`readDocument` callback**: The triage executor's core logic accepts a `readDocument(path)` function parameter rather than performing file I/O directly. In production, this calls `fs.readFileSync` + `extractFrontmatter`. In tests, this returns mock document contents. This inversion enables deterministic testing without filesystem mocks.

---

## Module Structure

```
src/
├── resolve-next-action.js       # Script 1: CLI entry point + core logic
├── execute-triage.js             # Script 2: CLI entry point + core logic
├── validate-state-transition.js  # Script 3: CLI entry point + core logic
└── lib/
    └── constants.js              # Shared enums (FR-4)

tests/
├── resolve-next-action.test.js   # ~30 resolution path tests
├── execute-triage.test.js         # 16 decision table row tests + error cases
├── validate-state-transition.test.js  # 15 invariant tests (positive + negative)
└── constants.test.js              # Enum completeness + no-overlap tests
```

**Utility imports**: Scripts import existing utilities from `.github/skills/validate-orchestration/scripts/lib/utils/`:
- `fs-helpers.js` — `readFile()`, `exists()`
- `frontmatter.js` — `extractFrontmatter()`
- `yaml-parser.js` — `parseYaml()`

These are NOT duplicated — they are imported by relative path.

---

## Decision Table Encoding Design

### Task-Level Decision Table (11 Rows)

The triage executor evaluates rows in order. First matching row wins.

| Row | Match Condition | Output |
|---|---|---|
| 1 | `report_status == "complete"` AND `!has_deviations` AND `review_doc == null` | Skip verdict/action. Action context: `"advance_no_review"` |
| 2 | `report_status == "complete"` AND `!has_deviations` AND `review_doc != null` AND `verdict == "approved"` | `verdict: "approved"`, `action: "advanced"` |
| 3 | `report_status == "complete"` AND `has_deviations` AND `deviation_type == "minor"` AND `verdict == "approved"` | `verdict: "approved"`, `action: "advanced"` |
| 4 | `report_status == "complete"` AND `has_deviations` AND `deviation_type == "architectural"` AND `verdict == "approved"` | `verdict: "approved"`, `action: "advanced"` |
| 5 | `report_status == "complete"` AND `review_doc != null` AND `verdict == "changes_requested"` | `verdict: "changes_requested"`, `action: "corrective_task_issued"` |
| 6 | `report_status == "complete"` AND `review_doc != null` AND `verdict == "rejected"` | `verdict: "rejected"`, `action: "halted"` |
| 7 | `report_status == "partial"` AND `review_doc == null` | Skip verdict/action. Action context: `"assess_severity"` |
| 8 | `report_status == "partial"` AND `review_doc != null` AND `verdict == "changes_requested"` | `verdict: "changes_requested"`, `action: "corrective_task_issued"` |
| 9 | `report_status == "partial"` AND `review_doc != null` AND `verdict == "rejected"` | `verdict: "rejected"`, `action: "halted"` |
| 10 | `report_status == "failed"` AND `severity == "minor"` AND `retries < max_retries` | `action: "corrective_task_issued"`. Verdict: from review if exists, else skip. |
| 11 | `report_status == "failed"` AND (`severity == "critical"` OR `retries >= max_retries`) | `action: "halted"`. Verdict: from review if exists, else skip. |

**Row 10 branching logic**: This is the one row that crosses multiple state fields. The core function implementing this row should be a named function `checkRetryBudget(task, limits)` for readability and testability.

### Phase-Level Decision Table (5 Rows)

| Row | Match Condition | Output |
|---|---|---|
| 1 | `phase_review == null` | Skip verdict/action. No triage needed. |
| 2 | `phase_review_verdict == "approved"` AND all exit criteria met | `verdict: "approved"`, `action: "advanced"` |
| 3 | `phase_review_verdict == "approved"` AND some exit criteria unmet | `verdict: "approved"`, `action: "advanced"` |
| 4 | `phase_review_verdict == "changes_requested"` | `verdict: "changes_requested"`, `action: "corrective_tasks_issued"` |
| 5 | `phase_review_verdict == "rejected"` | `verdict: "rejected"`, `action: "halted"` |

---

## State Write Contract

### Atomic Write Pattern

Both the triage executor and the validator-gated write follow this pattern to prevent partial writes:

```
1. Read current state.json into memory
2. Apply changes to in-memory object
3. Serialize entire object with JSON.stringify(state, null, 2)
4. Write to file with fs.writeFileSync (synchronous, atomic at OS level for small files)
```

No incremental patching. No field-level writes. The entire `state.json` is always rewritten.

### Write Ordering Enforcement

When the triage executor writes verdict/action:
1. Check that `handoff_doc` has NOT been set in this same logical operation
2. Write verdict + action fields
3. Only AFTER triage completes can the Tactical Planner create a handoff doc in a subsequent state write

The validator (V14) enforces this by comparing current → proposed: if `review_doc` changed from null to non-null in the same write as verdict/action, that is a violation.

### Immutability Enforcement

When the triage executor targets a specific task/phase:
1. Read the current verdict/action fields for that task/phase
2. If any target field is non-null, refuse the write and return error with code `IMMUTABILITY_VIOLATION`
3. The validator (V15) provides a second layer: if current state has verdict/action for task N and proposed state changes them, that is a violation

---

## Accessibility

Not applicable — these are CLI scripts consumed by agents and developers via terminal. No visual UI, no keyboard navigation concerns, no screen reader support, no color contrast requirements.

The equivalent "accessibility" concern for CLI tools is **parsability**:
- All output is valid JSON — parsable by `JSON.parse()` without custom parsing logic
- Error messages include structured codes and invariant identifiers — not requiring natural language interpretation
- Exit codes follow POSIX conventions — `0` success, non-zero failure
- Flag names follow GNU long-option conventions (`--state`, `--level`) — parsable by Node.js `parseArgs()`
