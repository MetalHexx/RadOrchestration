# Validation

The orchestration system includes a zero-dependency Node.js CLI tool that validates the entire ecosystem — agents, skills, instructions, configuration, cross-references, and file structure. Run it any time you add, rename, or change orchestration components to catch misconfigurations before they break the pipeline.

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

## Quick Start

```bash
# Default .github root shown. Adjust if you configured a custom orch_root.

# Run all checks
node .github/skills/orchestration/scripts/validate/validate-orchestration.js

# Verbose output (show passing checks too)
node .github/skills/orchestration/scripts/validate/validate-orchestration.js --verbose

# Check a single category
node .github/skills/orchestration/scripts/validate/validate-orchestration.js --category agents

# CI-friendly (no color, exits 1 on failure)
node .github/skills/orchestration/scripts/validate/validate-orchestration.js --no-color
```

**Exit codes:** `0` = all checks passed (warnings allowed), `1` = one or more failures.

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Print usage and available categories |
| `--verbose` | `-v` | Show passing results in addition to failures and warnings |
| `--quiet` | `-q` | Suppress all output except the final summary line |
| `--no-color` | | Disable ANSI colors (auto-enabled when `NO_COLOR` is set or stdout is not a TTY) |
| `--category <name>` | `-c` | Run and display results for a single category only |

Valid categories: `structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-references`.

> When `--category` is used, all checks still run internally (to build shared context like agent discovery). Only the output is filtered.

## What It Checks

The validator runs seven categories of checks in sequence. Each check produces results tagged as **pass**, **warn**, or **fail**.

### 1. Structure

Verifies the required `.github/` layout _(or your [configured root](configuration.md))_:

- Required directories exist: `agents/`, `skills/`, `instructions/`
- Required files exist: `orchestration.yml`, `copilot-instructions.md`
- No unexpected files in controlled directories

### 2. Agents

Validates all `.agent.md` files:

- Valid YAML frontmatter with required fields
- Tool declarations reference valid tools
- Subagent declarations reference existing agents
- Description is present and non-empty

### 3. Skills

Validates all skill directories:

- Each skill has a `SKILL.md` file
- Valid frontmatter with description
- Referenced scripts and assets exist
- Skill names follow naming conventions

### 4. Config

Validates `orchestration.yml`:

- Valid YAML syntax
- All required keys present with correct types
- Values within allowed ranges
- Error severity categories use valid identifiers
- Human gate settings are valid

### 5. Instructions

Validates `.instructions.md` files:

- Valid frontmatter with `applyTo` pattern
- `applyTo` glob patterns are syntactically valid
- No duplicate instruction files for the same scope

### 6. Prompts

Validates `.prompt.md` files:

- Valid frontmatter
- Required fields present
- Referenced agents exist

### 7. Cross-References

Checks referential integrity across all components:

- Skills referenced by agents actually exist
- Agents referenced as subagents actually exist
- No orphaned skills (defined but never referenced)
- No orphaned agents (defined but never referenced)
- Instruction `applyTo` patterns match at least one file

## Output Format

Default output groups results by category with color-coded status:

```
✅ Structure: .github/agents/ exists
✅ Structure: .github/skills/ exists
⚠️  Skills: skill 'create-agent' has no references/ directory
❌ Cross-refs: agent 'orchestrator' references non-existent subagent 'planner'

Summary: 42 passed, 1 warning, 1 failed
```

Use `--verbose` to see all passing checks. Use `--quiet` for just the summary line.

## CI Integration

The validator is designed for CI pipelines:

```bash
# Default .github root shown. Adjust if you configured a custom orch_root.
node .github/skills/orchestration/scripts/validate/validate-orchestration.js --no-color
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
- Any structural changes to `.github/` _(or your [configured root](configuration.md))_

## Next Steps

- [Configuration](configuration.md) — Understand the settings the validator checks
- [Scripts](scripts.md) — Explore the pipeline CLI and action vocabulary
- [Project Structure](project-structure.md) — See the workspace layout the validator expects
