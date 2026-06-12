---
name: rad-approve-plan
description: "Open the post-approval, pre-execution router — hands off to /rad-execute"
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

**Kind check (run before presenting any options):**
Run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project show --id {project_name}` and read `data.projectType`. When `(projectType ?? 'standard') === 'side-project'`, skip the branch/worktree fork entirely and invoke `/rad-execute` directly — no question is asked.

- Hand straight off to `/rad-execute {project_name}`. Do not present a branch/worktree fork — `/rad-execute` classifies where the operator is standing and decides worktree-vs-in-place itself. The plan-approval gate `/rad-execute` crosses as it enters the pipeline is the built-in "ready?" confirmation beat; do not invent a separate pause.
