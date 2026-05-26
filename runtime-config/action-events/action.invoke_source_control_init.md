---
kind: action
name: invoke_source_control_init
title: Invoke source control init
description: Initialize source-control context for the project — branch, base branch, worktree, and auto-commit/auto-pr modes.
category: source-control
completion_event: source_control_init_completed
---

Spawn `rad-orc:source-control` in init mode. The agent provisions the worktree (when required) and confirms branch, base branch, worktree path, and the `auto_commit` / `auto_pr` modes.

Extract `branch`, `base_branch`, `worktree_path`, `auto_commit`, and `auto_pr` from the agent's result. Include `remote_url` and `compare_url` when the agent emits them; treat omitted or empty values as `null`.

Normalize `auto_commit` / `auto_pr` values `yes` and `no` to `always` and `never` respectively (case-insensitive). Reject any other value with a descriptive error.
