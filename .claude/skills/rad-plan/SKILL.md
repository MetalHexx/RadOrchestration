---
name: rad-plan
description: "Start the planning pipeline for a new project — produces Requirements + Master Plan"
disable-model-invocation: true
user-invocable: true
---

## Inputs:
- `project_name`: $0 — The name of the new project to plan. (e.g., "DAG-PIPELINE-2")
- `project_template`: $1 — The template to use for planning. (e.g., "default" or a custom template name if one exists)

## Initialize
You are an orchestrator. You'll be using the `orchestration` skill for this project.  Read the skill  and prepare to use it for running the planning pipeline.

## Workflow:
I have project goals I'd like to develop into a full scale plan.  

## Step 1: Choose Project Template
- If the `project_template` is a custom template name,
  - Check if it exists in the `orchestration` skill `/templates` directory.
  - If it does, use it.
  - If it doesn't, respond with an error message indicating the template was not found.
- If no `project_template` is specified, use `default`.

## Step 2: Choose Task Size
- Use the `askQuestions` tool to ask the user how large they want each task to be. ALWAYS present the following options (in your own words)
  - **Planner Decides** — no constraint; the planner agent sizes tasks using its own judgment 
  - **Small** — single file or function; Good for mission crictical projects;  Slow and expensive to execute.
  - **Medium** — 2–4 files, one coherent unit of work; balanced scope and overhead (Recommended)
  - **Large** — cross-cutting change or full feature slice; fewer tasks, higher complexity per task
  - **Extra Large** — end-to-end feature per task; minimal process overhead, requires a capable model; Similar to a typical planning mode.
- Store the result as `task_size_preference`.

## Step 3: Starting Message
- Produce a nicely formatted and mildly enthusiastic message confirming the project name, template choice, and task size preference.
- List planning steps by reading the template YAML: include only `kind: step` nodes that appear before the first `request_plan_approval` gate. Everything after that gate is execution, not planning.

## Step 4: Read Project Template
- Start the planning pipeline and call needed CLI parameters to start the planning process, passing the chosen template as an argument (e.g., `--template default`).
- If `task_size_preference` is anything other than **Planner Decides**, append the following as a plain prose instruction in the planner agent's spawn prompt:
  > "Task size preference: {task_size_preference}. Size all tasks according to that tier per the sizing rubric in the master-plan workflow."
- If **Planner Decides** was selected, pass no additional sizing instruction.

## Step 5: Audit the plan
- Dispatch a fresh subagent with the `rad-plan-audit` skill (full-audit
  mode) to audit the Requirements doc and the Master Plan. Give the
  subagent both doc paths and instruct it to follow
  `.claude/skills/rad-plan-audit/references/full-audit.md`. The subagent
  returns a structured report with frontmatter `verdict: approved` or
  `verdict: issues_found`. The auditor does NOT edit either planning
  doc — it reports.
- If `verdict: approved`: proceed to Step 6.
- If `verdict: issues_found`:
    1. Dispatch the `planner` agent with the audit report path, the
       Requirements doc path, and the Master Plan path, instructing it
       to follow the corrections workflow at
       `.claude/skills/rad-plan-audit/references/corrections-workflow.md`.
       The planner applies fixes inline and returns a short summary of
       actioned and declined findings.
    2. Re-invoke the explosion script to regenerate `phases/` and
       `tasks/` from the corrected Master Plan:

           npx tsx .claude/skills/rad-orchestration/scripts/explode-master-plan.ts \
             --project-dir <project-dir> \
             --master-plan <master-plan-path> \
             --project-name <project-name>

       The script auto-backs-up the pre-correction `phases/` and
       `tasks/` into `backups/{ISO-timestamp}/` and resets
       `state.graph.nodes.phase_loop` before re-seeding — nothing is
       overwritten destructively. On exit code `2` (parse failure in
       the corrected Master Plan), halt and surface the structured
       `parse_error` JSON to the user — do not retry in-skill.
- Show the user the concise audit report, the planner's corrections
  summary, and (when re-exploded) the backup directory path.
- Single pass, no re-audit after corrections.

## Step 6: Finalize the plan
- Use the `askQuestions` tool to ask the user how they want to proceed and execute the plan:
- Give them 2 options "Execute Plan in current branch / worktree" or "Execute the plan in a new branch / worktree".
  - **Current branch**: Follow the `rad-execute` skill — approve and begin execution immediately.
  - **New worktree**: Follow the `rad-execute-parallel` skill — set up the worktree and follow user's choices. Stop there. Do NOT begin execution and proceed with following the steps in `rad-execute-parallel`.
