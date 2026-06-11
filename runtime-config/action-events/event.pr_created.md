---
kind: event
name: pr_created
title: PR created
description: The source-control agent has finished the PR-creation attempt for all repos.
signal_payload:
  repos:
    required: true
    array: true
    description: Structured per-repo PR result array [{name, pr_url}] returned by the CLI.
---

Confirm the agent's `## PR Result` block reported a per-repo result array. Signaling writes each `pr_url` to the matching `source_control.repos[]` entry — a `null` `pr_url` means the PR was attempted but no URL is available.
