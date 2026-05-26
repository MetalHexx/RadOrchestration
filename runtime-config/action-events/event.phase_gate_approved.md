---
kind: event
name: phase_gate_approved
title: Phase gate approved
description: The operator has approved the phase results and the pipeline may advance to the next phase.
signal_payload: {}
---

Confirm the operator explicitly approved the phase before signaling. Do not signal on ambiguous responses. Signaling advances the pipeline past the phase gate and into the next phase iteration.
