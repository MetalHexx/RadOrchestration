---
name: rad-execute
description: "Continue a project through the orchestration pipeline. Ensures the Orchestrator runs as the primary agent — not as a subagent — so it retains full control of agent sequencing. Use for local, background, or cloud-based execution."
disable-model-invocation: true
user-invocable: true
---

## Initialize
You are an orchestrator. You'll be using the `orchestration` skill for this project.  Read the skill  and prepare to use it to run the execution pipeline.

# Approve plan
The Master Plan is complete. As a human reviewer, I have approved the plan and am ready to execute. Mark the plan as approved and begin execution of the project.

# Execute Plan
Execute the project according to the approved Master Plan using the proper execution pipeline.

## Source Control Initialization

Before the first pipeline tick, ensure `pipeline.source_control` is populated in `state.json`. The commit and PR gates read from this state — without it, the walker halts when it reaches either conditional.

1. Read `state.json`. **If `pipeline.source_control` is not null, skip this section** — resume is ceremony-free.
2. Otherwise, run `node {skillRoot}/scripts/gather-context.js` and parse its JSON output. `{skillRoot}` is the directory containing this SKILL.md.
3. Follow [`references/source-control-init.md`](references/source-control-init.md) to resolve each init field (prompting only when needed) and fire the `source_control_init` pipeline event.
4. Proceed with execution.

# Pipeline Error Handling
- If any errors occur with the pipeline during execution, use the `log-error` skill to log them
- Do not try to fix the pipeline code,  simply work around it. 
- Ensure that error messages are clear, actionable, and include relevant information about the failure point.
