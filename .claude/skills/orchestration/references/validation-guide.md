# Validation Guide

Reference document for running the orchestration validator. Covers CLI usage, check categories, output format, and troubleshooting.

## Overview

A zero-dependency Node.js CLI tool that validates all `{orch_root}/` orchestration files in batch — agents, skills, instructions, prompts, configuration, and cross-references. Produces colored terminal output with category-grouped results, supports flexible verbosity levels, and exits with CI-friendly codes (0 = pass, 1 = fail).

## When to Run Validation

- You just created or updated agents, skills, instructions, or prompts and want to verify they're valid
- You modified `orchestration.yml` and need to check for configuration errors
- You're running CI/CD and need automated validation with non-zero exit codes on failure
- You want to debug why a specific agent, skill, or file isn't being recognized
- You're setting up a new orchestration system and want to ensure all files are correct
- You updated cross-references and need to verify they're consistent

## Prerequisites

- Node.js v18+ installed and available in PATH
- Access to the `{orch_root}/` directory in your orchestration workspace
- No external npm dependencies required — uses only Node.js built-ins

## CLI Usage

### Run Full Validation

```bash
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js
```

Validates all orchestration files and prints grouped results with a final summary bar.

### CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Print usage and available categories |
| `--verbose` | `-v` | Show passing results in addition to failures and warnings |
| `--quiet` | `-q` | Suppress all output except the final summary line |
| `--no-color` | | Disable ANSI colors (auto-enabled when `NO_COLOR` env var is set or stdout is not a TTY) |
| `--category <name>` | `-c` | Run and display results for a single category only |

Valid category names: `structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-references`.

> Note: even when `--category` is used, all checks still run internally to build the shared context (e.g. agent discovery) — only the *output* is filtered.

### Common Workflows

```bash
# Check a specific category
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --category structure
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --category agents
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --category cross-references

# Verbose debugging
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --verbose

# Plain-text output (CI-friendly)
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --no-color

# Quiet mode (summary only)
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --quiet

# Combining flags
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --verbose --no-color --category agents
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --quiet --no-color
```

Special case: If both `--verbose` and `--quiet` are provided, `--quiet` wins (only summary bar printed).

## Check Categories

The validator runs seven categories of checks in sequence. Each check produces results tagged as **pass**, **warn**, or **fail**.

### 1. Structure

Verifies that the required `{orch_root}/` layout exists:

- Required directories: `{orch_root}/agents/`, `{orch_root}/skills/`, `{orch_root}/instructions/`
- Required files: `{orch_root}/skills/orchestration/config/orchestration.yml`, `{orch_root}/copilot-instructions.md`
- Optional directory (warn if absent): `{orch_root}/prompts/`

### 2. Agents

For every `.agent.md` file found in `{orch_root}/agents/`:

- Frontmatter is present and parses as valid YAML
- Required frontmatter fields are present (e.g. `name`, `description`, `tools`)
- All entries in the `tools` array are valid toolset names or namespaced tool identifiers
- Deprecated tool names produce a warning
- Skill names referenced in the agent's `## Skills` section are recorded for cross-reference validation

### 3. Skills

For every subdirectory in `{orch_root}/skills/`:

- `SKILL.md` file exists inside the directory
- `SKILL.md` has valid frontmatter with required fields
- Markdown links that point into `./templates/` resolve to actual files
- Bare files directly in `{orch_root}/skills/` (not inside a subdirectory) produce a warning

### 4. Config

Validates `orchestration.yml`:

- File can be read and parses as valid YAML
- All required top-level sections are present: `version`, `projects`, `limits`, `human_gates`
- Required limit fields: `max_phases`, `max_tasks_per_phase`, `max_retries_per_task`, `max_consecutive_review_rejections`
- Enum fields: `projects.naming` (`SCREAMING_CASE | lowercase | numbered`), `human_gates.execution_mode` (`ask | phase | task | autonomous`)
- Optional `system.orch_root`: if present, must be a non-empty string

### 5. Instructions

For every `.instructions.md` file in `{orch_root}/instructions/`:

- File has valid YAML frontmatter
- The `applyTo` glob field is present and non-empty

### 6. Prompts

For every `.prompt.md` file in `{orch_root}/prompts/`:

- File has valid YAML frontmatter
- Required frontmatter fields are present
- All `tools` references are valid toolset names or namespaced tool identifiers

### 7. Cross-References

Validates consistency between orchestration files using context built by earlier checks:

- Every agent name in the Orchestrator's `agents[]` frontmatter array corresponds to a real discovered agent file
- Every skill name referenced in any agent's `## Skills` section corresponds to a real discovered skill directory
- `projects.base_path` in `orchestration.yml` resolves to an existing directory

## Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `0` | All checks passed (warnings OK) | Deploy, merge, proceed |
| `1` | One or more checks failed | Halt pipeline, fix issues, retry |

Use exit codes in CI/CD scripts:

```bash
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js
if [ $? -ne 0 ]; then
  echo "Validation failed — fix errors above and retry."
  exit 1
fi
```

## Output Format

Results are grouped by category. Each line shows a status marker, the file name, and a message:

```
┌──────────────────────────────────────────────
│  Orchestration Validator v1.0.0
└──────────────────────────────────────────────

── Agents ──────────────────────────────────────
  ✗  orchestrator.agent.md   Orchestrator references unknown agent: Foobar
  ⚠  coder.agent.md          Deprecated tool: "vscode"

── Cross-References ─────────────────────────────
  ✗  orchestrator.agent.md   Orchestrator → Foobar reference valid

══════════════════════════════════════════════════
  2 failed   1 warning   18 passed
══════════════════════════════════════════════════
```

In verbose mode (`--verbose`), passing results are also printed with expected/found details. In quiet mode (`--quiet`), only the summary line is shown. With `--no-color`, Unicode markers are replaced with `[PASS]`, `[FAIL]`, `[WARN]`.

## Shared Context

Check modules communicate through a shared `context` object passed to every check in sequence:

| Property | Populated by | Consumed by |
|----------|-------------|-------------|
| `context.agents` | `agents.js` | `cross-refs.js` |
| `context.skills` | `skills.js` | `cross-refs.js` |
| `context.config` | `config.js` | `cross-refs.js` |
| `context.instructions` | `instructions.js` | *(future use)* |
| `context.prompts` | `prompts.js` | *(future use)* |

Checks run in the fixed order defined in the validator entry point. Do not reorder categories without verifying context dependencies are still satisfied.

## Troubleshooting

### "File not found" errors

**Problem**: Tool reports missing `{orch_root}/` directories or `orchestration.yml`

**Solutions**:
- Ensure you're running from the workspace root (where `{orch_root}/` exists)
- Check that the tool path is correct: `node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js`
- Verify `{orch_root}/` is not in `.gitignore`

### "Invalid frontmatter" for valid-looking files

**Problem**: Tool rejects `.agent.md`, `.skill.md`, or `.instructions.md` frontmatter

**Solutions**:
- Use `--verbose` to see expected vs. actual values
- Check for trailing whitespace or non-UTF-8 encoding
- Ensure frontmatter is wrapped in exactly `---` markers (lines 1 and N)
- Verify required fields are present and non-empty

### Non-TTY output always plain-text

**Problem**: Running using `node ... | tee logfile` loses ANSI colors

**Solutions**:
- This is expected — piped output auto-disables ANSI (TTY detection)
- Use `--no-color` explicitly if you want to force plain-text
- The `NO_COLOR` environment variable also forces plain-text
