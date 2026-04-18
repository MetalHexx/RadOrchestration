# Action & Event Reference

Quick-lookup tables for the Orchestrator. See [pipeline-guide.md](pipeline-guide.md) for the full event loop, CLI usage, error handling, and operational context.

## Action Routing Table

Every `result.action` value maps to exactly one Orchestrator operation. All branching derives from this table.

| # | `result.action` | Category | Orchestrator Operation | Event to Signal on Completion |
|---|-----------------|----------|----------------------|-------------------------------|
| 1 | `spawn_research` | Agent spawn | **Two-step protocol:** (1) Signal `research_started` with `{}` context → pipeline returns `spawn_research` again; (2) Spawn **research** agent with PRD (required) + brainstorming doc (if exists). Evidence-only contract — no recommendations. Output: {NAME}-RESEARCH-FINDINGS.md | `research_completed --doc-path <output-path>` |
| 2 | `spawn_prd` | Agent spawn | **Two-step protocol:** (1) Signal `prd_started` with `{}` context → pipeline returns `spawn_prd` again; (2) Spawn **product-manager** agent with brainstorming doc (if exists). Output: {NAME}-PRD.md | `prd_completed --doc-path <output-path>` |
| 3 | `spawn_design` | Agent spawn | **Two-step protocol:** (1) Signal `design_started` with `{}` context → pipeline returns `spawn_design` again; (2) Spawn **ux-designer** agent with PRD (required) + RESEARCH-FINDINGS.md (if exists) + BRAINSTORMING.md (if exists). Design-vs-Architecture boundary — experience only. Output: {NAME}-DESIGN.md | `design_completed --doc-path <output-path>` |
| 4 | `spawn_architecture` | Agent spawn | **Two-step protocol:** (1) Signal `architecture_started` with `{}` context → pipeline returns `spawn_architecture` again; (2) Spawn **architect** agent with PRD.md + DESIGN.md + RESEARCH-FINDINGS.md. Output: {NAME}-ARCHITECTURE.md | `architecture_completed --doc-path <output-path>` |
| 5 | `spawn_master_plan` | Agent spawn | **Two-step protocol:** (1) Signal `master_plan_started` with `{}` context → pipeline returns `spawn_master_plan` again; (2) Spawn **tactical-planner** agent with all planning docs plus `state.json` and `template.yml` path context. Output: {NAME}-MASTER-PLAN.md | `master_plan_completed --doc-path <output-path>` |
| 6 | `create_requirements` | Agent spawn | **Two-step protocol:** (1) Signal `requirements_started` with `{}` context → pipeline returns `create_requirements` again; (2) Spawn **planner** agent with orchestrator action `create_requirements`. The planner routes internally to `rad-create-plans/references/requirements/workflow.md`. Inputs: `{NAME}-BRAINSTORMING.md` (if exists); the agent performs codebase discovery privately. Output: `{NAME}-REQUIREMENTS.md`. | `requirements_completed --doc-path <output-path>` |
| 7 | `create_execution_plan` | Agent spawn | **Two-step protocol:** (1) Signal `execution_plan_started` with `{}` context → pipeline returns `create_execution_plan` again; (2) Spawn **planner** agent with orchestrator action `create_execution_plan`. The planner routes internally to `rad-create-plans/references/execution-plan/workflow.md`. Inputs: `{NAME}-REQUIREMENTS.md` (required), `{NAME}-BRAINSTORMING.md` (optional). Output: `{NAME}-EXECUTION-PLAN.md`. | `execution_plan_completed --doc-path <output-path>` |
| 8 | `create_phase_plan` | Agent spawn | **Two-step protocol — check `is_correction` first.** **Fresh phase** (`is_correction` is falsy): (1) Signal `phase_planning_started` with `{}` context → pipeline returns `create_phase_plan` again; (2) Spawn **tactical-planner** — the agent loads `rad-create-plans` and follows `references/phase-plan/workflow.md`. **Corrective** (`is_correction` is true): Skip `phase_planning_started`, spawn **tactical-planner** directly with `result.context.previous_review` — the agent loads `rad-create-plans` and follows `references/phase-plan/workflow.md`. Output: phases/{NAME}-PHASE-{NN}-{TITLE}.md | `phase_plan_created --doc-path <output-path>` |
| 9 | `create_task_handoff` | Agent spawn | **Two-step protocol — check `is_correction` first.** **Fresh task** (`is_correction` is falsy): (1) Signal `task_handoff_started` with `{}` context → pipeline returns `create_task_handoff` again; (2) Spawn **tactical-planner** — the agent loads `rad-create-plans` and follows `references/task-handoff/workflow.md`. **Corrective** (`is_correction` is true): Skip `task_handoff_started`, spawn **tactical-planner** directly with `result.context.previous_review` — the agent loads `rad-create-plans` and follows `references/task-handoff/workflow.md`. Output: tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md | `task_handoff_created --doc-path <output-path>` |
| 10 | `execute_task` | Agent spawn | **Two-step protocol:** (1) Signal `execution_started` with `{}` context → pipeline returns `execute_task` again; (2) Spawn **coder** agent with the task's handoff document. Output: Source code + tests (no document produced) | `task_completed` |
| 11 | `spawn_code_reviewer` | Agent spawn | **Two-step protocol:** (1) Signal `code_review_started` with `{}` context → pipeline returns `spawn_code_reviewer` again; (2) Spawn **reviewer** agent for task-level code review. Context includes `head_sha` — the commit hash of the task's commit (resolved from active corrective task when applicable, else task iteration). `head_sha` is `null` when `source_control.auto_commit: never` or no commit has been made; in that case the reviewer falls back to `git diff HEAD` + untracked files. Output: reports/{NAME}-CODE-REVIEW-P{NN}-T{NN}-{TITLE}.md | `code_review_completed --doc-path <output-path>` |
| 12 | `generate_phase_report` | Agent spawn | **Two-step protocol:** (1) Signal `phase_report_started` with `{}` context → pipeline returns `generate_phase_report` again; (2) Spawn **tactical-planner** (report mode) for the phase. Output: reports/{NAME}-PHASE-REPORT-P{NN}-{TITLE}.md | `phase_report_created --doc-path <output-path>` |
| 13 | `spawn_phase_reviewer` | Agent spawn | **Two-step protocol:** (1) Signal `phase_review_started` with `{}` context → pipeline returns `spawn_phase_reviewer` again; (2) Spawn **reviewer** agent for phase-level review. Context includes `phase_report_doc` plus `phase_first_sha` (first task's initial commit) and `phase_head_sha` (last task's latest commit, corrective-aware). Both SHAs are `null` when `source_control.auto_commit: never` or no commits have been made; in that case the reviewer falls back to `git diff HEAD` + untracked files. Reviewer runs `git diff <phase_first_sha>~1..<phase_head_sha>` to get the cumulative phase diff for the skeptical pass. Output: reports/{NAME}-PHASE-REVIEW-P{NN}-{TITLE}.md | `phase_review_completed --doc-path <output-path>` |
| 14 | `spawn_final_reviewer` | Agent spawn | **Two-step protocol:** (1) Signal `final_review_started` with `{}` context → pipeline returns `spawn_final_reviewer` again; (2) Spawn **reviewer** agent for final comprehensive review. Output: {NAME}-FINAL-REVIEW.md | `final_review_completed --doc-path <output-path>` |
| 15 | `request_plan_approval` | Human gate | Display Master Plan summary to the human. Ask human to approve or reject. | `plan_approved` (if approved) or `plan_rejected` (if rejected) — no context payload |
| 16 | `request_final_approval` | Human gate | Display final review to the human. Ask human to approve or request changes. **PR link:** If `pipeline.source_control.pr_url` is present in state, include a `PR: {pr_url}` line in the prompt so the reviewer can navigate directly to the pull request. If `pr_url` is absent, omit the PR line entirely — do not show an empty placeholder or error. | `final_approved` (if approved) or `final_rejected` (if rejected) — no context payload |
| 17 | `gate_task` | Human gate | Show task results to the human. Wait for approval. | `gate_approved --gate-type task` (if approved) or `gate_rejected --gate-type task --reason "<reason>"` (if rejected) |
| 18 | `gate_phase` | Human gate | Show phase results to the human. Wait for approval. | `gate_approved --gate-type phase` (if approved) or `gate_rejected --gate-type phase --reason "<reason>"` (if rejected) |
| 19 | `ask_gate_mode` | Human gate | Present the three gate mode options (`task`, `phase`, `autonomous`) to the operator. Wait for selection. | `gate_mode_set --gate-mode <chosen>` |
| 20 | `display_halted` | Terminal | Display `result.context.message` to the human. **Loop terminates.** | *(none — terminal action)* |
| 21 | `display_complete` | Terminal | Display completion summary to the human. **Loop terminates.** | *(none — terminal action)* |
| 22 | `invoke_source_control_commit` | Agent spawn | Spawn **source-control** in commit mode. The agent reads `pipeline.source_control` from state, constructs the commit message, executes `git-commit.js`, and outputs a structured commit result block. Extract `commitHash` and `pushed` from the agent's `## Commit Result` JSON block in its output. | `commit_completed --commit-hash <hash> --pushed <true|false> --phase <N> --task <N>` |
| 23 | `invoke_source_control_pr` | Agent spawn | Spawn **source-control** in PR mode. The agent reads `pipeline.source_control` and `final_review.doc_path` from state, executes `gh-pr.js`, and outputs a structured PR result block. Extract `pr_url` and `pr_number` from the agent's `## PR Result` JSON block in its output. | `pr_created [--pr-url <url>]` |

## Event Signaling Reference

These are the exact event names passed to `--event`:

| Event | Flags (besides `--event` and `--project-dir`) | When to Signal |
|-------|-----------------------------------------------|----------------|
| `start` | *(none)* | First call (new project), cold start, or context compaction recovery |
| `prd_started` | *(none)* | Before Product Manager spawn. Transitions `graph.nodes.prd.status` to `in_progress`. See action #2 two-step protocol. |
| `prd_completed` | `--doc-path <path>` | After Product Manager finishes |
| `research_started` | *(none)* | Before Research agent spawn. Transitions `graph.nodes.research.status` to `in_progress`. See action #1 two-step protocol. |
| `research_completed` | `--doc-path <path>` | After Research agent finishes |
| `design_started` | *(none)* | Before UX Designer spawn. Transitions `graph.nodes.design.status` to `in_progress`. See action #3 two-step protocol. |
| `design_completed` | `--doc-path <path>` | After UX Designer finishes |
| `architecture_started` | *(none)* | Before Architect spawn (architecture doc). Transitions `graph.nodes.architecture.status` to `in_progress`. See action #4 two-step protocol. |
| `architecture_completed` | `--doc-path <path>` | After Architect finishes (architecture doc) |
| `master_plan_started` | *(none)* | Before Tactical Planner spawn (master plan). Transitions `graph.nodes.master_plan.status` to `in_progress`. See action #5 two-step protocol. |
| `master_plan_completed` | `--doc-path <path>` | After Tactical Planner finishes (master plan) |
| `requirements_started` | *(none)* | Before Planner spawn for Requirements. Transitions `graph.nodes.requirements.status` to `in_progress`. See action #6 two-step protocol. |
| `requirements_completed` | `--doc-path <path>` | After Planner finishes Requirements doc. |
| `execution_plan_started` | *(none)* | Before Planner spawn for Execution Plan. Transitions `graph.nodes.execution_plan.status` to `in_progress`. See action #7 two-step protocol. |
| `execution_plan_completed` | `--doc-path <path>` | After Planner finishes Execution Plan doc. |
| `plan_approved` | *(none)* | After human approves master plan |
| `plan_rejected` | *(none)* | After human rejects master plan |
| `source_control_init` | `--branch <name> --base-branch <name> --worktree-path <path> --auto-commit <always\|never> --auto-pr <always\|never> [--remote-url <url>] [--compare-url <url>]` | After `rad-execute-parallel` creates the worktree. One-time initialization that persists source control context to `pipeline.source_control` in state. Remote and compare URLs are optional; omitted or empty values are stored as `null`. |
| `phase_planning_started` | *(none)* | Before Tactical Planner spawn for fresh (non-corrective) phases only. Transitions phase from `not_started / planning` to `in_progress / planning`. See action #6 two-step protocol. |
| `phase_plan_created` | `--doc-path <path>` | After Tactical Planner finishes phase plan |
| `task_handoff_started` | *(none)* | Before Tactical Planner spawn for fresh (non-corrective) tasks only. Transitions task from `not_started` to `in_progress` while leaving `task.stage` at `'planning'`. See action #7 two-step protocol. |
| `task_handoff_created` | `--doc-path <path>` | After Tactical Planner finishes task handoff |
| `execution_started` | *(none)* | Before Coder spawn. Transitions `task_executor.status` to `in_progress`. See action #8 two-step protocol. |
| `code_review_started` | *(none)* | Before Reviewer spawn (task-level). Transitions `code_review.status` to `in_progress`. See action #9 two-step protocol. |
| `task_completed` | `--doc-path <path>` *(optional, ignored)* | After Coder finishes task. The CLI accepts `--doc-path` for backward compatibility, but the pipeline ignores it. |
| `code_review_completed` | `--doc-path <path>` | After Reviewer finishes code review |
| `commit_started` | `[--phase <N>] [--task <N>]` | Signaled when the walker reaches the `commit` node in `task_loop.body`. `--phase` and `--task` are optional; auto-resolved from the active in-progress phase/task when omitted. |
| `commit_completed` | `--commit-hash <hash> --pushed <true\|false> [--phase <N>] [--task <N>]` | After Source Control Agent completes. Extract `commitHash` and `pushed` from the agent's `## Commit Result` JSON block. `--phase` and `--task` are optional; auto-resolved when omitted. |
| `pr_requested` | *(none)* | Signaled internally after `final_review_completed` when `auto_pr: always` and `pr_url` is **undefined** (absent from state — not yet attempted). A `null` value means PR creation was attempted but no URL is available; `null` does **not** re-trigger `pr_requested`. Validation checkpoint before Source Control Agent spawn in PR mode. |
| `pr_created` | `--pr-url <url>` *(optional)* | After Source Control Agent completes PR creation. Extract `pr_url` and `pr_number` from the agent's `## PR Result` JSON block. On success, signal with `--pr-url <url>`. On failure (`pr_url` is `null` in the result), signal `pr_created` **without** the `--pr-url` flag — the pipeline CLI will omit `pr_url` from context and the mutation handler will coalesce it to `null`. Writes `pr_url` to `state.pipeline.source_control`. |
| `phase_report_started` | *(none)* | Before Tactical Planner spawn (phase report). Transitions `phase_report.status` to `in_progress`. See action #10 two-step protocol. |
| `phase_report_created` | `--doc-path <path>` | After Tactical Planner finishes phase report |
| `phase_review_started` | *(none)* | Before Reviewer spawn (phase-level). Transitions `phase_review.status` to `in_progress`. See action #11 two-step protocol. |
| `phase_review_completed` | `--doc-path <path>` | After Reviewer finishes phase review |
| `gate_mode_set` | `--gate-mode task\|phase\|autonomous` | After operator selects gate mode |
| `gate_approved` | `--gate-type task\|phase` | After human approves a gate |
| `gate_rejected` | `--gate-type task\|phase --reason <text>` | After human rejects a gate |
| `final_review_started` | *(none)* | Before Reviewer spawn (final review). Transitions `final_review.status` to `in_progress`. See action #12 two-step protocol. |
| `final_review_completed` | `--doc-path <path>` | After final reviewer finishes |
| `final_approved` | *(none)* | After human approves final review |
| `final_rejected` | *(none)* | After human rejects final review |
| `halt` | *(none)* | Emergency stop — signals the pipeline to halt immediately |

> [!NOTE]
> **Task auto-resolution:** For task-scoped events (`commit_started`, `commit_completed`), the `--phase` and `--task` flags are optional. When omitted, the engine resolves the active phase and task from state automatically. If no single unambiguous active phase or task exists (zero or multiple `in_progress`), the event fails with a descriptive error and instructs the operator to pass `--phase <N>` and/or `--task <N>` explicitly.

> [!NOTE]
> **Phase auto-resolution:** For phase-scoped `_started` events (`phase_planning_started`, `phase_report_started`, `phase_review_started`), the `--phase` flag is optional. When omitted, the engine resolves the active phase from state automatically. If no single unambiguous active phase exists (zero or multiple phases `in_progress`), the event fails with a descriptive error and instructs the operator to pass `--phase <N>` explicitly.
