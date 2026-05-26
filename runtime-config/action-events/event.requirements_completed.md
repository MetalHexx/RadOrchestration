---
kind: event
name: requirements_completed
title: Requirements completed
description: The planner has authored the project's requirements ledger.
signal_payload:
  doc-path:
    required: true
    description: Path to the Requirements doc emitted by the planner.
---

Confirm the requirements doc exists at the path the planner returned and that its frontmatter carries a positive integer `requirement_count`. Signaling commits the orchestrator to using that doc as the FR/NFR/AD/DD ledger for downstream planning.
