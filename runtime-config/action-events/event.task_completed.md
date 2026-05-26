---
kind: event
name: task_completed
title: Task completed
description: The coder has finished executing the task.
signal_payload: {}
---

Confirm the coder agent has returned and that any expected source / test edits and the optional `## Execution Notes` appendix are on disk. Signaling advances the task loop into the review and (when configured) commit stages.
