---
kind: event
name: source_control_init
title: Source control init
description: Source-control context has been initialized and persisted to the pipeline state.
signal_payload:
  branch:
    required: true
    description: Working branch for the project.
  base-branch:
    required: true
    description: Base branch that the project's eventual PR will target.
  worktree-path:
    required: true
    description: Absolute path to the worktree.
  auto-commit:
    required: true
    description: Auto-commit mode — `always` or `never`.
  auto-pr:
    required: true
    description: Auto-PR mode — `always` or `never`.
  remote-url:
    required: false
    description: Remote URL for the worktree's origin, if known.
  compare-url:
    required: false
    description: Compare/PR URL prefix for the remote, if known.
---

Confirm the branch, base branch, worktree path, and the two auto modes are all present and well-formed. Signaling persists source-control context to `pipeline.source_control` in state and is one-time per project.
