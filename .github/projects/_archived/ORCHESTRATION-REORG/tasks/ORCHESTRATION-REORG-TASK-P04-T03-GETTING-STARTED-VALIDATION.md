---
project: "ORCHESTRATION-REORG"
phase: 4
task: 3
title: "Update docs/getting-started.md & docs/validation.md"
status: "pending"
skills_required: ["file-editing"]
skills_optional: []
estimated_files: 2
---

# Update docs/getting-started.md & docs/validation.md

## Objective

Update two documentation files to reflect the post-reorg single-directory distribution model. Remove the `src/` copy instruction from `docs/getting-started.md` and update the stale `src/validate-state.js` CLI path in `docs/validation.md` to `.github/orchestration/scripts/validate-state.js`.

## Context

The repository restructure moved all CLI scripts from `src/` into `.github/orchestration/scripts/`. The distribution model is now single-directory: users only need to copy `.github/` into their workspace — the scripts live inside it. Two docs files still reference the old `src/` paths and must be corrected.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/getting-started.md` | Remove `src/` copy instruction; single-directory message |
| MODIFY | `docs/validation.md` | Update 1 CLI path reference in State Validation section |

## Implementation Steps

1. **Open `docs/getting-started.md`** and locate step 3 under "## Installation" (the "Copy into your project" step).

2. **Replace the multi-directory copy instruction** with a single-directory version:
   - **Current text (lines to replace):**
     ```
     Copy the `.github/` and `src/` directories into the root of your target project. The `.github/` folder contains all agents, skills, instructions, and configuration. The `src/` folder contains the deterministic CLI scripts.
     ```
   - **New text:**
     ```
     Copy the `.github/` directory into the root of your target project. It contains all agents, skills, instructions, configuration, and deterministic CLI scripts.
     ```

3. **Verify** no other occurrences of `src/` remain in `docs/getting-started.md`. The file should contain zero `src/` path references after the edit.

4. **Open `docs/validation.md`** and locate the "## State Validation" section near the bottom of the file.

5. **Replace the stale CLI path** in the code block:
   - **Current text:**
     ```
     node src/validate-state.js --current path/to/current.json --proposed path/to/proposed.json
     ```
   - **New text:**
     ```
     node .github/orchestration/scripts/validate-state.js --current path/to/current.json --proposed path/to/proposed.json
     ```

6. **Verify** no other occurrences of `src/` remain in `docs/validation.md`. The file should contain zero `src/` path references after the edit.

## Current File Contents

### docs/getting-started.md (full)

```markdown
# Getting Started

This guide walks you through setting up the orchestration system and running your first project.

## Prerequisites

- **Node.js v18+** — powers the CLI scripts and validation tool (no `npm install` required)
- **VS Code** with **GitHub Copilot** and agent mode enabled
- A workspace where you want to run orchestrated projects

## Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd orchestration
   ```

2. **Open in VS Code** with GitHub Copilot enabled

3. **Copy into your project** (if using in an existing workspace)

   Copy the `.github/` and `src/` directories into the root of your target project. The `.github/` folder contains all agents, skills, instructions, and configuration. The `src/` folder contains the deterministic CLI scripts.

4. **Configure the system**

   Run the `/configure-system` prompt in Copilot. This creates or updates `.github/orchestration.yml` with your preferences — project storage path, pipeline limits, git strategy, and human gate settings.

   Or manually edit `.github/orchestration.yml` — see [Configuration](configuration.md) for all options.

## Your First Project

### Option A: Start with Brainstorming

If you have a rough idea but want to explore it first:

1. Open Copilot chat and invoke `@Brainstormer`
2. Describe your idea — the Brainstormer will ask questions, explore trade-offs, and help you converge on a clear concept
3. The output is a `BRAINSTORMING.md` document in your project folder
4. Then invoke `@Orchestrator` — it will pick up the brainstorming document and start the pipeline

### Option B: Start Directly

If you already know what you want to build:

1. Open Copilot chat and invoke `@Orchestrator`
2. Describe your project: *"Build me a REST API for managing inventory with auth, CRUD operations, and a React dashboard"*
3. The Orchestrator initializes the project and begins the planning pipeline

### What Happens Next

The Orchestrator automatically sequences agents through the pipeline:

1. **Research** — analyzes your codebase, tech stack, and relevant patterns
2. **Product Manager** — creates a PRD with requirements, user stories, and success metrics
3. **UX Designer** — produces a design document with flows, layouts, and accessibility specs
4. **Architect** — defines system architecture, module structure, API contracts, and interfaces
5. **Architect** — synthesizes everything into a Master Plan with phased execution
6. **Human gate** — you review and approve the Master Plan before any code is written

After approval, execution begins:

7. **Tactical Planner** — breaks each phase into concrete tasks
8. **Coder** — executes tasks from self-contained handoff documents
9. **Reviewer** — reviews code against the plan
10. Loop until all phases are complete, then final review and human approval

## Continuing a Project

To resume a project that's already in progress:

```
@Orchestrator continue the project
```

The Orchestrator reads `state.json` to determine exactly where the pipeline left off and spawns the appropriate agent. The deterministic [Next-Action Resolver](scripts.md) ensures consistent routing regardless of how many times you resume.

## Checking Status

```
@Orchestrator what's the project status?
```

The Orchestrator reads `STATUS.md` — a human-readable summary that's updated after every significant event (task completion, phase advance, error, halt).

## Running Validation

Validate that all orchestration files are correctly configured:

```bash
node .github/skills/validate-orchestration/scripts/validate-orchestration.js
```

Add `--verbose` for detailed output, or `--category agents` to check a single category. See [Validation](validation.md) for full CLI options.

## Key Commands

| Command | What It Does |
|---------|-------------|
| `@Brainstormer` + idea | Collaboratively explore and refine a project idea |
| `@Orchestrator` + idea | Start a new project through the full pipeline |
| `@Orchestrator` continue | Resume an in-progress project |
| `@Orchestrator` status | Check current project status |
| `/configure-system` | Create or update `orchestration.yml` |
| `/execute-plan` | Approve a Master Plan and begin execution |
| `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` | Validate orchestration files |

## Next Steps

- [Agents](agents.md) — understand the 9 specialized agents and their roles
- [Pipeline](pipeline.md) — learn how the planning and execution pipeline works
- [Configuration](configuration.md) — customize pipeline behavior via `orchestration.yml`
- [Project Structure](project-structure.md) — understand the file layout and naming conventions
```

### docs/validation.md (full)

```markdown
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

## State Validation

For runtime state validation (checking `state.json` transitions), use the separate [State Transition Validator](scripts.md):

```bash
node src/validate-state.js --current path/to/current.json --proposed path/to/proposed.json
```

This checks all 15 invariants (V1–V15) and is called by the Tactical Planner before every state write. See [Deterministic Scripts](scripts.md) for details.

## When to Run

Run validation after:
- Adding or renaming agents
- Adding or modifying skills
- Changing `orchestration.yml`
- Modifying instruction files
- Adding prompt files
- Any structural changes to `.github/`
```

## Contracts & Interfaces

N/A — this task modifies documentation files only. No code interfaces or contracts apply.

## Styles & Design Tokens

N/A — no UI components involved.

## Test Requirements

- [ ] **Grep `docs/getting-started.md` for `src/`** — expect 0 matches as a path prefix (i.e., no `src/` directory references)
- [ ] **Grep `docs/validation.md` for `src/`** — expect 0 matches as a path prefix
- [ ] **Verify `docs/getting-started.md`** contains the text "Copy the `.github/` directory into the root of your target project"
- [ ] **Verify `docs/validation.md`** contains the text `node .github/orchestration/scripts/validate-state.js`
- [ ] **Both files render correctly** in Markdown preview (no broken formatting)

## Acceptance Criteria

- [ ] `docs/getting-started.md` step 3 says "Copy the `.github/` directory" — no `src/` copy instruction
- [ ] `docs/getting-started.md` explanation references single-directory distribution (`.github/` contains scripts)
- [ ] `docs/getting-started.md` contains zero `src/` path references
- [ ] `docs/validation.md` State Validation code block uses `node .github/orchestration/scripts/validate-state.js`
- [ ] `docs/validation.md` contains zero `src/` path references
- [ ] Neither file has broken Markdown formatting
- [ ] All existing content (sections, links, tables) outside the changed lines is preserved exactly

## Constraints

- Do NOT modify any sections other than the ones specified (step 3 in getting-started.md, State Validation code block in validation.md)
- Do NOT add new sections or remove existing sections
- Do NOT change link targets or table formatting outside the specified edits
- Do NOT touch any other files — scope is limited to `docs/getting-started.md` and `docs/validation.md`
