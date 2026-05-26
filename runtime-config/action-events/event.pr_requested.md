---
kind: event
name: pr_requested
title: PR requested
description: Internal validation checkpoint signaled after final review when auto-PR is enabled and no PR has been attempted yet.
signal_payload: {}
---

Signal `pr_requested` internally after `final_review_completed` when `pipeline.source_control.auto_pr: always` and `pr_url` is **undefined** (absent from state — not yet attempted). A `null` value means PR creation was already attempted but no URL is available; `null` does not re-trigger `pr_requested`. The event serves as the validation checkpoint before the source-control agent is spawned in PR mode.
