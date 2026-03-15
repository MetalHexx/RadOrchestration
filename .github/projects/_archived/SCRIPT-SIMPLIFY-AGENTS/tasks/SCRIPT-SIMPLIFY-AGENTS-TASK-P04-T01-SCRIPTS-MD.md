---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 1
title: "Rewrite scripts.md"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Rewrite scripts.md

## Objective

Replace the entire contents of `docs/scripts.md` (currently 339 lines documenting 3 deleted standalone scripts — `next-action.js`, `triage.js`, `validate-state.js`) with comprehensive documentation for the unified `pipeline.js` event-driven system.

## Context

The orchestration system was refactored from three standalone CLI scripts into a single unified pipeline script (`pipeline.js`). The old scripts (`next-action.js`, `triage.js`, `validate-state.js`) have been deleted. The pipeline script accepts events, applies mutations to `state.json`, runs integrated triage and validation, and returns deterministic JSON results. The lib directory now contains 7 modules: `constants.js`, `mutations.js`, `pipeline-engine.js`, `state-io.js`, `resolver.js`, `state-validator.js`, and `triage-engine.js`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/scripts.md` | Full rewrite — replace all 339 lines |

## Implementation Steps

1. **Delete all existing content** in `docs/scripts.md` and start fresh.

2. **Write the title and introduction** — explain that the orchestration system uses a single unified pipeline script (`pipeline.js`) for all deterministic pipeline operations: routing, mutation, triage, and validation. Contrast with the old 3-script approach. Explain *why* scripts exist (determinism over LLM interpretation — same input = same output).

3. **Document the CLI interface** with exact usage:
   ```bash
   node .github/orchestration/scripts/pipeline.js \
     --event <event_name> \
     --project-dir <path> \
     [--config <path>] \
     [--context '<json>']
   ```
   - `--event` (required): One of the 19 pipeline events
   - `--project-dir` (required): Absolute path to the project directory containing `state.json`
   - `--config` (optional): Path to `orchestration.yml`; built-in defaults used if omitted
   - `--context` (optional): JSON string with event-specific context (e.g., `report_path`, `doc_path`)

4. **Write the 4-layer module architecture section** with this directory tree and layer descriptions:
   ```
   .github/orchestration/scripts/
   ├── pipeline.js                    # CLI entry point — I/O, arg parsing, exit codes
   ├── lib/
   │   ├── pipeline-engine.js         # Orchestration engine — load → mutate → validate → triage → resolve
   │   ├── mutations.js               # Pure mutation handlers — one per event, lookup table pattern
   │   ├── state-io.js                # I/O isolation — read/write state, config, documents
   │   ├── resolver.js                # Next-Action Resolver — pure function, 35-action routing
   │   ├── state-validator.js         # State Transition Validator — 15 invariants
   │   ├── triage-engine.js           # Triage engine — task/phase decision tables
   │   └── constants.js               # Shared enums — frozen, zero dependencies
   └── tests/
       ├── pipeline.test.js           # CLI end-to-end tests
       ├── pipeline-engine.test.js    # Engine integration tests
       ├── mutations.test.js          # Mutation handler unit tests
       ├── state-io.test.js           # I/O module tests
       ├── resolver.test.js           # Routing resolver tests
       ├── state-validator.test.js    # Invariant validation tests
       ├── triage-engine.test.js      # Triage decision table tests
       └── constants.test.js          # Enum integrity tests
   ```
   Layer descriptions:
   - **Layer 1: CLI entry point** (`pipeline.js`) — handles I/O (read files, write stdout, exit codes). Uses `require.main === module` guard for dual CLI/programmatic use. Constructs the `PipelineIO` dependency injection object and delegates to the engine.
   - **Layer 2: Pipeline engine** (`pipeline-engine.js`) — the orchestration core. Linear recipe: load state → apply mutation → validate transition → run triage (if needed) → resolve next action → write state → return result.
   - **Layer 3: Domain modules** (`mutations.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) — pure functions with no filesystem access. Each has a single responsibility.
   - **Layer 4: Constants & I/O** (`constants.js`, `state-io.js`) — `constants.js` is the leaf module (zero internal dependencies, all enums frozen). `state-io.js` encapsulates all filesystem operations behind the `PipelineIO` interface.

5. **Write the closed event vocabulary section** — table of all 19 events:

   | # | Event | Tier | Description | Triage? |
   |---|-------|------|-------------|---------|
   | 1 | `start` | Any | Initialize new project or resolve next action for existing project | No |
   | 2 | `research_completed` | Planning | Research agent finished; sets `planning.steps.research` to complete | No |
   | 3 | `prd_completed` | Planning | PRD created; sets `planning.steps.prd` to complete | No |
   | 4 | `design_completed` | Planning | Design doc created; sets `planning.steps.design` to complete | No |
   | 5 | `architecture_completed` | Planning | Architecture doc created; sets `planning.steps.architecture` to complete | No |
   | 6 | `master_plan_completed` | Planning | Master plan created; sets `planning.steps.master_plan` to complete, `planning.status` to complete | No |
   | 7 | `plan_approved` | Planning | Human approved the plan; sets `planning.human_approved`, transitions to execution tier | No |
   | 8 | `plan_rejected` | Planning | Human rejected the plan; halts the pipeline | No |
   | 9 | `phase_plan_created` | Execution | Phase plan document saved; sets `phase.phase_doc`, `phase.status` to in_progress | No |
   | 10 | `task_handoff_created` | Execution | Task handoff document saved; sets `task.handoff_doc` | No |
   | 11 | `task_completed` | Execution | Coder finished task; sets `task.report_doc`; triggers **task-level triage** | Yes (task) |
   | 12 | `code_review_completed` | Execution | Reviewer finished review; sets `task.review_doc`; triggers **task-level triage** | Yes (task) |
   | 13 | `phase_report_created` | Execution | Phase report saved; sets `phase.phase_report` | No |
   | 14 | `phase_review_completed` | Execution | Phase reviewer finished; sets `phase.phase_review`; triggers **phase-level triage** | Yes (phase) |
   | 15 | `gate_approved` | Execution | Human approved gate; advances task/phase | No |
   | 16 | `gate_rejected` | Execution | Human rejected gate; halts pipeline | No |
   | 17 | `final_review_completed` | Review | Final comprehensive review saved; sets `final_review.report_doc` | No |
   | 18 | `final_approved` | Review | Human approved final review; transitions to complete tier | No |
   | 19 | `final_rejected` | Review | Human rejected final review; halts pipeline | No |

6. **Write the action vocabulary section** — document the 35-value `NEXT_ACTIONS` enum returned by the resolver. Organize into the same 5 groups used in the old `scripts.md` (Planning, Execution — task lifecycle, Execution — phase lifecycle, Review, Terminal) with the same table format:

   **Planning tier (8 actions):**

   | Action | Meaning |
   |--------|---------|
   | `init_project` | Project needs initialization |
   | `spawn_research` | Spawn Research agent |
   | `spawn_prd` | Spawn Product Manager |
   | `spawn_design` | Spawn UX Designer |
   | `spawn_architecture` | Spawn Architect for architecture |
   | `spawn_master_plan` | Spawn Architect for master plan |
   | `request_plan_approval` | Planning complete — request human approval |
   | `transition_to_execution` | Planning approved — transition to execution tier |

   **Execution tier — task lifecycle (13 actions):**

   | Action | Meaning |
   |--------|---------|
   | `create_phase_plan` | Phase needs a plan |
   | `create_task_handoff` | Task needs a handoff document |
   | `execute_task` | Task has handoff, ready to execute |
   | `update_state_from_task` | Task has report, update state |
   | `create_corrective_handoff` | Create corrective task from review feedback |
   | `halt_task_failed` | Task failed — halt for intervention |
   | `spawn_code_reviewer` | Task needs code review |
   | `update_state_from_review` | Review complete, update state |
   | `triage_task` | Task needs triage decision |
   | `halt_triage_invariant` | Triage loop detected — halt |
   | `retry_from_review` | Review requested changes — retry |
   | `halt_from_review` | Review rejected — halt |
   | `advance_task` | Task approved — advance to next |
   | `gate_task` | Task gate — request human approval |

   **Execution tier — phase lifecycle (7 actions):**

   | Action | Meaning |
   |--------|---------|
   | `generate_phase_report` | All tasks complete — generate phase report |
   | `spawn_phase_reviewer` | Phase needs review |
   | `update_state_from_phase_review` | Phase review complete, update state |
   | `triage_phase` | Phase needs triage decision |
   | `halt_phase_triage_invariant` | Phase triage loop detected — halt |
   | `gate_phase` | Phase gate — request human approval |
   | `advance_phase` | Phase approved — advance to next |
   | `transition_to_review` | All phases complete — transition to review tier |

   **Review tier (3 actions):**

   | Action | Meaning |
   |--------|---------|
   | `spawn_final_reviewer` | Spawn final comprehensive review |
   | `request_final_approval` | Final review complete — request human approval |
   | `transition_to_complete` | Final review approved — mark complete |

   **Terminal (2 actions):**

   | Action | Meaning |
   |--------|---------|
   | `display_halted` | Project is halted — display status |
   | `display_complete` | Project is complete — display status |

   Add a summary note: "The resolver is a pure function that returns one of these 35 values from a closed enum based solely on the current `state.json` contents."

7. **Write the result shapes section** — document both success and error JSON:

   **Success result:**
   ```json
   {
     "success": true,
     "action": "execute_task",
     "context": {
       "tier": "execution",
       "phase_index": 0,
       "task_index": 2,
       "phase_id": "P01",
       "task_id": "P01-T03",
       "reason": "Task P01-T03 has handoff but status is not_started"
     },
     "mutations_applied": [
       "task.status → in_progress"
     ],
     "triage_ran": false,
     "validation_passed": true
   }
   ```

   **Error result:**
   ```json
   {
     "success": false,
     "error": "Validation failed: [V3] Only one task may be in_progress",
     "event": "task_handoff_created",
     "state_snapshot": { "current_phase": 0 },
     "mutations_applied": [],
     "validation_passed": false
   }
   ```

8. **Write the pipeline internals section** covering:
   - **Mutation lookup table**: The `MUTATIONS` object in `mutations.js` maps each of the 18 non-start events to a pure handler function. Each handler receives `(state, context)` and returns `{ state, mutations_applied }`. Functions mutate the state object in place and return the list of human-readable mutation descriptions.
   - **Integrated triage**: Three events auto-trigger triage: `task_completed`, `code_review_completed` (→ task-level), and `phase_review_completed` (→ phase-level). Triage runs inside the engine after mutation but before the final state write — mutation + triage are atomic (single write).
   - **`triage_attempts` lifecycle**: Stored at `execution.triage_attempts` in `state.json`. Initialized to `0`. Incremented by 1 on every triage run. Reset to `0` when a task or phase advances. If value exceeds `1` before triage runs, the pipeline returns `display_halted` (triage invariant).
   - **Dual validation**: Triage-triggering events run validation twice — once for the mutation (post-mutation state vs. pre-mutation state) and once for the triage changes (post-triage state vs. post-mutation state). This prevents false-positive invariant violations (e.g., V8, V14).
   - **I/O isolation via `PipelineIO`**: The pipeline engine receives all I/O functions via dependency injection. The `PipelineIO` interface:
     ```javascript
     {
       readState: (projectDir) => Object|null,
       writeState: (projectDir, state) => void,
       readConfig: (configPath) => Object,
       readDocument: (docPath) => { frontmatter, content }|null,
       ensureDirectories: (projectDir) => void
     }
     ```
     This makes the engine fully testable with in-memory stubs.

9. **Write the shared constants section** — document the `constants.js` enum reference table (reuse the same table format from the old file, updated for accuracy):

   | Enum | Values | Purpose |
   |------|--------|---------|
   | `PIPELINE_TIERS` | `planning`, `execution`, `review`, `complete`, `halted` | Pipeline tier progression |
   | `PLANNING_STATUSES` | `not_started`, `in_progress`, `complete` | Overall planning tier status |
   | `PLANNING_STEP_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `skipped` | Individual planning step status |
   | `PHASE_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` | Phase lifecycle status |
   | `TASK_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` | Task lifecycle status |
   | `REVIEW_VERDICTS` | `approved`, `changes_requested`, `rejected` | Review outcome |
   | `REVIEW_ACTIONS` | `advanced`, `corrective_task_issued`, `halted` | Task-level triage action (singular) |
   | `PHASE_REVIEW_ACTIONS` | `advanced`, `corrective_tasks_issued`, `halted` | Phase-level triage action (plural) |
   | `SEVERITY_LEVELS` | `minor`, `critical` | Error severity classification |
   | `HUMAN_GATE_MODES` | `ask`, `phase`, `task`, `autonomous` | Execution gate behavior |
   | `TRIAGE_LEVELS` | `task`, `phase` | Triage scope |
   | `NEXT_ACTIONS` | 35 values (see action vocabulary table) | Complete routing vocabulary |

   Include the note: "`REVIEW_ACTIONS` uses singular `corrective_task_issued` while `PHASE_REVIEW_ACTIONS` uses plural `corrective_tasks_issued`. This distinction is intentional."

10. **Write the testing and CLI conventions sections**:

    **Testing** — all tests use `node:test` (Node.js built-in). List the test files:
    ```bash
    node .github/orchestration/scripts/tests/constants.test.js
    node .github/orchestration/scripts/tests/mutations.test.js
    node .github/orchestration/scripts/tests/pipeline-engine.test.js
    node .github/orchestration/scripts/tests/pipeline.test.js
    node .github/orchestration/scripts/tests/state-io.test.js
    node .github/orchestration/scripts/tests/resolver.test.js
    node .github/orchestration/scripts/tests/state-validator.test.js
    node .github/orchestration/scripts/tests/triage-engine.test.js
    ```
    Coverage targets: every event has at least one mutation test, every resolved action has at least one resolver test, every decision table row has a triage test, every invariant (V1–V15) has positive and negative validator tests.

    **CLI conventions** (same as old system):
    - CommonJS modules with `'use strict'`
    - Shebang line: `#!/usr/bin/env node`
    - `if (require.main === module)` guard — allows both CLI and programmatic use
    - `parseArgs()` exported — CLI argument parsing is testable
    - GNU long-option style: `--event`, `--project-dir`, `--config`, `--context`
    - Exit codes: `0` = success, `1` = failure
    - stdout = structured JSON output, stderr = diagnostics and crash messages
    - Zero external dependencies — Node.js built-ins only

## Contracts & Interfaces

### PipelineIO Interface (dependency injection)

```javascript
// Constructed in pipeline.js, injected into pipeline-engine.js
const io = {
  readState:         (projectDir) => Object | null,
  writeState:        (projectDir, state) => void,
  readConfig:        (configPath) => Object,
  readDocument:      (docPath) => { frontmatter: Object, content: string } | null,
  ensureDirectories: (projectDir) => void
};
```

### PipelineResult — Success Shape

```javascript
{
  success: true,           // boolean
  action: string,          // One of NEXT_ACTIONS enum values
  context: Object,         // { tier, phase_index, task_index, phase_id, task_id, reason }
  mutations_applied: [],   // string[] — human-readable mutation descriptions
  triage_ran: boolean,     // Whether integrated triage executed
  validation_passed: true  // boolean — always true on success
}
```

### PipelineResult — Error Shape

```javascript
{
  success: false,          // boolean
  error: string,           // Human-readable error message
  event: string | null,    // Event that caused the failure
  state_snapshot: Object | null, // Partial state for debugging
  mutations_applied: [],   // string[] — mutations applied before error
  validation_passed: null | false // null if not run, false if failed
}
```

### MutationResult Shape (internal to mutations.js)

```javascript
{
  state: Object,           // The mutated state object (same reference, modified in place)
  mutations_applied: []    // string[] — e.g., ["task.status → in_progress", "task.handoff_doc → path"]
}
```

### MUTATIONS Lookup Table (18 entries in mutations.js)

```javascript
const MUTATIONS = {
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
```

### Triage-Triggering Events

```javascript
function needsTriage(event, state) {
  if (event === 'task_completed')          return { shouldTriage: true, level: 'task' };
  if (event === 'code_review_completed')   return { shouldTriage: true, level: 'task' };
  if (event === 'phase_review_completed')  return { shouldTriage: true, level: 'phase' };
  return { shouldTriage: false, level: null };
}
```

## Styles & Design Tokens

Not applicable — this is a documentation-only task.

## Test Requirements

- [ ] The rewritten `docs/scripts.md` is valid Markdown (no broken links, no unclosed code blocks)
- [ ] All code blocks use correct language identifiers (`bash`, `json`, `javascript`)
- [ ] The document does NOT contain any of these stale terms: `next-action.js`, `triage.js`, `validate-state.js`
- [ ] The 19-event table has exactly 19 rows (matching the 18 MUTATIONS entries + `start`)
- [ ] The action vocabulary tables list all 35 `NEXT_ACTIONS` enum values
- [ ] The shared constants table lists all 12 enums from `constants.js`

## Acceptance Criteria

- [ ] `docs/scripts.md` is a complete rewrite — zero content from the old 3-script documentation remains
- [ ] Document title reflects the unified pipeline script (not "Node.js Scripts" for 3 scripts)
- [ ] CLI usage section shows the exact `pipeline.js` invocation with all 4 flags (`--event`, `--project-dir`, `--config`, `--context`)
- [ ] 4-layer module architecture is documented with directory tree showing all 7 lib modules and 8 test files
- [ ] Closed event vocabulary table contains all 19 events with tier, description, and triage indicator
- [ ] Action vocabulary section contains all 35 `NEXT_ACTIONS` values organized by tier
- [ ] Both success and error result JSON shapes are documented with examples
- [ ] Pipeline internals section covers: mutation lookup table, integrated triage, `triage_attempts` lifecycle, dual validation, `PipelineIO` dependency injection
- [ ] Shared constants enum reference table includes all 12 enums with values
- [ ] Testing section lists all 8 test files with `node:test` runner commands
- [ ] CLI conventions section is present (CommonJS, shebang, `require.main === module`, GNU options, exit codes, zero dependencies)
- [ ] The string `next-action.js` does not appear anywhere in the file
- [ ] The string `triage.js` does not appear anywhere in the file (except as an event name like `triage_engine.test.js`)
- [ ] The string `validate-state.js` does not appear anywhere in the file
- [ ] No references to "Tactical Planner writes state.json" — the pipeline script is the sole writer

## Constraints

- Do NOT modify any file other than `docs/scripts.md`
- Do NOT reference `next-action.js`, `triage.js`, or `validate-state.js` as existing scripts
- Do NOT add content about agent roles, pipeline flow, or architecture beyond what the scripts do — that belongs in `pipeline.md` and `agents.md`
- Do NOT reference `STATUS.md` — it has been deleted
- Do NOT reference `state-json-schema.md` or `state-management.instructions.md` — they have been deleted
- Do NOT say "see Architecture doc" or "see Design doc" — this task is self-contained from the handoff, and the output `scripts.md` should be self-contained as a standalone reference
- Do NOT invent information — document only what exists in the actual source code under `.github/orchestration/scripts/`
- Preserve the document's role as the definitive reference for the scripting system — other docs (`pipeline.md`, `agents.md`, `configuration.md`) will link to it
