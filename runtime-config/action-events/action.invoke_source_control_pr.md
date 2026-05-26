---
kind: action
name: invoke_source_control_pr
title: Invoke source control PR
description: Spawn the source-control agent to open a pull request for the completed project branch.
category: source-control
completion_event: pr_completed
---

Spawn `rad-orc:source-control` in PR mode.

Pass `worktree_path`, `branch`, `base_branch` (from `data.context`), the project name, and `state.final_review.doc_path` as the body file.

Extract `pr_url` and `pr_number` from the agent's `## PR Result` block.

For the PR mechanics themselves, see `rad-source-control/SKILL.md`.
