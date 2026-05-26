---
kind: action
name: display_final_approval_gate
title: Display final approval gate
description: Present the final review to the operator and wait for approval before the pipeline concludes.
category: gate
completion_event: final_approval_gate_approved
---

Present the final review document to the operator. If `pipeline.source_control.pr_url` is present in state, include a `PR: {pr_url}` line so they can navigate directly to the pull request. Omit the PR line entirely when `pr_url` is absent — do not show an empty placeholder.

Ask the operator to approve or reject. Hold here until they respond — do not proceed autonomously.

Signal `final_approval_gate_approved` when the operator approves. Signal `final_approval_gate_rejected` when the operator rejects; the pipeline will route back for changes.
