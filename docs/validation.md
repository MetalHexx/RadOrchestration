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

Runtime state validation runs automatically inside `pipeline-engine.js` on every event — there is no separate CLI validator. Before writing `state.json`, the engine calls `validateTransition(currentState, proposedState, config)` from `validator.js`. This function checks **12 active invariants** and returns an array of errors. It validates both status transitions (V12) and stage transitions (V14/V15) in addition to structural and timestamp checks:

```javascript
/**
 * Validate a v4 state transition.
 * Checks structural invariants (V1, V2, V5–V7, V10, V16),
 * transition invariants (V11–V15), and timestamp monotonicity (V13).
 *
 * @param {StateV4 | null} current - state before mutation (null on init)
 * @param {StateV4} proposed - state after mutation
 * @param {Object} config - parsed orchestration config
 * @returns {ValidationError[]} - empty array means valid
 */
validateTransition(current, proposed, config)
// → ValidationError[]  (empty array means valid)
```

Validation runs once per event, after the mutation. If any invariant fails, the pipeline returns an error result and does **not** write `state.json`.

### Invariant Catalog (12 active)

| ID | Name | Check Type | Description |
|----|------|-----------|-------------|
| V1 | Phase index bounds | Proposed-only | `current_phase` must be within `[1, phases.length]`; 0 when `phases` empty |
| V2 | Task index bounds | Proposed-only | `current_task` must be within `[1, tasks.length]`; 0 when `tasks` empty; may equal `tasks.length + 1` as transient "all tasks processed" state |
| V5 | Config limits | Proposed-only | `phases.length ≤ max_phases`; each `phase.tasks.length ≤ max_tasks_per_phase` |
| V6 | Execution tier gate | Proposed-only | `pipeline.current_tier === 'execution'` requires `planning.human_approved === true` |
| V7 | Final review gate | Proposed-only | `pipeline.current_tier === 'complete'` with `after_final_review` gate requires `final_review.human_approved === true` |
| V10 | Phase-tier consistency | Proposed-only | Active phase status must be consistent with `pipeline.current_tier` (no `in_progress` during planning; all `complete`/`halted` during review/complete) |
| V11 | Retry monotonicity | Current→Proposed | Task `retries` count must never decrease |
| V12 | Status transitions | Current→Proposed | Phase and task status changes must follow allowed transition maps; `complete` is terminal for tasks (no `complete → failed` path) |
| V13 | Timestamp monotonicity | Current→Proposed | `project.updated` must strictly increase |
| V14 | Task stage transitions | Current→Proposed | Task `stage` changes must follow `ALLOWED_TASK_STAGE_TRANSITIONS` |
| V15 | Phase stage transitions | Current→Proposed | Phase `stage` changes must follow `ALLOWED_PHASE_STAGE_TRANSITIONS` |
| V16 | JSON Schema validation | Proposed-only | Structural validation against `state-v4.schema.json` (field types, required fields, enum values) |

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
complete    → (terminal)
halted      → (terminal)
```

> **Note:** `complete` is terminal for tasks. Corrective retries happen via the `stage` field while `status` remains `in_progress` (see V14).

See [Pipeline Script](scripts.md) for details on the unified pipeline CLI.

## When to Run

Run validation after:
- Adding or renaming agents
- Adding or modifying skills
- Changing `orchestration.yml`
- Modifying instruction files
- Adding prompt files
- Any structural changes to `.github/`
