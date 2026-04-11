---
description: "Start the full planning pipeline for a new project — Research through Master Plan"
agent: orchestrator
---

#Inputs:
- `project_name` (string): The name of the new project to plan. (e.g., "DAG-PIPELINE-2")
- `project_template` (string): The template to use for planning. (e.g., "full" or "quick" or custom template name if one exists)


# Workflow:
I have project goals I'd like to develop into a full scale plan.  

## Step 1: Choose Project Template
- If the `project_template` is "full", use the full planning template.
- If the `project_template` is "quick", use the quick planning template.
- If the `project_template` is a custom template name, 
  - Check if it exists in the `orchestration` skill `/templates` directory
  - If it does, use it. 
  - If it doesn't, respond with an error message indicating the template was not found.
- If no template is specified, use the askQuestions tool to ask the user to choose between "full", "quick" and list any available custom templates.

  ## Step 2: Read Project Template
  - Start the planning pipeline and call the CLI 

