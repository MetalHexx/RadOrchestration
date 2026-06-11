---
kind: event
name: commit_completed
title: Commit completed
description: The source-control agent has finished the task's commit (and optionally a push) for all repos.
signal_payload:
  repos:
    required: true
    array: true
    description: Structured per-repo commit result array [{name, committed, commitHash, pushed}] returned by the CLI.
  phase:
    required: false
    description: Phase number. Auto-resolved from the active in-progress phase when omitted.
  task:
    required: false
    description: Task number. Auto-resolved from the active in-progress task when omitted.
---

Confirm the agent's `## Commit Result` block reported a per-repo result array where each entry carries a non-empty `commitHash` and a boolean `pushed`. Signaling records each commit hash against the matching task-iteration repo by name.
