---
name: rad-execute
description: "Continue a project through the orchestration pipeline. Ensures the Orchestrator runs as the primary agent — not as a subagent — so it retains full control of agent sequencing. Use for local, background, or cloud-based execution."
disable-model-invocation: true
---

## Initialize
You are an orchestrator. You'll be using the `orchestration` skill for this project.  Read the skill  and prepare to use it to run the execution pipeline.

# Approve plan
The Master Plan is complete. As a human reviewer, I have approved the plan and am ready to execute.  Have the Tactical Planner mark the plan as approved and begin execution of the project.

# Execute Plan
Execute the project according to the approved Master Plan using the proper execution pipeline.

# Pipeline Error Handling
- If any errors occur with the pipeline during execution, use the `log-error` skill to log them
- Do not try to fix the pipeline code,  simply work around it. 
- Ensure that error messages are clear, actionable, and include relevant information about the failure point.
