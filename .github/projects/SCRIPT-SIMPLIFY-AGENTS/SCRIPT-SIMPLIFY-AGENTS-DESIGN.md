---
project: "SCRIPT-SIMPLIFY-AGENTS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-12T00:00:00Z"
---

# SCRIPT-SIMPLIFY-AGENTS — Design

## Design Overview

This design specifies the interaction model for a unified event-driven pipeline script that replaces three standalone CLI scripts and removes state-management responsibilities from the Tactical Planner agent. The "users" are the Orchestrator agent (calling the script via terminal, parsing JSON results), the Tactical Planner agent (reading computed triage outcomes from `state.json`), and developers maintaining the orchestration system. The design defines the CLI interface contract, JSON input/output schemas, the Orchestrator's simplified event loop, the reduced action vocabulary mapping, and the developer experience for reading, debugging, and extending the pipeline modules.

## User Flows

### Flow 1: Orchestrator Event Loop (Steady-State)

```
Orchestrator reads state.json
  → Calls `pipeline.js --event <name> --project-dir <path> [--context <json>]`
  → Pipeline script: load state → mutate → validate → [triage] → resolve → write state → return JSON
  → Orchestrator parses JSON result from stdout
  → Result contains { action, context }
  → Orchestrator pattern-matches action against ~18-entry action table
  → If agent spawn: spawn agent → wait for completion → signal next event → loop
  → If human gate: present gate to human → signal gate result event → loop
  → If terminal (display_halted, display_complete): display message → stop
```

The Orchestrator never reads intermediate state between the event call and the result. Each pipeline call is atomic: one event in, one action out. Context compaction recovery is trivial — the Orchestrator re-calls `pipeline.js --event start --project-dir <path>` to cold-start from persisted state.

### Flow 2: Project Initialization (First Run)

```
Orchestrator receives project idea (no state.json exists)
  → Calls `pipeline.js --event start --project-dir <path> --config <config-path>`
  → Pipeline script detects no state.json
  → Reads orchestration.yml for limits, gate defaults
  → Creates project directory + subdirectories (phases/, tasks/, reports/)
  → Scaffolds state.json from template with config values
  → Resolves next action (spawn_research)
  → Returns { action: "spawn_research", context: { ... } }
  → Orchestrator spawns Research agent
```

No LLM involvement in initialization. The initial `state.json` is guaranteed schema-compliant because the script builds it programmatically from constants and config values.

### Flow 3: Task Completion with Triage

```
Coder completes task → produces Task Report
  → Orchestrator signals: pipeline.js --event task_completed --project-dir <path> --context '{"report_path":"..."}'
  → Pipeline script:
    1. Reads task report frontmatter (status, deviations, severity)
    2. Mutates state: task status → complete, report_doc → path
    3. Validates transition (state-validator)
    4. Writes state.json
    5. Detects triage trigger → runs triage-engine
    6. Triage reads code review (if exists) via readDocument callback
    7. Triage returns verdict + action (e.g., approved/advanced)
    8. Mutates state: review_verdict, review_action, resets/increments triage_attempts
    9. Validates again
    10. Writes state.json
    11. Resolves next action
  → Returns { action: "execute_task" | "spawn_code_reviewer" | "display_halted", context: { ... } }
```

The Orchestrator passes only the report path. All parsing, triage decision-making, and state mutation happen inside the script. The Orchestrator never sees intermediate state.

### Flow 4: Tactical Planner Creates Corrective Task Handoff

```
Pipeline script has already written review_action: "corrective_task_issued" to state.json
  → Orchestrator receives { action: "create_task_handoff", context: { phase, task, corrective: true } }
  → Orchestrator spawns Tactical Planner with handoff instruction
  → Tactical Planner reads state.json → sees review_action = "corrective_task_issued"
  → Reads code review at review_doc path → extracts Issues table
  → Creates corrective task handoff targeting those issues
  → Orchestrator signals: pipeline.js --event task_handoff_created --project-dir <path> --context '{"handoff_path":"..."}'
```

The Planner never derives the triage outcome. It reads a computed field (`review_action`) and plans accordingly. The "Prior Context" section in the `create-task-handoff` skill guides this read-then-plan pattern.

### Flow 5: Phase Completion Cycle

```
All tasks in phase complete
  → Orchestrator signals: pipeline.js --event phase_tasks_complete --project-dir <path>
  → Pipeline returns { action: "generate_phase_report", context: { phase } }
  → Orchestrator spawns Tactical Planner for phase report
  → Orchestrator signals: pipeline.js --event phase_report_created --project-dir <path> --context '{"report_path":"..."}'
  → Pipeline returns { action: "spawn_phase_reviewer", context: { phase } }
  → Orchestrator spawns Reviewer
  → Orchestrator signals: pipeline.js --event phase_review_completed --project-dir <path> --context '{"review_path":"..."}'
  → Pipeline runs phase-level triage → writes phase_review_verdict, phase_review_action
  → Pipeline returns { action: "create_phase_plan" (if corrective) | next phase action | "transition_to_review" }
```

### Flow 6: Context Compaction Recovery

```
Orchestrator loses context (agent restart, long conversation)
  → Orchestrator reads state.json (knows project exists)
  → Calls: pipeline.js --event start --project-dir <path>
  → Pipeline loads state.json, skips mutation (no event to apply)
  → Resolves next action from current state
  → Returns { action, context }
  → Orchestrator resumes the loop from this action
```

All state is in `state.json` (including `triage_attempts`). No runtime counters, no agent memory required. Recovery is a single script call.

## Layout & Components

> **Note**: This project has no visual UI. "Layout & Components" maps to the **module architecture** and **CLI interface** — the structural elements a developer or agent interacts with.

### Pipeline Script Module Map

| Module | Role | Analogy | Notes |
|--------|------|---------|-------|
| `pipeline.js` | CLI entry point | "Page shell" | ~20 lines. Parses args, calls engine, prints JSON, exits. |
| `pipeline-engine.js` | Core orchestration logic | "Main layout" | Linear recipe: load → mutate → validate → write → triage → resolve → return. |
| `mutations.js` | Event-to-mutation lookup table | "Component library" | One named function per event type. Each ≤15 lines. |
| `state-io.js` | Filesystem I/O isolation | "Data layer" | Read/write `state.json`, read `orchestration.yml`, read documents. Mockable boundary. |
| `lib/constants.js` | Enums and types | "Design tokens" | PRESERVED — unchanged. |
| `lib/resolver.js` | Next-action resolution | "Router" | PRESERVED — unchanged. |
| `lib/state-validator.js` | Transition validation | "Form validator" | PRESERVED — unchanged. |
| `lib/triage-engine.js` | Triage decision engine | "Business rules" | PRESERVED — unchanged. |

### CLI Interface Design

**Entry point**: `.github/orchestration/scripts/pipeline.js`

```
pipeline.js --event <event-name> --project-dir <path> [--config <path>] [--context <json>]
```

| Flag | Required | Type | Description |
|------|----------|------|-------------|
| `--event` | Yes | String (enum) | Event name from the closed event vocabulary |
| `--project-dir` | Yes | Path | Absolute path to project directory |
| `--config` | No | Path | Path to `orchestration.yml` (default: auto-discover) |
| `--context` | No | JSON string | Event-specific context payload |

**Output contract**:
- **stdout**: Single JSON object — the pipeline result
- **stderr**: Diagnostic messages (warnings, debug info)
- **Exit code 0**: Success — stdout contains valid result JSON
- **Exit code 1**: Error — stderr contains error message, stdout may be empty or contain error JSON

### Event Vocabulary

| Event | Context Payload | Trigger |
|-------|----------------|---------|
| `start` | `{}` | Cold start / compaction recovery / initial run |
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

### Pipeline Result Schema (stdout JSON)

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

| Field | Type | Always Present | Description |
|-------|------|---------------|-------------|
| `success` | Boolean | Yes | Whether the pipeline completed without error |
| `action` | String | Yes (if success) | Next action from the ~18-value reduced vocabulary |
| `context` | Object | Yes (if success) | Action-specific context for the Orchestrator |
| `mutations_applied` | String[] | Yes (if success) | Human-readable list of state changes (for diagnostics) |
| `triage_ran` | Boolean | Yes (if success) | Whether triage was triggered during this call |
| `validation_passed` | Boolean | Yes (if success) | Whether state validation passed (always true on success) |
| `error` | String | Yes (if !success) | Error message on failure |

### Error Result Schema (stdout JSON on exit code 1)

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

Errors include the event that caused the failure, any mutations that were applied before the error, and a state snapshot for debugging. On validation failure, state is NOT written — the previous valid state is preserved.

## Reduced Action Vocabulary (~18 Actions)

### Action-to-Agent Mapping Table

This is the Orchestrator's sole routing table. Every action returned by the pipeline script maps to exactly one external operation.

| # | Action | Category | Orchestrator Operation | Event to Signal on Completion |
|---|--------|----------|----------------------|-------------------------------|
| 1 | `spawn_research` | Agent spawn | Spawn Research agent | `research_completed` |
| 2 | `spawn_prd` | Agent spawn | Spawn Product Manager agent | `prd_completed` |
| 3 | `spawn_design` | Agent spawn | Spawn UX Designer agent | `design_completed` |
| 4 | `spawn_architecture` | Agent spawn | Spawn Architect agent | `architecture_completed` |
| 5 | `spawn_master_plan` | Agent spawn | Spawn Architect agent | `master_plan_completed` |
| 6 | `create_phase_plan` | Agent spawn | Spawn Tactical Planner (phase plan mode) | `phase_plan_created` |
| 7 | `create_task_handoff` | Agent spawn | Spawn Tactical Planner (handoff mode) | `task_handoff_created` |
| 8 | `execute_task` | Agent spawn | Spawn Coder agent | `task_completed` |
| 9 | `spawn_code_reviewer` | Agent spawn | Spawn Reviewer agent (task review) | `code_review_completed` |
| 10 | `spawn_phase_reviewer` | Agent spawn | Spawn Reviewer agent (phase review) | `phase_review_completed` |
| 11 | `generate_phase_report` | Agent spawn | Spawn Tactical Planner (report mode) | `phase_report_created` |
| 12 | `spawn_final_reviewer` | Agent spawn | Spawn Reviewer agent (final review) | `final_review_completed` |
| 13 | `request_plan_approval` | Human gate | Present master plan for approval | `plan_approved` or `plan_rejected` |
| 14 | `request_final_approval` | Human gate | Present final review for approval | `final_approved` or `final_rejected` |
| 15 | `gate_task` | Human gate | Present task for human gate check | `gate_approved` or `gate_rejected` |
| 16 | `gate_phase` | Human gate | Present phase for human gate check | `gate_approved` or `gate_rejected` |
| 17 | `display_halted` | Terminal | Display halt message — pipeline stops | *(none — terminal)* |
| 18 | `display_complete` | Terminal | Display completion message — pipeline stops | *(none — terminal)* |

### Actions Internalized by Pipeline Script

The following actions from the current 35-action vocabulary are no longer visible to the Orchestrator. They execute internally within the pipeline script as part of event handling:

| Internalized Action | Handled By |
|--------------------|------------|
| `init_project` | `start` event (no `state.json` exists) |
| `transition_to_execution` | Automatic after `plan_approved` event |
| `update_state_from_task` | `task_completed` event mutation |
| `update_state_from_review` | `code_review_completed` event mutation |
| `update_state_from_phase_review` | `phase_review_completed` event mutation |
| `triage_task` | Internal triage after task/review events |
| `triage_phase` | Internal triage after phase review events |
| `halt_triage_invariant` | Internal triage attempt check |
| `halt_phase_triage_invariant` | Internal phase triage attempt check |
| `retry_from_review` | Internal triage routing |
| `halt_from_review` | Internal triage routing |
| `advance_task` | Internal post-triage advancement |
| `advance_phase` | Internal post-phase-triage advancement |
| `halt_task_failed` | Internal halt detection |
| `transition_to_review` | Automatic phase/execution completion |
| `transition_to_complete` | Automatic after final approval |
| `create_corrective_handoff` | Merged into `create_task_handoff` (with `corrective: true` in context) |

## States & Interactions

### Pipeline Script States (per invocation)

Each pipeline call is stateless between invocations. Within a single call, the engine progresses through a linear state machine:

| State | Description | Transitions To | Failure Mode |
|-------|-------------|---------------|-------------|
| `PARSE_ARGS` | Parse CLI flags, validate required args | `LOAD_STATE` | Exit 1 with usage error |
| `LOAD_STATE` | Read `state.json` (or detect first run) | `APPLY_MUTATION` or `INIT_PROJECT` | Exit 1 if read fails |
| `INIT_PROJECT` | Create dirs, scaffold `state.json`, read config | `RESOLVE` | Exit 1 if config missing/invalid |
| `APPLY_MUTATION` | Look up event in mutations table, apply mutation function | `VALIDATE` | Exit 1 if unknown event |
| `VALIDATE` | Run `state-validator.validateTransition(current, proposed)` | `WRITE_STATE` | Exit 1 with validation errors; state NOT written |
| `WRITE_STATE` | Atomically write mutated `state.json` via `state-io` | `TRIAGE_CHECK` | Exit 1 if write fails |
| `TRIAGE_CHECK` | Determine if triage is needed for this event + state | `RUN_TRIAGE` or `RESOLVE` | — |
| `RUN_TRIAGE` | Call `triage-engine.executeTriage()` with `readDocument` callback | `APPLY_TRIAGE_MUTATION` | Exit 1 if document not found |
| `APPLY_TRIAGE_MUTATION` | Apply triage verdict/action to state, manage `triage_attempts` | `VALIDATE` (second pass) | Exit 1 if validation fails |
| `RESOLVE` | Call `resolver.resolveNextAction(state, config)` | `OUTPUT` | — |
| `OUTPUT` | Print JSON result to stdout, exit 0 | *(terminal)* | — |

### Triage Trigger Rules

| Event | Triggers Triage? | Level | Condition |
|-------|-----------------|-------|-----------|
| `task_completed` | Yes | `task` | Always — needs triage to determine verdict |
| `code_review_completed` | Yes | `task` | Always — review doc changes triage input |
| `phase_review_completed` | Yes | `phase` | Always — phase review needs triage |
| All other events | No | — | Triage only runs on completion/review events |

### `triage_attempts` Lifecycle

| Event Type | `triage_attempts` Behavior |
|-----------|---------------------------|
| Triage trigger event | Increment `triage_attempts` by 1 |
| `triage_attempts` > 1 | Pipeline returns `display_halted` (triage invariant) |
| Advance event (task or phase moves forward) | Reset `triage_attempts` to 0 |
| `start` event (cold start) | Preserve existing value from `state.json` |
| Init (new project) | Initialize to 0 |

### Mutation Function Contract

Each mutation function in `mutations.js` follows a uniform contract:

```
/**
 * @param {Object} state - Deep clone of current state.json
 * @param {Object} context - Event context payload from --context flag
 * @returns {Object} mutated state (same object, modified in place)
 */
function handleTaskCompleted(state, context) { ... }
```

- **Input**: Deep-cloned state object + event context
- **Output**: Mutated state object (same reference, modified in place)
- **Side effects**: None — pure function operating on a clone
- **Size**: Each function ≤15 lines — single-purpose, single-event

### State I/O Contract

`state-io.js` exports an interface that `pipeline-engine.js` calls. This is the sole mockable boundary for testing:

| Function | Signature | Description |
|----------|-----------|-------------|
| `readState` | `(projectDir) → Object` | Read and parse `state.json` from project dir. Returns `null` if not found. |
| `writeState` | `(projectDir, state) → void` | Atomically write `state.json` to project dir. |
| `readConfig` | `(configPath) → Object` | Read and parse `orchestration.yml`. |
| `readDocument` | `(docPath) → { frontmatter, body }` | Read a markdown document and extract frontmatter. For triage engine injection. |
| `ensureDirectories` | `(projectDir) → void` | Create project dir + `phases/`, `tasks/`, `reports/` subdirectories. |

## Agent Interaction Design

### Orchestrator Agent — Simplified Definition Structure

The Orchestrator's agent definition restructures around three concepts:

1. **Event loop pseudocode** — a short, repeatable loop the LLM can follow even after compaction
2. **Action routing table** — the 18-entry table above (action → agent/gate/display)
3. **Event signaling reference** — which event to signal after each action completes

The definition should be organized as:

```
## Event Loop
1. Call pipeline.js with event + context
2. Parse result
3. Route on result.action (see Action Table)
4. After agent/gate completes, signal the corresponding event
5. Go to 1

## Action Table
(18 rows — see Reduced Action Vocabulary section above)

## Recovery
Call pipeline.js --event start to recover from any state
```

**Key change**: The Orchestrator no longer maintains any runtime state (no `triage_attempts` counter, no "last action" memory). Everything is derived from `state.json` via the pipeline script. This makes the agent definition dramatically shorter and compaction-proof.

### Tactical Planner Agent — Reduced Definition Structure

The Planner retains three modes (renumbered):

| Mode | Name | Reads | Writes |
|------|------|-------|--------|
| 1 | Create Phase Plan | Master Plan, Architecture, Design, `state.json` (read-only), prior reports/reviews | Phase Plan document |
| 2 | Create Task Handoff | Phase Plan, Architecture, Design, `state.json` (read-only), prior reports/reviews | Task Handoff document |
| 3 | Generate Phase Report | Phase Plan, Task Reports, Code Reviews, `state.json` (read-only) | Phase Report document |

**Removed**: Mode 1 (Initialize Project), Mode 2 (Update State), triage steps from Modes 3/4, `execute` tool, all `STATUS.md` references, all state-write instructions.

**Added**: "Prior Context" reading pattern — each mode starts by reading `state.json` for computed fields (`review_action`, `phase_review_action`) and adjusts its output accordingly.

### Corrective Context Flow — Skill Integration

The `create-task-handoff` and `create-phase-plan` skills each gain a "Prior Context" section:

**`create-task-handoff` Prior Context**:
```
1. Read state.json → current task's review_action
2. If review_action == "corrective_task_issued":
   a. Read code review at task's review_doc path
   b. Extract Issues table from the review
   c. These issues become the primary objective of the corrective handoff
3. If review_action == "advanced" or not set: proceed with normal handoff
```

**`create-phase-plan` Prior Context**:
```
1. Read state.json → current phase's phase_review_action
2. If phase_review_action == "corrective_tasks_issued":
   a. Read phase review at phase's phase_review path
   b. Extract Cross-Task Issues section
   c. Create corrective tasks targeting those issues
3. If phase_review_action == "advanced" or not set: proceed with normal phase plan
```

## Developer Experience

### Reading & Understanding the Pipeline

A developer encountering the pipeline script should understand it in concentric circles:

| Layer | File | What It Answers | Read Time |
|-------|------|----------------|-----------|
| 1 — Entry | `pipeline.js` | "What CLI flags does this take? What does it output?" | 2 min |
| 2 — Flow | `pipeline-engine.js` | "What happens when an event comes in? What's the sequence?" | 5 min |
| 3 — Events | `mutations.js` | "What does `task_completed` actually do to state?" | Per-function: 1 min |
| 4 — I/O | `state-io.js` | "How does state get read/written? What filesystem calls happen?" | 3 min |
| 5 — Domain | `lib/resolver.js`, `lib/triage-engine.js`, `lib/state-validator.js`, `lib/constants.js` | "What are the business rules?" | Existing — already documented via tests |

### Debugging a Pipeline Failure

| Symptom | Diagnostic Path |
|---------|----------------|
| Wrong next action returned | Check `mutations_applied` in result JSON → verify mutation function → check resolver logic |
| Validation failure (exit 1) | Read `error` field → identifies which invariant (V1-V15) failed → check mutation against validator |
| Triage returned wrong verdict | Check `triage_ran: true` in result → inspect triage-engine test rows → verify document content |
| State seems stale | Re-call `pipeline.js --event start` → check if state.json was written (timestamp) |
| Unknown event error | Check event name against event vocabulary → verify spelling in Orchestrator definition |

**Diagnostic output** on stderr includes:
- Event received and context
- Mutation function invoked
- Validation result summary
- Triage trigger decision and outcome
- Resolver input summary

### Extending the Pipeline

**Adding a new event type** requires exactly two changes:

1. **`mutations.js`**: Add a new named function (e.g., `handleNewEvent(state, context)`) and register it in the mutations lookup table
2. **`pipeline-engine.js`**: If the event triggers triage, add it to the triage trigger rules

No changes to existing mutation functions. No changes to the CLI entry point. No changes to the Orchestrator agent definition (unless the event maps to a new external action).

**Adding a new external action** requires:

1. Add the action value to `constants.js` `NEXT_ACTIONS` enum
2. Add resolver logic in `resolver.js`
3. Add a row to the Orchestrator's action routing table
4. Update `constants.test.js` and `resolver.test.js`

### File Organization (Post-Refactor)

```
.github/orchestration/scripts/
├── pipeline.js                  # NEW — CLI entry point (~20 lines)
├── lib/
│   ├── constants.js             # PRESERVED — enums, types
│   ├── resolver.js              # PRESERVED — next-action resolution
│   ├── state-validator.js       # PRESERVED — 15 invariants
│   ├── triage-engine.js         # PRESERVED — decision tables
│   ├── pipeline-engine.js       # NEW — core orchestration logic
│   ├── mutations.js             # NEW — event mutation lookup table
│   └── state-io.js              # NEW — filesystem I/O isolation
└── tests/
    ├── constants.test.js        # PRESERVED — unchanged
    ├── resolver.test.js         # PRESERVED — unchanged
    ├── state-validator.test.js  # PRESERVED — unchanged
    ├── triage-engine.test.js    # PRESERVED — unchanged
    ├── pipeline.test.js         # NEW — CLI arg parsing + E2E
    ├── pipeline-engine.test.js  # NEW — integration tests with mocked I/O
    ├── mutations.test.js        # NEW — unit tests per mutation function
    └── (validation test files)  # UPDATED — cross-refs, agents, skills, etc.
```

**Removed files**:
- `next-action.js` — replaced by `pipeline.js`
- `triage.js` — replaced by `pipeline.js`
- `validate-state.js` — replaced by `pipeline.js`
- `next-action.test.js` — replaced by `pipeline.test.js`
- `triage.test.js` — replaced by `pipeline.test.js`
- `validate-state.test.js` — replaced by `pipeline.test.js`

## Accessibility

> **Note**: This is a developer infrastructure project with no visual UI. "Accessibility" maps to **developer accessibility** — ensuring the system is understandable, debuggable, and navigable by developers of varying experience levels with the orchestration system.

| Requirement | Implementation |
|-------------|---------------|
| Discoverability | `pipeline.js --help` prints usage, event vocabulary, and example invocations |
| Error clarity | All error messages include: which event failed, which invariant was violated, what the expected vs. actual values were |
| Output parsability | stdout is always valid JSON (success or error). Diagnostic text goes to stderr only. Agents and scripts can reliably `JSON.parse(stdout)` |
| Naming consistency | Event names use `snake_case`, match action names where possible (e.g., `task_completed` event produces state that may resolve to `spawn_code_reviewer` action) |
| Progressive disclosure | Result JSON includes `mutations_applied` and `triage_ran` for diagnostics but `action` + `context` are sufficient for normal operation |
| Code navigability | Mutation functions are named `handle<EventName>` in a single lookup table — `grep` for any event name finds its handler instantly |
| Test readability | Each mutation test file mirrors the mutations module: one `describe` block per event, one test per expected state change |
| Documentation self-sufficiency | The Orchestrator agent definition contains the complete event loop and action table — no external document references needed during execution |

## Responsive Behavior

> **Note**: No visual breakpoints apply. "Responsive behavior" maps to how the pipeline script adapts to different **runtime contexts**.

| Context | Behavior |
|---------|----------|
| First run (no `state.json`) | `start` event initializes project, scaffolds state, returns first action |
| Cold start (existing `state.json`) | `start` event skips mutation, resolves next action from current state |
| Context compaction recovery | Same as cold start — Orchestrator calls `--event start` to re-derive next action |
| Missing `orchestration.yml` | Uses built-in defaults for limits and gate mode (matches current `next-action.js` behavior) |
| Invalid event name | Exit 1 with error listing valid events |
| Invalid context JSON | Exit 1 with JSON parse error details |
| Validation failure mid-pipeline | State is NOT written. Error result includes mutations that were attempted. Previous valid state preserved. |
| Document not found during triage | Triage engine returns error. Pipeline exits 1 with document path in error message. |

## Design System Additions

> **Note**: No visual design tokens. "Design system additions" maps to **new conventions** introduced by this project that should be followed consistently.

| Type | Name | Definition | Rationale |
|------|------|-----------|-----------|
| Convention | Event vocabulary | Closed enum of ~19 events (see Event Vocabulary table) | All pipeline inputs must use these exact names — no freeform event strings |
| Convention | Mutation function naming | `handle<PascalCaseEventName>` (e.g., `handleTaskCompleted`) | Enables grep-based discovery; consistent with existing `resolve*` and `validate*` naming in lib modules |
| Convention | Result JSON shape | `{ success, action, context, mutations_applied, triage_ran, validation_passed }` | Uniform contract between pipeline script and Orchestrator — every call returns this shape |
| Convention | Diagnostic output channel | stderr for diagnostics, stdout for JSON only | Extends existing convention from the 3 standalone scripts to the unified pipeline |
| Convention | I/O isolation boundary | All filesystem access through `state-io.js` exports | Makes `pipeline-engine.js` testable with stubs; follows existing `triage-engine.js` DI pattern |
| Schema addition | `triage_attempts` field | Integer at `execution` level in `state.json`, default `0` | Persists triage retry counter that was previously a runtime-local variable in the Orchestrator |
