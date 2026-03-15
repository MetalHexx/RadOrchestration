---
project: "INSTALLER"
author: "brainstormer-agent"
created: "2026-03-14"
---

# INSTALLER — Brainstorming

## Problem Space

The orchestration system currently lives as a set of files tightly coupled to GitHub Copilot's primitives (`.agent.md`, `.github/skills/`, `.instructions.md`, `.prompt.md`). There is no mechanism to install this system into a new repository, adapt it to a repo with existing agentic infrastructure, or run it on other AI coding tools (Cursor, Claude Code). As adoption grows, maintaining separate copies of orchestration assets per tool would be a maintenance nightmare. We need a single-source-of-truth installation and portability strategy.

## Research Findings

Detailed research on each tool's customization surface is captured in companion documents:

- [COPILOT-PRIMITIVES.md](research/COPILOT-PRIMITIVES.md) — GitHub Copilot agents, skills, instructions, prompts, and tool system
- [CURSOR-PRIMITIVES.md](research/CURSOR-PRIMITIVES.md) — Cursor rules, skills, and AGENTS.md
- [CLAUDE-CODE-PRIMITIVES.md](research/CLAUDE-CODE-PRIMITIVES.md) — Claude Code subagents, skills, plugins, permissions, and hooks
- [AGENT-SKILLS-STANDARD.md](research/AGENT-SKILLS-STANDARD.md) — The Agent Skills open standard (agentskills.io)

### Key Research Takeaway

The **Agent Skills open standard** (`SKILL.md`) is already portable across all three tools. It's the one format that works everywhere. Skills are the portable foundation. Everything else — agents, instructions/rules, global context files — remains tool-specific and requires adaptation.

## Validated Goals

### Goal 1: Single Canonical Source, Multiple Targets

**Description**: Maintain one copy of each orchestration asset (agent prompts, skills, instructions, config) in a canonical format. Generate tool-specific files from this source at install time.

**Rationale**: Maintaining separate `.agent.md`, `.claude/agents/*.md`, and Cursor rules for 9 agents would triple the maintenance burden and inevitably drift. A canonical → adapter pattern keeps the source of truth in one place.

**Key considerations**:
- Skills already follow the Agent Skills standard and need minimal adaptation (mainly path relocation)
- Agent prompts (the system prompt body) are tool-agnostic text; only the frontmatter wrapper is tool-specific
- Instructions/rules content is tool-agnostic; only the scoping mechanism differs (`applyTo` vs `globs` vs directory nesting)
- Some tool-specific features (Copilot's `handoffs`, Claude Code's `hooks`, `memory`) have no cross-tool equivalent — these should be in optional tool-specific overlays

### Goal 2: Fresh Repo Installation

**Description**: Provide a CLI or script that installs the orchestration system into a new or existing repository, generating the correct files for the user's chosen tool(s).

**Rationale**: The current "copy the `.github/` folder" approach doesn't scale. An installer can interview the user for preferences (git strategy, execution mode) and generate a tailored `orchestration.yml`.

**Key considerations**:
- Installer should detect which tool(s) the user has (Copilot, Cursor, Claude Code) and generate appropriate files
- The UI dashboard is a separate optional component — don't bundle it with the core install
- `sample-apps/`, `docs/`, `archive/` are reference material, not installed assets

### Goal 3: Existing Repo Adaptation

**Description**: The installer should detect existing agentic infrastructure (skills, rules, agents, instructions) in the target repo and propose an integration plan rather than blindly overwriting.

**Rationale**: Real repos already have `.cursor/rules/`, `.claude/CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md`. Overwriting these breaks existing workflows.

**Key considerations**:
- Scan all standard paths: `.agents/skills/`, `.claude/skills/`, `.cursor/skills/`, `.github/skills/`
- Detect existing agent files across all tools
- Merge strategy for global instruction files (append orchestration context, don't replace)
- Offer to register discovered skills so orchestration agents can use them
- Handle naming collisions (what if they already have a `coder.agent.md`?)

### Goal 4: Tool Portability Without Duplication

**Description**: Use the `.agents/skills/` cross-client convention as the primary skill location. Generate tool-specific wrappers (agents, instructions, global context) from canonical sources at install time.

**Rationale**: `.agents/skills/` is already scanned by Cursor and Claude Code. The Agent Skills format is the one portable primitive. Building on this convention means skills work across tools with zero adaptation. Agent wrappers and instruction files are the adaptation layer.

**Key considerations**:
- Copilot only scans `.github/skills/` — the installer must either copy/symlink skills to `.github/skills/` for Copilot, or Copilot must add `.agents/skills/` scanning in the future
- Agent personas are the hardest portability problem: Copilot has rich agent definitions, Claude Code has subagents with different capabilities, Cursor has no real agent equivalent
- Some orchestration features (multi-agent pipeline, subagent spawning, tool restrictions) may not be fully expressible in all tools

## Scope Boundaries

### In Scope

- CLI installer that generates tool-specific files from canonical sources
- Support for Copilot, Cursor, and Claude Code as initial targets
- Fresh repo installation with interactive configuration
- Existing repo detection and merge strategy for agentic assets
- Canonical format for agent prompts, skills, instructions, and config
- Tool-specific adapter generation (frontmatter wrappers, path mapping)
- Upgrade mechanism (re-run installer to pick up new agents/skills without losing customizations)

### Out of Scope

- Runtime translation (no middleware that transpiles on-the-fly)
- UI dashboard installation (separate concern)
- MCP server configuration (tool-specific, handled by users)
- Creating a new open standard for agents (use existing tool formats)
- Supporting tools beyond the big three (Copilot, Cursor, Claude Code) in v1
- Plugin marketplace distribution (Claude Code-specific)

## Key Constraints

- **No runtime dependency**: The installer generates static files. No daemon, no build step required after installation. The generated files must work natively in each tool.
- **Skills must follow the Agent Skills standard**: No proprietary skill format. Extensions go in tool-specific overlays only.
- **Single source of truth**: The canonical files must be the authoritative source. Generated files should include a header comment indicating they're generated and should not be hand-edited.
- **Backward compatible**: Existing orchestration system repos should continue to work without the installer. The installer is additive, not required.
- **The pipeline logic (`pipeline.js`) is already tool-agnostic**: It runs in any terminal. No adaptation needed.

## Open Questions

1. **Canonical format for agent prompts**: Should the canonical source be a custom YAML+Markdown format, or just Markdown with a superset frontmatter that adapters strip/transform?
2. **Copilot skill path gap**: Copilot doesn't scan `.agents/skills/`. Should we duplicate skills into `.github/skills/`, symlink, or advocate for Copilot to add `.agents/skills/` scanning?
3. **Cursor agent gap**: Cursor lacks named agents, subagent invocation, and tool restrictions. Can the orchestration pipeline work at all in Cursor, or is it Copilot/Claude Code only with Cursor getting "skills only" support?
4. **Upgrade strategy**: When the canonical source adds a new agent or updates a skill, how does `installer upgrade` know what's user-customized vs. installer-generated?
5. **Where does the installer itself live?**: npm package? Standalone repo? Bundled with the orchestration system?
6. **Should the installer be an agent?**: An `@Installer` agent that uses research skills to scan the target repo and propose an integration plan.

## Summary

We're building an installation and portability tool for the orchestration system. It maintains a single canonical source of agent prompts, skills, instructions, and configuration, then generates tool-specific files for Copilot, Cursor, and Claude Code. Skills are already portable via the Agent Skills standard. Agents and instructions need tool-specific adapters generated at install time. The installer also handles existing repo detection, merge strategies, and upgrades.
