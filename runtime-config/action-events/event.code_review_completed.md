---
kind: event
name: code_review_completed
title: Code review completed
description: A task-level code review has been finalized — either directly by the reviewer or after orchestrator mediation.
signal_payload:
  doc-path:
    required: true
    description: Path to the code review doc.
---

Confirm the review doc exists at the returned path. When the raw reviewer verdict was `changes_requested`, confirm mediation has run and the doc's frontmatter carries `orchestrator_mediated: true`, an `effective_outcome`, and a `corrective_handoff_path` whenever `effective_outcome` is `changes_requested`. Signaling commits the task loop to the recorded outcome.
