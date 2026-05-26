---
kind: event
name: explosion_completed
title: Explosion completed
description: The explosion script has emitted per-phase and per-task docs and pre-seeded the phase loop.
signal_payload: {}
---

Confirm the script exited successfully and that `phases/` and `tasks/` are populated. Signaling clears any prior `master_plan.last_parse_error` and `parse_retry_count` recovery state and moves the pipeline into the phase loop.
