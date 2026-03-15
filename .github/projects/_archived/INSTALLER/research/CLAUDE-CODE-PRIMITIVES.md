# Claude Code — Customization Primitives Reference

> Research document for the INSTALLER project. Captures Claude Code's agentic customization surface as of March 2026.

## Overview

Claude Code provides a rich, hierarchical customization system built around scoped settings, memory files (`CLAUDE.md`), custom subagents, skills (following the open standard), plugins, and hooks. It's the most feature-complete of the three tools, with fine-grained permission controls, persistent agent memory, sandboxing, and a plugin marketplace.

## 1. Configuration Scopes

Claude Code uses a layered scope system with strict precedence:

| Scope | Location | Shared | Precedence |
|-------|----------|--------|------------|
| **Managed** | Server-managed, plist/registry, or `managed-settings.json` | IT-deployed | 1 (highest) |
| **CLI args** | Command-line flags | Session only | 2 |
| **Local** | `.claude/settings.local.json` | No (gitignored) | 3 |
| **Project** | `.claude/settings.json` | Yes (committed) | 4 |
| **User** | `~/.claude/settings.json` | No | 5 (lowest) |

Array settings **merge** across scopes (concatenated, deduplicated).

## 2. Memory Files (`CLAUDE.md`)

The equivalent of Copilot's `copilot-instructions.md` — but more flexible.

### Locations

| Location | Scope |
|----------|-------|
| `~/.claude/CLAUDE.md` | User-level (all projects) |
| `CLAUDE.md` or `.claude/CLAUDE.md` | Project-level (root) |
| `{subdir}/CLAUDE.md` | Directory-level (nested, auto-discovered) |

### Behavior

- Loaded at startup into Claude's context
- Plain markdown, no frontmatter
- Nested `CLAUDE.md` files are auto-discovered when working in subdirectories
- `--add-dir` directories can optionally load their `CLAUDE.md` via `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`

## 3. Custom Subagents

Claude Code's equivalent of Copilot's `.agent.md` files — specialized AI assistants with custom system prompts, tool restrictions, and independent permissions.

### Location & Discovery

| Scope | Path | Priority |
|-------|------|----------|
| CLI flag | `--agents` JSON | 1 (highest) |
| Project | `.claude/agents/*.md` | 2 |
| User | `~/.claude/agents/*.md` | 3 |
| Plugin | `<plugin>/agents/` | 4 (lowest) |

### File Format

Markdown files with YAML frontmatter:

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. Analyze the code and provide feedback.
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique identifier (lowercase, hyphens) |
| `description` | `string` | Yes | When Claude should delegate to this subagent |
| `tools` | `string` | No | Comma-separated tool allowlist. Inherits all if omitted |
| `disallowedTools` | `string` | No | Tools to deny (denylist) |
| `model` | `string` | No | `sonnet`, `opus`, `haiku`, full model ID, or `inherit` |
| `permissionMode` | `string` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | `number` | No | Maximum agentic turns |
| `skills` | `string[]` | No | Skills to preload into subagent context at startup |
| `mcpServers` | `list` | No | MCP servers scoped to subagent (inline or reference) |
| `hooks` | `object` | No | Lifecycle hooks (`PreToolUse`, `PostToolUse`, `Stop`) |
| `memory` | `string` | No | Persistent memory scope: `user`, `project`, or `local` |
| `background` | `boolean` | No | Always run as background task |
| `isolation` | `string` | No | `worktree` for isolated git worktree |

### Built-in Subagents

| Name | Model | Purpose |
|------|-------|---------|
| Explore | Haiku | Fast, read-only codebase exploration |
| Plan | — | Planning and reasoning |
| General-purpose | — | Default delegation target |

### Subagent Capabilities

- **Tool restrictions**: `tools` (allowlist) and `disallowedTools` (denylist)
- **Agent spawning restrictions**: `Agent(worker, researcher)` syntax limits which sub-subagents can be spawned
- **Scoped MCP servers**: Inline or referenced, connected only for subagent lifetime
- **Persistent memory**: Cross-session knowledge stored in scoped directories
- **Hooks**: `PreToolUse`, `PostToolUse`, `Stop` for validation and automation
- **Foreground/background execution**: Background agents run concurrently
- **Resumable**: Subagents can be resumed with full context

### Key Difference from Copilot

Copilot agents are conversation-level personas the user invokes via `@Name`. Claude Code subagents are delegated to by the main Claude instance — the user doesn't directly invoke subagents, Claude decides when to delegate (or the user asks Claude to use one).

## 4. Skills

Claude Code follows the **Agent Skills open standard** with extensions.

### Skill Directories

| Path | Scope |
|------|-------|
| `.claude/skills/{name}/SKILL.md` | Project-level |
| `~/.claude/skills/{name}/SKILL.md` | User-level |
| Enterprise managed | Organization-level |
| Plugin's `skills/` | Plugin scope |

**Cross-client compatibility**: Claude Code also looks in `.agents/skills/` and nested `.claude/skills/` in subdirectories.

### SKILL.md Format

Same as the open standard, plus Claude Code extensions:

| Field | Type | Standard | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Skill identifier |
| `description` | `string` | Yes | What it does and when to use it |
| `disable-model-invocation` | `boolean` | Extension | Prevent auto-invocation |
| `user-invocable` | `boolean` | Extension | Hide from `/` menu (`false`) |
| `allowed-tools` | `string` | Standard (exp.) | Pre-approved tools |
| `model` | `string` | Extension | Model override when active |
| `context` | `string` | Extension | `fork` to run in subagent context |
| `agent` | `string` | Extension | Which subagent type for `context: fork` |
| `argument-hint` | `string` | Extension | Hint for autocomplete |
| `hooks` | `object` | Extension | Lifecycle hooks scoped to skill |

### Invocation

- **Automatic**: Claude decides based on `description`
- **Manual**: User types `/skill-name`
- **In subagent**: Skills listed in subagent's `skills` field are preloaded at startup

### Advanced Features

- **Dynamic context injection**: `!`command`` syntax runs shell commands before content is sent
- **String substitution**: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`
- **Subagent delegation**: `context: fork` runs skill in isolated subagent

## 5. Plugins

A distribution mechanism for packaging skills, agents, hooks, and MCP servers.

### Distribution

- **Marketplaces**: GitHub repos, git URLs, npm packages, URLs, directories
- **Management**: `/plugin` command for install/enable/disable
- **Settings**: `enabledPlugins`, `extraKnownMarketplaces` in `settings.json`
- **Managed restrictions**: `strictKnownMarketplaces`, `blockedMarketplaces` for enterprise

## 6. Permissions System

| Rule Type | Example | Effect |
|-----------|---------|--------|
| `allow` | `Bash(npm run *)` | Auto-approve matching commands |
| `ask` | `Bash(git push *)` | Prompt for confirmation |
| `deny` | `Read(./.env)` | Block access |

### Rule Syntax

- `Tool` — matches all uses of tool
- `Tool(specifier)` — matches specific pattern
- Evaluated in order: deny → ask → allow (first match wins)

### Tool-Specific Patterns

- `Bash(command *)` — command matching
- `Read(path)` / `Edit(path)` — file path matching
- `WebFetch(domain:example.com)` — domain matching
- `Agent(subagent-name)` — subagent spawning

## 7. Hooks

Event-driven automation at lifecycle boundaries:

| Event | Trigger |
|-------|---------|
| `PreToolUse` | Before a tool executes |
| `PostToolUse` | After a tool executes |
| `Stop` | When agent finishes |
| `SubagentStart` | When a subagent begins |
| `SubagentStop` | When a subagent completes |

### Hook Types

- **Command hooks**: Run shell scripts
- **HTTP hooks**: Call URLs

### Exit Codes

- `0`: Continue normally
- `2`: Block the operation (PreToolUse)

## 8. Settings Reference (Selected)

| Setting | Description |
|---------|-------------|
| `model` | Default model override |
| `permissions` | Allow/ask/deny rules |
| `hooks` | Lifecycle hooks |
| `env` | Environment variables for sessions |
| `sandbox` | Bash sandboxing (filesystem, network) |
| `includeGitInstructions` | Toggle built-in git workflow prompts |
| `plansDirectory` | Custom location for plan files |
| `autoMemoryDirectory` | Custom location for auto memory |

## 9. Key Portability Observations

### What's Directly Portable

- **Skills**: `SKILL.md` follows the open standard. Claude Code scans `.agents/skills/` and `.claude/skills/`. Skills authored for Copilot would work if placed in a scanned path.

### What Needs Adaptation

| Copilot Concept | Claude Code Equivalent | Adaptation Needed |
|-----------------|----------------------|-------------------|
| `.agent.md` files | `.claude/agents/*.md` | Different frontmatter schema, different field names |
| `copilot-instructions.md` | `CLAUDE.md` | Rename + relocate |
| `.instructions.md` with `applyTo` | Nested `CLAUDE.md` in subdirectories | Different scoping mechanism (directory-based vs. glob-based) |
| `.prompt.md` files | Skills with `disable-model-invocation: true` | Convert to skill format |
| `tools` whitelist (per agent) | `tools` + `disallowedTools` (per subagent) | Similar concept, different syntax |
| `model` field | `model` field | Different model ID format (no `(copilot)` suffix) |
| `agents` array | `Agent(name)` in tools | Different subagent restriction mechanism |
| `handoffs` | No equivalent | Lost in translation |

### What Claude Code Has That Others Don't

- **Persistent subagent memory** (cross-session knowledge)
- **Plugin marketplace** (distribution system)
- **Sandbox** (filesystem + network isolation)
- **Hooks** (lifecycle event automation)
- **Permission system** (allow/ask/deny rules)
- **Background agents** (concurrent execution)
- **Worktree isolation** (git worktree per agent)
- **Agent teams** (multi-agent coordination across sessions)
