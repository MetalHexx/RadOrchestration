---
description: "Run through a review / repair loop ensure all lingering issues are resolved and the code is in good shape."
agent: orchestrator
---

Lets execute this sequence:
- Use a reviewer subagent look at all the review reports throughout the {project-name} project and find any lingering items that did not get repaired.  Create a list of items to look into.
- Spawn coder subagents to repair the issues, if any.  make sure to include updating and running tests!
- Spawn a reviewer agent to do an indenpendent skeptical review of the changes. Run tests!
- Use  a source control subagent Commit the code to remote.

Once all review items have been completed:
- Have a reviewer do a full skeptical pass of the code looking for code smells for any code that was written in the {project-name} project and create a list  of corrections.
- Have another coder review that these  are valid changes. make sure to include updating and running tests!
- Once we have a final list of good cleanup  to do, have a coder  implement the changes.
- Have a reviewer review the final changes. Run tests!
- Make sure the UI builds ok.
- Once everything looks good, commit the code using a source control agent.
- Do 3 passes using this second workflow.

Create a todo list and lets get going.