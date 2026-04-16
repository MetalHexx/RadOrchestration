---
name: create-agent
description: 'Create new custom agents (.agent.md) for the orchestration system. Use when asked to "create an agent", "make a new agent", "scaffold an agent", or when adding a new specialized role to the orchestration pipeline.'
---

# Create Agent

A skill for creating new custom agents for the orchestration system. Generates properly structured agent files with dual-format YAML frontmatter (Claude Code and Github Copilot) and a consistent markdown body following the established patterns.

## When to Use This Skill

- User asks to "create an agent", "make a new agent", or "scaffold an agent"
- Adding a new specialized role to the orchestration pipeline
- Duplicating or extending an existing agent with modified capabilities
- Migrating a `.chatmode.md` file to the new `.agent.md` format

## Prerequisites

- Understanding of the agent's role and responsibilities
- Knowledge of which tools and skills the agent needs
- Clear boundaries: what the agent does and does NOT do

## Inputs Required

| Input | Source | Description |
|-------|--------|-------------|
| Agent role | Human | What this agent does — its specialized purpose |
| Tool needs | Human / Architecture | Which tool sets or individual tools the agent requires |
| Skill bindings | Human / Architecture | Which skills the agent should use |
| Subagent needs | Human / Architecture | Whether this agent can spawn other agents |

## Workflow

1. **Determine the filename and name**: Lowercase, hyphenated: `{agent-name}.md` (placed in `.claude/agents/`). The `name:` field must match the filename without extension (e.g., filename `product-manager.md` → `name: product-manager`) — Claude Code spawns agents by this name.
2. **Select tools**: Apply principle of least privilege — only grant what the agent needs. Populate BOTH `tools:` (comma-separated Pascal names) and `allowedTools:` (YAML list, same entries). See the **Frontmatter Reference** below.
3. **Write the description**: Keyword-rich — includes WHAT it does AND WHEN to use it (both hosts use this for agent discovery)
4. **Write the body**: Follow the **Agent Body Template** below
5. **Validate**: Use the checklist at the bottom of this skill

## Key Rules

- **Dual-format frontmatter is mandatory**: Every agent must include BOTH `name:` + `tools:` (Claude Code — comma-separated Pascal names) AND `allowedTools:` (legacy Copilot chatmode — YAML list). Without the Claude Code pair, `/rad-plan` fails with `Agent type not found`. See the [frontmatter reference](./references/frontmatter-reference.md) for details.
- **Keep the tool lists in sync**: `tools:` and `allowedTools:` must list the same tools — if you grant `Edit` in one, grant it in the other.
- **Principle of least privilege**: Grant only the tools the agent needs — read-only agents don't get `Edit`/`Write`.
- **Consistent body structure**: Follow the established pattern — Role & Constraints → Workflow → Skills → Output Contract → Quality Standards.

## Frontmatter Reference

See the bundled reference at [references/frontmatter-reference.md](./references/frontmatter-reference.md) for all available frontmatter fields, tool names, toolsets, and model names.

### Quick Tool Selection Guide

Use these Pascal-case names in both the `tools:` string and the `allowedTools:` list.

| Agent Archetype | Recommended Tools | Notes |
|-----------------|-------------------|-------|
| Read-only / Orchestrator | `Read, Grep, Glob, Agent` | Include `Agent` only if it spawns subagents |
| Planning / Document writer | `Read, Grep, Glob, Edit, Write, TodoWrite` | No terminal access needed |
| Research / Explorer | `Read, Grep, Glob, Edit, Write, TodoWrite, WebFetch` | `WebFetch` for external sources |
| Code writer | `Read, Grep, Glob, Edit, Write, Bash, TodoWrite` | `Bash` for terminal, tests, builds |
| Reviewer | `Read, Grep, Glob, Edit, Write, Bash, TodoWrite` | `Bash` for running tests/builds |

## Template

Use the bundled agent template: [templates/AGENT.md](./templates/AGENT.md)

## Validation Checklist

Before finalizing an agent, verify:

- [ ] File is named `{agent-name}.md` with lowercase hyphenated name
- [ ] File is placed in `.claude/agents/`
- [ ] `name:` field matches the filename without `.md` (Claude Code spawns by this name)
- [ ] `description:` explains WHAT the agent does AND WHEN to use it (keyword-rich)
- [ ] `tools:` field is a comma-separated string of Pascal-case names (Claude Code)
- [ ] `allowedTools:` field is a YAML list containing the same entries as `tools:` (Copilot legacy chatmode)
- [ ] Tools use Pascal-case names: `Read, Grep, Glob, Edit, Write, Bash, WebFetch, WebSearch, Agent, TodoWrite`
- [ ] Body follows the standard structure: Role & Constraints → Workflow → Skills → Output Contract → Quality Standards
- [ ] "What you do NOT do" section clearly defines boundaries
- [ ] Write access is explicitly stated
