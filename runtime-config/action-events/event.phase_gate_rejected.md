---
kind: event
name: phase_gate_rejected
title: Phase gate rejected
description: The operator has rejected the phase results and the pipeline must route into a corrective cycle.
signal_payload:
  reason:
    required: true
    description: Brief operator-supplied reason. Drives the corrective cycle's framing.
---

Signal `phase_gate_rejected --reason "<reason>"` only when the operator explicitly declined the phase. Capture the operator's reason verbatim so the corrective handoff downstream can frame the cycle around the operator's concern.
