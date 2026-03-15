# GitHub Copilot — Customization Primitives Reference

> Research document for the INSTALLER project. Captures Copilot's agentic customization surface as of March 2026.

## Overview

GitHub Copilot (VS Code) provides five workspace-level customization primitives, all living under `.github/`. Together they form a layered system: global instructions set workspace context, instruction files add file-scoped rules, agents define personas with tool/model constraints, skills package reusable capabilities, and prompts create slash-command shortcuts.

## 1. Agents (`.agent.md`)

### Location & Discovery

- **Path**: `.github/agents/*.agent.md`
- **Invocation**: `@AgentName` in chat (uses the `name` frontmatter field)
- **Filename convention**: lowercase, hyphenated (e.g., `orchestrator.agent.md`)

### Frontmatter Schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | filename stem | Display name for `@` invocation |
| `description` | `string` | Yes | — | What the agent does and when to use it. Used for discovery/matching |
| `model` | `string \| string[]` | No | user's picker selection | Model ID or prioritized fallback array |
| `tools` | `string[]` | Yes | all tools | Whitelist of tool/toolset/MCP-tool names |
| `agents` | `string[]` | Yes | all agents | Subagent access: `['*']` = all, `[]` = none, or list specific names |
| `argument-hint` | `string` | No | — | Hint text for user input |
| `user-invocable` | `boolean` | No | `true` | Whether agent appears in the agents dropdown |
| `disable-model-invocation` | `boolean` | No | `false` | Prevent AI from auto-invoking as subagent |
| `target` | `string` | No | `vscode` | `vscode` or `github-copilot` |
| `handoffs` | `object[]` | No | — | Transition buttons rendered after agent completes |
| `handoffs[].label` | `string` | Yes* | — | Button display text |
| `handoffs[].agent` | `string` | Yes* | — | Target agent identifier |
| `handoffs[].prompt` | `string` | No | — | Pre-filled prompt for target agent |
| `handoffs[].send` | `boolean` | No | `false` | Auto-submit the prompt |
| `handoffs[].model` | `string` | No | — | Override model for handoff |

### Body Convention

The markdown body after frontmatter is the agent's system prompt. Common sections:

```
# {Agent Name}
## Role & Constraints
### What you do:
### What you do NOT do:
### Write access:
## Workflow
## Skills
## Output Contract
## Quality Standards
```

### Subagent Invocation

- The calling agent must have `agent` in its `tools` array
- The calling agent must list targets in its `agents` array (or `['*']`)
- `disable-model-invocation: true` prevents auto-invocation but allows explicit invocation
- `user-invocable: false` hides from dropdown but allows subagent use
- The `runSubagent` tool spawns a child agent with a prompt; it returns a single message

### Handoffs (Structured Transitions)

```yaml
handoffs:
  - label: "Start Planning"
    agent: Orchestrator
    prompt: "Begin planning from BRAINSTORMING.md"
    send: true
```

Renders a UI button for explicit agent transitions with optional auto-submit.

## 2. Skills (`SKILL.md`)

### Location & Discovery

- **Path**: `.github/skills/{skill-name}/SKILL.md`
- **Discovery**: Description-based matching — Copilot reads the `description` field to decide when to activate
- **Built-in skills**: `copilot-skill:/` URI scheme for bundled skills
- **No `.agents/skills/` scanning observed** — only `.github/skills/` is used

### Directory Structure

```
.github/skills/{skill-name}/
├── SKILL.md              # Required
├── templates/            # Optional — document templates
├── references/           # Optional — background material
├── scripts/              # Optional — CLI tools, automation
└── assets/               # Optional — static files
```

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | 1–64 chars, lowercase/numbers/hyphens, must match folder name |
| `description` | `string` | Yes | 1–1024 chars. What it does AND when to use it |
| `license` | `string` | No | License name or reference |
| `compatibility` | `string` | No | 1–500 chars, environment requirements |
| `metadata` | `object` | No | Key-value pairs |
| `allowed-tools` | `string` | No | Space-delimited pre-approved tools (experimental) |

### Skill-Agent Binding

Agents reference skills in their body's `## Skills` section. The primary matching mechanism is Copilot's description-based matching, not explicit binding.

## 3. Instruction Files (`.instructions.md`)

### Location & Discovery

- **Path**: `.github/instructions/*.instructions.md`
- **Scoping**: Automatically loaded when the user edits files matching the `applyTo` glob

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applyTo` | `string` (glob) | Yes | Glob pattern matched against workspace-relative file paths |

**Only one field.** No `name`, `description`, or other metadata.

### Behavior

- Uses standard glob syntax (e.g., `'.github/projects/**'`, `'**/state.json'`)
- Content is injected into context when the glob matches the active file
- Additive with `copilot-instructions.md` (both load when applicable)

## 4. Prompt Files (`.prompt.md`)

### Location & Discovery

- **Path**: `.github/prompts/*.prompt.md`
- **Invocation**: `/prompt-name` slash command in chat
- **Optional**: The prompts directory is not required

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Description for discovery |
| `agent` | `string` | No | Route prompt to a specific agent |
| `tools` | `string[]` | No | Tool/toolset names available during execution |

### How Prompts Differ

- **Agents**: Persistent personas with identity and constraints
- **Skills**: Capability bundles (instructions + templates + scripts) used by agents
- **Prompts**: Pre-composed user messages — reusable slash commands with optional agent routing

## 5. Global Instructions (`copilot-instructions.md`)

### Location & Behavior

- **Path**: `.github/copilot-instructions.md`
- **Always loaded**: Injected into every conversation, regardless of agent or file
- **No frontmatter**: Plain markdown, no YAML block
- **Purpose**: Workspace-wide context (the "README for Copilot")

### Interaction with `.instructions.md`

- `copilot-instructions.md` = unconditional, always loaded
- `.instructions.md` = conditional, loaded when `applyTo` glob matches
- Both are additive

## 6. Tool System

### Restriction Mechanism

Agents restrict tools via the `tools` whitelist array. If omitted, all tools are available.

### Granularity

| Approach | Syntax | Effect |
|----------|--------|--------|
| Toolset (broad) | `read`, `search`, `edit` | All tools in category |
| Individual tool | `read/readFile`, `search/codebase` | Specific tool only |
| MCP server tool | `<server>/<tool>` or `<server>/*` | MCP server tools |
| Special | `agent`, `todo` | Standalone (no namespace) |

### Toolset Contents

| Toolset | Tools |
|---------|-------|
| `read` | readFile, problems, getTaskOutput, terminalLastCommand, terminalSelection, getNotebookSummary, readNotebookCellOutput |
| `search` | codebase, usages, fileSearch, textSearch, listDirectory, changes, searchResults |
| `edit` | editFiles, createFile, createDirectory, editNotebook, createJupyterNotebook |
| `execute` | runInTerminal, getTerminalOutput, runTests, testFailure, runTask, createAndRunTask, runNotebookCell |
| `web` | fetch, githubRepo |
| `vscode` | extensions, installExtension, runCommand, vscodeAPI, openSimpleBrowser, newWorkspace, getProjectSetupInfo |

## 7. Model Configuration

### Per-Agent

```yaml
model: Claude Sonnet 4.6 (copilot)
```

Or with fallback chain:

```yaml
model:
  - Claude Opus 4.6 (copilot)
  - Claude Sonnet 4.6 (copilot)
```

### Format

Model IDs follow `{Model Name} (copilot)` convention. If `model` is omitted, Copilot uses the user's current picker selection.

## 8. Required Directory Structure

```
.github/
├── copilot-instructions.md        # Required — always loaded
├── agents/                         # Required
│   └── *.agent.md
├── skills/                         # Required
│   └── {skill-name}/
│       └── SKILL.md
├── instructions/                   # Required
│   └── *.instructions.md
└── prompts/                        # Optional
    └── *.prompt.md
```

## Key Portability Observations

1. **Skills** follow the Agent Skills open standard (`SKILL.md` format) but live in `.github/skills/` rather than the cross-client `.agents/skills/`
2. **Agent files** are Copilot-specific — no other tool uses `.agent.md` with this schema
3. **Instruction files** are Copilot-specific — the `applyTo` glob mechanism is unique
4. **Prompt files** are Copilot-specific — Cursor and Claude Code have different slash-command mechanisms
5. **`copilot-instructions.md`** is analogous to Claude Code's `CLAUDE.md` and Cursor's `AGENTS.md` but with a different name and location
6. **Tool names** are Copilot-specific namespaced identifiers (e.g., `read/readFile`) — other tools use different names
