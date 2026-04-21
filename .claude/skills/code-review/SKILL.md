---
name: code-review
description: 'Review code, phases, and projects for quality, correctness, and conformance. Supports three modes: task review, phase review, and final review. Each mode runs a conformance-first pass against a per-requirement audit table, followed by a lean quality sweep. Status semantics are scope-aware — task and phase use tiered status (on-track / drift / regression); final uses strict status (met / missing).'
user-invocable: false
---

# Code Review

Three modes. Identify yours from the spawn context fields you received, then follow the matching workflow file end-to-end. Each mode's workflow is fully self-contained — do not load any other review doc or cross-reference between modes.

| Your context includes…                                       | Mode  | Scope                                                          | Status Enum                     | Workflow                                               | Template                                               |
|--------------------------------------------------------------|-------|----------------------------------------------------------------|---------------------------------|--------------------------------------------------------|--------------------------------------------------------|
| `task_number` (and `task_id`, `head_sha`)                    | Task  | The task's diff vs. its Task Handoff contract                  | `on-track \| drift \| regression` | [task-review/workflow.md](./task-review/workflow.md)   | [task-review/template.md](./task-review/template.md)   |
| `phase_first_sha` (and `phase_head_sha`)                     | Phase | The phase's cumulative diff vs. its Phase Plan contract        | `on-track \| drift \| regression` | [phase-review/workflow.md](./phase-review/workflow.md) | [phase-review/template.md](./phase-review/template.md) |
| `project_base_sha` (and `project_head_sha`); no task / phase | Final | The project's cumulative diff vs. the Requirements doc         | `met \| missing`                 | [final-review/workflow.md](./final-review/workflow.md) | [final-review/template.md](./final-review/template.md) |

Every mode writes a per-requirement audit table. Verdict enum is unchanged across all three: `approved | changes_requested | rejected`. Each workflow runs the conformance pass first, then a lean quality sweep; findings merge and highest severity wins.
