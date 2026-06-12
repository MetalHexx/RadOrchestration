---
kind: action
name: spawn_code_reviewer
title: Spawn code reviewer
description: Spawn the reviewer agent for a task-level code review.
category: agent-spawn
completion_event: code_review_completed
---

Spawn the `rad-orc:reviewer` agent for task-level code review.

The envelope carries `data.context.repos[]` — an array where each entry has `name`, `path`, `branch`, and the task-scoped commit SHA (`head_sha`) for that repo. Inline the `repos[]` array verbatim into the reviewer spawn prompt so the reviewer resolves each repo's diff independently using the per-repo `head_sha` and `path`. When `source_control.auto_commit: never` or no commit has been made for a repo, that entry's `head_sha` is `null`; the reviewer falls back to `git diff HEAD` plus untracked files for that repo.

Extract the review doc path from the agent's final message.

When the reviewer's verdict is `changes_requested|rejected`, perform correction mediation before signaling.
