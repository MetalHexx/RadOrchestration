---
project: "STATE-TRANSITION-SCRIPTS"
phase: 2
title: "Next-Action Resolver"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-08T23:45:00Z"
---

# Phase 2: Next-Action Resolver

## Phase Goal

Implement the core routing logic that replaces the Orchestrator's prose decision tree with a deterministic pure function encoding ~30 distinct next-action resolutions. Deliver the resolver domain module, CLI entry point, comprehensive test suite, and address Phase 1 carry-forward items.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../STATE-TRANSITION-SCRIPTS-MASTER-PLAN.md) | Phase 2 scope, exit criteria, execution constraints |
| [Architecture](../STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md) | Module map, contracts (NextActionResult, OrchestratorConfig, StateJson), resolver interfaces, CLI entry point signatures, utility import paths, dependency graph, cross-cutting concerns |
| [Design](../STATE-TRANSITION-SCRIPTS-DESIGN.md) | Script 1 CLI interface (flags, exit codes), JSON output schemas (NextAction success/error), NextAction value reference (full ~35-value enum), Flow 1 agent workflow, determinism contract |
| [PRD](../STATE-TRANSITION-SCRIPTS-PRD.md) | FR-1 (resolver script), FR-9 (test suite), NFR-1 through NFR-10 |
| [Research](../STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md) | §1 Routing Decision Tree (complete NextAction vocabulary, routing priority within execution tier), §5 CLI conventions |
| [Phase 1 Report](../reports/STATE-TRANSITION-SCRIPTS-PHASE-REPORT-P01.md) | All tasks complete, 84 tests passing, 3 carry-forward items |
| [Phase 1 Review](../reports/STATE-TRANSITION-SCRIPTS-PHASE-REVIEW-P01.md) | Verdict: approved. 3 minor cross-task issues as carry-forward: (1) unused imports in state-validator.js, (2) V10 ordering vulnerability, (3) current-state null guards |
| Phase 1 outputs | `src/lib/constants.js` (12 frozen enums), `src/lib/state-validator.js` (15 invariants) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Phase 1 Carry-Forward Cleanup | — | coding | 2 | *(created at execution time)* |
| T2 | Next-Action Resolver Core | T1 | coding | 1 | *(created at execution time)* |
| T3 | Resolver Test Suite | T2 | coding | 1 | *(created at execution time)* |
| T4 | Next-Action CLI Entry Point | T2 | coding | 1 | *(created at execution time)* |

### T1 — Phase 1 Carry-Forward Cleanup

**Files**: `src/lib/state-validator.js` (MODIFY), `tests/state-validator.test.js` (MODIFY)

**Scope**: Address the 3 carry-forward items identified in the Phase 1 Review:

1. **Remove unused imports** — Remove the 4 unused imports from `state-validator.js`: `PHASE_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`. These were prescribed in the Task Handoff but are not used by any V1–V15 check function. Re-add only if a future invariant needs them.

2. **V10 ordering fix** — Move V10 (structural validation of `proposed.execution`) to run **before** V1–V9. Currently, if `proposed.execution === null`, V1 throws `TypeError` instead of producing a structured `ValidationResult` error. After the fix, V10 runs first and short-circuits on structural failure, producing a clean `{ valid: false, errors: [{invariant: 'V10', ...}] }`.

3. **Current-state null guards** — Add defensive null checks at the entry of V11–V15 check functions for the `current` parameter. If `current.execution` or `current.execution.phases` is missing/null, return a structured error instead of throwing `TypeError`.

**Test updates**: Update `tests/state-validator.test.js` to:
- Verify V10 runs before V1 (test that `proposed.execution = null` produces V10 error, not TypeError)
- Add test cases for V11–V15 with malformed `current` parameter
- Confirm existing 43 tests still pass after restructuring

**Acceptance criteria**:
- No unused imports remain in `state-validator.js`
- `proposed.execution = null` returns `{ valid: false, errors: [{invariant: 'V10', ...}] }` (not TypeError)
- V11–V15 with `current.execution = null` return structured errors (not TypeError)
- `node tests/state-validator.test.js` passes — all existing tests plus new null-guard tests
- `node tests/constants.test.js` still passes (no regressions)

### T2 — Next-Action Resolver Core

**File**: `src/lib/resolver.js` (CREATE)

**Scope**: Implement the `resolveNextAction(state, config?)` pure function encoding the full ~30-branch routing decision tree. This is the core domain module that the Orchestrator will consume to determine its next action.

**Resolution tiers** (evaluation order):
1. **No state / halted**: `init_project`, `display_halted`
2. **Planning tier**: `spawn_research` → `spawn_prd` → `spawn_design` → `spawn_architecture` → `spawn_master_plan` → `request_plan_approval` → `transition_to_execution`
3. **Execution tier — task lifecycle**: `create_phase_plan` → `create_task_handoff` → `execute_task` → `update_state_from_task` → `create_corrective_handoff` / `halt_task_failed` → `spawn_code_reviewer` → `update_state_from_review` → `triage_task` / `halt_triage_invariant` → `retry_from_review` / `halt_from_review` → `advance_task` / `gate_task`
4. **Execution tier — phase lifecycle**: `generate_phase_report` → `spawn_phase_reviewer` → `update_state_from_phase_review` → `triage_phase` / `halt_phase_triage_invariant` → `gate_phase` → `advance_phase` → `transition_to_review`
5. **Review tier**: `spawn_final_reviewer` → `request_final_approval` → `transition_to_complete`
6. **Terminal**: `display_complete`

**Contract**: Returns `NextActionResult` per Architecture § Resolver Interfaces:
```javascript
{
  action: string,       // NEXT_ACTIONS enum value
  context: {
    tier: string,       // PIPELINE_TIERS enum value
    phase_index: number|null,
    task_index: number|null,
    phase_id: string|null,    // e.g. "P01"
    task_id: string|null,     // e.g. "P01-T03"
    details: string           // explanation of resolution path
  }
}
```

**Imports**: Only `src/lib/constants.js` — zero filesystem access, zero infrastructure imports.

**Acceptance criteria**:
- Exports `resolveNextAction(state, config?)` via `module.exports`
- Returns `NextActionResult` for every reachable state
- Pure function: no `Date.now()`, no `Math.random()`, no `fs`, no `process`
- Covers all ~35 `NEXT_ACTIONS` enum values
- `'use strict'` at top, JSDoc on all functions
- `config` parameter is optional; defaults inferred from `state.pipeline.human_gate_mode`

### T3 — Resolver Test Suite

**File**: `tests/resolver.test.js` (CREATE)

**Scope**: Comprehensive test suite verifying every `NEXT_ACTIONS` enum value has at least one test exercising the state conditions that produce it. Uses `node:test` framework (`describe`/`it` from `require('node:test')`, `require('node:assert')`).

**Test organization by tier**:
- **Setup / terminal** (~3 tests): `init_project` (no state), `display_halted`, `display_complete`
- **Planning tier** (~9 tests): `spawn_research`, `spawn_prd`, `spawn_design`, `spawn_architecture`, `spawn_master_plan`, `request_plan_approval`, `transition_to_execution`
- **Execution: task lifecycle** (~13 tests): `create_phase_plan`, `create_task_handoff`, `execute_task`, `update_state_from_task`, `create_corrective_handoff`, `halt_task_failed`, `spawn_code_reviewer`, `update_state_from_review`, `triage_task`, `halt_triage_invariant`, `retry_from_review`, `halt_from_review`, `advance_task`, `gate_task`
- **Execution: phase lifecycle** (~8 tests): `generate_phase_report`, `spawn_phase_reviewer`, `update_state_from_phase_review`, `triage_phase`, `halt_phase_triage_invariant`, `gate_phase`, `advance_phase`, `transition_to_review`
- **Review tier** (~3 tests): `spawn_final_reviewer`, `request_final_approval`, `transition_to_complete`

**Test pattern**: Each test constructs a minimal state object that triggers one specific action, calls `resolveNextAction(state)`, and asserts `result.action === NEXT_ACTIONS.<VALUE>`.

**Acceptance criteria**:
- Every `NEXT_ACTIONS` enum value has at least one test
- `node tests/resolver.test.js` exits with code `0`
- Tests import `resolveNextAction` directly (no subprocess spawning)
- Uses `makeBaseState()` helper pattern from Phase 1 convention
- No filesystem access in tests

### T4 — Next-Action CLI Entry Point

**File**: `src/next-action.js` (CREATE)

**Scope**: CLI wrapper that reads `state.json` (and optionally `orchestration.yml`), calls `resolveNextAction()`, and emits JSON to stdout.

**CLI flags**:
- `--state <path>` (required) — Path to `state.json`. If file doesn't exist, return `{ action: "init_project", context: { ... } }`.
- `--config <path>` (optional) — Path to `orchestration.yml`. Used to resolve `human_gate_mode` if needed.

**Behavior**:
1. Parse args with `parseArgs(process.argv.slice(2))`
2. Check if `--state` file exists; if not, emit `init_project` action JSON, exit 0
3. Read and parse `state.json` with `JSON.parse(readFile(statePath))`
4. Optionally read `orchestration.yml` with `parseYaml(readFile(configPath))`
5. Call `resolveNextAction(state, config)` from `src/lib/resolver.js`
6. Emit `JSON.stringify(result, null, 2)` to stdout
7. Exit 0

**Error handling**: On unexpected error, write `[ERROR] next-action: <message>` to stderr, exit 1.

**Imports**:
- `src/lib/resolver.js` — `resolveNextAction`
- `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` — `readFile`, `exists`
- `../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser.js` — `parseYaml`

**Acceptance criteria**:
- Shebang `#!/usr/bin/env node`, `'use strict'`, CommonJS
- `parseArgs()` exported via `module.exports`
- `if (require.main === module)` guard
- `node src/next-action.js --state <path>` emits valid JSON with `action` and `context` fields
- Exit code 0 on success, 1 on error
- Non-existent state file returns `init_project` action (not an error)

## Execution Order

```
T1 (carry-forward cleanup)
 └→ T2 (resolver core — depends on T1 for stable constants + validator)
     ├→ T3 (test suite — depends on T2 for resolver function)
     └→ T4 (CLI entry point — depends on T2 for resolver function)  ← parallel-ready
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T3 and T4 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] `src/lib/resolver.js` exports `resolveNextAction(state, config?)` returning `NextActionResult`
- [ ] Every value in the `NEXT_ACTIONS` enum has at least one test case exercising the state conditions that produce it
- [ ] `node tests/resolver.test.js` passes — all ~30 resolution paths covered
- [ ] `src/next-action.js` runs end-to-end: `node src/next-action.js --state <path>` emits valid JSON with `action` and `context` fields
- [ ] Resolver is a pure function: no filesystem access, no `Date.now()`, no ambient state — identical inputs always produce identical output
- [ ] All scripts follow CLI conventions: shebang, `'use strict'`, CommonJS, `parseArgs()` exported, `if (require.main === module)` guard
- [ ] All Phase 1 carry-forward items resolved: unused imports removed, V10 runs before V1–V9, current-state null guards added
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors in any created/modified file)
- [ ] All tests pass (`tests/resolver.test.js`, `tests/state-validator.test.js`, `tests/constants.test.js`)

## Known Risks for This Phase

- **~30 branches in one function**: The resolver encodes ~30 distinct resolution paths. Missing a branch or misordering evaluation produces wrong routing. Mitigation: comprehensive test coverage (one test per NEXT_ACTIONS value), incremental implementation by tier, and structured evaluation order matching Research §1.
- **Execution tier evaluation priority is order-sensitive**: Within the execution tier, checking phase-complete before task-status matters. Research §1 documents the priority: (1) all phases complete? → transition_to_review; (2) phase not started? → create_phase_plan; (3) find first incomplete task → route by status. Tests must validate this ordering.
- **Config parameter optionality**: The resolver accepts an optional `config` for `human_gate_mode`. If omitted, it reads from `state.pipeline.human_gate_mode`. Tests must cover both paths (config provided vs. config omitted).
