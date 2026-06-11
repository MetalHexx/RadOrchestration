---
kind: action
name: spawn_phase_reviewer
title: Spawn phase reviewer
description: Spawn the reviewer agent for a phase-level conformance review.
category: agent-spawn
completion_event: phase_review_completed
---

Spawn the `rad-orc:reviewer` agent for phase-level review.

The envelope carries `data.context.repos[]` — an array where each entry has `name`, `path`, `branch`, and the phase-scoped SHAs (`phase_first_sha` — the first task's initial commit, and `phase_head_sha` — the last task's latest commit, corrective-aware) for that repo. Inline the `repos[]` array verbatim into the reviewer spawn prompt so the reviewer reviews each repo's diff across the full phase range independently. When `source_control.auto_commit: never` or no commits have been made for a repo, that entry's SHAs are `null`; the reviewer falls back to `git diff HEAD` plus untracked files for that repo.

Extract the review doc path from the agent's final message.

When the reviewer's verdict is `changes_requested|rejected`, perform correction mediation before signaling.