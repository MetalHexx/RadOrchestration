---
kind: event
name: final_review_completed
title: Final review completed
description: The final project-level review has been finalized — strict-and-final with no corrective cycle.
signal_payload:
  doc-path:
    required: true
    description: Path to the final review doc.
---

Confirm the review doc exists at the returned path and that its frontmatter carries a `verdict` of `approved`, `changes_requested`, or `rejected`. No mediation fields participate at this scope; signaling commits the project to the recorded verdict.
