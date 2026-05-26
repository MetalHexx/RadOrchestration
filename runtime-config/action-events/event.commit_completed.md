---
kind: event
name: commit_completed
title: Commit completed
description: The source-control agent has finished the task's commit (and optionally a push).
signal_payload:
  commit-hash:
    required: true
    description: Commit SHA returned by the source-control agent.
  pushed:
    required: true
    description: Whether the commit was pushed to the remote (`true` / `false`).
  phase:
    required: false
    description: Phase number. Auto-resolved from the active in-progress phase when omitted.
  task:
    required: false
    description: Task number. Auto-resolved from the active in-progress task when omitted.
---

Confirm the agent's `## Commit Result` block reported a non-empty `commitHash` and a boolean `pushed`. Signaling records the commit SHA and push state against the active task iteration.
