# Orchestration Validator

A static-analysis CLI tool that validates the consistency and correctness of the orchestration system's configuration files, agents, skills, instructions, and cross-references. Run it any time you add, rename, or change orchestration components to catch misconfigurations before they break the pipeline.

---

## Quick Start

```bash
# Run all checks
node .github/skills/validate-orchestration/scripts/validate-orchestration.js

# Show all results including passing checks
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --verbose

# Check a single category
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --category agents

# CI-friendly (no color, exits 1 on any failure)
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --no-color
```

**Exit codes:** `0` = all checks passed (warnings are allowed), `1` = one or more failures.

---

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Print usage and available categories |
| `--verbose` | `-v` | Show passing results in addition to failures and warnings |
| `--quiet` | `-q` | Suppress all output except the final summary line |
| `--no-color` | | Disable ANSI colors (auto-enabled when `NO_COLOR` env var is set or stdout is not a TTY) |
| `--category <name>` | `-c` | Run and display results for a single category only |

Valid category names: `structure`, `agents`, `skills`, `config`, `instructions`, `prompts`, `cross-references`.

> Note: even when `--category` is used, all checks still run internally to build the shared context (e.g. agent discovery) — only the *output* is filtered.

---

## What It Checks

The validator runs seven categories of checks in sequence. Each check produces results tagged as **pass**, **warn**, or **fail**.

### 1. Structure
Verifies that the required `.github/` layout exists:

- Required directories: `.github/agents/`, `.github/skills/`, `.github/instructions/`
- Required files: `.github/orchestration.yml`, `.github/copilot-instructions.md`
- Optional directory (warn if absent): `.github/prompts/`

### 2. Agents
For every `.agent.md` file found in `.github/agents/`:

- Frontmatter is present and parses as valid YAML
- Required frontmatter fields are present (e.g. `name`, `description`, `tools`)
- All entries in the `tools` array are valid toolset names or namespaced tool identifiers
- Deprecated tool names produce a warning
- Skill names referenced in the agent's `## Skills` section are recorded for cross-reference validation

### 3. Skills
For every subdirectory in `.github/skills/`:

- `SKILL.md` file exists inside the directory
- `SKILL.md` has valid frontmatter with required fields
- Markdown links that point into `./templates/` resolve to actual files
- Bare files directly in `.github/skills/` (not inside a subdirectory) produce a warning

### 4. Config
Validates `.github/orchestration.yml`:

- File can be read and parses as valid YAML
- All required top-level sections are present: `version`, `projects`, `limits`, `human_gates`
- Required limit fields are present: `max_phases`, `max_tasks_per_phase`, `max_retries_per_task`, `max_consecutive_review_rejections`
- Enum fields contain only allowed values:
  - `projects.naming`: `SCREAMING_CASE | lowercase | numbered`
  - `human_gates.execution_mode`: `ask | phase | task | autonomous`
- Optional `system.orch_root`: if present, must be a non-empty string (single folder name or absolute path)

### 5. Instructions
For every `.instructions.md` file in `.github/instructions/`:

- File has valid YAML frontmatter
- The `applyTo` glob field is present and non-empty

### 6. Prompts
For every `.prompt.md` file in `.github/prompts/`:

- File has valid YAML frontmatter
- Required frontmatter fields are present
- All `tools` references are valid toolset names or namespaced tool identifiers

### 7. Cross-References
Validates consistency *between* orchestration files using the context built by earlier checks:

- Every agent name listed in the Orchestrator's `agents[]` frontmatter array corresponds to a real discovered agent file
- Every skill name referenced in any agent's `## Skills` section corresponds to a real discovered skill directory
- The `projects.base_path` path in `orchestration.yml` resolves to an existing directory

---

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

In verbose mode (`--verbose`), passing results are also printed. In quiet mode (`--quiet`) only the summary line is shown. When color is disabled, Unicode markers are replaced with `[PASS]`, `[FAIL]`, and `[WARN]`.

---

## Project Layout

```
.github/skills/validate-orchestration/
├── README.md                    ← this file
├── SKILL.md                     ← skill definition (used by the orchestration system)
└── scripts/
    ├── validate-orchestration.js   ← CLI entry point
    └── lib/
        ├── reporter.js             ← formats and prints results
        ├── checks/
        │   ├── structure.js        ← category: structure
        │   ├── agents.js           ← category: agents
        │   ├── skills.js           ← category: skills
        │   ├── config.js           ← category: config
        │   ├── instructions.js     ← category: instructions
        │   ├── prompts.js          ← category: prompts
        │   └── cross-refs.js       ← category: cross-references
        └── utils/
            ├── constants.js        ← valid toolset/tool names, deprecated tools
            ├── frontmatter.js      ← YAML frontmatter extractor
            ├── fs-helpers.js       ← file system utilities
            └── yaml-parser.js      ← safe YAML parser wrapper

.github/orchestration/scripts/tests/   ← test suite
    agents.test.js
    config.test.js
    cross-refs.test.js
    frontmatter.test.js
    ...
```

---

## Running the Tests

Tests use Node's built-in `node:test` runner — no external test framework is required.

```bash
# Run all tests
node .github/orchestration/scripts/tests/agents.test.js
node .github/orchestration/scripts/tests/skills.test.js
# ... etc.

# Or run them all at once (PowerShell)
$files = Get-ChildItem .github/orchestration/scripts/tests/*.test.js | ForEach-Object { $_.FullName }
foreach ($f in $files) { node $f }
```

---

## How to Update the Validator

When the orchestration system changes, the relevant check module needs to be updated. Here's a guide for common scenarios.

### Adding a new required config field
Edit `scripts/lib/checks/config.js`:
- To require a new top-level section, add its name to `REQUIRED_SECTIONS`.
- To require a new field under `limits`, add it to `REQUIRED_LIMIT_FIELDS`.
- To enforce an enum on any dotted key path, add an entry to `ENUM_RULES`.

### Adding a new valid toolset or tool name
Edit `scripts/lib/utils/constants.js`:
- `VALID_TOOLSETS` — add the new toolset string.
- `VALID_NAMESPACED_TOOLS` — add the new `namespace.toolName` string.
- `DEPRECATED_TOOLS` — add old names that should produce a warning instead of a failure.

### Adding a new required agent or skill frontmatter field
Edit the relevant check module (`agents.js` or `skills.js`) and add the field name to the required-fields validation block.

### Adding a new cross-reference rule
Edit `scripts/lib/checks/cross-refs.js`:
1. Write a new helper function (e.g. `checkMyNewRule(agents, skills, config)`).
2. Call it inside the `module.exports` async function and spread its results into `results`.

### Adding a new check category entirely
1. Create a new file in `scripts/lib/checks/` that exports an `async function(basePath, context)` returning an array of result objects.
2. Register it in `scripts/validate-orchestration.js`:
   - Add the category string to the `CATEGORIES` array.
   - Add `{ category: 'my-category', check: require('./lib/checks/my-category') }` to `CHECK_MODULES`.

### Changing the required `.github/` directory structure
Edit `scripts/lib/checks/structure.js` and update the `requiredDirs` or `requiredFiles` arrays. Optional entries can be marked with `optional: true` to produce a warning instead of a failure.

---

## Shared Context

Check modules communicate through a shared `context` object that is passed to every check in sequence. Earlier checks populate it; later checks read from it.

| Property | Populated by | Consumed by |
|----------|-------------|-------------|
| `context.agents` | `agents.js` | `cross-refs.js` |
| `context.skills` | `skills.js` | `cross-refs.js` |
| `context.config` | `config.js` | `cross-refs.js` |
| `context.instructions` | `instructions.js` | *(future use)* |
| `context.prompts` | `prompts.js` | *(future use)* |

Because checks run in the fixed order defined in `CHECK_MODULES`, a check may safely read context populated by any earlier check. The order matters — do not reorder entries in `CHECK_MODULES` without verifying that context dependencies are still satisfied.
