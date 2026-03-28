# Pipeline Guide

Reference document for the Orchestrator agent. Covers the pipeline event loop, action routing, CLI usage, and error handling.

## Pipeline Event Loop

The Orchestrator operates as an event-driven controller:

1. **Determine the event to signal** (see Event Signaling Reference below)
2. **Call the pipeline script**:
   ```
   node {orch_root}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> [--context <json>]
   ```
3. **Parse the JSON result** from stdout
4. **Pattern-match `result.action`** against the Action Routing Table
5. **Execute the action** (spawn agent, present gate, or display message)
6. **After the action completes**, determine the next event to signal based on the action's completion
7. **Go to step 2**

### First Call

- **New project**: `pipeline.js --event start --project-dir <path>`
- **Continuing a project**: `pipeline.js --event start --project-dir <path>`
- **Recovery after context compaction**: `pipeline.js --event start --project-dir <path>`

The `start` event is always safe — the pipeline loads `state.json`, skips mutation, and resolves the next action from the current state.

### CLI Invocation

Always invoke `pipeline.js` from the workspace root:

```bash
node {orch_root}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> [--context <json>]
```

The `--config` flag overrides the default config path:

```bash
node {orch_root}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> --config <path-to-orchestration.yml>
```

### Loop Termination

The loop terminates when `result.action` is `display_halted` or `display_complete`. These are terminal actions with no follow-up event.

### Valid Pause and Stop Points

Only these `result.action` values should pause execution for human input or stop the loop:

| Action | Behavior |
|--------|----------|
| `display_halted` | Stop — display message, loop terminates |
| `display_complete` | Stop — display summary, loop terminates |
| `request_plan_approval` | Pause — wait for human approval |
| `request_final_approval` | Pause — wait for human approval |
| `gate_task` | Pause — wait for human approval |
| `gate_phase` | Pause — wait for human approval |
| `ask_gate_mode` | Pause — wait for operator gate mode selection |

All other actions must be executed immediately without asking the human.

## Action Routing Table

Every `result.action` value maps to exactly one Orchestrator operation. All branching derives from this table.

| # | `result.action` | Category | Orchestrator Operation | Event to Signal on Completion |
|---|-----------------|----------|----------------------|-------------------------------|
| 1 | `spawn_research` | Agent spawn | **Two-step protocol:** (1) Signal `research_started` with `{}` context → pipeline returns `spawn_research` again; (2) Spawn **Research** agent with project idea + brainstorming doc (if exists). Output: {NAME}-RESEARCH-FINDINGS.md | `research_completed` with `{ "doc_path": "<output-path>" }` |
| 2 | `spawn_prd` | Agent spawn | **Two-step protocol:** (1) Signal `prd_started` with `{}` context → pipeline returns `spawn_prd` again; (2) Spawn **Product Manager** agent with RESEARCH-FINDINGS.md (+ brainstorming doc if exists). Output: {NAME}-PRD.md | `prd_completed` with `{ "doc_path": "<output-path>" }` |
| 3 | `spawn_design` | Agent spawn | **Two-step protocol:** (1) Signal `design_started` with `{}` context → pipeline returns `spawn_design` again; (2) Spawn **UX Designer** agent with PRD.md + RESEARCH-FINDINGS.md. Output: {NAME}-DESIGN.md | `design_completed` with `{ "doc_path": "<output-path>" }` |
| 4 | `spawn_architecture` | Agent spawn | **Two-step protocol:** (1) Signal `architecture_started` with `{}` context → pipeline returns `spawn_architecture` again; (2) Spawn **Architect** agent with PRD.md + DESIGN.md + RESEARCH-FINDINGS.md. Output: {NAME}-ARCHITECTURE.md | `architecture_completed` with `{ "doc_path": "<output-path>" }` |
| 5 | `spawn_master_plan` | Agent spawn | **Two-step protocol:** (1) Signal `master_plan_started` with `{}` context → pipeline returns `spawn_master_plan` again; (2) Spawn **Architect** agent with all planning docs. Output: {NAME}-MASTER-PLAN.md | `master_plan_completed` with `{ "doc_path": "<output-path>" }` |
| 6 | `create_phase_plan` | Agent spawn | **Two-step protocol — check `is_correction` first.** **Fresh phase** (`is_correction` is falsy): (1) Signal `phase_planning_started` with `{}` context → pipeline returns `create_phase_plan` again; (2) Spawn **Tactical Planner** (phase plan mode). **Corrective** (`is_correction` is true): Skip `phase_planning_started`, spawn **Tactical Planner** directly with `result.context.previous_review`. Output: phases/{NAME}-PHASE-{NN}-{TITLE}.md | `phase_plan_created` with `{ "doc_path": "<output-path>" }` |
| 7 | `create_task_handoff` | Agent spawn | Spawn **Tactical Planner** (handoff mode) for `result.context.phase`/`result.context.task`. If `result.context.is_correction` is true, create a corrective handoff. Output: tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md | `task_handoff_created` with `{ "doc_path": "<output-path>" }` |
| 8 | `execute_task` | Agent spawn | Spawn **Coder** agent with the task's handoff document. Output: reports/{NAME}-TASK-REPORT-P{NN}-T{NN}-{TITLE}.md | `task_completed` with `{ "doc_path": "<output-path>" }` |
| 9 | `spawn_code_reviewer` | Agent spawn | Spawn **Reviewer** agent for task-level code review. Output: reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md | `code_review_completed` with `{ "doc_path": "<output-path>" }` |
| 10 | `generate_phase_report` | Agent spawn | Spawn **Tactical Planner** (report mode) for the phase. Output: reports/{NAME}-PHASE-REPORT-P{NN}-{TITLE}.md | `phase_report_created` with `{ "doc_path": "<output-path>" }` |
| 11 | `spawn_phase_reviewer` | Agent spawn | Spawn **Reviewer** agent for phase-level review. Output: reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md | `phase_review_completed` with `{ "doc_path": "<output-path>" }` |
| 12 | `spawn_final_reviewer` | Agent spawn | Spawn **Reviewer** agent for final comprehensive review. Output: {NAME}-FINAL-REVIEW.md | `final_review_completed` with `{ "doc_path": "<output-path>" }` |
| 13 | `request_plan_approval` | Human gate | Display Master Plan summary to the human. Ask human to approve or reject. | `plan_approved` (if approved) or `plan_rejected` (if rejected) |
| 14 | `request_final_approval` | Human gate | Display final review to the human. Ask human to approve or request changes. | `final_approved` (if approved) or `final_rejected` (if rejected) |
| 15 | `gate_task` | Human gate | Show task results to the human. Wait for approval. | `gate_approved` with `{ "gate_type": "task" }` or `gate_rejected` with `{ "gate_type": "task", "reason": "<reason>" }` |
| 16 | `gate_phase` | Human gate | Show phase results to the human. Wait for approval. | `gate_approved` with `{ "gate_type": "phase" }` or `gate_rejected` with `{ "gate_type": "phase", "reason": "<reason>" }` |
| 17 | `ask_gate_mode` | Human gate | Present the three gate mode options (`task`, `phase`, `autonomous`) to the operator. Wait for selection. | `gate_mode_set` with `{ "gate_mode": "<chosen>" }` |
| 18 | `display_halted` | Terminal | Display `result.context.message` to the human. **Loop terminates.** | *(none — terminal action)* |
| 19 | `display_complete` | Terminal | Display completion summary to the human. **Loop terminates.** | *(none — terminal action)* |

## Event Signaling Reference

These are the exact event names passed to `--event`:

| Event | Context Payload | When to Signal |
|-------|----------------|----------------|
| `start` | `{}` | First call (new project), cold start, or context compaction recovery |
| `research_started` | `{}` | Before Research agent spawn. Transitions `planning.steps[0].status` to `in_progress`. See action #1 two-step protocol. |
| `research_completed` | `{ "doc_path": "<path>" }` | After Research agent finishes |
| `prd_started` | `{}` | Before Product Manager spawn. Transitions `planning.steps[1].status` to `in_progress`. See action #2 two-step protocol. |
| `prd_completed` | `{ "doc_path": "<path>" }` | After Product Manager finishes |
| `design_started` | `{}` | Before UX Designer spawn. Transitions `planning.steps[2].status` to `in_progress`. See action #3 two-step protocol. |
| `design_completed` | `{ "doc_path": "<path>" }` | After UX Designer finishes |
| `architecture_started` | `{}` | Before Architect spawn (architecture doc). Transitions `planning.steps[3].status` to `in_progress`. See action #4 two-step protocol. |
| `architecture_completed` | `{ "doc_path": "<path>" }` | After Architect finishes (architecture doc) |
| `master_plan_started` | `{}` | Before Architect spawn (master plan). Transitions `planning.steps[4].status` to `in_progress`. See action #5 two-step protocol. |
| `master_plan_completed` | `{ "doc_path": "<path>" }` | After Architect finishes (master plan) |
| `plan_approved` | `{}` | After human approves master plan |
| `plan_rejected` | `{}` | After human rejects master plan |
| `phase_planning_started` | `{}` | Before Tactical Planner spawn for fresh (non-corrective) phases only. Transitions phase from `not_started / planning` to `in_progress / planning`. See action #6 two-step protocol. |
| `phase_plan_created` | `{ "doc_path": "<path>" }` | After Tactical Planner finishes phase plan |
| `task_handoff_created` | `{ "doc_path": "<path>" }` | After Tactical Planner finishes task handoff |
| `task_completed` | `{ "doc_path": "<path>" }` | After Coder finishes task |
| `code_review_completed` | `{ "doc_path": "<path>" }` | After Reviewer finishes code review |
| `phase_report_created` | `{ "doc_path": "<path>" }` | After Tactical Planner finishes phase report |
| `phase_review_completed` | `{ "doc_path": "<path>" }` | After Reviewer finishes phase review |
| `gate_mode_set` | `{ "gate_mode": "<chosen>" }` | After operator selects gate mode |
| `gate_approved` | `{ "gate_type": "task\|phase" }` | After human approves a gate |
| `gate_rejected` | `{ "gate_type": "task\|phase", "reason": "<reason>" }` | After human rejects a gate |
| `final_review_completed` | `{ "doc_path": "<path>" }` | After final reviewer finishes |
| `final_approved` | `{}` | After human approves final review |
| `final_rejected` | `{}` | After human rejects final review |
| `halt` | `{}` | Emergency stop — signals the pipeline to halt immediately |

## State Mutations

All state mutations are performed by the pipeline script internally — no agent writes `state.json` directly. The pipeline:

1. Receives an event via CLI
2. Validates the current state
3. Applies the appropriate mutation(s)
4. Validates the resulting state
5. Writes `state.json`
6. Returns the JSON result with `result.action`

The pipeline result always includes:
- `success`: boolean
- `action`: the next action for the Orchestrator to execute
- `context`: action-specific payload
- `orchRoot`: the orchestration root path (use for subsequent calls)

## Error Handling

If the pipeline exits with code 1, the result contains error details:

```json
{
  "success": false,
  "error": "Validation failed: V6 — multiple in_progress tasks",
  "event": "task_completed",
  "state_snapshot": { "current_phase": 1, "current_task": 1 },
  "mutations_applied": ["task_status → complete"],
  "validation_passed": false
}
```

| Category | Name | Description | Examples | Action |
|----------|------|-------------|----------|--------|
| 1 | Sequencing Error (Recoverable) | The Orchestrator signaled the wrong event or signaled out of order, but no agent output was produced or consumed. | Signaling `task-execute` before `task-plan` is complete; signaling an event for a phase that isn't active. | Log the error. Re-signal the correct event. Continue pipeline. |
| 2 | Stale State (Recoverable) | A state field is stale, null, or inconsistent due to a prior incomplete transition, but the underlying agent output is valid. | `current_phase` still references a completed phase; a task status is stuck at `in-progress` after the task report confirms completion. | Log the error. Clear or correct the stale field. Re-signal the appropriate event. Continue pipeline. |
| 3 | Output Quality Error (Recoverable) | An agent produced an output file with malformed content, invalid frontmatter, wrong status values, or missing required sections. The Orchestrator cannot fix this programmatically. | pipeline returns unexpected type due to malformed frontmatter; agent output file is missing or empty; code review verdict is not one of the valid enum values. | Log the error with full context (file path, field name, expected vs. actual value). Display the error to the human operator. Halt the pipeline immediately. Do not attempt automatic recovery. |
| 4 | Critical issue with the project code itself (Unrecoverable) | The agent output is not just malformed, but indicates a critical failure in the codebase that prevents further progress. | Code produced that fails to compile or run at all, blocking all downstream work. | Log the error with full context. Halt the pipeline immediately. Do not attempt automatic recovery. |

**Default rule**: When an error does not clearly fit Category 1 or Category 2, or Category 3, treat it as **Category 4 (Halt)**. A false halt is recoverable by the human operator; a false recovery may corrupt pipeline state.

**On every `success: false` result:**

1. **Classify** the error using the table above
2. **Log the error**: Invoke the `log-error` skill to append a structured entry to `{NAME}-ERROR-LOG.md` in the project directory (e.g., `{base_path}/MYAPP/MYAPP-ERROR-LOG.md`). Populate the entry fields from the pipeline result:
   - **Pipeline Event**: from `result.event`
   - **Pipeline Action**: from `result.action` (or `N/A` if not present)
   - **Severity**: classify using the skill's severity guide (`critical` = blocks execution, `high` = incorrect state, `medium` = degraded behavior, `low` = cosmetic)
   - **Phase/Task**: from `result.state_snapshot`
   - **Symptom**: describe the observable failure from `result.error`
   - **Pipeline Output**: the full raw JSON result
   - **Root Cause**: diagnose if obvious, otherwise "Under investigation."
   - **Workaround Applied**: describe recovery action, or "None — awaiting fix."
3. **Execute the category action**: Follow the Action column for the classified category. For Category 3, display `result.error` to the human and halt immediately.

## Recovery

On context compaction or agent restart, the Orchestrator has no runtime memory to recover. Recovery is a single call:

```bash
node {orch_root}/skills/orchestration/scripts/pipeline.js --event start --project-dir <path>
```

The pipeline loads `state.json`, skips mutation, and resolves the next action from the current state. All state is persisted in `state.json` by the pipeline script, so no runtime memory is needed.
