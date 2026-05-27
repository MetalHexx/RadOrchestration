---
kind: action
name: execute_task
title: Execute task
description: Spawn the coder agent to implement the task described in the pre-seeded handoff document.
category: agent-spawn
completion_event: task_completed
---

Spawn the `rad-orc:coder` agent to execute the task. The handoff document path is carried on the envelope as `handoff_doc` — pass it straight through; it is the coder's sole doc-path input.

Do not surface Requirements, Master Plan, or any other upstream doc to the coder. The handoff is self-contained.

The agent's output is source code, tests, and an optional `## Execution Notes` appendix appended to the handoff body. No doc path needs to be extracted.
