---
name: code-review
description: 'Review code, phases, and projects for quality, correctness, and conformance. Supports three modes: task review, phase review, and final review. Each mode uses a dual-pass approach — conformance checking against planning documents followed by an independent quality assessment.'
user-invocable: false
---

# Code Review

Three modes. Identify yours from the spawn context fields you received, then follow the matching workflow file end-to-end. Each mode's workflow is fully self-contained — do not load any other review doc or cross-reference between modes.

| Your context includes…                       | Mode  | Workflow                                               | Template                                               |
|----------------------------------------------|-------|--------------------------------------------------------|--------------------------------------------------------|
| `task_number` (and `task_id`, `head_sha`)    | Task  | [task-review/workflow.md](./task-review/workflow.md)   | [task-review/template.md](./task-review/template.md)   |
| `phase_first_sha` (and `phase_head_sha`) | Phase | [phase-review/workflow.md](./phase-review/workflow.md) | [phase-review/template.md](./phase-review/template.md) |
| No task or phase fields (empty context)      | Final | [final-review/workflow.md](./final-review/workflow.md) | [final-review/template.md](./final-review/template.md) |
