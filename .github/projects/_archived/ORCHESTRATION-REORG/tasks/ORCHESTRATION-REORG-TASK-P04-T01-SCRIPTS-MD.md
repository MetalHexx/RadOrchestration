---
project: "ORCHESTRATION-REORG"
phase: 4
task: 1
title: "Update docs/scripts.md Path References"
status: "pending"
skills_required: ["file editing"]
skills_optional: []
estimated_files: 1
---

# Update docs/scripts.md Path References

## Objective

Replace all stale `src/` and `tests/` path references in `docs/scripts.md` with their `.github/orchestration/scripts/` equivalents so the documentation reflects the post-reorg directory structure.

## Context

The orchestration system's CLI scripts were migrated from `src/` and `tests/` to `.github/orchestration/scripts/` and `.github/orchestration/scripts/tests/` in Phases 1–3. The documentation file `docs/scripts.md` still contains the old path references. This task updates every path reference in that file — architecture diagram, CLI invocations, test execution examples, inline prose references, and lib module references.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/scripts.md` | Replace all ~21 stale `src/` and `tests/` path references |

## Current File Content

Below is the **exact current content** of `docs/scripts.md`. Every `src/` and `tests/` path prefix must be replaced with `.github/orchestration/scripts/` or `.github/orchestration/scripts/tests/` respectively.

````markdown
# Node.js Scripts

The orchestration system uses three JavaScript CLI scripts to make pipeline routing, triage, and state validation fully deterministic. These scripts replace prose-based decision-making with pure functions — same input always produces the same output. Agents call the scripts via the terminal and parse structured JSON output.

## Why Scripts?

Without these scripts, LLM-based agents must re-derive routing and triage decisions from natural language on every invocation. This produces inconsistent results for identical inputs — the same `state.json` could lead to different next actions depending on how the agent interprets its instructions.

The scripts encode these decisions as tested, deterministic code:
- **Routing** — which agent to spawn next, given the current pipeline state
- **Triage** — what to do after a review verdict (advance, retry, or halt)
- **Validation** — whether a proposed state transition is legal

LLMs still handle all judgment-requiring work: coding, reviewing, designing, architecting. The scripts handle the mechanical decisions.

## Architecture

```
src/
├── lib/
│   ├── constants.js           # Shared enums — leaf module, zero dependencies
│   ├── resolver.js            # Next-Action Resolver — pure function
│   └── state-validator.js     # State Transition Validator — pure function
├── next-action.js             # Resolver CLI entry point
├── validate-state.js          # Validator CLI entry point
└── triage.js                  # Triage Executor CLI entry point
```

**Four-layer architecture:**
1. **CLI entry points** — handle I/O (read files, write stdout, exit codes)
2. **Domain logic** — pure functions with no filesystem access
3. **Shared constants** — frozen enums imported by everything
4. **Infrastructure utilities** — reused from the validate-orchestration skill

Domain modules never import filesystem utilities directly. The triage engine uses dependency injection for document reading, keeping it pure and testable.

## Shared Constants

`src/lib/constants.js` is the single source of truth for all enum values. Every other module imports from it. All enums are `Object.freeze()`-d to prevent runtime mutation.

### Enum Reference

| Enum | Values | Purpose |
|------|--------|---------|
| `PIPELINE_TIERS` | `planning`, `execution`, `review`, `complete`, `halted` | Pipeline tier progression |
| `PLANNING_STATUSES` | `not_started`, `in_progress`, `complete` | Overall planning tier status |
| `PLANNING_STEP_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `skipped` | Individual planning step status |
| `PHASE_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` | Phase lifecycle status |
| `TASK_STATUSES` | `not_started`, `in_progress`, `complete`, `failed`, `halted` | Task lifecycle status |
| `REVIEW_VERDICTS` | `approved`, `changes_requested`, `rejected` | Review outcome |
| `REVIEW_ACTIONS` | `advanced`, `corrective_task_issued`, `halted` | Task-level triage action (singular) |
| `PHASE_REVIEW_ACTIONS` | `advanced`, `corrective_tasks_issued`, `halted` | Phase-level triage action (plural) |
| `SEVERITY_LEVELS` | `minor`, `critical` | Error severity classification |
| `HUMAN_GATE_MODES` | `ask`, `phase`, `task`, `autonomous` | Execution gate behavior |
| `TRIAGE_LEVELS` | `task`, `phase` | Triage scope |
| `NEXT_ACTIONS` | 35 values — see below | Complete routing vocabulary |

> **Note:** `REVIEW_ACTIONS` uses singular `corrective_task_issued` while `PHASE_REVIEW_ACTIONS` uses plural `corrective_tasks_issued`. This distinction is intentional.

---

## Next-Action Resolver

The resolver is a **pure function** that takes `state.json` as input and returns one of 35 possible next actions from a closed enum. It encodes the complete routing decision tree across all pipeline tiers.

### CLI Usage

```bash
node src/next-action.js --state path/to/state.json
# Optional: --config path/to/orchestration.yml (for human_gate_mode)
```

### Output

```json
{
  "action": "execute_task",
  "context": {
    "tier": "execution",
    "phase_index": 0,
    "task_index": 2,
    "phase_id": "P01",
    "task_id": "P01-T03",
    "reason": "Task P01-T03 has handoff but status is not_started"
  }
}
```

### How the Orchestrator Uses It

1. Call `node src/next-action.js --state <path>`
2. Parse the JSON output
3. Pattern-match on `result.action` to determine which agent to spawn
4. Track `triage_attempts` counter: increment on `triage_task`/`triage_phase`, reset on `advance_task`/`advance_phase`, halt if > 1

### Action Vocabulary

The resolver returns one of these 35 actions:

**Planning tier:**

| Action | Meaning |
|--------|---------|
| `init_project` | Project needs initialization |
| `spawn_research` | Spawn Research agent |
| `spawn_prd` | Spawn Product Manager |
| `spawn_design` | Spawn UX Designer |
| `spawn_architecture` | Spawn Architect for architecture |
| `spawn_master_plan` | Spawn Architect for master plan |
| `request_plan_approval` | Planning complete — request human approval |
| `transition_to_execution` | Planning approved — transition to execution tier |

**Execution tier — task lifecycle:**

| Action | Meaning |
|--------|---------|
| `create_phase_plan` | Phase needs a plan |
| `create_task_handoff` | Task needs a handoff document |
| `execute_task` | Task has handoff, ready to execute |
| `update_state_from_task` | Task has report, update state |
| `create_corrective_handoff` | Create corrective task from review feedback |
| `halt_task_failed` | Task failed — halt for intervention |
| `spawn_code_reviewer` | Task needs code review |
| `update_state_from_review` | Review complete, update state |
| `triage_task` | Task needs triage decision |
| `halt_triage_invariant` | Triage loop detected — halt |
| `retry_from_review` | Review requested changes — retry |
| `halt_from_review` | Review rejected — halt |
| `advance_task` | Task approved — advance to next |
| `gate_task` | Task gate — request human approval |

**Execution tier — phase lifecycle:**

| Action | Meaning |
|--------|---------|
| `generate_phase_report` | All tasks complete — generate phase report |
| `spawn_phase_reviewer` | Phase needs review |
| `update_state_from_phase_review` | Phase review complete, update state |
| `triage_phase` | Phase needs triage decision |
| `halt_phase_triage_invariant` | Phase triage loop detected — halt |
| `gate_phase` | Phase gate — request human approval |
| `advance_phase` | Phase approved — advance to next |
| `transition_to_review` | All phases complete — transition to review tier |

**Review tier:**

| Action | Meaning |
|--------|---------|
| `spawn_final_reviewer` | Spawn final comprehensive review |
| `request_final_approval` | Final review complete — request human approval |
| `transition_to_complete` | Final review approved — mark complete |

**Terminal:**

| Action | Meaning |
|--------|---------|
| `display_halted` | Project is halted — display status |
| `display_complete` | Project is complete — display status |

---

## Triage Executor

The triage engine evaluates review verdicts against deterministic decision tables to decide the next action: advance, issue corrective tasks, or halt. It uses **dependency injection** for document reading, keeping the core logic pure.

### CLI Usage

```bash
# Task-level triage
node src/triage.js --state path/to/state.json --level task --project-dir path/to/project/

# Phase-level triage
node src/triage.js --state path/to/state.json --level phase --project-dir path/to/project/
```

### Output

```json
{
  "level": "task",
  "verdict": "changes_requested",
  "action": "corrective_task_issued",
  "severity": "minor",
  "phase_index": 0,
  "task_index": 2,
  "reason": "Review requested changes (minor severity), retry budget available"
}
```

### How the Tactical Planner Uses It

The Tactical Planner calls the triage script instead of interpreting decision tables in prose:

- **Mode 3 (phase triage):** `node src/triage.js --state <path> --level phase --project-dir <dir>`
- **Mode 4 (task triage):** `node src/triage.js --state <path> --level task --project-dir <dir>`

### Task-Level Decision Table (11 rows)

The triage engine evaluates these conditions in order (first match wins):

| # | Conditions | Action |
|---|-----------|--------|
| 1 | `review_verdict = approved` | `advanced` |
| 2 | `review_verdict = rejected`, severity = `critical` | `halted` |
| 3 | `review_verdict = rejected`, severity = `minor` | `halted` |
| 4 | `review_verdict = changes_requested`, severity = `critical` | `halted` |
| 5 | `review_verdict = changes_requested`, severity = `minor`, retries < max | `corrective_task_issued` |
| 6 | `review_verdict = changes_requested`, severity = `minor`, retries >= max | `halted` |
| 7 | `review_verdict = changes_requested`, severity = null, retries < max | `corrective_task_issued` |
| 8 | `review_verdict = changes_requested`, severity = null, retries >= max | `halted` |
| 9 | No review doc exists | Error: `DOCUMENT_NOT_FOUND` |
| 10 | Invalid verdict value | Error: `INVALID_VERDICT` |
| 11 | Target fields already non-null | Error: `IMMUTABILITY_VIOLATION` |

### Phase-Level Decision Table (5 rows)

| # | Conditions | Action |
|---|-----------|--------|
| 1 | `phase_review_verdict = approved` | `advanced` |
| 2 | `phase_review_verdict = changes_requested` | `corrective_tasks_issued` |
| 3 | `phase_review_verdict = rejected` | `halted` |
| 4 | No phase review doc exists | Error: `DOCUMENT_NOT_FOUND` |
| 5 | Target fields already non-null | Error: `IMMUTABILITY_VIOLATION` |

### Write Behavior

The triage CLI entry point (`src/triage.js`) — not the domain function — performs the `state.json` write:

1. Read current `state.json`
2. Verify target verdict/action fields are `null` (immutability check)
3. Call `executeTriage()` to get the resolved verdict and action
4. Write the updated `state.json` atomically (`JSON.stringify` → `fs.writeFileSync`)

---

## State Transition Validator

The validator checks a proposed `state.json` against all 15 documented invariants, ensuring every state transition is legal before it's committed.

### CLI Usage

```bash
node src/validate-state.js --current path/to/current-state.json --proposed path/to/proposed-state.json
```

### Output (valid)

```json
{
  "valid": true,
  "invariants_checked": 15
}
```

Exit code: `0`

### Output (invalid)

```json
{
  "valid": false,
  "invariants_checked": 15,
  "errors": [
    {
      "invariant": "V3",
      "message": "Only one task may be in_progress at a time. Found 2 tasks in_progress.",
      "severity": "critical"
    }
  ]
}
```

Exit code: `1`

### How the Tactical Planner Uses It

Before every `state.json` write, the Tactical Planner:

1. Writes the proposed state to a temporary file
2. Calls `node src/validate-state.js --current <current> --proposed <proposed>`
3. On `valid: true` — commits the write
4. On `valid: false` — records errors in `errors.active_blockers`, halts, does NOT commit

### Invariant Catalog (V1–V15)

| ID | Invariant | Description |
|----|-----------|-------------|
| V1 | Task status transitions | Tasks can only transition through allowed paths (`not_started` → `in_progress` → `complete`/`failed`) |
| V2 | Phase status transitions | Phases follow allowed status progressions |
| V3 | Single active task | Only one task may be `in_progress` across the entire project |
| V4 | Planning gate | `planning.human_approved` must be `true` before `current_tier = execution` |
| V5 | Phase count limit | `phases.length <= limits.max_phases` |
| V6 | Task count limit | `phase.tasks.length <= limits.max_tasks_per_phase` |
| V7 | Retry count limit | `task.retries <= limits.max_retries_per_task` |
| V8 | Retry monotonicity | Retry counts never decrease |
| V9 | Timestamp monotonicity | `project.updated` never decreases |
| V10 | Tier progression | Pipeline tiers follow allowed progression order |
| V11 | Phase completion | Phase status is `complete` only when all tasks are `complete` |
| V12 | Execution status consistency | Execution status reflects the state of its phases |
| V13 | Planning step ordering | Planning steps complete in required sequential order |
| V14 | Write ordering | Review verdict/action fields follow required sequencing |
| V15 | Cross-task immutability | Completed task fields cannot be modified |

---

## CLI Conventions

All scripts follow consistent conventions:

- **CommonJS modules** with `'use strict'`
- **Shebang line:** `#!/usr/bin/env node`
- **`if (require.main === module)` guard** — allows both CLI and programmatic use
- **`parseArgs()` exported** — CLI argument parsing is testable
- **GNU long-option style:** `--state`, `--level`, `--current`, `--proposed`
- **Exit codes:** `0` = success, `1` = failure
- **stdout** = structured JSON output, **stderr** = diagnostics and crash messages
- **Zero external dependencies** — Node.js built-ins only

## Testing

All scripts have comprehensive test suites using `node:test`:

```bash
# Run all tests
node tests/constants.test.js
node tests/resolver.test.js
node tests/state-validator.test.js
node tests/triage-engine.test.js

# Or validate-state CLI end-to-end
node tests/validate-state.test.js
```

Test coverage targets:
- Every `NEXT_ACTIONS` enum value has at least one test case (~35 paths)
- Every decision table row has at least one test (16 rows)
- Every invariant has positive and negative test cases (V1–V15)
- Error cases: `DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`
````

## Expected Result After Applying Changes

Below is the **exact target content** of `docs/scripts.md` after all replacements. Every occurrence of `src/` as a path prefix becomes `.github/orchestration/scripts/` and every `tests/` as a path prefix becomes `.github/orchestration/scripts/tests/`.

### Change Map (21 replacements)

| # | Section | Old Path | New Path |
|---|---------|----------|----------|
| 1 | Architecture diagram, line 1 | `src/` | `.github/orchestration/scripts/` |
| 2 | Architecture diagram, lib dir | `├── lib/` | (unchanged — relative inside tree) |
| 3 | Shared Constants, prose | `` `src/lib/constants.js` `` | `` `.github/orchestration/scripts/lib/constants.js` `` |
| 4 | Next-Action CLI Usage | `node src/next-action.js --state path/to/state.json` | `node .github/orchestration/scripts/next-action.js --state path/to/state.json` |
| 5 | Next-Action CLI Usage | `node src/next-action.js` (comment line) | `node .github/orchestration/scripts/next-action.js` |
| 6 | Orchestrator Usage, step 1 | `` `node src/next-action.js --state <path>` `` | `` `node .github/orchestration/scripts/next-action.js --state <path>` `` |
| 7 | Triage CLI Usage, task | `node src/triage.js --state path/to/state.json --level task --project-dir path/to/project/` | `node .github/orchestration/scripts/triage.js --state path/to/state.json --level task --project-dir path/to/project/` |
| 8 | Triage CLI Usage, phase | `node src/triage.js --state path/to/state.json --level phase --project-dir path/to/project/` | `node .github/orchestration/scripts/triage.js --state path/to/state.json --level phase --project-dir path/to/project/` |
| 9 | Tactical Planner Usage, Mode 3 | `node src/triage.js --state <path> --level phase --project-dir <dir>` | `node .github/orchestration/scripts/triage.js --state <path> --level phase --project-dir <dir>` |
| 10 | Tactical Planner Usage, Mode 4 | `node src/triage.js --state <path> --level task --project-dir <dir>` | `node .github/orchestration/scripts/triage.js --state <path> --level task --project-dir <dir>` |
| 11 | Write Behavior, prose | `` `src/triage.js` `` | `` `.github/orchestration/scripts/triage.js` `` |
| 12 | Validator CLI Usage | `node src/validate-state.js --current path/to/current-state.json --proposed path/to/proposed-state.json` | `node .github/orchestration/scripts/validate-state.js --current path/to/current-state.json --proposed path/to/proposed-state.json` |
| 13 | Validator Planner Usage, step 2 | `node src/validate-state.js --current <current> --proposed <proposed>` | `node .github/orchestration/scripts/validate-state.js --current <current> --proposed <proposed>` |
| 14 | Testing, example 1 | `node tests/constants.test.js` | `node .github/orchestration/scripts/tests/constants.test.js` |
| 15 | Testing, example 2 | `node tests/resolver.test.js` | `node .github/orchestration/scripts/tests/resolver.test.js` |
| 16 | Testing, example 3 | `node tests/state-validator.test.js` | `node .github/orchestration/scripts/tests/state-validator.test.js` |
| 17 | Testing, example 4 | `node tests/triage-engine.test.js` | `node .github/orchestration/scripts/tests/triage-engine.test.js` |
| 18 | Testing, comment | `# Or validate-state CLI end-to-end` | (unchanged — no path) |
| 19 | Testing, example 5 | `node tests/validate-state.test.js` | `node .github/orchestration/scripts/tests/validate-state.test.js` |

> **Note**: Items inside the architecture tree diagram that are relative to the root (e.g., `├── lib/`, `├── next-action.js`) do NOT need individual changes — only the root folder line `src/` changes to `.github/orchestration/scripts/`. The diagram remains a valid tree once the root is updated.

## Implementation Steps

1. **Open** `docs/scripts.md` for editing.
2. **Replace the architecture diagram root**: Change the first line of the code block from `src/` to `.github/orchestration/scripts/`.
3. **Replace the Shared Constants prose reference**: Change `` `src/lib/constants.js` `` to `` `.github/orchestration/scripts/lib/constants.js` ``.
4. **Replace all Next-Action Resolver CLI paths**: Change every `node src/next-action.js` to `node .github/orchestration/scripts/next-action.js` (3 occurrences: CLI Usage code block, CLI Usage comment line, Orchestrator step 1).
5. **Replace all Triage Executor CLI paths**: Change every `node src/triage.js` to `node .github/orchestration/scripts/triage.js` (4 occurrences: task CLI, phase CLI, Mode 3, Mode 4).
6. **Replace the Triage Write Behavior prose reference**: Change `` `src/triage.js` `` to `` `.github/orchestration/scripts/triage.js` ``.
7. **Replace all State Validator CLI paths**: Change every `node src/validate-state.js` to `node .github/orchestration/scripts/validate-state.js` (2 occurrences: CLI Usage, Planner step 2).
8. **Replace all test execution paths**: Change every `node tests/` to `node .github/orchestration/scripts/tests/` (5 occurrences: constants, resolver, state-validator, triage-engine, validate-state).
9. **Final scan**: Search the file for any remaining `src/` or `tests/` path prefixes. There should be zero.
10. **Verify Markdown renders correctly**: Ensure the architecture diagram code block, CLI code blocks, and inline code all render properly.

## Contracts & Interfaces

Not applicable — this task modifies documentation only, no code interfaces.

## Styles & Design Tokens

Not applicable — no UI components involved.

## Test Requirements

- [ ] `grep -c "node src/" docs/scripts.md` returns `0`
- [ ] `grep -c "node tests/" docs/scripts.md` returns `0`
- [ ] `grep -c "'src/" docs/scripts.md` returns `0` (backtick-quoted src/ paths)
- [ ] The architecture diagram code block starts with `.github/orchestration/scripts/` not `src/`
- [ ] File renders correctly in Markdown preview (no broken code blocks or formatting)

## Acceptance Criteria

- [ ] Zero occurrences of `src/` as a path prefix in `docs/scripts.md`
- [ ] Zero occurrences of `tests/` as a path prefix in `docs/scripts.md`
- [ ] All ~21 path references updated to `.github/orchestration/scripts/` equivalents per the Change Map above
- [ ] Architecture diagram root line reads `.github/orchestration/scripts/`
- [ ] All CLI invocations use `node .github/orchestration/scripts/<script>.js` format
- [ ] All test execution examples use `node .github/orchestration/scripts/tests/<test>.test.js` format
- [ ] File renders correctly in Markdown preview
- [ ] No other content in the file is modified (tables, prose descriptions, enum values, etc. remain unchanged)

## Constraints

- Do NOT modify any content other than path references (do not rewrite prose, tables, or section headings)
- Do NOT change paths inside JSON output examples (e.g., `"path/to/state.json"` is a placeholder, not a real path)
- Do NOT add or remove sections — only update paths within existing content
- Do NOT change the `# Optional:` comment line content, only update the path within it
- Do NOT modify the `--test` flag paths if they appear as CLI argument placeholders (e.g., `path/to/...`)
