---
name: rad-approve-plan
description: "Open the post-approval, pre-execution router — delegates to /rad-execute or /rad-execute-parallel"
disable-model-invocation: true
user-invocable: true
---

## Inputs:
- `project_name`: $0 — The name of the approved project to execute. (e.g., "DAG-PIPELINE-2")

## Initialize
You are an orchestrator. The plan for `project_name` has already been approved upstream — this skill is a thin router that helps the user choose how to begin execution. You do not approve, mutate `state.json`, or create worktrees yourself; that work belongs to the downstream skills.

## Workflow:
The plan for `project_name` has been approved. I'll help you start execution.

## Step 1: Choose execution branch
- Greet the user briefly, confirming `project_name`.
- Use the `askQuestions` tool to ask the user how they want to proceed and execute the plan:
- Give them 2 options "Execute Plan in current branch / worktree" or "Execute the plan in a new branch / worktree".
  - **Current branch**: Invoke the `/rad-execute` skill and follow its workflow start-to-finish without skipping or improvising from this skill's context. Source Control Initialization (rad-execute Step 3) is mandatory for fresh projects and MUST prompt the user for any `auto_commit` or `auto_pr` value set to `"ask"` in `orchestration.yml` (the default).
  - **New worktree**: Follow the `rad-execute-parallel` skill — set up the worktree and follow user's choices. Stop there. Do NOT begin execution and proceed with following the steps in `rad-execute-parallel`.
