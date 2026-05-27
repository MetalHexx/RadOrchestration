---
kind: event
name: phase_review_completed
title: Phase review completed
description: A phase-level review has been finalized — either directly by the reviewer or after orchestrator mediation.
signal_payload:
  doc-path:
    required: true
    description: Path to the phase review doc.
---

Confirm the review doc exists at the returned path and that its frontmatter carries the reviewer's raw `verdict` and `exit_criteria_met`. When the raw verdict was `changes_requested`, confirm mediation has run and the doc's frontmatter carries `orchestrator_mediated: true`, an `effective_outcome`, and a `corrective_handoff_path` whenever `effective_outcome` is `changes_requested`. Signaling commits the phase loop to the recorded outcome.
