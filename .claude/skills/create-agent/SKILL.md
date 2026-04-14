---
name: create-agent
description: 'Create new custom agents (.agent.md) for the orchestration system. Use when asked to "create an agent", "make a new agent", "scaffold an agent", or when adding a new specialized role to the orchestration pipeline.'
---

# Create Agent

A skill for creating new custom agents (`.agent.md` files) for the orchestration system. Generates properly structured agent files with correct YAML frontmatter, namespaced tools, and a consistent markdown body following the established patterns.

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

1. **Determine the agent name**: Use a clear, descriptive display name (e.g., "Security Reviewer", "API Designer")
2. **Determine the filename**: Lowercase, hyphenated: `{agent-name}.agent.md` (placed in `.github/agents/`)
3. **Select tools**: Apply principle of least privilege — only grant what the agent needs. Use the **Frontmatter Reference** below
4. **Write the description**: Keyword-rich — includes WHAT it does AND WHEN to use it (Copilot uses this for agent discovery)
5. **Write the body**: Follow the **Agent Body Template** below
6. **Validate**: Use the checklist at the bottom of this skill

## Key Rules

- **Namespaced tools are mandatory**: Use `read/readFile`, NOT `readFile`. Use toolsets (`read`, `search`, `edit`, `execute`, `web`) for broad access
- **`agent` tool required with `agents` array**: If the agent can spawn subagents, `agent` MUST be in the `tools` list
- **`agents: []` prevents subagent use**: Explicitly set to empty array for agents that should NOT spawn subagents
- **Principle of least privilege**: Grant only the tools the agent needs — read-only agents don't get `edit`
- **Consistent body structure**: Follow the established pattern — Role & Constraints → Workflow → Skills → Output Contract → Quality Standards

## Frontmatter Reference

See the bundled reference at [references/frontmatter-reference.md](./references/frontmatter-reference.md) for all available frontmatter fields, tool names, toolsets, and model names.

### Quick Tool Selection Guide

| Agent Archetype | Recommended Tools | Notes |
|-----------------|-------------------|-------|
| Read-only / Orchestrator | `read`, `search`, `agent` | Add `agent` only if it spawns subagents |
| Planning / Document writer | `read`, `search`, `edit`, `todo` | No terminal access needed |
| Research / Explorer | `read`, `search`, `edit`, `web/fetch`, `todo` | `web/fetch` for external sources |
| Code writer | `read`, `search`, `edit`, `execute`, `todo` | `execute` for terminal, tests, builds |
| Reviewer | `read`, `search`, `edit`, `execute`, `todo` | `execute` for running tests/builds |

### Tool Sets vs Individual Tools

| Approach | When to Use |
|----------|-------------|
| **Toolsets** (`read`, `search`, `edit`, `execute`) | Broad access to all tools in category — simpler, recommended default |
| **Individual tools** (`read/readFile`, `search/codebase`) | Precise control — use when you need to restrict within a category |

## Template

Use the bundled agent template: [templates/AGENT.md](./templates/AGENT.md)

## Validation Checklist

Before finalizing an agent, verify:

- [ ] File is named `{agent-name}.agent.md` with lowercase hyphenated name
- [ ] File is placed in `.github/agents/`
- [ ] `name` field is a clear display name
- [ ] `description` explains WHAT the agent does AND WHEN to use it (keyword-rich)
- [ ] All tool names use namespaced format (e.g., `read/readFile`) or valid toolset names (e.g., `read`)
- [ ] `agent` tool is included if `agents` array is non-empty
- [ ] `agents: []` is set explicitly if the agent should NOT spawn subagents
- [ ] Body follows the standard structure: Role & Constraints → Workflow → Skills → Output Contract → Quality Standards
- [ ] "What you do NOT do" section clearly defines boundaries
- [ ] Write access is explicitly stated
- [ ] No deprecated tool names (`readFile`, `editFile`, `createFile`, `findFiles`, `runInTerminal`, `fetchWebpage`)
