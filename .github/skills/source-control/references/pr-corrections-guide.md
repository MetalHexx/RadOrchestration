# PR Corrections Guide

Workflow for reviewing inbound PR comments, deciding on fixes, implementing them, and responding.

## Step 1: Review

- Read all PR comments and form a repair plan.
- **Validate independently** — do not treat reviewer comments as ground truth.
- Read docs like the PRD, Architecture, Design, and Master Plan to ground yourself in the project's scope.
- Project docs could make mistakes, so keep that in mind and seek the truth. 
- Read the affected code and its surroundings to assess blast radius.
- Read through the repo commit history to better understand the the intent and evolution of the affected code.

## Step 2: Implement

- Use your own judgment on the best solution — do not blindly adopt the reviewer's suggestion.
- Limit changes to what the PR comment addresses; avoid scope creep.

## Step 3: Respond & Commit

- Reply to **each** PR comment individually via the GitHub MCP tool with an acknowledgement and summary of what changed (or why no change was made).
- Commit and push to the branch — **only if `pipeline.source_control.auto_commit` is enabled in the project's `state.json`**. If not enabled, skip and notify the user.
