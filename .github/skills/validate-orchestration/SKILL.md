---
name: validate-orchestration
description: 'Comprehensive validation of the orchestration system ecosystem. Use when checking if agents, skills, instructions, prompts, and orchestration.yml are valid, catching misconfigurations before they break the pipeline. Validates frontmatter, cross-references, file structure, and exit codes for CI integration.'
---

# Validate Orchestration Skill

A zero-dependency Node.js CLI tool that validates all `{orch_root}/` orchestration files in batch — agents, skills, instructions, prompts, configuration, and cross-references. Produces colored terminal output with category-grouped results, supports flexible verbosity levels, and exits with CI-friendly codes (0 = pass, 1 = fail).

> **Note:** `{orch_root}` is your orchestration root folder — `.github` by default. Set via `system.orch_root` in `orchestration.yml`. See [Configuration](docs/configuration.md).

## When to Use This Skill

- You just created or updated agents, skills, instructions, or prompts and want to verify they're valid
- You modified `orchestration.yml` and need to check for configuration errors
- You're running CI/CD and need automated validation with non-zero exit codes on failure
- You want to debug why a specific agent, skill, or file isn't being recognized
- You're setting up a new orchestration system and want to ensure all files are correct
- You updated cross-references and need to verify they're consistent

## Prerequisites

- Node.js v14+ installed and available in PATH
- Access to the `{orch_root}/` directory in your orchestration workspace
- No external npm dependencies required — uses only Node.js built-ins

## Basic Usage

### Run Full Validation

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js
```

Validates all orchestration files and prints grouped results with a final summary bar.

### Common Workflows

#### Workflow 1: Check Specific Category

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --category structure
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --category agents
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --category cross-references
```

Run validation for one logical grouping. Useful when fixing a specific area. Categories run in dependency order (structure → agents → skills → config → instructions → prompts → cross-refs), so prerequisite checks run silently to ensure cross-reference accuracy.

#### Workflow 2: Verbose Debugging

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --verbose
```

Show detailed output including checksums, file paths, and actual vs. expected values for every check result. Helpful when diagnosing why a file is rejected.

#### Workflow 3: Plain-Text Output (No Colors)

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --no-color
```

Emit plain ASCII output with `[PASS]`, `[FAIL]`, `[WARN]` markers instead of Unicode + ANSI colors. Useful when piping output to log files or non-TTY environments.

#### Workflow 4: Quiet Mode (CI Integration)

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --quiet
```

Print only the final summary bar — pass/fail counts and exit code. Perfect for CI/CD pipelines where you just need the result signal.

#### Workflow 5: Help

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --help
```

Print usage information and exit with code 0.

### Combining Flags

Most flags can combine:

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --verbose --no-color --category agents
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js --quiet --no-color
```

Special case: If both `--verbose` and `--quiet` are provided, `--quiet` wins (only summary bar printed).

## Validation Categories

The tool validates files in this order:

| Category | What It Checks | Exit on Fail? |
|----------|---|---|
| **File Structure** | `{orch_root}/` directories and files exist | Yes, fails fast |
| **Agents** | `.agent.md` frontmatter, tools, agents field consistency | Yes |
| **Skills** | `SKILL.md` exists, frontmatter valid, `templates/` directory | Yes |
| **Configuration** | `orchestration.yml` syntax, field requirements, enum constraints | Yes |
| **Instructions** | `.instructions.md` frontmatter, required fields | Yes |
| **Prompts** | `.prompt.md` frontmatter, required fields | Yes |
| **Cross-References** | Agent-tool consistency, agent-agents consistency, prompt calls valid agents | Yes |

## Understanding Output

### Colored Output (Default)

```
VALIDATOR v1.0  │ Orchestration System Validator

┌─ File Structure ────────────────────────────────────────────
│ ✓ Directory: {orch_root}/agents exists
│ ✓ Directory: {orch_root}/skills exists
│ ✗ File: {orch_root}/orchestration.yml not found
├─ Category Result: 2 pass, 1 fail, 0 warn
└─

┌─ Agents ────────────────────────────────────────────────────
│ ✓ Agent frontmatter: orchestrator.agent.md valid
│ ⚠ Agent tools: deprecated tool name "foo-tool" in coder.agent.md
├─ Category Result: 5 pass, 0 fail, 1 warn
└─

═══════════════════════════════════════════════════════════════
Result: 7 pass, 1 fail, 1 warn  │  Exit: 1 (FAILURES FOUND)
═══════════════════════════════════════════════════════════════
```

### Plain-Text Output (`--no-color`)

```
VALIDATOR v1.0 | Orchestration System Validator

--- File Structure -----------------------------------------------
[PASS] Directory: {orch_root}/agents exists
[PASS] Directory: {orch_root}/skills exists
[FAIL] File: {orch_root}/orchestration.yml not found
--- Category Result: 2 pass, 1 fail, 0 warn ---

--- Agents ---
[PASS] Agent frontmatter: orchestrator.agent.md valid
[WARN] Agent tools: deprecated tool name "foo-tool" in coder.agent.md
--- Category Result: 5 pass, 0 fail, 1 warn ---

=========================================================
Result: 7 pass, 1 fail, 1 warn | Exit: 1 (FAILURES FOUND)
=========================================================
```

### Verbose Mode (Additional Details)

In `--verbose`, each failed check includes `Expected` and `Found` blocks:

```
┌─ Agents ────────────────────────────────────────────────────
│ ✗ Agent frontmatter: coder.agent.md missing required field
│   Expected: Field "tools" must be non-empty array
│   Found: tools = []
├─ Category Result: 2 pass, 1 fail, 0 warn
└─
```

## Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `0` | All checks passed (warnings OK) | Deploy, merge, proceed |
| `1` | One or more checks failed | Halt pipeline, fix issues, retry |

Use exit codes in CI/CD scripts:

```bash
node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js
if [ $? -ne 0 ]; then
  echo "Validation failed — fix errors above and retry."
  exit 1
fi
```

## Troubleshooting

### "File not found" errors

**Problem**: Tool reports missing `{orch_root}/` directories or `orchestration.yml`

**Solutions**:
- Ensure you're running from the workspace root (where `{orch_root}/` exists)
- Check that the tool path is correct: `node {orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js` (not `node lib/validate.js`)
- Verify `{orch_root}/` is not in `.gitignore`

### "Invalid frontmatter" for valid-looking files

**Problem**: Tool rejects `.agent.md`, `.skill.md`, or `.instructions.md` frontmatter

**Solutions**:
- Use `--verbose` to see expected vs. actual values
- Check for trailing whitespace or non-UTF-8 encoding
- Ensure frontmatter is wrapped in exactly `---` markers (lines 1 and N)
- Verify required fields are present and non-empty

### "Unknown tool" warning

**Problem**: Agent's `tools` array contains a tool name the validator doesn't recognize

**Solutions**:
- Check the tool name spelling (case-sensitive)
- Use fully-qualified namespaced tools: `mcp_ns_tool` (not `ns-tool`)
- Verify the tool is listed in the validator's known tools (unlikely to change without validator update)

### Non-TTY output always plain-text

**Problem**: Running using `node ... | tee logfile` loses ANSI colors

**Solutions**:
- This is expected — piped output auto-disables ANSI (TTY detection)
- Use `--no-color` explicitly if you want to force plain-text
- The `NO_COLOR` environment variable also forces plain-text

### Slow validation on large workspaces

**Problem**: Tool takes >5 seconds to validate

**Solutions**:
- Use `--category <name>` to validate only one category
- Check for extremely large files in `{orch_root}/` (shouldn't happen)
- This is unlikely — validator is optimized for the typical orchestration structure

## References

- Orchestration System: `{orch_root}/copilot-instructions.md`
- Configuration Schema: `{orch_root}/orchestration.yml`
- Agent Specification: `{orch_root}/skills/create-agent/SKILL.md`
- Skill Specification: `{orch_root}/skills/create-skill/SKILL.md`
- Validator Source: `{orch_root}/skills/validate-orchestration/scripts/validate-orchestration.js` and `{orch_root}/skills/validate-orchestration/scripts/lib/` directory
