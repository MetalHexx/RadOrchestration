---
kind: action
name: invoke_source_control_pr
title: Invoke source control PR
description: Spawn the source-control agent to open a pull request for the completed project branch.
category: source-control
completion_event: pr_created
---

Spawn `rad-orc:source-control` in PR mode.

The envelope carries `data.context.repos[]` — an array where each entry has `name`, `path`, and `branch`. Inline the `repos[]` array verbatim into the source-control agent spawn prompt, along with the project name and `state.final_review.doc_path` as the PR body file. The agent composes one PR description per repo and runs `radorch git pr --repos '<json>'` with the full array as a single JSON argument.

The orchestrator relays the agent's structured `[{name, pr_url}]` result array into one array-shaped `pr_created` signal via `--repos '<json>'`. If a repo's `pr_url` is non-null, the signal carries the URL; if `pr_url` is `null` (creation failed or a pre-condition was unmet), that entry's URL is omitted so the pipeline records the attempt as `null` and proceeds to the human gate.
