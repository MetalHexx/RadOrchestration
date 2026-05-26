---
kind: event
name: pr_created
title: PR created
description: The source-control agent has finished the PR-creation attempt for the project branch.
signal_payload:
  pr-url:
    required: false
    description: URL of the created PR. Omit the flag entirely when no URL is available — the pipeline coalesces the absent flag to `null` in state.
---

Confirm the agent's `## PR Result` block was read. On success, signal with `--pr-url <url>`. On failure (`pr_url` reported as `null`), signal without the `--pr-url` flag so the pipeline writes `null` to `state.pipeline.source_control.pr_url`.
