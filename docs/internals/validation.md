# Validation

The orchestration system includes a zero-dependency Node.js CLI that validates agents, skills, instructions, configuration, cross-references, and file structure. Run it any time you add, rename, or change orchestration components to catch misconfigurations before they break the pipeline.

> **Note:** Commands below use `.claude` as the default orchestration root. If you've [configured a custom root](../configuration.md), adjust paths accordingly.

## Quick Start

```bash
# Default .claude root shown. Adjust if you configured a custom orch_root.

# Run all checks
node .claude/skills/rad-orchestration/validate/validate-orchestration.js

# Verbose output (show passing checks too)
node .claude/skills/rad-orchestration/validate/validate-orchestration.js --verbose

# Check a single category
node .claude/skills/rad-orchestration/validate/validate-orchestration.js --category agents

# CI-friendly (no color, exits 1 on failure)
node .claude/skills/rad-orchestration/validate/validate-orchestration.js --no-color
```

**Exit codes:** `0` = all checks passed (warnings allowed), `1` = one or more failures.

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Print usage and available categories |
| `--verbose` | `-v` | Show detailed context for every check |
| `--quiet` | `-q` | Suppress all output except the final summary line |
| `--no-color` | | Disable ANSI colors (auto-enabled when `NO_COLOR` is set or stdout is not a TTY) |
| `--category <name>` | `-c` | Run and display results for a single category only |

Valid categories: `structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-references`.

> When `--category` is used, all checks still run internally (to build shared context like agent discovery). Only the output is filtered.

## What It Checks

The validator runs seven categories of checks in sequence. Each check produces results tagged as **pass**, **warn**, or **fail**.

### 1. Structure

Verifies the required layout under the orchestration root _(or your [configured root](../configuration.md))_:

- Required directories exist: `agents/`, `skills/`
- Required files exist: `skills/rad-orchestration/config/orchestration.yml`, `settings.json`

### 2. Agents

Validates all `.agent.md` files:

- Valid YAML frontmatter with required fields (`name`, `description`, `tools`)
- Tool declarations reference valid tools
- Only the Orchestrator agent may have a non-empty `agents` array

### 3. Skills

Validates all skill directories under `skills/`:

- Each skill has a `SKILL.md` file
- Valid frontmatter with `name` and `description` fields
- Skill `name` matches its folder name
- `templates/` subdirectory is present (unless the skill is exempt)
- Template links in `SKILL.md` resolve to existing files

### 4. Config

Validates `orchestration.yml`:

- Valid YAML syntax
- Required sections present: `version`, `projects`, `limits`, `human_gates`
- `version` is `1.0`
- Enum fields (`projects.naming`, `human_gates.execution_mode`) use valid values
- Limit fields are positive integers
- Hard gates `after_planning` and `after_final_review` are both `true`

### 5. Instructions

Validates `.instructions.md` files:

- Valid frontmatter with a non-empty `applyTo` field
- `applyTo` pattern is consistent with the configured `projects.base_path`

### 6. Prompts

Validates `.prompt.md` files:

- Valid frontmatter with a non-empty `description` field
- `tools` array, if present, contains only valid tool names

### 7. Cross-References

Checks referential integrity across components:

- Agents listed in the Orchestrator's `agents` array exist as discovered agents
- Skills referenced in agent bodies exist in the skills directory
- `projects.base_path` in `orchestration.yml` resolves to an existing directory

## Output Format

Default output groups results by category with color-coded status:

```
✅ Structure: .claude/agents/ exists
✅ Structure: .claude/skills/ exists
⚠️  Skills: skill 'create-agent' has no references/ directory
❌ Cross-refs: agent 'orchestrator' references non-existent subagent 'planner'

Summary: 42 passed, 1 warning, 1 failed
```

Use `--verbose` to expand detail blocks for every check. Use `--quiet` for just the summary line.

## CI Integration

The validator is designed for CI pipelines:

```bash
# Default .claude root shown. Adjust if you configured a custom orch_root.
node .claude/skills/rad-orchestration/validate/validate-orchestration.js --no-color
```

- Exit code `0` means all checks passed
- Exit code `1` means one or more failures (warnings are allowed)
- `--no-color` strips ANSI escape codes for clean logs

## When to Run

Run validation after:
- Adding or renaming agents
- Adding or modifying skills
- Changing `orchestration.yml`
- Modifying instruction files
- Adding prompt files
- Any structural changes to `.claude/` _(or your [configured root](../configuration.md))_

## Next Steps

- [Configuration](../configuration.md) — Understand the settings the validator checks
- [Scripts](scripts.md) — Explore the pipeline CLI and action vocabulary
- [Project Structure](../project-structure.md) — See the workspace layout the validator expects
