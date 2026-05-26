---
kind: action
name: spawn_planner
title: Spawn planner
description: Spawn the planner agent in Requirements mode to author the project's requirements ledger.
category: agent-spawn
completion_event: requirements_completed
---

Spawn the `rad-orc:planner` agent in Requirements mode to author the project's FR/NFR/AD/DD ledger.

Before spawning, inline `repository_skills_block` verbatim into the spawn prompt per the orchestrator agent's *Planner Spawn Manifest* section. When that field is the empty string, omit the manifest entirely.

Extract the requirements doc path from the agent's final message.
