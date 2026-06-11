---
kind: action
name: invoke_source_control_commit
title: Invoke source control commit
description: Spawn the source-control agent to commit (and optionally push) the task's working changes.
category: source-control
completion_event: commit_completed
---

Spawn `rad-orc:source-control` in commit mode.

The envelope carries `data.context.repos[]` — an array where each entry has `name`, `path`, and `branch`. Inline the `repos[]` array verbatim into the source-control agent spawn prompt, along with the task title and task type read from the handoff. The agent composes one commit message per repo and runs `radorch git commit --repos '<json>'` with the full array as a single JSON argument.

The orchestrator relays the agent's structured per-repo result array into one array-shaped `commit_completed` signal via `--repos '<json>'`.
