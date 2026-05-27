---
kind: action
name: invoke_source_control_commit
title: Invoke source control commit
description: Spawn the source-control agent to commit (and optionally push) the task's working changes.
category: source-control
completion_event: commit_completed
---

Spawn `rad-orc:source-control` in commit mode.

Pass `worktree_path` and `task_id` (from `data.context`), plus the task title and task type read from the handoff.

Extract `commitHash` and `pushed` from the agent's `## Commit Result` block.
