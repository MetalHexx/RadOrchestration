---
kind: action
name: display_phase_gate
title: Display phase gate
description: Present the completed phase results to the operator and wait for approval before the pipeline advances to the next phase.
category: gate
completion_event: phase_gate_approved
---

Show the operator the phase review summary: exit-criteria assessment, cumulative diff scope, and any issues or carry-forward items noted by the reviewer. Give them sufficient context to judge whether the phase meets the bar before the pipeline moves on.

Ask the operator to approve or reject. Hold here until they respond. If they reject, collect a brief reason — the pipeline routes back to a corrective cycle using that reason.

Signal `phase_gate_approved` when the operator approves. Signal `phase_gate_rejected --reason "<reason>"` when the operator rejects.
