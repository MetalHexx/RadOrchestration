---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 2
title: "Orchestrator Agent Rewrite"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Orchestrator Agent Rewrite

## Objective

Rewrite `.github/agents/orchestrator.agent.md` to an event-driven controller that calls `pipeline.js`, parses JSON results, and routes on an ~18-action table. The rewritten definition replaces the current ~260-line 35-action mapping with a shorter, compaction-proof event loop.

## Context

The orchestration system now has a unified pipeline script (`pipeline.js`) that internalizes state mutations, validation, triage, and next-action resolution into a single CLI call. The Orchestrator no longer needs to coordinate multiple scripts, maintain runtime triage counters, or manage intermediate mechanical actions. It signals events, parses results, and routes on ~18 external actions. `triage_attempts` is persisted in `state.json` by the pipeline script — the Orchestrator does not track it. The T01 carry-forward fixes ensure all 19 events work correctly, including the V8/V9 triage paths.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | Full content replacement — rewrite from scratch |

## Implementation Steps

1. **Replace the entire content** of `.github/agents/orchestrator.agent.md` with the new definition specified below.

2. **Preserve the frontmatter structure** but update it:
   - Keep `name: Orchestrator`
   - Keep the same `tools` list: `read`, `search`, `agent`, `execute`
   - Keep the same `agents` list (all 7 subagents)
   - Update the `description` to reference event-driven operation

3. **Write the Role & Constraints section**:
   - The Orchestrator signals events via `pipeline.js`, parses JSON results, and routes on the action table
   - It spawns subagents, presents human gates, and displays terminal messages
   - It **never writes files directly** — strictly read-only plus script execution
   - Write access: **NONE** (files). Execute access: `pipeline.js` only
   - Remove all references to `STATUS.md` — the Orchestrator reads `state.json` for context

4. **Write the Event Loop section** — the core operational loop:
   ```
   1. Determine the event to signal (see Event Signaling Reference)
   2. Call: node .github/orchestration/scripts/pipeline.js --event <event> --project-dir <dir> [--context <json>]
   3. Parse JSON result from stdout
   4. Pattern-match result.action against the Action Routing Table
   5. Execute the action (spawn agent, present gate, display message)
   6. After action completes, determine the next event to signal
   7. Go to step 2
   ```
   - For the first call (new project or recovery): use `--event start`
   - The loop terminates when the action is `display_halted` or `display_complete`

5. **Write the Action Routing Table** — exactly 18 rows as specified in the Contracts section below. Each row maps an action to the Orchestrator operation and the event to signal on completion.

6. **Write the Event Signaling Reference** — a table showing which events the Orchestrator signals and what context payload to include.

7. **Write the Recovery section**:
   - On context compaction or agent restart: call `pipeline.js --event start --project-dir <path>`
   - Pipeline loads `state.json`, skips mutation, resolves next action from current state
   - All state (including `triage_attempts`) is in `state.json` — no runtime memory needed

8. **Write the Spawning Subagents section** — brief guidance on what to include when spawning agents (task description, file paths, project context, output expectations).

9. **Write the Configuration section** — read `.github/orchestration.yml` for `projects.base_path` and project location.

10. **Verify the final document** meets all acceptance criteria: exactly 18 actions, zero STATUS.md references, zero references to old scripts, event-driven loop clearly documented.

## Contracts & Interfaces

### Frontmatter (preserve this structure)

```chatagent
---
name: Orchestrator
description: "The main orchestration agent that coordinates the entire project pipeline. Signals events to the pipeline script, parses JSON results, and routes on an 18-action table. Never writes files directly."
argument-hint: "Describe the project to start, or ask to continue an existing project."
tools:
  - read
  - search
  - agent
  - execute
agents:
  - Research
  - Product Manager
  - UX Designer
  - Architect
  - Tactical Planner
  - Coder
  - Reviewer
---
```

### Pipeline CLI Contract

```
node .github/orchestration/scripts/pipeline.js --event <event-name> --project-dir <path> [--config <path>] [--context <json>]
```

- `--event` (required): Event name from the closed vocabulary (19 events)
- `--project-dir` (required): Absolute path to project directory
- `--config` (optional): Path to `orchestration.yml` (auto-discovered if omitted)
- `--context` (optional): JSON string with event-specific context payload

**Output**: stdout is a single JSON object. Exit code 0 = success, exit code 1 = error.

### Pipeline Result Schema (Success)

```json
{
  "success": true,
  "action": "<one of 18 action values>",
  "context": {
    "phase": 0,
    "task": 2,
    "doc_path": "/path/to/relevant/doc",
    "corrective": false,
    "message": "Human-readable description"
  },
  "mutations_applied": ["task_status → complete"],
  "triage_ran": true,
  "validation_passed": true
}
```

The Orchestrator uses `result.action` for routing and `result.context` for spawning details. `mutations_applied` and `triage_ran` are diagnostic only.

### Pipeline Result Schema (Error)

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

On error (exit code 1), display `result.error` to the human and halt.

### Action Routing Table (~18 Actions)

This is the complete routing table. Every `result.action` value maps to exactly one Orchestrator operation. The Orchestrator does NO other routing logic — all branching derives from this table.

| # | `result.action` | Category | Orchestrator Operation | Event to Signal on Completion |
|---|-----------------|----------|----------------------|-------------------------------|
| 1 | `spawn_research` | Agent spawn | Spawn **Research** agent with project idea + brainstorming doc (if exists). Output: RESEARCH-FINDINGS.md | `research_completed` with `{ "doc_path": "<output-path>" }` |
| 2 | `spawn_prd` | Agent spawn | Spawn **Product Manager** agent with RESEARCH-FINDINGS.md (+ brainstorming doc if exists). Output: PRD.md | `prd_completed` with `{ "doc_path": "<output-path>" }` |
| 3 | `spawn_design` | Agent spawn | Spawn **UX Designer** agent with PRD.md + RESEARCH-FINDINGS.md. Output: DESIGN.md | `design_completed` with `{ "doc_path": "<output-path>" }` |
| 4 | `spawn_architecture` | Agent spawn | Spawn **Architect** agent with PRD.md + DESIGN.md + RESEARCH-FINDINGS.md. Output: ARCHITECTURE.md | `architecture_completed` with `{ "doc_path": "<output-path>" }` |
| 5 | `spawn_master_plan` | Agent spawn | Spawn **Architect** agent with all planning docs. Output: MASTER-PLAN.md | `master_plan_completed` with `{ "doc_path": "<output-path>" }` |
| 6 | `create_phase_plan` | Agent spawn | Spawn **Tactical Planner** (phase plan mode) for `result.context.phase`. Output: PHASE-PLAN.md | `phase_plan_created` with `{ "plan_path": "<output-path>" }` |
| 7 | `create_task_handoff` | Agent spawn | Spawn **Tactical Planner** (handoff mode) for `result.context.phase`/`result.context.task`. If `result.context.corrective` is true, instruct Planner to create a corrective handoff. Output: TASK-HANDOFF.md | `task_handoff_created` with `{ "handoff_path": "<output-path>" }` |
| 8 | `execute_task` | Agent spawn | Spawn **Coder** agent with the task's handoff document. Output: TASK-REPORT.md | `task_completed` with `{ "report_path": "<output-path>" }` |
| 9 | `spawn_code_reviewer` | Agent spawn | Spawn **Reviewer** agent for task-level code review. Output: CODE-REVIEW.md | `code_review_completed` with `{ "review_path": "<output-path>" }` |
| 10 | `generate_phase_report` | Agent spawn | Spawn **Tactical Planner** (report mode) for the phase. Output: PHASE-REPORT.md | `phase_report_created` with `{ "report_path": "<output-path>" }` |
| 11 | `spawn_phase_reviewer` | Agent spawn | Spawn **Reviewer** agent for phase-level review. Output: PHASE-REVIEW.md | `phase_review_completed` with `{ "review_path": "<output-path>" }` |
| 12 | `spawn_final_reviewer` | Agent spawn | Spawn **Reviewer** agent for final comprehensive review. Output: FINAL-REVIEW.md | `final_review_completed` with `{ "review_path": "<output-path>" }` |
| 13 | `request_plan_approval` | Human gate | Display Master Plan summary to the human. Ask human to approve or reject. | `plan_approved` (if approved) or `plan_rejected` (if rejected) — no context payload |
| 14 | `request_final_approval` | Human gate | Display final review to the human. Ask human to approve or request changes. | `final_approved` (if approved) or `final_rejected` (if rejected) — no context payload |
| 15 | `gate_task` | Human gate | Show task results to the human. Wait for approval. | `gate_approved` with `{ "gate_type": "task" }` (if approved) or `gate_rejected` with `{ "gate_type": "task" }` (if rejected) |
| 16 | `gate_phase` | Human gate | Show phase results to the human. Wait for approval. | `gate_approved` with `{ "gate_type": "phase" }` (if approved) or `gate_rejected` with `{ "gate_type": "phase" }` (if rejected) |
| 17 | `display_halted` | Terminal | Display `result.context.message` and `errors.active_blockers` from `state.json` to the human. Ask how to proceed. **Loop terminates.** | *(none — terminal action)* |
| 18 | `display_complete` | Terminal | Display completion summary to the human. **Loop terminates.** | *(none — terminal action)* |

### Event Vocabulary (19 Events)

These are the exact event names the Orchestrator passes to `--event`:

| Event | Context Payload | When to Signal |
|-------|----------------|----------------|
| `start` | `{}` | First call (new project), cold start, or context compaction recovery |
| `research_completed` | `{ "doc_path": "<path>" }` | After Research agent finishes |
| `prd_completed` | `{ "doc_path": "<path>" }` | After Product Manager finishes |
| `design_completed` | `{ "doc_path": "<path>" }` | After UX Designer finishes |
| `architecture_completed` | `{ "doc_path": "<path>" }` | After Architect finishes (architecture doc) |
| `master_plan_completed` | `{ "doc_path": "<path>" }` | After Architect finishes (master plan) |
| `plan_approved` | `{}` | After human approves master plan |
| `plan_rejected` | `{}` | After human rejects master plan |
| `phase_plan_created` | `{ "plan_path": "<path>" }` | After Tactical Planner finishes phase plan |
| `task_handoff_created` | `{ "handoff_path": "<path>" }` | After Tactical Planner finishes task handoff |
| `task_completed` | `{ "report_path": "<path>" }` | After Coder finishes task |
| `code_review_completed` | `{ "review_path": "<path>" }` | After Reviewer finishes code review |
| `phase_report_created` | `{ "report_path": "<path>" }` | After Tactical Planner finishes phase report |
| `phase_review_completed` | `{ "review_path": "<path>" }` | After Reviewer finishes phase review |
| `gate_approved` | `{ "gate_type": "task\|phase" }` | After human approves a gate |
| `gate_rejected` | `{ "gate_type": "task\|phase" }` | After human rejects a gate |
| `final_review_completed` | `{ "review_path": "<path>" }` | After final reviewer finishes |
| `final_approved` | `{}` | After human approves final review |
| `final_rejected` | `{}` | After human rejects final review |

### Key Structural Rules for the New Definition

1. **NO `STATUS.md` references** — anywhere in the file. The Orchestrator reads `state.json` for status/display.
2. **NO runtime `triage_attempts` counter** — `triage_attempts` is persisted in `state.json`, managed by the pipeline script.
3. **NO references to `next-action.js`** — replaced by `pipeline.js`.
4. **NO references to `triage.js`** — triage runs internally inside pipeline.js.
5. **NO references to `validate-state.js`** — validation runs internally inside pipeline.js.
6. **NO intermediate mechanical actions** — `update_state_from_task`, `triage_task`, `advance_task`, `transition_to_execution`, etc. are all internalized by the pipeline script and invisible to the Orchestrator.
7. **ALL routing derives from `result.action`** — the Orchestrator reads `state.json` only for display/context when spawning agents, never for routing decisions.
8. **Recovery is a single call** — `pipeline.js --event start --project-dir <path>` recovers from any state (context compaction, agent restart, etc.).

## Styles & Design Tokens

Not applicable — this is an agent definition file (Markdown), not a UI component.

## Test Requirements

- [ ] Open the rewritten `.github/agents/orchestrator.agent.md` and verify it parses as valid chatagent frontmatter
- [ ] Count distinct action values in the Action Routing Table — must be exactly 18
- [ ] Grep for `STATUS.md` — must return zero matches
- [ ] Grep for `triage_attempts` as a runtime counter — must return zero matches (references to pipeline script managing it are OK)
- [ ] Grep for `next-action.js` — must return zero matches
- [ ] Grep for `triage.js` — must return zero matches (but `triage-engine.js` references inside pipeline context are OK when explaining what pipeline does internally)
- [ ] Grep for `validate-state.js` — must return zero matches
- [ ] Verify the event-driven loop pseudocode calls `pipeline.js --event <event> --project-dir <dir>`
- [ ] Verify every action row has a corresponding "Event to Signal on Completion"
- [ ] Verify terminal actions (`display_halted`, `display_complete`) have no event to signal

## Acceptance Criteria

- [ ] `.github/agents/orchestrator.agent.md` contains a valid chatagent frontmatter block with `name: Orchestrator`, tools `[read, search, agent, execute]`, and 7 agents
- [ ] The Action Routing Table has exactly 18 rows (12 agent spawns + 4 human gates + 2 terminal displays)
- [ ] Zero occurrences of `STATUS.md` anywhere in the file
- [ ] Zero occurrences of a runtime `triage_attempts` counter (the word `triage_attempts` may appear only in context of "persisted in state.json by the pipeline script")
- [ ] Zero references to `next-action.js`, `triage.js`, or `validate-state.js`
- [ ] Zero references to internalized actions: `update_state_from_task`, `update_state_from_review`, `update_state_from_phase_review`, `triage_task`, `triage_phase`, `halt_triage_invariant`, `halt_phase_triage_invariant`, `advance_task`, `advance_phase`, `transition_to_execution`, `transition_to_review`, `transition_to_complete`, `create_corrective_handoff`, `halt_task_failed`, `halt_from_review`, `retry_from_review`, `init_project`
- [ ] Event-driven loop is documented with explicit `pipeline.js` CLI calls showing `--event` and `--project-dir` flags
- [ ] Recovery section documents `pipeline.js --event start` as the compaction recovery mechanism
- [ ] Every agent-spawn and human-gate action row specifies the exact event to signal on completion (with context payload)
- [ ] The file does NOT contain the old 35-action mapping table or any references to 35 actions
- [ ] Build check: `node -e "const fs = require('fs'); const c = fs.readFileSync('.github/agents/orchestrator.agent.md','utf8'); if(!c.includes('pipeline.js')) process.exit(1);"` exits 0

## Constraints

- Do NOT modify any other file — this task touches only `.github/agents/orchestrator.agent.md`
- Do NOT add new tools to the frontmatter tools list — keep `read`, `search`, `agent`, `execute`
- Do NOT add or remove agents from the frontmatter agents list
- Do NOT reference any planning document formats (PRD template, Architecture template, etc.) — the Orchestrator delegates all planning decisions to subagents
- Do NOT include implementation details of `pipeline-engine.js`, `mutations.js`, or `state-io.js` — the Orchestrator treats the pipeline script as a black box
- Do NOT add `STATUS.md` generation, reading, or referencing in any form
- Do NOT include inline code for state mutations or validation — the Orchestrator is a coordinator, not an implementer
