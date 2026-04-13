---
description: "Start the full planning pipeline for a new project — Research through Master Plan"
agent: orchestrator
---

## Inputs:
- `project_name` (string): The name of the new project to plan. (e.g., "DAG-PIPELINE-2")
- `project_template` (string): The template to use for planning. (e.g., "full" or "quick" or custom template name if one exists)

## Workflow:
I have project goals I'd like to develop into a full scale plan.  

## Step 1: Choose Project Template
- If the `project_template` is "full", use the full planning template.
- If the `project_template` is "quick", use the quick planning template.
- If the `project_template` is a custom template name, 
  - Check if it exists in the `orchestration` skill `/templates` directory
  - If it does, use it. 
  - If it doesn't, respond with an error message indicating the template was not found.
- If no template is specified, use the askQuestions tool to ask the user to choose between "full", "quick" and list any available custom templates.

## Step 2: Starting Message
- Produce a nicely formatted and mildly enthusiastic message confirming the project name and template choice.
- Indicate the planning process steps we'll run through. (Including the audit) 

## Step 3: Read Project Template
- Start the planning pipeline and call needed CLI parameters to start the planning process, passing the chosen template as an argument (e.g., `--template full`).

## Step 4: Audit the plan
- Use the `rad-plan-audit` tool to audit the generated plan for completeness, correctness, and alignment with the project goals.  
- Run the audit up to 3 times in a loop using a fresh subagent to ensure unbiased feedback.
- Don't feel the need to review 3 times if the plan is already in good shape after 1 or 2 iterations. 
-  Use your judgment to decide when to stop iterating.
  - If you still spot problems after 3 iterations, halt, go to Step 5.
- When prompting the subagent, 
  - Tell them the name of all the planning docs to check based on the template used.
  - Ask them to use the `rad-plan-audit` tool for auditing instructions.
- Show the user the concise results of each audit iteration, and any changes you make to the plan based on the feedback.

## Step 5: Finalize the plan
- Produce an audit summary that includes the results of the audit iterations.
- Use the `askQuestions` tool to:
  - If the plan is ready and passed the audit cleanup, give the user the option to execute the plan.
    - Give them 2 options "Execute Plan in current branch / worktree" or "Execute the plan in a new branch / worktree".
      - **Current branch**: Follow the `rad-execute` skill — approve and begin execution immediately.
      - **New worktree**: Follow the `rad-execute-parallel` skill — set up the worktree and follow users choices. Stop there. Do NOT begin execution. The user will run `/rad-execute` manually.
  - If the plan has unresolved issues, ask the user if they want to execute the plan anyway or if they want to continue iterating on the audit.


