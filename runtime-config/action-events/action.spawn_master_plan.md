---
kind: action
name: spawn_master_plan
title: Spawn planner — Master Plan mode
description: Spawn the planner agent to read the requirements ledger and produce the inlined phase + task plan.
category: agent-spawn
completion_event: master_plan_completed
---

Spawn the `rad-orc:planner` agent to read the project's requirements ledger and produce the inlined phase + task Master Plan. The agent's output is `{NAME}-MASTER-PLAN.md`.

Before spawning, inline `repository_skills_block` verbatim into the spawn prompt per the orchestrator agent's *Planner Spawn Manifest* section. When that field is the empty string, omit the manifest entirely.

Extract the master-plan doc path from the agent's final message.
