# Pipeline Guide

Reference document for the Orchestrator agent. Covers the envelope contract, the event loop, CLI invocation, valid pause/stop points, error handling, recovery, and spawning guidance.

> **ALWAYS FOLLOW THE GATE PROTOCOL in state.json.** When `ask` or `never` is selected for any gate listed in the project's `state.json`, no exceptions — even in Copilot's "autopilot", Claude Code's "Auto Mode", or any other YOLO-style mode. The human approves or rejects at every gate when `ask` or `never` is configured. Do not attempt to bypass or automate human approval at gates under any circumstances.

## Envelope Shape

Every successful `radorch pipeline signal` call returns a JSON envelope of this shape on stdout:

```jsonc
{
  "ok": true,
  "data": {
    "action": "<action-name>",          // next operation; null when the pipeline has nothing more to do
    "completion_event": "<event-name>", // event to signal when the action completes; null for terminal actions
    "prompt": "<composed instructions>",// sole instruction source for this action
    "context": { /* action-specific payload */ }
  }
}
```

`data.prompt` is composed by the engine from the catalog under `~/.radorc/action-events/`. It includes:

- the action body (no heading), followed by
- a `## When complete` section containing the completion event's instruction body and a derived `Signal: <event> [--<flag> <value>]` line, when `data.completion_event` is non-null,
- optional `## Before doing this action`, `## Before signaling`, and `## After signaling` sections injected from `~/.radorc/action-events/custom/` overlays.

The orchestrator reads `data.prompt` as the sole instruction source for the action. The embedded `Signal:` line is authoritative for the event name and its flags — derive nothing else from this skill.

`data.context` carries the action-specific payload (file paths, phase/task identifiers, configuration). When the prompt references a context field by name (e.g., `handoff_doc`, `repository_skills_block`, `worktree_path`), read that field from `data.context`.

## Frontmatter Onboarding — action / event files

Catalog files under `~/.radorc/action-events/` follow `<kind>.<name>.md`:

- **`action.<name>.md`** — frontmatter requires `kind: action`, `name`, `title`, `description`, `category` (one of `agent-spawn`, `gate`, `terminal`, `source-control`), and `completion_event` (string or `null`). The body is instruction prose — what the orchestrator does when this action is returned.
- **`event.<name>.md`** — frontmatter requires `kind: event`, `name`, `title`, `description`, and `signal_payload` (a map of flag-name → flag definition; `{}` when the event takes no flags). The body is instruction prose — what to confirm before signaling.
- **`custom/<...>.md`** — project-level overlays. Slot shapes are `action.<name>.pre.md`, `event.<name>.pre.md`, and `event.<name>.post.md`. Each overlay shares its parent catalog file's frontmatter contract so the validator can confirm it targets a real entry.

The catalog README at `~/.radorc/action-events/README.md` and `~/.radorc/action-events/custom/README.md` are the authoritative documentation for the file contracts, slot shapes, and merge behavior. This skill does not duplicate them.

## Cross-cutting invariants

- **Single-source instructions.** `data.prompt` is the only place the orchestrator reads per-action instructions. No routing tables, no signaling lookups, no inline action recipes live in this skill or in agent files.
- **No `_started` two-step protocol.** The pipeline does not return an action twice. Step-node `in_progress` transitions are written optimistically on the engine response that returns the action; the orchestrator simply executes the work and signals the completion event.
- **Optimistic in-progress transitions.** When the engine returns a step-level action, it has already marked the corresponding step node `in_progress` on the same writeState. Agents never simulate this transition.
- **`completion_event === null` ⇒ terminal action.** Display the message in `data.prompt` and exit the loop. Currently `display_halted` and `display_complete`.

## Pipeline Event Loop

The Orchestrator operates as an event-driven controller:

1. **Determine the event to signal.** On a fresh session, signal `start`. After every action, signal the `data.completion_event` from the previous envelope (using the `Signal:` line in `data.prompt` for flag names).
2. **Invoke the CLI** using the canonical form below.
3. **Parse the JSON envelope** from stdout.
4. **Execute `data.prompt`.** Use `data.context` for inputs. Do not consult this skill for per-action steps — the prompt is authoritative.
5. **Signal `data.completion_event`** when the action completes (or terminate the loop if it is `null`).
6. Go to step 2.

### CLI Invocation

The `radorch pipeline signal` subcommand is the pipeline entry point. All pipeline calls use this canonical form, with `${PLUGIN_ROOT}` resolving to the orchestration install root at runtime:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" pipeline signal \
  --event <event> \
  --project-dir <dir> \
  [--config <path>] [--template <name>] \
  [--doc-path <path>] \
  [--branch <name>] [--base-branch <name>] [--worktree-path <path>] \
  [--auto-commit <always|never>] [--auto-pr <always|never>] \
  [--remote-url <url>] [--compare-url <url>] \
  [--gate-type <type>] [--reason <text>] [--gate-mode <mode>] \
  [--commit-hash <hash>] [--pushed <true|false>] [--pr-url <url>] \
  [--parse-error <json>]
```

Always invoke from the workspace root. The `--config` flag overrides the default config path. The catalog file for each event documents which flags are required for that event in its `signal_payload` block; the `Signal:` line in `data.prompt` mirrors the same shape.

### First Call

Signal `--event start --project-dir <path>` for new projects, for continuing a project, and for recovery after context compaction. The `start` event is always safe — the pipeline loads `state.json`, skips mutation, and resolves the next action from the current state.

### Loop Termination

The loop terminates when `data.completion_event` is `null`. In the current catalog this fires on `display_halted` and `display_complete`. The orchestrator displays the message in `data.prompt` and exits.

## Valid Pause and Stop Points

Only these actions pause execution for human input or stop the loop. All other actions execute immediately without asking the human.

| Action | Behavior |
|--------|----------|
| `display_halted` | Stop — display message, loop terminates |
| `display_complete` | Stop — display summary, loop terminates |
| `request_plan_approval` | Pause — wait for human approval |
| `request_final_approval` | Pause — wait for human approval |
| `gate_task` | Pause — wait for human approval |
| `gate_phase` | Pause — wait for human approval |
| `ask_gate_mode` | Pause — wait for operator gate mode selection |

The catalog file for each pause-point action carries the human-facing prompt language. The orchestrator reads that prose from `data.prompt`, not from this table.

## Corrective Mediation

When the pipeline returns `data.action` of `spawn_code_reviewer` and the reviewer returns a raw `verdict: changes_requested`, the orchestrator enters an in-session mediation flow **before** signaling `code_review_completed`. The full mediation procedure — per-finding judgment, addendum authoring, corrective Task Handoff creation, and budget enforcement — is defined in [`corrective-playbook.md`](corrective-playbook.md). The same flow fires on `phase_review_completed` with raw `verdict: changes_requested`. When the reviewer returns `approved`, the orchestrator signals the completion event with no mediation fields and propagation is normal. When the reviewer returns `rejected`, the orchestrator signals the completion event immediately (no mediation) and the mutation routes the rejected verdict into a clean pipeline halt. The orchestrator never flips an `approved` verdict to `changes_requested`.

## Error Handling

If the pipeline exits with code 1, the envelope carries error details:

```json
{
  "ok": false,
  "data": { "event": "task_completed", "field": "phase" },
  "error": { "type": "user_error", "message": "Validation failed: V6 — multiple in_progress tasks" }
}
```

| Category | Name | Description | Examples | Action |
|----------|------|-------------|----------|--------|
| 1 | Sequencing Error (Recoverable) | The Orchestrator signaled the wrong event or signaled out of order, but no agent output was produced or consumed. | Signaling `task-execute` before `task-plan` is complete; signaling an event for a phase that isn't active. | Log the error. Re-signal the correct event. Continue pipeline. |
| 2 | Stale State (Recoverable) | A state field is stale, null, or inconsistent due to a prior incomplete transition, but the underlying agent output is valid. | `current_phase` still references a completed phase; a task status is stuck at `in-progress` after completion is confirmed. | Log the error. Clear or correct the stale field. Re-signal the appropriate event. Continue pipeline. |
| 3 | Output Quality Error (Recoverable) | An agent produced an output file with malformed content, invalid frontmatter, wrong status values, or missing required sections. The Orchestrator cannot fix this programmatically. | Pipeline returns unexpected type due to malformed frontmatter; agent output file is missing or empty; code review verdict is not one of the valid enum values. | Log the error with full context (file path, field name, expected vs. actual value). Display the error to the human operator. Halt the pipeline immediately. Do not attempt automatic recovery. |
| 4 | Critical issue with the project code itself (Unrecoverable) | The agent output is not just malformed, but indicates a critical failure in the codebase that prevents further progress. | Code produced that fails to compile or run at all, blocking all downstream work. | Log the error with full context. Halt the pipeline immediately. Do not attempt automatic recovery. |

**Default rule**: When an error does not clearly fit Category 1, 2, or 3, treat it as **Category 4 (Halt)**. A false halt is recoverable by the human operator; a false recovery may corrupt pipeline state.

**On every `ok: false` envelope:**

1. **Classify** the error using the table above.
2. **Log the error**: Invoke the `rad-log-error` skill to append a structured entry to `{NAME}-ERROR-LOG.md` in the project directory (e.g., `~/.radorc/projects/MYAPP/MYAPP-ERROR-LOG.md`). Populate the entry fields from the envelope:
   - **Pipeline Event**: from `data.event`
   - **Pipeline Action**: from `data.action` (or `N/A` if not present)
   - **Severity**: classify using the skill's severity guide (`critical` = blocks execution, `high` = incorrect state, `medium` = degraded behavior, `low` = cosmetic)
   - **Phase/Task**: from `data.field`
   - **Symptom**: describe the observable failure from `error.message`
   - **Pipeline Output**: the full raw JSON envelope
   - **Root Cause**: diagnose if obvious, otherwise "Under investigation."
   - **Workaround Applied**: describe recovery action, or "None — awaiting fix."
3. **Execute the category action**: Follow the Action column for the classified category. For Category 3, display `error.message` to the human and halt immediately.

## Recovery

On context compaction or agent restart, the Orchestrator has no runtime memory to recover. Recovery is a single `radorch pipeline signal` call with `--event start --project-dir <path>` using the canonical form above. The pipeline loads `state.json`, skips mutation, and resolves the next action from the current state. All state is persisted in `state.json` by the pipeline script, so no runtime memory is needed.

## Spawning Subagents

When the action in `data.prompt` instructs the orchestrator to spawn an agent, provide:

1. **Clear task description** — what the agent should do, taken from `data.prompt` and the agent-specific manifests referenced therein.
2. **File paths** — exact paths to input documents the agent needs to read, drawn from `data.context`.
3. **Project context** — project name, current phase/task numbers from `data.context`.
4. **Output expectations** — where to save the output document (derive from project naming conventions in `document-conventions.md`).

Example spawn instruction (paraphrased):
> "Create the requirements for the MYAPP project. If a brainstorming document exists at `~/.radorc/projects/MYAPP/MYAPP-BRAINSTORMING.md`, read that. Save the requirements to `~/.radorc/projects/MYAPP/MYAPP-REQUIREMENTS.md`."

The action's catalog file (e.g., `action.spawn_requirements.md`) carries the canonical spawn-prompt shape; the composer assembles it into `data.prompt`. Read it from the envelope; do not duplicate it here.

## Status Reporting

After every significant action, summarize to the human:
- What was just completed.
- What the current state is.
- What happens next.

Keep status updates concise — 2-3 bullet points maximum.
