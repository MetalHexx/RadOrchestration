# Validation

The orchestration system includes a zero-dependency Node.js CLI tool that validates the entire ecosystem — agents, skills, instructions, configuration, cross-references, and file structure. Run it any time you add, rename, or change orchestration components to catch misconfigurations before they break the pipeline.

## Quick Start

```bash
# Run all checks
node .github/skills/validate-orchestration/scripts/validate-orchestration.js

# Verbose output (show passing checks too)
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --verbose

# Check a single category
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --category agents

# CI-friendly (no color, exits 1 on failure)
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --no-color
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

Verifies the required `.github/` layout:

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
# In your CI config
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --no-color
```

- Exit code `0` means all checks passed
- Exit code `1` means one or more failures (warnings are allowed)
- `--no-color` strips ANSI escape codes for clean logs

## State Transition Validation

Runtime state validation runs automatically inside `pipeline-engine.js` on every event — there is no separate CLI validator. Before writing `state.json`, the engine calls `validateTransition(currentState, proposedState, config)` from `validator.js`. This function checks ~11 invariants and returns an array of errors:

```javascript
// Signature (from validator.js)
validateTransition(current, proposed, config)
// → ValidationError[]  (empty array means valid)
```

Validation runs once per event, after the mutation. If any invariant fails, the pipeline returns an error result and does **not** write `state.json`.

### Invariant Catalog (V1–V7, V10–V13)

| ID | Name | Check Type | Description |
|----|------|-----------|-------------|
| V1 | Phase index bounds | Proposed-only | `current_phase` must be a valid index into `execution.phases[]` (0 when empty) |
| V2 | Task index bounds | Proposed-only | Each phase's `current_task` must be a valid index into its `tasks[]` (0 when empty, may equal length when all complete) |
| V3 | Phase count match | Proposed-only | `total_phases` matches `phases.length` |
| V4 | Task count match | Proposed-only | `total_tasks` matches `tasks.length` per phase |
| V5 | Config limits | Proposed-only | `phases.length` must not exceed `config.limits.max_phases`; each phase's `tasks.length` must not exceed `config.limits.max_tasks_per_phase` |
| V6 | Execution tier gate | Proposed-only | Execution tier requires `planning.human_approved` to be `true` |
| V7 | Final review gate | Proposed-only | Complete tier with `after_final_review` gate enabled requires `planning.human_approved` to be `true` |
| V10 | Phase-tier consistency | Proposed-only | Active phase status must be consistent with `current_tier` (e.g., no `in_progress` phase during planning tier; all phases `complete` or `halted` during review/complete tier) |
| V11 | Retry monotonicity | Current→Proposed | Task `retries` count must never decrease between transitions |
| V12 | Status transitions | Current→Proposed | Phase and task status changes must follow allowed transition maps (see diagrams below) |
| V13 | Timestamp monotonicity | Current→Proposed | `project.updated` must strictly increase on every write |

### Valid Status Transitions (V12)

**Phase transitions:**

```
not_started → in_progress
in_progress → complete | halted
complete    → (terminal)
halted      → (terminal)
```

**Task transitions:**

```
not_started → in_progress
in_progress → complete | failed | halted
failed      → in_progress  (retry path)
complete    → failed | halted
halted      → (terminal)
```

See [Pipeline Script](scripts.md) for details on the unified pipeline CLI.

## When to Run

Run validation after:
- Adding or renaming agents
- Adding or modifying skills
- Changing `orchestration.yml`
- Modifying instruction files
- Adding prompt files
- Any structural changes to `.github/`
