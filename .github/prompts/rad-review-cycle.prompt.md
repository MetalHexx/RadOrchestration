---
description: "Run through a review / repair loop ensure all lingering issues are resolved and the code is in good shape."
---

## Lets execute this sequence:
>Each subagent should report to the human operator the issues that were found or repaired on every pass. 
>Always run tests and run builds to ensure the fixes didn't break the build.

### Phase 1: Fix any carry forward items from the project
- Use a reviewer subagent look at all the review reports throughout the {project-name} project and find any lingering items that did not get repaired. Create a list of items to look into.  
- Spawn coder subagents to repair the issues, if any.  make sure to include updating and running tests!
- Spawn a reviewer agent to do an indenpendent skeptical review of the changes. Run tests!
- Coder should fix any issues found by the reviewer
- Affected code should be built to ensure fixes didn't break the build.
- Use  a source control subagent Commit the code to remote.

### Phase 2: Do an further independent reviews of all the project code
Once all review items have been completed:
- Have a reviewer do a full skeptical pass of the code looking for code smells for any code that was written in the {project-name} project and create a list  of corrections.
- Have another coder review that these  are valid changes. make sure to include updating and running tests!
- Once we have a final list of good cleanup  to do, have a coder  implement the changes.
- Have a reviewer review the final changes. Run tests!
- Affected code should be built to ensure fixes didn't break the build.
- Once everything looks good, commit the code using a source control agent.
- Do 3 passes using this second workflow.

### Offer the user to continue more iterations of Phase 2.

Create a todo list and lets get going.