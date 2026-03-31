# Action & Event Reference

Quick-lookup tables for the Orchestrator. See [pipeline-guide.md](pipeline-guide.md) for the full event loop, CLI usage, error handling, and operational context.

## Action Routing Table

Every `result.action` value maps to exactly one Orchestrator operation. All branching derives from this table.

| # | `result.action` | Category | Orchestrator Operation | Event to Signal on Completion |
|---|-----------------|----------|----------------------|-------------------------------|
| 1 | `spawn_research` | Agent spawn | **Two-step protocol:** (1) Signal `research_started` with `{}` context → pipeline returns `spawn_research` again; (2) Spawn **research** agent with project idea + brainstorming doc (if exists). Output: {NAME}-RESEARCH-FINDINGS.md | `research_completed --doc-path <output-path>` |
| 2 | `spawn_prd` | Agent spawn | **Two-step protocol:** (1) Signal `prd_started` with `{}` context → pipeline returns `spawn_prd` again; (2) Spawn **product-manager** agent with RESEARCH-FINDINGS.md (+ brainstorming doc if exists). Output: {NAME}-PRD.md | `prd_completed --doc-path <output-path>` |
| 3 | `spawn_design` | Agent spawn | **Two-step protocol:** (1) Signal `design_started` with `{}` context → pipeline returns `spawn_design` again; (2) Spawn **ux-designer** agent with PRD.md + RESEARCH-FINDINGS.md. Output: {NAME}-DESIGN.md | `design_completed --doc-path <output-path>` |
| 4 | `spawn_architecture` | Agent spawn | **Two-step protocol:** (1) Signal `architecture_started` with `{}` context → pipeline returns `spawn_architecture` again; (2) Spawn **architect** agent with PRD.md + DESIGN.md + RESEARCH-FINDINGS.md. Output: {NAME}-ARCHITECTURE.md | `architecture_completed --doc-path <output-path>` |
| 5 | `spawn_master_plan` | Agent spawn | **Two-step protocol:** (1) Signal `master_plan_started` with `{}` context → pipeline returns `spawn_master_plan` again; (2) Spawn **architect** agent with all planning docs. Output: {NAME}-MASTER-PLAN.md | `master_plan_completed --doc-path <output-path>` |
| 6 | `create_phase_plan` | Agent spawn | **Two-step protocol — check `is_correction` first.** **Fresh phase** (`is_correction` is falsy): (1) Signal `phase_planning_started` with `{}` context → pipeline returns `create_phase_plan` again; (2) Spawn **tactical-planner** (phase plan mode). **Corrective** (`is_correction` is true): Skip `phase_planning_started`, spawn **tactical-planner** directly with `result.context.previous_review`. Output: phases/{NAME}-PHASE-{NN}-{TITLE}.md | `phase_plan_created --doc-path <output-path>` |
| 7 | `create_task_handoff` | Agent spawn | **Two-step protocol — check `is_correction` first.** **Fresh task** (`is_correction` is falsy): (1) Signal `task_handoff_started` with `{}` context → pipeline returns `create_task_handoff` again; (2) Spawn **tactical-planner** (handoff mode). **Corrective** (`is_correction` is true): Skip `task_handoff_started`, spawn **tactical-planner** directly (corrective mode) with `result.context.previous_review`. Output: tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md | `task_handoff_created --doc-path <output-path>` |
| 8 | `execute_task` | Agent spawn | Spawn **coder** agent with the task's handoff document. Output: Source code + tests (no document produced) | `task_completed` |
| 9 | `spawn_code_reviewer` | Agent spawn | Spawn **reviewer** agent for task-level code review. Output: reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md | `code_review_completed --doc-path <output-path>` |
| 10 | `generate_phase_report` | Agent spawn | Spawn **tactical-planner** (report mode) for the phase. Output: reports/{NAME}-PHASE-REPORT-P{NN}-{TITLE}.md | `phase_report_created --doc-path <output-path>` |
| 11 | `spawn_phase_reviewer` | Agent spawn | Spawn **reviewer** agent for phase-level review. Output: reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md | `phase_review_completed --doc-path <output-path>` |
| 12 | `spawn_final_reviewer` | Agent spawn | Spawn **reviewer** agent for final comprehensive review. Output: {NAME}-FINAL-REVIEW.md | `final_review_completed --doc-path <output-path>` |
| 13 | `request_plan_approval` | Human gate | Display Master Plan summary to the human. Ask human to approve or reject. | `plan_approved` (if approved) or `plan_rejected` (if rejected) — no context payload |
| 14 | `request_final_approval` | Human gate | Display final review to the human. Ask human to approve or request changes. | `final_approved` (if approved) or `final_rejected` (if rejected) — no context payload |
| 15 | `gate_task` | Human gate | Show task results to the human. Wait for approval. | `gate_approved --gate-type task` (if approved) or `gate_rejected --gate-type task --reason "<reason>"` (if rejected) |
| 16 | `gate_phase` | Human gate | Show phase results to the human. Wait for approval. | `gate_approved --gate-type phase` (if approved) or `gate_rejected --gate-type phase --reason "<reason>"` (if rejected) |
| 17 | `ask_gate_mode` | Human gate | Present the three gate mode options (`task`, `phase`, `autonomous`) to the operator. Wait for selection. | `gate_mode_set --gate-mode <chosen>` |
| 18 | `display_halted` | Terminal | Display `result.context.message` to the human. **Loop terminates.** | *(none — terminal action)* |
| 19 | `display_complete` | Terminal | Display completion summary to the human. **Loop terminates.** | *(none — terminal action)* |
| 20 | `invoke_source_control_commit` | Agent spawn | Spawn **source-control** in commit mode. The agent reads `pipeline.source_control` from state, constructs the commit message, executes `git-commit.js`, and outputs a structured commit result block. Extract `commitHash` and `pushed` from the agent's `## Commit Result` JSON block in its output. | `task_committed --commit-hash <hash> --pushed <true|false>` |

## Event Signaling Reference

These are the exact event names passed to `--event`:

| Event | Flags (besides `--event` and `--project-dir`) | When to Signal |
|-------|-----------------------------------------------|----------------|
| `start` | *(none)* | First call (new project), cold start, or context compaction recovery |
| `research_started` | *(none)* | Before Research agent spawn. Transitions `planning.steps[0].status` to `in_progress`. See action #1 two-step protocol. |
| `research_completed` | `--doc-path <path>` | After Research agent finishes |
| `prd_started` | *(none)* | Before Product Manager spawn. Transitions `planning.steps[1].status` to `in_progress`. See action #2 two-step protocol. |
| `prd_completed` | `--doc-path <path>` | After Product Manager finishes |
| `design_started` | *(none)* | Before UX Designer spawn. Transitions `planning.steps[2].status` to `in_progress`. See action #3 two-step protocol. |
| `design_completed` | `--doc-path <path>` | After UX Designer finishes |
| `architecture_started` | *(none)* | Before Architect spawn (architecture doc). Transitions `planning.steps[3].status` to `in_progress`. See action #4 two-step protocol. |
| `architecture_completed` | `--doc-path <path>` | After Architect finishes (architecture doc) |
| `master_plan_started` | *(none)* | Before Architect spawn (master plan). Transitions `planning.steps[4].status` to `in_progress`. See action #5 two-step protocol. |
| `master_plan_completed` | `--doc-path <path>` | After Architect finishes (master plan) |
| `plan_approved` | *(none)* | After human approves master plan |
| `plan_rejected` | *(none)* | After human rejects master plan |
| `source_control_init` | `--branch <name> --base-branch <name> --worktree-path <path> --auto-commit <always\|never> --auto-pr <always\|never> [--remote-url <url>] [--compare-url <url>]` | After `rad-execute-parallel` creates the worktree. One-time initialization that persists source control context to `pipeline.source_control` in state. Remote and compare URLs are optional; omitted or empty values are stored as `null`. |
| `phase_planning_started` | *(none)* | Before Tactical Planner spawn for fresh (non-corrective) phases only. Transitions phase from `not_started / planning` to `in_progress / planning`. See action #6 two-step protocol. |
| `phase_plan_created` | `--doc-path <path>` | After Tactical Planner finishes phase plan |
| `task_handoff_started` | *(none)* | Before Tactical Planner spawn for fresh (non-corrective) tasks only. Transitions task from `not_started` to `in_progress` while leaving `task.stage` at `'planning'`. See action #7 two-step protocol. |
| `task_handoff_created` | `--doc-path <path>` | After Tactical Planner finishes task handoff |
| `task_completed` | `--doc-path <path>` *(optional, ignored)* | After Coder finishes task. The CLI accepts `--doc-path` for backward compatibility, but the pipeline ignores it. |
| `code_review_completed` | `--doc-path <path>` | After Reviewer finishes code review |
| `task_commit_requested` | *(none)* | Signaled internally after `code_review_completed` when `auto_commit: always` and review verdict is approved. Triggers Source Control Agent spawn. |
| `task_committed` | `--commit-hash <hash> --pushed <true\|false>` | After Source Control Agent completes. Extract `commitHash` and `pushed` from the agent's `## Commit Result` JSON block. |
| `phase_report_created` | `--doc-path <path>` | After Tactical Planner finishes phase report |
| `phase_review_completed` | `--doc-path <path>` | After Reviewer finishes phase review |
| `gate_mode_set` | `--gate-mode task\|phase\|autonomous` | After operator selects gate mode |
| `gate_approved` | `--gate-type task\|phase` | After human approves a gate |
| `gate_rejected` | `--gate-type task\|phase --reason <text>` | After human rejects a gate |
| `final_review_completed` | `--doc-path <path>` | After final reviewer finishes |
| `final_approved` | *(none)* | After human approves final review |
| `final_rejected` | *(none)* | After human rejects final review |
| `halt` | *(none)* | Emergency stop — signals the pipeline to halt immediately |
