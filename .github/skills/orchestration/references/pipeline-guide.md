# Pipeline Guide

Reference document for the Orchestrator agent. Covers the pipeline event loop, action routing, CLI usage, and error handling.

## Configuration

### Orchestration Root {orchRoot}

Before constructing any path, determine the orchestration root folder:
1. Find `orchestration.yml` in the workspace.
2. If found, use its directory as `orchRoot`.
3. Every `pipeline.js` JSON result includes an `orchRoot` field. Use `result.orchRoot` for all path construction after the first pipeline call.
4. {orchRoot} is the base for all file paths in the pipeline — planning docs, code files, logs, and even subsequent pipeline calls.
- `projects.base_path`: Where project folders live
- Use `base_path` to locate the project directory: `{base_path}/{PROJECT-NAME}/`.

## Pipeline Event Loop

The Orchestrator operates as an event-driven controller:

1. **Determine the event to signal** (see Event Signaling Reference below)
2. **Call the pipeline script**:
   ```
   node {orchRoot}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> [--config <path>]
       [--doc-path <path>]
       [--branch <name>] [--base-branch <name>] [--worktree-path <path>]
       [--auto-commit <always|never>] [--auto-pr <always|never>]
       [--remote-url <url>] [--compare-url <url>]
       [--gate-type <type>] [--reason <text>]
       [--gate-mode <mode>]
       [--commit-hash <hash>] [--pushed <true|false>]
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
node {orchRoot}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> [--config <path>]
    [--doc-path <path>]
    [--branch <name>] [--base-branch <name>] [--worktree-path <path>]
    [--auto-commit <always|never>] [--auto-pr <always|never>]
    [--remote-url <url>] [--compare-url <url>]
    [--gate-type <type>] [--reason <text>]
    [--gate-mode <mode>]
    [--commit-hash <hash>] [--pushed <true|false>]
```

The `--config` flag overrides the default config path:

```bash
node {orchRoot}/skills/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> --config <path-to-orchestration.yml>
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

→ See [action-event-reference.md](action-event-reference.md)

## Event Signaling Reference

These are the exact event names passed to `--event`:

→ See [action-event-reference.md](action-event-reference.md)

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
| 2 | Stale State (Recoverable) | A state field is stale, null, or inconsistent due to a prior incomplete transition, but the underlying agent output is valid. | `current_phase` still references a completed phase; a task status is stuck at `in-progress` after completion is confirmed. | Log the error. Clear or correct the stale field. Re-signal the appropriate event. Continue pipeline. |
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
node {orchRoot}/skills/orchestration/scripts/pipeline.js --event start --project-dir <path>
```

The pipeline loads `state.json`, skips mutation, and resolves the next action from the current state. All state is persisted in `state.json` by the pipeline script, so no runtime memory is needed.

## Spawning Subagents

When spawning a subagent, always provide:

1. **Clear task description**: What the agent should do
2. **File paths**: Exact paths to input documents the agent needs to read
3. **Project context**: Project name, current phase/task numbers from `result.context`
4. **Output expectations**: Where to save the output document (derive from project naming conventions)

Example spawn instruction:
> "Create the PRD for the MYAPP project. Read the research findings at `{base_path}/MYAPP/MYAPP-RESEARCH-FINDINGS.md`. If a brainstorming document exists at `{base_path}/MYAPP/MYAPP-BRAINSTORMING.md`, read that too. Save the PRD to `{base_path}/MYAPP/MYAPP-PRD.md`."

## Status Reporting

After every significant action, summarize to the human:
- What was just completed
- What the current state is
- What happens next

Keep status updates concise — 2-3 bullet points maximum.
