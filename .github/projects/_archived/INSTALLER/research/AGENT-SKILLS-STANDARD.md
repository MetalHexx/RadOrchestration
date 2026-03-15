# Agent Skills Open Standard — Reference

> Research document for the INSTALLER project. Captures the Agent Skills specification as of March 2026.

## Overview

Agent Skills is an **open standard** originally developed by Anthropic and released for cross-tool interoperability. It defines a simple, portable format for packaging domain-specific knowledge and workflows that AI agents can discover and use.

**Website**: [agentskills.io](https://agentskills.io/)  
**GitHub**: [github.com/agentskills/agentskills](https://github.com/agentskills/agentskills)  
**Reference library**: [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) (validation tool)

## Adoption

The standard is supported by a growing list of tools:

| Tool | Vendor | Status |
|------|--------|--------|
| Claude Code | Anthropic | Full support |
| Cursor | Anysphere | Full support |
| Junie | JetBrains | Supported |
| Roo Code | Roo | Supported |
| OpenHands | All Hands AI | Supported |
| Amp | Sourcegraph | Supported |
| Snowflake Cortex Code | Snowflake | Supported |
| Spring AI | VMware | Supported |
| Agentman | Agentman | Supported |
| Laravel Boost | Laravel | Supported |
| Command Code | Command | Supported |
| GitHub Copilot | GitHub/Microsoft | Uses `SKILL.md` format but non-standard paths |

## Specification

### Directory Structure

```
skill-name/
├── SKILL.md              # Required: metadata + instructions
├── scripts/              # Optional: executable code
├── references/           # Optional: documentation
├── assets/               # Optional: templates, resources
└── ...                   # Any additional files
```

### SKILL.md Format

YAML frontmatter followed by Markdown content.

### Frontmatter Fields (Standard)

| Field | Required | Constraints | Description |
|-------|----------|-------------|-------------|
| `name` | Yes | 1–64 chars, `[a-z0-9-]`, no leading/trailing/consecutive hyphens, must match parent directory | Skill identifier |
| `description` | Yes | 1–1024 chars, non-empty | What the skill does and when to use it. Critical for agent discovery |
| `license` | No | — | License name or bundled file reference |
| `compatibility` | No | 1–500 chars | Environment requirements (tools, packages, network, etc.) |
| `metadata` | No | String key → string value map | Arbitrary additional properties |
| `allowed-tools` | No | Space-delimited | Pre-approved tools (experimental) |

### Body Content

The Markdown body after frontmatter contains skill instructions. No format restrictions — write whatever helps agents perform the task. Recommended sections:

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases

### Minimal Example

```yaml
---
name: code-review
description: Review code for quality, security, and best practices. Use when reviewing pull requests or code changes.
---

# Code Review

When reviewing code, check for:
1. Security vulnerabilities
2. Performance issues
3. Code style consistency
```

## Progressive Disclosure (3-Tier Loading)

This is the core architectural principle of the standard:

| Tier | What's Loaded | When | Token Cost |
|------|---------------|------|------------|
| 1. Catalog | `name` + `description` only | Session start | ~50–100 tokens per skill |
| 2. Instructions | Full `SKILL.md` body | Skill activation | < 5000 tokens recommended |
| 3. Resources | `scripts/`, `references/`, `assets/` | On demand (when referenced) | Varies |

### Why This Matters for Portability

An agent with 20 installed skills pays ~1000–2000 tokens upfront (catalog only). Full instructions load only when activated. This makes it feasible to have many skills available without context bloat.

## Discovery Paths

### Standard Cross-Client Convention

| Path | Scope |
|------|-------|
| `<project>/.agents/skills/` | Project-level (cross-client) |
| `~/.agents/skills/` | User-level (cross-client) |

### Client-Specific Paths

| Client | Project Path | User Path |
|--------|-------------|-----------|
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Copilot | `.github/skills/` | — |

### Compatibility Scanning

Several tools scan other clients' paths for interoperability:

- **Cursor** scans: `.agents/skills/`, `.cursor/skills/`, `.claude/skills/`, `.codex/skills/`
- **Claude Code** scans: `.claude/skills/`, `.agents/skills/`, nested subdirectories
- **Copilot** scans: `.github/skills/` only (no cross-client scanning observed)

## Client Extensions

The standard defines a minimal core. Clients extend it with additional frontmatter fields:

| Field | Cursor | Claude Code | Copilot | Standard |
|-------|--------|-------------|---------|----------|
| `name` | Yes | Yes | Yes | **Yes** |
| `description` | Yes | Yes | Yes | **Yes** |
| `license` | Yes | Yes | Yes | **Yes** |
| `compatibility` | Yes | Yes | Yes | **Yes** |
| `metadata` | Yes | Yes | Yes | **Yes** |
| `allowed-tools` | — | Yes | Yes | **Yes** (exp.) |
| `disable-model-invocation` | Yes | Yes | — | No |
| `user-invocable` | — | Yes | — | No |
| `model` | — | Yes | — | No |
| `context` | — | Yes (`fork`) | — | No |
| `agent` | — | Yes | — | No |
| `argument-hint` | — | Yes | — | No |
| `hooks` | — | Yes | — | No |

## Optional Directories

### `scripts/`

Executable code agents can run. Should be:
- Self-contained or clearly document dependencies
- Include helpful error messages
- Handle edge cases gracefully
- Any language supported by the agent runtime (Python, Bash, JavaScript common)

### `references/`

Additional documentation loaded on demand:
- `REFERENCE.md` — detailed technical reference
- Domain-specific files
- Keep individual files focused (smaller = less context)

### `assets/`

Static resources:
- Templates (document, configuration)
- Images, diagrams
- Data files (schemas, lookup tables)

## File References

Use relative paths from skill root:

```markdown
See [the reference guide](references/REFERENCE.md) for details.
Run the script: `scripts/extract.py`
```

Keep references one level deep from `SKILL.md`. Avoid deeply nested chains.

## Validation

```bash
skills-ref validate ./my-skill
```

Checks frontmatter validity and naming conventions.

## Key Implications for the Installer Project

### Skills Are the Portable Foundation

`SKILL.md` is the **one format** that works across all three tools with zero or minimal adaptation. This is the natural unit of portability.

### The `.agents/skills/` Convention Is Winning

Both Cursor and Claude Code scan `.agents/skills/`. This is the emerging cross-client standard path. Copilot is the outlier, scanning only `.github/skills/`.

### Extensions Are Client-Specific

Fields like `disable-model-invocation`, `context: fork`, `model`, and `hooks` are not portable. A skill using these features will work in one tool and be silently ignored (or break) in others. The installer should use only standard fields in the canonical source and generate client-specific extensions.

### Agents Are NOT Part of the Standard

The standard covers skills only — not agents, instructions, or rules. These remain tool-specific and are the harder portability problem.
