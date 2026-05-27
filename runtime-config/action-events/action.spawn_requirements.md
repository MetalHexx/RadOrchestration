---
kind: action
name: spawn_requirements
title: Spawn planner — Requirements mode
description: Spawn the planner agent in Requirements mode to author the project's requirements ledger.
category: agent-spawn
completion_event: requirements_completed
---

Spawn the `rad-orc:planner` agent in Requirements mode to author the project's FR/NFR/AD/DD ledger. The agent's output is `{NAME}-REQUIREMENTS.md`.

Before spawning, inline `repository_skills_block` verbatim into the agent's spawn prompt. When that field is the empty string, omit it entirely.

Extract the requirements doc path from the agent's final message.
