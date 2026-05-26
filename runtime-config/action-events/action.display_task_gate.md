---
kind: action
name: display_task_gate
title: Display task gate
description: Present the completed task results to the operator and wait for approval before the pipeline advances to the next task.
category: gate
completion_event: task_gate_approved
---

Show the operator the task's outcome: the code-review verdict, any corrective cycles applied, and the final state of the handoff. Give them enough context to judge whether the task is acceptable before the pipeline moves on.

Ask the operator to approve or reject. Hold here until they respond. If they reject, collect a brief reason — the pipeline routes back to a corrective cycle using that reason.

Signal `task_gate_approved` when the operator approves. Signal `task_gate_rejected --reason "<reason>"` when the operator rejects.
