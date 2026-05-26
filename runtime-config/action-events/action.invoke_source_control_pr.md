---
kind: action
name: invoke_source_control_pr
title: Invoke source control PR
description: Spawn the source-control agent to open a pull request for the completed project branch.
category: source-control
completion_event: pr_completed
---

Spawn `rad-orc:source-control` in PR mode. The agent reads `pipeline.source_control` from state for `branch`, `base_branch`, and `worktree_path`, reads `final_review.doc_path` from state for the PR body file, executes `radorch git pr` with the resolved flags, and emits a `## PR Result` JSON block.

Pass `worktree_path`, `branch`, `base_branch` (from `data.context`), the project name, and `state.final_review.doc_path` as the body file.

Extract `pr_url` and `pr_number` from the agent's `## PR Result` block. If `pr_url` is non-null, signal `pr_completed --pr-url <url>`. If `pr_url` is `null` (creation failed or a pre-condition was unmet), signal `pr_completed` **without** the `--pr-url` flag so the pipeline records the attempt as `null` and proceeds to the human gate.

For the PR mechanics themselves, see `rad-source-control/SKILL.md`.
