---
kind: event
name: gate_rejected
title: Gate rejected
description: The operator has rejected either a task gate or a phase gate; the pipeline must route into a corrective cycle.
signal_payload:
  gate-type:
    required: true
    description: Which gate the operator rejected — `task` or `phase`.
  reason:
    required: true
    description: Brief operator-supplied reason. Drives the corrective cycle's framing.
---

This event fires when the human rejects either a task gate or a phase gate. Signal `gate_rejected --gate-type <task|phase> --reason "<reason>"` only when the operator explicitly declined. Capture the operator's reason verbatim so the corrective handoff downstream can frame the cycle around the operator's concern; the `gate-type` field tells the orchestrator whether to route into a task-scope or phase-scope corrective cycle.
