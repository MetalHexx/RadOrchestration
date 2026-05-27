---
kind: action
name: spawn_code_reviewer
title: Spawn code reviewer
description: Spawn the reviewer agent for a task-level code review.
category: agent-spawn
completion_event: code_review_completed
---

Spawn the `rad-orc:reviewer` agent for task-level code review.

Pass `head_sha` — the commit hash of the task's commit (resolved from the active corrective task when applicable, otherwise from the task iteration). When `source_control.auto_commit: never` or no commit has been made, pass `head_sha` as `null`; the reviewer will fall back to `git diff HEAD` plus untracked files.

Extract the review doc path from the agent's final message.

When the reviewer's verdict is `changes_requested|rejected`, perform correction mediation before signaling.
