---
project: "SCRIPT-SIMPLIFY-AGENTS"
author: "research-agent"
created: "2026-03-12T00:00:00Z"
---

# SCRIPT-SIMPLIFY-AGENTS — Research Findings

## Research Scope

Investigated the orchestration system's scripts, agents, skills, state management, documentation, and test infrastructure to gather context for refactoring the control flow into a unified event-driven pipeline script. Focused on understanding what exists today, how components interact, and what each change in the brainstorming document touches.

---

## 1. Existing Scripts

### Directory Structure

```
.github/orchestration/scripts/
├── next-action.js            # CLI: Next-Action Resolver (82 lines)
├── triage.js                 # CLI: Triage Executor (115 lines)
├── validate-state.js         # CLI: State Validator (84 lines)
├── lib/
│   ├── constants.js          # Shared enums, JSDoc types (260 lines)
│   ├── resolver.js           # Pure resolver function (495 lines)
│   ├── state-validator.js    # 15-invariant validator (500 lines)
│   └── triage-engine.js      # Decision table engine (526 lines)
└── tests/
    ├── constants.test.js     # Enum freeze/export tests (343 lines)
    ├── resolver.test.js      # ~35 action paths (794 lines)
    ├── state-validator.test.js # V1–V15 (709 lines)
    ├── triage-engine.test.js # 11+5 row coverage (747 lines)
    ├── next-action.test.js   # CLI arg parsing + E2E (290 lines)
    ├── triage.test.js        # CLI arg parsing (80 lines)
    ├── validate-state.test.js # CLI E2E (243 lines)
    ├── agents.test.js
    ├── config.test.js
    ├── cross-refs.test.js
    ├── frontmatter.test.js
    ├── fs-helpers.test.js
    ├── instructions.test.js
    ├── prompts.test.js
    ├── reporter.test.js
    ├── skills.test.js
    ├── structure.test.js
    └── yaml-parser.test.js
```

### CLI Entry Points — Interfaces

| Script | CLI Flags | Input | Output | Exit Codes |
|--------|-----------|-------|--------|------------|
| `next-action.js` | `--state <path>` `--config <path>` (optional) | `state.json`, `orchestration.yml` | `{ action, context }` JSON to stdout | 0=success, 1=error |
| `triage.js` | `--state <path>` `--level task\|phase` `--project-dir <path>` | `state.json`, review/report docs | `{ success, level, verdict, action, ... }` JSON to stdout; writes updated `state.json` on success | 0=success, 1=error |
| `validate-state.js` | `--current <path>` `--proposed <path>` | Two `state.json` objects | `{ valid, invariants_checked, errors? }` JSON to stdout | 0=valid, 1=invalid |

### CLI Dependency Map

| CLI Entry Point | Imports from `lib/` | Imports from `validate-orchestration` utils |
|-----------------|---------------------|---------------------------------------------|
| `next-action.js` | `resolver.resolveNextAction` | `fs-helpers.readFile`, `fs-helpers.exists`, `yaml-parser.parseYaml` |
| `triage.js` | `triage-engine.executeTriage`, `constants.TRIAGE_LEVELS` | `fs-helpers.readFile`, `frontmatter.extractFrontmatter` |
| `validate-state.js` | `state-validator.validateTransition` | `fs-helpers.readFile` |

### Lib Module Dependency Map

| Lib Module | Imports |
|------------|---------|
| `constants.js` | None (leaf module) |
| `resolver.js` | `constants.js` only |
| `state-validator.js` | `constants.js` only |
| `triage-engine.js` | `constants.js` only |

**Key observation**: All three lib modules are pure functions with zero I/O and depend only on `constants.js`. The CLI entry points handle all filesystem I/O. `triage-engine.js` uses dependency injection (`readDocument` callback) for document reading. `triage.js` (CLI) is the only script that **writes** to `state.json` — it applies the triage verdict/action and writes atomically with `fs.writeFileSync`.

### Shared Utilities (from `validate-orchestration` skill)

The scripts import filesystem and parsing utilities from `.github/skills/validate-orchestration/scripts/lib/utils/`:

| Utility | Exports Used | Used By |
|---------|-------------|---------|
| `fs-helpers.js` | `readFile`, `exists` | All 3 CLI scripts |
| `yaml-parser.js` | `parseYaml` | `next-action.js` |
| `frontmatter.js` | `extractFrontmatter` | `triage.js` |

---

## 2. State Management

### state.json Schema (from `constants.js` JSDoc types + `state-json-schema.md`)

**Top-level structure:**

| Section | Fields |
|---------|--------|
| `project` | `name`, `created` (ISO 8601), `updated` (ISO 8601) |
| `pipeline` | `current_tier`, `human_gate_mode` |
| `planning` | `status`, `steps` (5 planning steps), `human_approved` |
| `execution` | `status`, `current_phase` (0-based), `total_phases`, `phases[]` |
| `final_review` | `status`, `report_doc`, `human_approved` |
| `errors` | `total_retries`, `total_halts`, `active_blockers[]` |
| `limits` | `max_phases`, `max_tasks_per_phase`, `max_retries_per_task` |

**Enum values (from `constants.js`):**

| Enum | Values |
|------|--------|
| `PIPELINE_TIERS` | `planning`, `execution`, `review`, `complete`, `halted` |
| `PLANNING_STATUSES` | `not_started`, `in_progress`, `complete` |
| `PLANNING_STEP_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `skipped` |
| `PHASE_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` |
| `TASK_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` |
| `REVIEW_VERDICTS` | `approved`, `changes_requested`, `rejected` |
| `REVIEW_ACTIONS` | `advanced`, `corrective_task_issued`, `halted` |
| `PHASE_REVIEW_ACTIONS` | `advanced`, `corrective_tasks_issued`, `halted` |
| `SEVERITY_LEVELS` | `minor`, `critical` |
| `HUMAN_GATE_MODES` | `ask`, `phase`, `task`, `autonomous` |
| `TRIAGE_LEVELS` | `task`, `phase` |
| `NEXT_ACTIONS` | 35 values (full closed enum) |

**Allowed task status transitions (from `state-validator.js`):**

| From | To |
|------|-----|
| `not_started` | `in_progress` |
| `in_progress` | `complete`, `failed`, `halted` |
| `complete` | *(terminal)* |
| `failed` | `in_progress` (retry path) |
| `halted` | *(terminal)* |

**15 Invariants (from `state-validator.js`):**

| ID | Check | Against |
|----|-------|---------|
| V1 | `current_phase` index bounds | proposed only |
| V2 | `current_task` index bounds | proposed only |
| V3 | Retry limit (`task.retries <= max_retries_per_task`) | proposed only |
| V4 | Max phases (`phases.length <= max_phases`) | proposed only |
| V5 | Max tasks per phase | proposed only |
| V6 | Single `in_progress` task across project | proposed only |
| V7 | Human approval before execution tier | proposed only |
| V8 | Task triage consistency (`review_doc` set → `review_verdict` must be set) | proposed only |
| V9 | Phase triage consistency (`phase_review` set → `phase_review_verdict` must be set) | proposed only |
| V10 | Structural validation (required top-level keys) | proposed only |
| V11 | Retry monotonicity (never decrease) | current → proposed |
| V12 | Task status transitions (allowed paths only) | current → proposed |
| V13 | Timestamp monotonicity (`project.updated` must increase) | current → proposed |
| V14 | Write ordering (no simultaneous `review_doc` + verdict/action change) | current → proposed |
| V15 | Cross-task immutability (only one task's verdict/action changes per write) | current → proposed |

### `state-json-schema.md` (to be eliminated)

- **Location**: `.github/orchestration/schemas/state-json-schema.md` (219 lines)
- **Contents**: Full JSON schema definition, field reference, enum descriptions, state transition pseudocode
- **Overlap with code**: The schema duplicates `constants.js` (types, enums), `state-validator.js` (invariants), and `resolver.js` (transition pseudocode). The validator implements 15 invariants; the schema documents 10 in the invariant list and some in the pseudocode.
- **Only consumer**: The document is referenced in `docs/project-structure.md` (workspace layout tree). No agent imports or loads it at runtime.

### `state-management.instructions.md` (to be eliminated)

- **Location**: `.github/instructions/state-management.instructions.md`
- **`applyTo`**: `**/state.json,**/*STATUS.md`
- **Contents** (6 sections):
  1. Sole Writer declaration (Tactical Planner)
  2. `state.json` invariants (subset of V1–V15)
  3. `STATUS.md` rules
  4. Pipeline tier ordering
  5. Error severity definitions
  6. Pre-write validation workflow (CLI interface, output format, required steps, failure behavior)
- **Post-refactor status**: Every section becomes wrong or redundant:
  - Sole writer changes from Tactical Planner → pipeline script
  - Invariants are in `state-validator.js` (more complete)
  - `STATUS.md` is eliminated
  - Pipeline tiers are in `constants.js`
  - Error severity is in `orchestration.yml` and `constants.js`
  - Pre-write validation is internalized by the pipeline engine
- **`applyTo` pattern**: Targets files no agent writes directly post-refactor

### `schemas/` directory

- **Location**: `.github/orchestration/schemas/`
- **Contents**: Only `state-json-schema.md`
- **Post-deletion**: Directory becomes empty and can be removed

---

## 3. Tactical Planner Agent

### File

`.github/agents/tactical-planner.agent.md` (~240 lines)

### Frontmatter

```yaml
tools: [read, search, edit, todo, execute]
agents: []
```

### Modes

| Mode | Name | Type | Description |
|------|------|------|-------------|
| 1 | Initialize Project | Mechanical | Create project folder, subdirectories (`phases/`, `tasks/`, `reports/`), scaffold `state.json` from template, create `STATUS.md` |
| 2 | Update State | Mechanical | Read current `state.json`, apply mutation based on Orchestrator instruction, validate with `validate-state.js`, write, update `STATUS.md` |
| 3 | Create Phase Plan | **Mixed** | Read triage result from `state.json` (or call `triage.js --level phase`) → produce Phase Plan document. Triage step = mechanical; planning step = judgment |
| 4 | Create Task Handoff | **Mixed** | Read triage result from `state.json` (or call `triage.js --level task`) → produce Task Handoff document. Triage step = mechanical; planning step = judgment |
| 5 | Generate Phase Report | Judgment | Aggregate task reports, assess exit criteria, identify carry-forward items |

### Mechanical vs. Judgment Breakdown

| Responsibility | Category | Post-Refactor Owner |
|---------------|----------|---------------------|
| Create project directories and scaffold `state.json` | Mechanical | Pipeline script (`start` event / init) |
| Create `STATUS.md` | Mechanical | **Eliminated** |
| Apply state mutations (task complete, phase advance, tier transition, etc.) | Mechanical | Pipeline script (event handlers) |
| Call `validate-state.js` before writes | Mechanical | Pipeline script (internal) |
| Update `STATUS.md` after every event | Mechanical | **Eliminated** |
| Call `triage.js` and route based on result | Mechanical | Pipeline script (triage step) |
| Write `review_verdict`/`review_action` to state | Mechanical | Pipeline script (triage step) |
| Read Master Plan + Architecture + Design → produce Phase Plan | Judgment | **Stays** — Tactical Planner Mode 3 (simplified) |
| Read Phase Plan + Architecture + Design → produce Task Handoff | Judgment | **Stays** — Tactical Planner Mode 4 (simplified) |
| Read corrective context from reviews → produce corrective handoff | Judgment | **Stays** — Tactical Planner Mode 4 |
| Aggregate task reports → produce Phase Report | Judgment | **Stays** — Tactical Planner Mode 5 |

### Skills Referenced

| Skill | Usage |
|-------|-------|
| `create-phase-plan` | Mode 3 — phase plan creation |
| `create-task-handoff` | Mode 4 — handoff creation |
| `generate-phase-report` | Mode 5 — phase report aggregation |
| `triage-report` | Modes 3 & 4 — documentation-only reference for triage decision tables |

### Tool Access

- `execute` tool is used to call `triage.js` and `validate-state.js` via terminal
- Post-refactor: The Planner should lose `execute` since it won't call scripts. It retains `read`, `search`, `edit` (for writing planning docs), and `todo`.

---

## 4. Orchestrator Agent

### File

`.github/agents/orchestrator.agent.md` (~290 lines)

### Frontmatter

```yaml
tools: [read, search, agent, execute]
agents: [Research, Product Manager, UX Designer, Architect, Tactical Planner, Coder, Reviewer]
```

### Current Decision Loop

1. Read `state.json` + `STATUS.md`
2. Call `next-action.js --state <path> --config <path>` → parse JSON result
3. Pattern-match on `result.action` → spawn appropriate agent per 35-entry action table
4. Track `triage_attempts` counter (runtime-local, not persisted)
5. After spawned agent completes → re-read state → re-run script → loop

### Action Table (35 actions → agent mapping)

The current action table maps all 35 `NEXT_ACTIONS` enum values to agent spawns, human gates, or display actions. Key categories:

| Category | Actions | Count |
|----------|---------|-------|
| Planning — agent spawns | `spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan` | 5 |
| Planning — transitions/gates | `init_project`, `request_plan_approval`, `transition_to_execution` | 3 |
| Execution — Tactical Planner spawns | `create_phase_plan`, `create_task_handoff`, `update_state_from_task`, `update_state_from_review`, `update_state_from_phase_review`, `create_corrective_handoff` | 6 |
| Execution — Coder spawn | `execute_task` | 1 |
| Execution — Reviewer spawns | `spawn_code_reviewer`, `spawn_phase_reviewer` | 2 |
| Execution — triage | `triage_task`, `triage_phase` | 2 |
| Execution — triage halts | `halt_triage_invariant`, `halt_phase_triage_invariant` | 2 |
| Execution — post-triage routing | `retry_from_review`, `halt_from_review`, `advance_task`, `advance_phase` | 4 |
| Execution — gates | `gate_task`, `gate_phase` | 2 |
| Execution — halt/report | `halt_task_failed`, `generate_phase_report` | 2 |
| Execution — tier transition | `transition_to_review` | 1 |
| Review tier | `spawn_final_reviewer`, `request_final_approval`, `transition_to_complete` | 3 |
| Terminal | `display_halted`, `display_complete` | 2 |

**Actions that are purely mechanical state mutations** (would be internalized by pipeline script):

`init_project`, `transition_to_execution`, `update_state_from_task`, `update_state_from_review`, `update_state_from_phase_review`, `triage_task`, `triage_phase`, `halt_triage_invariant`, `halt_phase_triage_invariant`, `retry_from_review`, `halt_from_review`, `advance_task`, `advance_phase`, `halt_task_failed`, `transition_to_review`, `transition_to_complete`, `create_corrective_handoff` (partial — state mutation portion)

**Post-refactor Orchestrator actions (~18 remaining):**

Actions requiring agent spawns, human interaction, or display:
- Agent spawns: `spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan`, `create_phase_plan`, `create_task_handoff`, `execute_task`, `spawn_code_reviewer`, `spawn_phase_reviewer`, `generate_phase_report`, `spawn_final_reviewer`
- Human gates: `request_plan_approval`, `request_final_approval`, `gate_task`, `gate_phase`
- Display/terminal: `display_halted`, `display_complete`

### `triage_attempts` Counter

- Currently: runtime-local variable, initialized to 0, incremented on `triage_task`/`triage_phase`, reset on `advance_task`/`advance_phase`, halt if > 1
- Vulnerability: Lost on context compaction (agent restart)
- Post-refactor: Persisted in `state.json`, managed by pipeline script

---

## 5. Triage Skill

### File

`.github/skills/triage-report/SKILL.md` (~210 lines)

### Contents

| Section | Content | Post-Refactor Disposition |
|---------|---------|---------------------------|
| Execution Authority Notice | Warning that `triage.js` is the authoritative executor | Irrelevant — skill is deleted |
| Invocation Context | Embedded in Tactical Planner Mode 3 and Mode 4 | Planner no longer runs triage |
| Mode 4 — Task-Level Triage Read Sequence | 2-step read: task report → code review | Moves to pipeline script |
| Task-Level Decision Table (11 rows) | Conditions → verdict/action mapping | Already in `triage-engine.js` code |
| Row Clarifications | Row 10/11 retry budget, Row 1/7 no-review-doc | Already in `triage-engine.js` code |
| Mode 3 — Phase-Level Triage Read Sequence | 2-step read: phase report → phase review | Moves to pipeline script |
| Phase-Level Decision Table (5 rows) | Conditions → verdict/action mapping | Already in `triage-engine.js` code |
| State Write Contract | Which fields, allowed values, transcription rules | Moves to pipeline script + `constants.js` |
| Write Ordering | Verdict/action before `handoff_doc` | Enforced by pipeline script |
| Immutability | Verdict/action indexed by task/phase number | Enforced by `state-validator.js` (V15) |
| Error Handling | DOCUMENT_NOT_FOUND, INVALID_VERDICT | Already in `triage-engine.js` code |

### What Useful Content Survives Deletion

Only the **Planner-relevant planning guidance** — i.e., "if `review_action` is `corrective_task_issued`, read the code review Issues table and create a corrective handoff targeting those issues." This context folds into:

- `create-task-handoff` skill: Add a "Prior Context" section describing how to read `review_action` from `state.json` and, if corrective, read the code review to extract issues
- `create-phase-plan` skill: Add a similar section for reading `phase_review_action` and extracting cross-task issues from the phase review

---

## 6. Related Skills

### `create-task-handoff` (`SKILL.md`)

- **Current state**: No reference to triage, `review_action`, or corrective context. The workflow lists inputs (Phase Plan, Architecture, Design, Previous Task Report) but does not describe how to handle corrective paths.
- **Change needed**: Add a "Prior Context / Corrective Handling" section that instructs the Planner to read `state.json → task.review_action`. If `corrective_task_issued`, read the code review at `task.review_doc` and extract the Issues table to drive the corrective handoff.

### `create-phase-plan` (`SKILL.md`)

- **Current state**: Inputs include state.json and Previous Phase Report, but no reference to `phase_review_action` or corrective routing.
- **Change needed**: Add a similar "Prior Context / Corrective Handling" section for reading `phase_review_action` from `state.json` and extracting cross-task issues from the phase review.

### `generate-phase-report` (`SKILL.md`)

- **Current state**: Reads Phase Plan, all Task Reports, all Code Reviews, state.json. Purely an aggregation skill.
- **Change needed**: None structurally. The skill does not reference triage, state management, or `STATUS.md`. Its inputs and outputs remain the same.

### `review-code` (`SKILL.md`) — to become `review-task`

- **Current state**: Named `review-code`, skill directory `.github/skills/review-code/`.
- **Referenced by**: `reviewer.agent.md` (lines 60, 99), `docs/skills.md`, `docs/agents.md`
- **Change needed**: Rename skill directory to `review-task`, update SKILL.md name/description, update all cross-references (reviewer agent, docs)

### `review-phase` (`SKILL.md`)

- **Current state**: No triage or state management references. Inputs: Phase Plan, Task Reports, Code Reviews, Architecture, Design, PRD, Source Code.
- **Change needed**: None. Unaffected by this refactor.

---

## 7. Documentation

### Files Requiring Updates

| File | Path | Reason |
|------|------|--------|
| **README.md** | `README.md` (159 lines) | References: Tactical Planner as state authority, 3 scripts, triage executor, sole writer policy mentioning Tactical Planner |
| **Agents** | `docs/agents.md` (~200 lines) | Describes Tactical Planner's 7 modes (init, update state, triage, phase plan, task handoff, phase report), references `STATUS.md`, lists `triage-report` skill, calls Tactical Planner "sole writer" |
| **Pipeline** | `docs/pipeline.md` (208 lines) | Describes execution loop with state update steps, triage executor, triage attempts, `STATUS.md` references |
| **Scripts** | `docs/scripts.md` (339 lines) | Documents all 3 standalone scripts, 35-action vocabulary, task/phase decision tables, write behavior for triage, invariant catalog. **Major rewrite needed — the 3-script architecture is replaced** |
| **Skills** | `docs/skills.md` (~200 lines) | Lists `triage-report` skill, skill-agent composition table includes triage in Tactical Planner row, `review-code` name |
| **Project Structure** | `docs/project-structure.md` (215 lines) | Shows `schemas/` directory with `state-json-schema.md`, `STATUS.md` in project folder, state management section, scoped instructions table references `state-management.instructions.md` |
| **Configuration** | `docs/configuration.md` | References may mention Tactical Planner as state writer |
| **Validation** | `docs/validation.md` | May reference `state-management.instructions.md` or `state-json-schema.md` |
| **Getting Started** | `docs/getting-started.md` | May reference `STATUS.md` or Tactical Planner state management |
| **copilot-instructions.md** | `.github/copilot-instructions.md` | States "Only the Tactical Planner writes `state.json` and `STATUS.md`", references `STATUS.md` |
| **project-docs.instructions.md** | `.github/instructions/project-docs.instructions.md` | Lists `state.json` and `STATUS.md` sole writer as Tactical Planner |

### Agent Definitions Requiring Updates

| Agent File | Changes Needed |
|------------|---------------|
| `tactical-planner.agent.md` | Remove Modes 1 & 2. Remove `execute` tool. Remove `STATUS.md` references. Remove triage steps from Modes 3 & 4. Remove `triage-report` skill reference. Strip state mutation prose. Update description/role. |
| `orchestrator.agent.md` | Replace `next-action.js` + action table with `pipeline.js` event-driven loop. Shrink action table from 35 to ~18. Add `triage_attempts` from `state.json` instead of runtime counter. Remove `STATUS.md` references. |
| `reviewer.agent.md` | Update `review-code` skill reference to `review-task`. |
| All other agents (7) | Remove "only the Tactical Planner does that" `STATUS.md` reference from constraints. |

---

## 8. Test Suites

### Framework

All tests use **Node.js built-in `node:test`** module with `node:assert`. Zero external testing dependencies.

### Test Files (18 total in `.github/orchestration/scripts/tests/`)

| Test File | Tests | Coverage Focus |
|-----------|-------|----------------|
| `constants.test.js` | 343 lines | All 12 enums: export, freeze, exact keys/values |
| `resolver.test.js` | 794 lines | All 35 `NEXT_ACTIONS` paths + edge cases |
| `state-validator.test.js` | 709 lines | All 15 invariants (V1–V15) positive + negative |
| `triage-engine.test.js` | 747 lines | All 11 task rows + 5 phase rows + error cases |
| `next-action.test.js` | 290 lines | CLI arg parsing + E2E with real state files |
| `triage.test.js` | 80 lines | CLI arg parsing only |
| `validate-state.test.js` | 243 lines | CLI E2E with temp files |
| `agents.test.js` | — | Agent file structure validation |
| `config.test.js` | — | `orchestration.yml` validation |
| `cross-refs.test.js` | — | Cross-reference integrity |
| `frontmatter.test.js` | — | Frontmatter parser tests |
| `fs-helpers.test.js` | — | Filesystem utility tests |
| `instructions.test.js` | — | Instruction file validation |
| `prompts.test.js` | — | Prompt file validation |
| `reporter.test.js` | — | Reporter utility tests |
| `skills.test.js` | — | Skill file structure validation |
| `structure.test.js` | — | Directory structure validation |
| `yaml-parser.test.js` | — | YAML parser tests |

### Test Patterns

- **Helper functions**: `makeBaseState()` / `makeValidState()` — construct complete valid `state.json` objects. Used in resolver, triage-engine, state-validator, and CLI tests.
- **Deep clone + mutate**: Tests construct a valid base state, clone it, mutate specific fields, and assert the expected outcome.
- **Mock injection**: `triage-engine.test.js` uses `mockReadDocument(docMap)` — a map of path → `{ frontmatter, body }` — to inject document reads without filesystem I/O.
- **CLI E2E tests**: `next-action.test.js` and `validate-state.test.js` use `execFileSync` with temp files in `__tmp_*` directories.
- **`require.main === module` guard**: All CLI entry points include this guard; tests verify its presence.

### Tests That Must Continue to Pass Unchanged

| Test File | Reason |
|-----------|--------|
| `constants.test.js` | `constants.js` is unchanged |
| `resolver.test.js` | `resolver.js` is unchanged (pure function, reused by pipeline engine) |
| `state-validator.test.js` | `state-validator.js` is unchanged (pure function, reused by pipeline engine) |
| `triage-engine.test.js` | `triage-engine.js` is unchanged (pure function, reused by pipeline engine) |

### Tests That Will Need Updating

| Test File | Reason |
|-----------|--------|
| `next-action.test.js` | `next-action.js` CLI is replaced by `pipeline.js` |
| `triage.test.js` | `triage.js` CLI is replaced by `pipeline.js` |
| `validate-state.test.js` | `validate-state.js` CLI is replaced by `pipeline.js` |
| `cross-refs.test.js` | Cross-references change (skill rename, file deletions) |
| `agents.test.js` | Agent definitions change |
| `skills.test.js` | Skill files change (triage deleted, review-code → review-task) |
| `instructions.test.js` | Instruction file deleted (`state-management.instructions.md`) |
| `structure.test.js` | Directory structure changes (`schemas/` removed, new pipeline script files) |

---

## 9. Full `.github/orchestration/` Directory Tree

```
.github/orchestration/
├── schemas/
│   └── state-json-schema.md          # TO BE DELETED
└── scripts/
    ├── next-action.js                 # TO BE REPLACED by pipeline.js
    ├── triage.js                      # TO BE REPLACED by pipeline.js
    ├── validate-state.js              # TO BE REPLACED by pipeline.js
    ├── lib/
    │   ├── constants.js               # PRESERVED (leaf module)
    │   ├── resolver.js                # PRESERVED (composed by pipeline engine)
    │   ├── state-validator.js         # PRESERVED (composed by pipeline engine)
    │   └── triage-engine.js           # PRESERVED (composed by pipeline engine)
    └── tests/
        └── (18 test files)            # SEE section 8 for update analysis
```

---

## Existing Patterns

- **CommonJS modules** with `'use strict'` throughout all scripts
- **Shebang line**: `#!/usr/bin/env node` on all CLI entry points
- **`require.main === module` guard**: All CLI entry points export `parseArgs` for testing and run `main()` only when invoked directly
- **GNU long-option style**: `--state`, `--level`, `--current`, `--proposed`
- **Exit codes**: 0 = success, 1 = failure
- **stdout = JSON data, stderr = diagnostics**: Consistent across all scripts
- **Zero npm dependencies**: All Node.js built-ins only
- **Pure lib functions, impure CLI wrappers**: Domain logic never touches filesystem; CLI entry points handle all I/O
- **Frozen enums**: All enum objects use `Object.freeze()`
- **JSDoc type annotations**: Comprehensive `@typedef` in `constants.js`, `@param`/`@returns` in all lib modules
- **Dependency injection**: `triage-engine.js` takes a `readDocument` callback instead of importing fs directly
- **`makeBaseState()` test helper**: Centralized valid state factory in each test file

---

## Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | 18+ | Required for `node:test` built-in |
| Test framework | `node:test` | Built-in | No external test runner |
| Assertions | `node:assert` / `node:assert/strict` | Built-in | Some tests use strict, some don't |
| Process execution | `child_process.execFileSync` | Built-in | CLI E2E tests |
| File I/O | `fs`, `path` | Built-in | CLI entry points only |
| YAML parsing | Custom `yaml-parser.js` | Internal | In `validate-orchestration` skill utils |
| Frontmatter parsing | Custom `frontmatter.js` | Internal | In `validate-orchestration` skill utils |
| Agent platform | GitHub Copilot | VS Code | Custom agents, skills, instruction files, prompt files |
| Dashboard | Next.js | — | `ui/` directory, reads `state.json` directly |

---

## Constraints Discovered

- **Zero npm dependencies**: All new code must use Node.js built-ins only. No adding packages.
- **Node.js 18+ required**: For `node:test` module availability.
- **Pure lib modules are the reuse contract**: `resolver.js`, `triage-engine.js`, `state-validator.js`, and `constants.js` — these 4 files must remain functionally unchanged. Their existing test suites (3,593 lines total) must pass unmodified.
- **`triage.js` is the only current script that writes `state.json`**: The other two are read-only. The pipeline script will need to internalize this write behavior.
- **`triage-engine.js` uses dependency injection**: The pipeline engine must provide a `readDocument` callback when calling `executeTriage()`.
- **`validate-orchestration` utilities are shared dependencies**: `fs-helpers.js`, `yaml-parser.js`, `frontmatter.js` are imported from the validate-orchestration skill. The pipeline script will likely need the same imports.
- **`orchestration.yml` contains configuration that `state.json` copies at init**: The `limits` section and `human_gates.execution_mode` are read at project initialization and stored in `state.json`. The pipeline script should read `orchestration.yml` during init events.
- **The Orchestrator agent currently reads `STATUS.md`**: This reference must be removed when `STATUS.md` is eliminated, and the Orchestrator should rely on `state.json` only.
- **All 9 agent definitions mention `STATUS.md`**: 7 non-Orchestrator/non-Planner agents say "Write to `state.json` or `STATUS.md` — only the Tactical Planner does that." The Orchestrator says "Read `STATUS.md`". All need updating.
- **The `project-docs.instructions.md` lists sole writers**: The ownership table includes `state.json → Tactical Planner` and `STATUS.md → Tactical Planner`. Post-refactor, `state.json` ownership changes to "pipeline script" (or the ownership concept changes since no agent writes it), and `STATUS.md` is removed.
- **`copilot-instructions.md` references the Tactical Planner as sole state writer**: The workspace-level instructions loaded for every agent session mention this. Must be updated.
- **Dashboard (`ui/`) reads `state.json` directly**: No `STATUS.md` dependency found in the UI code. The dashboard change is out of scope.

---

## Recommendations

- **Preserve all 4 lib modules as-is**: `constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js` are already pure functions with clean interfaces. The pipeline engine composes them rather than modifying them.
- **New file: `pipeline.js`** (CLI entry point, ~20 lines) — trivial wrapper around `pipeline-engine.js`.
- **New file: `pipeline-engine.js`** — linear recipe: load state → apply mutation → validate → write → triage if needed → resolve → return.
- **New file: `mutations.js`** — lookup table with one small named function per event type (e.g., `task_completed`, `code_review_completed`, `phase_plan_created`).
- **New file: `state-io.js`** — isolates all filesystem operations (read `state.json`, write `state.json`, read `orchestration.yml`, read documents). Makes pipeline engine testable with stubs.
- **Keep `validate-orchestration` utility imports**: Reuse `fs-helpers`, `yaml-parser`, `frontmatter` as the pipeline script's I/O layer.
- **`triage_attempts` in `state.json`**: Add as a new top-level or execution-level field. Reset to 0 on advance events. The pipeline script checks and increments it during triage events.
- **Test strategy**: Unit-test each mutation function in `mutations.js`. Integration-test `pipeline-engine.js` with mocked `state-io.js`. The existing 4 lib test suites continue to run unchanged. Replace CLI-level tests (`next-action.test.js`, `triage.test.js`, `validate-state.test.js`) with `pipeline.test.js`.
- **Agent definition updates need careful cross-referencing**: 9 agent files, 2 instruction files, 1 copilot-instructions file, and 9 doc files all reference `STATUS.md`, Tactical Planner as state writer, or the 3-script architecture.
- **The `review-code` → `review-task` rename** touches: skill directory, skill `SKILL.md`, `reviewer.agent.md`, `docs/skills.md`, `docs/agents.md`, and potentially `cross-refs.test.js`.
