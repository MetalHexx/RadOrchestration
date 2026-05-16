# `harness-files/` — Contributing Guide

The `harness-files/` folder is the **single source of truth** for all agents and skills across multiple AI coding harnesses (Claude Code, GitHub Copilot in VS Code, GitHub Copilot CLI).

## Folder Structure

```
harness-files/
├── agents/              # Agent body files + per-harness frontmatter YAML
├── skills/              # Skill folders, each containing SKILL.md + subfolders
└── AGENTS.md            # This file
```

## Adding an Agent

### File Layout

Each agent consists of two parts:

1. **Body file:** `agents/<name>.md`
   - Contains the agent prompt/instructions in markdown
   - Starts with a `{{FRONTMATTER}}` token on the first line
   - The token is replaced at translation time with per-harness frontmatter

2. **Per-harness YAML files:** `agents/<name>.<harness>.yml`
   - One file per supported harness: `<name>.claude.yml`, `<name>.copilot-vscode.yml`, `<name>.copilot-cli.yml`
   - Contains the frontmatter YAML (name, description, model, tools, etc.)
   - Harness-specific formatting applied here; the body stays neutral

### Example

```
agents/
├── coder.md
├── coder.claude.yml           # Claude-specific frontmatter
├── coder.copilot-vscode.yml   # Copilot VS Code-specific frontmatter
└── coder.copilot-cli.yml      # Copilot CLI-specific frontmatter
```

The `coder.md` file starts with:
```
{{FRONTMATTER}}

# Coder Agent

Your instructions here...
```

Each `coder.<harness>.yml` contains:
```yaml
name: coder
description: "..."
model: sonnet
tools: [Read, Write, Bash]
# ... other harness-specific fields
```

## Adding a Skill

### File Layout

Each skill is a folder under `skills/` containing a `SKILL.md` file plus any supporting subfolders:

```
skills/
└── rad-my-skill/
    ├── SKILL.md           # Skill frontmatter + content (all harnesses inline)
    ├── references/        # Optional: reference docs
    │   └── guide.md
    ├── templates/         # Optional: template files
    │   └── template.txt
    └── scripts/           # Optional: helper scripts
        └── helper.js
```

### SKILL.md Format

Frontmatter is **authored inline** (lowest-common-denominator across harnesses), not split into per-harness YAML files:

```yaml
---
name: rad-my-skill
description: "Describe what this skill does"
user-invocable: false
---

# My Skill

Skill content...

## References

- [guide.md](references/guide.md)
```

Adapters do not project skill frontmatter — the file is shipped as-is to all harnesses. Keep frontmatter portable (no Claude-specific tool names, no model tier aliases).

### Subfolders

All subfolders under a skill (e.g., `references/`, `scripts/`, `templates/`) are copied verbatim to the output during translation. No transformation is applied.

## Conventions

### `{{FRONTMATTER}}` Token

The `{{FRONTMATTER}}` token is a placeholder in agent body files (`agents/<name>.md`) that gets replaced during translation:

1. The translator reads the agent body file
2. Finds the `{{FRONTMATTER}}` token (usually the very first line)
3. Loads the appropriate per-harness YAML file (`agents/<name>.<harness>.yml`)
4. Outputs a complete markdown file with YAML frontmatter + body

**Usage:** Always place `{{FRONTMATTER}}` on the first line of an agent body file.

### `${SKILLS_ROOT}` Token

The `${SKILLS_ROOT}` token references the skills folder in canonical content (agents and skill body text). It is replaced at **installation time** (not translation time) with the actual harness-specific destination path.

- Canonical source uses: `${SKILLS_ROOT}/rad-orchestration/...`
- At installation to Claude Code, `${SKILLS_ROOT}` becomes: `~/.claude/skills/`
- At installation to Copilot, `${SKILLS_ROOT}` becomes: `~/.copilot/skills/`

**Usage:** Use `${SKILLS_ROOT}` in skill or agent body text whenever you reference another skill's files. Never hardcode `.claude/` or `.copilot/`.

## Harness Vocabulary

Harness-specific vocabulary (tool names, model aliases, frontmatter fields) lives in **per-harness YAML files only**. The body text stays harness-neutral.

### Agent Frontmatter by Harness

#### Claude (`<name>.claude.yml`)
- **Model:** Tier alias: `haiku`, `sonnet`, `opus`
- **Tools:** PascalCase: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `TodoWrite`, `WebFetch`, `WebSearch`, `Task`, `Agent`
- **Fields:** Include both `tools:` (list/string) and `allowedTools:` (list) as needed

Example:
```yaml
name: coder
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob
allowedTools:
  - Read
  - Write
```

#### Copilot VS Code (`<name>.copilot-vscode.yml`)
- **Model:** Display name with suffix: `Claude Haiku 4.5 (copilot)`, `Claude Sonnet 4.6 (copilot)`, `Claude Opus 4.7 (copilot)`
- **Tools:** Lowercase aliases: `read`, `edit`, `execute`, `search`, `todo`, `web`, `web/fetch`, `agent`
- **Fields:** Use `tools:` only (Copilot VS Code ignores `allowedTools`)

Example:
```yaml
name: coder
model: Claude Sonnet 4.6 (copilot)
tools: read, edit, execute, search
```

#### Copilot CLI (`<name>.copilot-cli.yml`)
- **Model:** Display name with suffix: `Claude Haiku 4.5 (copilot)`, `Claude Sonnet 4.6 (copilot)`, `Claude Opus 4.7 (copilot)`
- **Tools:** Lowercase aliases: same as VS Code
- **Fields:** Use `tools:` only (Copilot CLI ignores `allowedTools`)

Example:
```yaml
name: coder
model: Claude Sonnet 4.6 (copilot)
tools: read, edit, execute, search
```

### Skills

Skills use **inline, portable frontmatter** — the same `SKILL.md` ships to all harnesses. Avoid Claude-specific vocabulary in the frontmatter or body.

**Avoid:** PascalCase tool names, tier aliases (`sonnet`, `opus`), Claude-only fields
**Use instead:** Neutral descriptions, generic tool categories, portable field names
