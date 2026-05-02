---
name: rad-plan-quick
description: "Start the planning pipeline in quick mode — same plan/audit/approval ceremony as /rad-plan, but with the quick template, Extra Large task size, and autonomous execution mode hardcoded"
disable-model-invocation: true
user-invocable: true
---

## Inputs
- `project_name`: $0 — The name of the new project to plan. (e.g., "QUICK-DEMO")

## Initialize
You are an orchestrator. You'll be using the `orchestration` skill for this project. Read the skill and prepare to use it for running the planning pipeline.

## Workflow
`/rad-plan-quick` is the discoverable front door for quick mode. It wraps `/rad-plan` and silently bakes in three defaults:

- The pipeline template is `quick` — `--template quick` is hardcoded; this skill does not prompt for a template choice and does not accept a template argument.
- The task-size preference is `Extra Large` — set as `task_size_preference = "Extra Large"`; this skill skips the task-size question.
- The human-gate execution mode is `autonomous` — set as `pipeline.gate_mode = "autonomous"` (signal `gate_mode_set` with `gate_mode: autonomous` per the action-event reference); this skill skips the gate-mode question. No mid-execution per-task or per-phase prompt fires.

Per DD-2, do not announce that defaults are being applied. The Step 2 starting message confirms all three resolved choices in one block, matching `/rad-plan`'s confirmation style.

## Step 1: Starting Message
Produce a nicely formatted and mildly enthusiastic message confirming the project name, the quick template, Extra Large task size, and autonomous execution mode. List planning steps by reading `quick.yml`: include only `kind: step` nodes that appear before the first `request_plan_approval` gate. Everything after that gate is execution, not planning.

## Step 2: Read Project Template and Start the Pipeline
Start the planning pipeline and call needed CLI parameters to start the planning process, passing `--template quick`. Append the following as a plain prose instruction in the planner agent's spawn prompt:
> "Task size preference: Extra Large. Size all tasks according to that tier per the sizing rubric in the master-plan workflow."

## Step 3: Audit the plan
- Dispatch a fresh subagent with the `rad-plan-audit` skill (full-audit mode) to audit the Requirements doc and the Master Plan. Give the subagent both doc paths and instruct it to follow `.claude/skills/rad-plan-audit/references/full-audit.md`. The subagent returns a structured report with frontmatter `verdict: approved` or `verdict: issues_found`. The auditor does NOT edit either planning doc — it reports.
- If `verdict: approved`: proceed to Step 4.
- If `verdict: issues_found`:
    1. Dispatch the `planner` agent with the audit report path, the Requirements doc path, and the Master Plan path, instructing it to follow the corrections workflow at `.claude/skills/rad-plan-audit/references/corrections-workflow.md`. The planner applies fixes inline and returns a short summary of actioned and declined findings.
    2. Re-invoke the explosion script to regenerate `phases/` and `tasks/` from the corrected Master Plan:

           npx tsx .claude/skills/rad-orchestration/scripts/explode-master-plan.ts \
             --project-dir <project-dir> \
             --master-plan <master-plan-path> \
             --project-name <project-name>

       The script auto-backs-up the pre-correction `phases/` and `tasks/` into `backups/{ISO-timestamp}/` and resets `state.graph.nodes.phase_loop` before re-seeding. On exit code `2` (parse failure in the corrected Master Plan), halt and surface the structured `parse_error` JSON to the user — do not retry in-skill.
- Show the user the concise audit report, the planner's corrections summary, and (when re-exploded) the backup directory path.
- Single pass, no re-audit after corrections.

## Step 4: Present plan_approval_gate
Per AD-4, the `plan_approval_gate` is non-negotiable in quick mode. Present the gate to the user and wait for an explicit approve / reject decision from the user. Quick mode is "lightweight execution," not "fire-and-forget post-plan," so the approval requires human review. On user approval, signal `plan_approved`. Before signalling `gate_mode_set`, set `gate_mode: autonomous` in the event context so the autonomous default sticks for the rest of the run.

## Step 5: Finalize the plan
Use the `askQuestions` tool to ask the user how they want to proceed and execute the plan. Give them 2 options:
- **Execute Plan in current branch / worktree** — Follow the `rad-execute` skill — approve and begin execution immediately.
- **Execute the plan in a new branch / worktree** — Follow the `rad-execute-parallel` skill — set up the worktree and follow user's choices. Stop there. Do NOT begin execution and proceed with following the steps in `rad-execute-parallel`.
