---
name: brainstorm
description: 'Brainstorm and refine project goals through collaborative ideation. Use when exploring problem spaces, validating concepts, building consensus on what to build, or creating the initial project goals document.'
user-invocable: true
---

# Brainstorm

Collaborative brainstorming skill. Produces a structured BRAINSTORMING.md — the first document in a project, capturing consensus-driven goals that feed into downstream planning.

## Routing Table

| Concern | Reference Document |
|---------|-------------------|
| How to brainstorm | [references/collaboration.md](./references/collaboration.md) |
| Writing the document | [references/document-writing.md](./references/document-writing.md) |
| Finding related projects | [references/project-memory.md](./references/project-memory.md) |
| Splitting large projects | [references/project-series.md](./references/project-series.md) |

## Loading Instructions

1. **Always read**: `collaboration.md` and `document-writing.md` — these are your core workflow.
2. **Read when relevant**: `project-memory.md` — when the conversation references past work, related projects, or a known domain.
3. **Read when relevant**: `project-series.md` — when the idea feels too large for a single project, or the user mentions phases, stages, or incremental delivery.

## Inputs

| Input | Source |
|-------|--------|
| Conversation context | User dialogue — ideas, problems, goals |
| Project name | User-provided, `SCREAMING-CASE` |
| Base path | `orchestration.yml` → `projects.base_path` |

## Core Principles

- **Collaborate, don't scribe** — suggest, challenge, refine. You are a thinking partner.
- **Consensus before ink** — only write goals validated through dialogue.
- **Living document** — update as thinking evolves. Remove stale ideas.
- **Minimal footprint** — create only the project folder and BRAINSTORMING.md. No state.json, no subfolders.

## Template

[templates/BRAINSTORMING.md](./templates/BRAINSTORMING.md)
