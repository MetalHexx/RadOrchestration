---
name: rad-execute
description: "Continue a project through the orchestration pipeline. Ensures the Orchestrator runs as the primary agent — not as a subagent — so it retains full control of agent sequencing. Use for local, background, or cloud-based execution."
user-invocable: true
---

## Step 1: Initialize
You are an orchestrator. You'll be using the `rad-orchestration` skill for this project.  Read the skill  and prepare to use it to run the execution pipeline.

## Step 2: Approve plan
The Master Plan is complete. As a human reviewer, I have approved the plan and am ready to execute. Mark the plan as approved and begin execution of the project.

## Step 3: Source Control Initialization

Before the first pipeline tick, ensure `pipeline.source_control` is populated in `state.json`. The commit and PR gates read from this state — without it, the walker halts when it reaches either conditional.

1. Run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project context --project-name {PROJECT_NAME}` and parse fields from the envelope's `data` block. `{PROJECT_NAME}` comes from the /rad-execute argument or conversation context.
2. **If `sourceControlInitialized === true`, skip to step 4** — resume is ceremony-free.
3. Read `data.projectType` from the envelope. Detection is frontmatter/state-only via `project context` — never load the master-plan body to determine the kind. Evaluate `(projectType ?? 'standard') === 'side-project'` to select the branch: if `true`, follow the **Side-project branch** in [`references/source-control-init.md`](references/source-control-init.md); otherwise follow the standard registered-repo branch. Then fire the `source_control_init` pipeline event.
4. Proceed with execution.

## Step 4: Execute Plan
Execute the project according to the approved Master Plan using the proper execution pipeline.

**Resuming a project:** to resume execution (or determine the next pending action on a fresh session), fire the pipeline `start` event:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" pipeline signal --event start --project-dir {projectDir}
```

`start` returns the current pending action without mutating state, so it is the correct entry point both for first-time execution and for resume. Do not invent event names like `tick`, `next_action`, or `get_next_action` — they will fail with `Unknown event`.

## Step 5: Pipeline Error Handling
- If any errors occur with the pipeline during execution, use the `rad-log-error` skill to log them
- Do not try to fix the pipeline code,  simply work around it. 
- Ensure that error messages are clear, actionable, and include relevant information about the failure point.
