---
kind: action
name: request_final_approval
title: Display final approval gate
description: Present the final review to the operator and wait for approval before the pipeline concludes.
category: gate
completion_event: final_approved
---

Present the final review document to the operator. For each `source_control.repos[]` entry that has a non-null `pr_url`, include a `PR: {pr_url}` line so they can navigate directly to that pull request. Omit the PR lines entirely when no repo has a PR — do not show an empty placeholder.

Ask the operator to approve or reject. Hold here until they respond — do not proceed autonomously.

Signal `final_approved` when the operator approves. Signal `final_rejected` when the operator rejects; the pipeline will route back for changes.
