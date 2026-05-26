---
kind: action
name: spawn_phase_reviewer
title: Spawn phase reviewer
description: Spawn the reviewer agent for a phase-level conformance review.
category: agent-spawn
completion_event: phase_review_completed
---

Spawn the `rad-orc:reviewer` agent for phase-level review.

Pass `phase_first_sha` (the first task's initial commit) and `phase_head_sha` (the last task's latest commit, corrective-aware). When `source_control.auto_commit: never` or no commits have been made, pass both SHAs as `null`; the reviewer will fall back to `git diff HEAD` plus untracked files.

Extract the review doc path from the agent's final message.

When the reviewer's verdict is `changes_requested`, mediate before signaling — see `corrective-playbook.md`.
