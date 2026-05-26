---
kind: action
name: spawn_final_reviewer
title: Spawn final reviewer
description: Spawn the reviewer agent for the final comprehensive project review.
category: agent-spawn
completion_event: final_review_completed
---

Spawn the `rad-orc:reviewer` agent for the final review.

Pass `project_base_sha` (the first chronological commit across the project) and `project_head_sha` (the last committed SHA, including corrective commits at both task and phase scope). When `source_control.auto_commit: never` or no commits have been made, pass both SHAs as `null`; the reviewer will fall back to `git diff HEAD` plus untracked files.

Extract the review doc path from the agent's final message.

Final-review corrective cycles are out of scope — the verdict is strict-and-final, with no orchestrator mediation.
