# Cursor — Customization Primitives Reference

> Research document for the INSTALLER project. Captures Cursor's agentic customization surface as of March 2026.

## Overview

Cursor provides three main customization mechanisms: Rules (project, user, team), Agent Skills (following the open standard), and `AGENTS.md` (a simple markdown alternative). Cursor's approach is less structured than Copilot's agent system — it doesn't have named agent personas with frontmatter schemas. Instead, it uses rules for behavioral guidance and skills for capability packaging.

## 1. Rules

Rules are the primary customization primitive. They provide persistent, reusable context injected at the start of model context.

### Rule Types

| Type | Location | Scope | Format |
|------|----------|-------|--------|
| **Project Rules** | `.cursor/rules/*.md` or `.mdc` | Repository (version-controlled) | Markdown with optional frontmatter |
| **User Rules** | Cursor Settings → Rules | Global (all projects) | Plain text |
| **Team Rules** | Cursor Dashboard | Organization-wide (Team/Enterprise plans) | Plain text with optional globs |

### Project Rule Anatomy

Each rule is a markdown file with optional YAML frontmatter:

```yaml
---
description: "Standards for frontend components and API validation"
globs: "src/components/**/*.tsx"
alwaysApply: false
---

- Use TypeScript for all new files
- Prefer functional components in React
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Used by the agent to decide relevance (for "Apply Intelligently" mode) |
| `globs` | `string` | File pattern for "Apply to Specific Files" mode |
| `alwaysApply` | `boolean` | When `true`, rule is applied to every chat session |

### Application Modes

| Mode | Trigger | Frontmatter |
|------|---------|-------------|
| Always Apply | Every chat session | `alwaysApply: true` |
| Apply Intelligently | Agent decides based on `description` | `alwaysApply: false`, no `globs` |
| Apply to Specific Files | File matches `globs` pattern | `globs` is set |
| Apply Manually | User types `@my-rule` | Manual invocation only |

### Rule Precedence

Team Rules → Project Rules → User Rules (all merged; earlier take precedence on conflict).

### Managing Rules

- `/create-rule` in Agent chat — generates rule files
- Cursor Settings → Rules → `+ Add Rule`
- Remote rules can be imported from GitHub repositories (auto-synced)

### `.mdc` vs `.md`

`.mdc` files support frontmatter for `description` and `globs`. Plain `.md` files work as simple rules without metadata.

## 2. Agent Skills

Cursor adopted the **Agent Skills open standard** ([agentskills.io](https://agentskills.io/)). Skills are portable, version-controlled packages that teach agents domain-specific tasks.

### Skill Directories (Discovery Paths)

| Path | Scope |
|------|-------|
| `.agents/skills/` | Project-level (cross-client standard) |
| `.cursor/skills/` | Project-level (Cursor-native) |
| `~/.cursor/skills/` | User-level (global) |

**Compatibility scanning**: Cursor also loads skills from `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, and `~/.codex/skills/`.

### Skill Structure

```
.agents/skills/my-skill/
├── SKILL.md              # Required
├── scripts/              # Optional — executable code
├── references/           # Optional — documentation
└── assets/               # Optional — static resources
```

### SKILL.md Frontmatter

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Lowercase, hyphens, numbers. Must match folder name |
| `description` | `string` | Yes | What it does and when to use it. Agent uses this for relevance |
| `license` | `string` | No | License name or file reference |
| `compatibility` | `string` | No | Environment requirements |
| `metadata` | `object` | No | Arbitrary key-value pairs |
| `disable-model-invocation` | `boolean` | No | When `true`, only invoked via `/skill-name` (not auto-applied) |

### Skill Invocation

- **Automatic**: Agent decides based on `description` relevance
- **Manual**: User types `/skill-name` in Agent chat
- **Disable auto**: Set `disable-model-invocation: true` for manual-only skills

### Installing Skills from GitHub

1. Cursor Settings → Rules
2. Add Rule → Remote Rule (GitHub)
3. Paste GitHub repository URL
4. Rules/skills auto-sync with source repository

### Migration

Cursor provides `/migrate-to-skills` to convert existing dynamic rules and slash commands to the skills format.

## 3. `AGENTS.md`

A simple markdown file alternative to `.cursor/rules/`. Placed in the project root (or subdirectories).

### Characteristics

- Plain markdown, **no frontmatter** or metadata
- Supports nested `AGENTS.md` files in subdirectories
- Simpler than Project Rules — no glob patterns or intelligent application
- Always applied when present
- Designed for straightforward, readable instructions

### Example

```markdown
# Project Instructions

## Code Style
- Use TypeScript for all new files
- Prefer functional components in React

## Architecture
- Follow the repository pattern
- Keep business logic in service layers
```

## 4. Key Differences from Copilot

| Concept | Copilot | Cursor |
|---------|---------|--------|
| **Named agent personas** | Yes (`.agent.md` with full schema) | No — no equivalent of named agents with tool restrictions |
| **Skills location** | `.github/skills/` only | `.agents/skills/`, `.cursor/skills/`, `.claude/skills/` (cross-client) |
| **File-scoped instructions** | `.instructions.md` with `applyTo` glob | Rules with `globs` field |
| **Global instructions** | `.github/copilot-instructions.md` | `AGENTS.md` in root, or rules with `alwaysApply: true` |
| **Slash commands** | `.prompt.md` files | `/skill-name` from skills |
| **Tool restrictions** | Per-agent `tools` whitelist | Not configurable per-rule/skill |
| **Model selection** | Per-agent `model` field | Not configurable per-rule/skill |
| **Subagent invocation** | `agents` array + `runSubagent` tool | Not available |

## 5. Portability Implications

### What's Directly Portable

- **Skills**: The `SKILL.md` format is identical to the open standard. Cursor scans `.agents/skills/` (the cross-client path) plus several compatibility paths. Skills authored for Copilot would work in Cursor if placed in a scanned directory.

### What Needs Adaptation

- **Agent personas**: Cursor has no equivalent. Agent behavior would need to be encoded as rules or as skill instructions.
- **Instruction files**: Copilot's `applyTo`-scoped `.instructions.md` files map to Cursor's `globs`-scoped rules, but the format differs.
- **Prompt files**: Copilot's `.prompt.md` with `agent` routing has no direct equivalent. Skills with `disable-model-invocation: true` serve a similar manual-invocation purpose.
- **`copilot-instructions.md`**: Maps to `AGENTS.md` or `alwaysApply: true` rules.

### What's Lost

- **Multi-agent orchestration**: Cursor doesn't support named agents, subagent invocation, or agent-to-agent handoffs. The orchestration pipeline's core agent-spawning mechanism has no Cursor equivalent.
- **Tool restrictions**: No way to restrict which tools a rule or skill can access.
- **Model routing**: No way to assign specific models to specific rules or skills.
