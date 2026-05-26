---
kind: event
name: task_gate_approved
title: Task gate approved
description: The operator has approved the task results and the pipeline may advance to the next task.
signal_payload: {}
---

Confirm the operator explicitly approved the task before signaling. Do not signal on ambiguous responses. Signaling advances the pipeline past the task gate and into the next step of the task loop.
