---
project: "STATE-TRANSITION-SCRIPTS"
phase: 1
title: "Foundation"
status: "active"
total_tasks: 5
author: "tactical-planner-agent"
created: "2026-03-08T14:00:00Z"
---

# Phase 1: Foundation

## Phase Goal

Establish the shared constants module and the State Transition Validator — the two foundational pieces that have no dependencies on other scripts and are needed by everything else. Deliver all 12 frozen enum objects, a pure-function validator checking 15 invariants, a CLI entry point, and comprehensive tests.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../STATE-TRANSITION-SCRIPTS-MASTER-PLAN.md) | Phase 1 scope, exit criteria, execution constraints |
| [Architecture](../STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md) | Module map, contracts (StateJson, ValidationResult, InvariantError), constants interface, file structure, CLI entry point signatures, utility import paths, cross-cutting concerns |
| [Design](../STATE-TRANSITION-SCRIPTS-DESIGN.md) | Script 3 CLI interface (flags, exit codes, JSON output schemas), invariant check details (V1–V15 with comparison types), shared constants enum table |
| [PRD](../STATE-TRANSITION-SCRIPTS-PRD.md) | FR-3 (validator), FR-4 (constants), FR-9 (test suite), NFR-1 through NFR-10 |
| [Research](../STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md) | §3 State.json Invariants (V1–V15 definitions, allowed state transitions, allowed field enums), existing code patterns |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Shared Constants Module | — | coding | 1 | *(created at execution time)* |
| T2 | Constants Test Suite | T1 | coding | 1 | *(created at execution time)* |
| T3 | State Transition Validator | T1 | coding | 1 | *(created at execution time)* |
| T4 | State Validator Test Suite | T1, T3 | coding | 1 | *(created at execution time)* |
| T5 | Validator CLI Entry Point | T1, T3 | coding | 1 | *(created at execution time)* |

### T1 — Shared Constants Module

**File**: `src/lib/constants.js`

**Scope**: Create the leaf constants module exporting all 12 frozen enum objects as specified in the Architecture § Constants Interface. Every enum must use `Object.freeze()`. Zero dependencies — this module imports nothing.

**Enums to implement** (12 total):
1. `PIPELINE_TIERS` — `planning`, `execution`, `review`, `complete`, `halted`
2. `PLANNING_STATUSES` — `not_started`, `in_progress`, `complete`
3. `PLANNING_STEP_STATUSES` — `not_started`, `in_progress`, `complete`, `failed`, `skipped`
4. `PHASE_STATUSES` — `not_started`, `in_progress`, `complete`, `failed`, `halted`
5. `TASK_STATUSES` — `not_started`, `in_progress`, `complete`, `failed`, `halted`
6. `REVIEW_VERDICTS` — `approved`, `changes_requested`, `rejected`
7. `REVIEW_ACTIONS` — `advanced`, `corrective_task_issued`, `halted`
8. `PHASE_REVIEW_ACTIONS` — `advanced`, `corrective_tasks_issued`, `halted` (plural — intentionally different from task-level)
9. `SEVERITY_LEVELS` — `minor`, `critical`
10. `HUMAN_GATE_MODES` — `ask`, `phase`, `task`, `autonomous`
11. `TRIAGE_LEVELS` — `task`, `phase`
12. `NEXT_ACTIONS` — ~35 values covering the full NextAction vocabulary

**Acceptance criteria**:
- All 12 enums exported via `module.exports`
- All enums are `Object.freeze()`-d
- Key naming uses `SCREAMING_SNAKE_CASE`, values use lowercase snake_case strings
- Zero imports — leaf module
- `'use strict'` at top
- JSDoc `@typedef` annotations per Architecture contract

### T2 — Constants Test Suite

**File**: `tests/constants.test.js`

**Scope**: Validate all 12 enum objects for completeness, freeze status, and no unintended cross-enum value collisions. Uses `node:test` framework (`describe`/`it` from `require('node:test')`, `require('node:assert')`).

**Test cases**:
- Each enum is exported and not `undefined`
- Each enum has the exact expected keys and values per the Architecture contract
- Each enum is frozen (`Object.isFrozen()` returns `true`)
- `REVIEW_ACTIONS` uses singular `corrective_task_issued`
- `PHASE_REVIEW_ACTIONS` uses plural `corrective_tasks_issued`
- `NEXT_ACTIONS` contains all ~35 values
- No accidental value overlap between `REVIEW_ACTIONS` and `PHASE_REVIEW_ACTIONS` (the `corrective_task(s)_issued` distinction)

**Acceptance criteria**:
- `node tests/constants.test.js` exits with code `0`
- All enums validated for keys, values, and freeze status

### T3 — State Transition Validator

**File**: `src/lib/state-validator.js`

**Scope**: Implement `validateTransition(current, proposed)` as a pure function checking all 15 invariants (V1–V15). Returns `ValidationResult` per the Architecture contract. Imports only from `src/lib/constants.js`.

**Invariants to implement**:

| # | Check | Inputs |
|---|-------|--------|
| V1 | `current_phase` is valid index into `phases[]` | Proposed only |
| V2 | Each phase's `current_task` is valid index into `tasks[]` | Proposed only |
| V3 | No task `retries` exceeds `limits.max_retries_per_task` | Proposed only |
| V4 | `phases.length` ≤ `limits.max_phases` | Proposed only |
| V5 | Each phase `tasks.length` ≤ `limits.max_tasks_per_phase` | Proposed only |
| V6 | At most one task across entire project has `status: "in_progress"` | Proposed only |
| V7 | `planning.human_approved == true` if `current_tier == "execution"` | Proposed only |
| V8 | No task has `review_doc != null AND review_verdict == null` | Proposed only |
| V9 | No phase has `phase_review != null AND phase_review_verdict == null` | Proposed only |
| V10 | Absent fields treated as `null`; defensive null checks | Proposed only |
| V11 | No task `retries` decreased vs. current state | Current → Proposed |
| V12 | Task status transitions follow allowed paths | Current → Proposed |
| V13 | `project.updated` is newer in proposed | Current → Proposed |
| V14 | Write ordering: `review_doc` change must not also change `review_verdict`/`review_action` in same write | Current → Proposed |
| V15 | Immutability: verdict/action for task N not overwritten by triage of task M | Current → Proposed |

**Acceptance criteria**:
- Exports `validateTransition(current, proposed)` returning `{ valid: true, invariants_checked: 15 }` or `{ valid: false, invariants_checked: 15, errors: [...] }`
- Each error has `{ invariant: "V{N}", message: "...", severity: "critical" }`
- Pure function: no filesystem access, no Date.now(), no ambient state
- `'use strict'`, CommonJS, JSDoc annotations

### T4 — State Validator Test Suite

**File**: `tests/state-validator.test.js`

**Scope**: Test all 15 invariants with at least one positive (valid transition) and one negative (violation) test case per invariant, totaling 30+ test cases. Uses `node:test` framework.

**Test structure**:
- `describe('V1 — current_phase index bounds')` → positive + negative
- `describe('V2 — current_task index bounds')` → positive + negative
- `describe('V3 — retry limit')` → positive + negative
- `describe('V4 — max phases')` → positive + negative
- `describe('V5 — max tasks per phase')` → positive + negative
- `describe('V6 — single in_progress task')` → positive + negative
- `describe('V7 — human approval before execution')` → positive + negative
- `describe('V8 — task triage consistency')` → positive + negative
- `describe('V9 — phase triage consistency')` → positive + negative
- `describe('V10 — null treatment')` → positive + negative
- `describe('V11 — retry monotonicity')` → positive + negative
- `describe('V12 — task status transitions')` → positive + negative (multiple transitions)
- `describe('V13 — timestamp monotonicity')` → positive + negative
- `describe('V14 — write ordering')` → positive + negative
- `describe('V15 — cross-task immutability')` → positive + negative

**Test helpers**: Create a `makeBaseState()` factory function that returns a minimal valid `state.json` object, mutated per-test.

**Acceptance criteria**:
- `node tests/state-validator.test.js` exits with code `0`
- 15+ positive and 15+ negative test cases (one per invariant minimum)
- Tests import `validateTransition` directly via `require()`

### T5 — Validator CLI Entry Point

**File**: `src/validate-state.js`

**Scope**: CLI wrapper for the state validator. Parses `--current` and `--proposed` flags, reads both JSON files, calls `validateTransition()`, emits JSON to stdout, exits with code `0` (valid) or `1` (invalid).

**Implementation requirements**:
- Shebang: `#!/usr/bin/env node`
- `'use strict'`, CommonJS
- Export `parseArgs(argv)` returning `{ current: string, proposed: string }`
- `async function main()` with `.catch()` safety net
- `if (require.main === module)` guard
- Import `readFile` from `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers`
- Import `validateTransition` from `./lib/state-validator`
- stdout: `JSON.stringify(result, null, 2)` — structured JSON only
- stderr: `[ERROR] validate-state: <message>` for unexpected errors
- Exit code `0` for valid, `1` for invalid or error

**Acceptance criteria**:
- `node src/validate-state.js --current <path> --proposed <path>` works end-to-end
- Valid transition emits `{ "valid": true, "invariants_checked": 15 }` with exit code `0`
- Invalid transition emits `{ "valid": false, "invariants_checked": 15, "errors": [...] }` with exit code `1`
- Missing/invalid flags emit error to stderr with exit code `1`
- `parseArgs` is exported for testability

## Execution Order

```
T1 (Shared Constants Module)
 ├→ T2 (Constants Test Suite)          ← parallel-ready with T3
 └→ T3 (State Transition Validator)    ← parallel-ready with T2
      ├→ T4 (State Validator Test Suite)    ← parallel-ready with T5
      └→ T5 (Validator CLI Entry Point)     ← parallel-ready with T4
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5

*Note: T2 and T3 are parallel-ready (no mutual dependency). T4 and T5 are parallel-ready. V1 executes sequentially.*

## Phase Exit Criteria

- [ ] `src/lib/constants.js` exports all 12 enum objects, all `Object.freeze()`-d
- [ ] `node tests/constants.test.js` passes — all enum values present, no cross-enum collisions where unintended
- [ ] `src/lib/state-validator.js` exports `validateTransition(current, proposed)` returning `ValidationResult`
- [ ] `node tests/state-validator.test.js` passes — 15+ positive and 15+ negative test cases (one per invariant minimum)
- [ ] `src/validate-state.js` runs end-to-end: `node src/validate-state.js --current <path> --proposed <path>` emits valid JSON and exits with code 0 (valid) or 1 (invalid)
- [ ] All scripts follow CLI conventions: shebang, `'use strict'`, CommonJS, `parseArgs()` exported, `if (require.main === module)` guard
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors in any created file)
- [ ] All tests pass

## Known Risks for This Phase

- **Utility import path resolution**: Scripts import `fs-helpers.js` via relative path from `src/` to `.github/skills/validate-orchestration/scripts/lib/utils/`. If the relative path is wrong, imports fail. Mitigation: T5 verifies the import end-to-end.
- **Invariants V14 and V15 complexity**: Write-ordering and cross-task immutability checks require comparing field changes between current and proposed state, which is more nuanced than single-state checks. Mitigation: T4 has dedicated positive and negative test cases for these.
- **`NEXT_ACTIONS` enum size**: ~35 values is large for a single enum definition. Mitigation: T2 validates all values are present and frozen.
