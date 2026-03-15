---
project: "STATE-TRANSITION-SCRIPTS"
phase: 3
title: "Triage Executor"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-09T23:00:00Z"
---

# Phase 3: Triage Executor

## Phase Goal

Implement the triage engine that replaces the Tactical Planner's inline execution of the 11-row task-level and 5-row phase-level decision tables with a deterministic, dependency-injected script. Deliver the triage engine domain module, CLI entry point with atomic `state.json` writes, comprehensive test suite covering all 16 decision table rows plus error cases, and resolve Phase 2 carry-forward items.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../STATE-TRANSITION-SCRIPTS-MASTER-PLAN.md) | Phase 3 scope and exit criteria |
| [Architecture](../STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md) | Triage engine interfaces (`executeTriage`, `checkRetryBudget`, `TriageResult`), dependency injection design, CLI entry point signatures, dependency graph (`triage-engine.js` → `constants.js` only; `triage.js` → `triage-engine.js` + `constants.js` + `fs-helpers` + `frontmatter`), atomic write pattern, immutability enforcement, cross-cutting concerns |
| [Design](../STATE-TRANSITION-SCRIPTS-DESIGN.md) | Script 2 CLI interface (flags: `--state`, `--level`, `--project-dir`; exit codes), JSON output schemas (TriageSuccess, TriageError), decision table encoding design (11 task-level + 5 phase-level rows, first-match-wins), state write contract, document resolution table, error codes (`DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`, `INVALID_STATE`, `INVALID_LEVEL`) |
| [PRD](../STATE-TRANSITION-SCRIPTS-PRD.md) | FR-2 (triage executor script), FR-9 (test suite), NFR-1 through NFR-10 |
| [Research](../STATE-TRANSITION-SCRIPTS-RESEARCH-FINDINGS.md) | §2 Decision Tables (all 16 rows with conditions), §2 Triage Read Sequences, §2 Triage State Write Contract, §5 CLI conventions |
| [Phase 2 Report](../reports/STATE-TRANSITION-SCRIPTS-PHASE-REPORT-P02.md) | All tasks complete, 134 tests passing, 2 carry-forward items |
| [Phase 2 Review](../reports/STATE-TRANSITION-SCRIPTS-PHASE-REVIEW-P02.md) | Verdict: approved. 2 minor cross-task issues as carry-forward: (1) semantic enum alignment in resolver, (2) negative tests for Orchestrator-managed actions. Recommendation: careful attention to atomic write pattern and immutability checking in triage CLI. |
| Phase 1–2 outputs | `src/lib/constants.js` (12 frozen enums incl. `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `TRIAGE_LEVELS`), `src/lib/resolver.js` (31 resolution paths), `src/lib/state-validator.js` (15 invariants), `src/validate-state.js`, `src/next-action.js` |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Phase 2 Carry-Forward Cleanup | — | coding | 2–3 | *(created at execution time)* |
| T2 | Triage Engine Core | T1 | coding | 1 | *(created at execution time)* |
| T3 | Triage Engine Test Suite | T2 | coding | 1 | *(created at execution time)* |
| T4 | Triage CLI Entry Point | T2 | coding | 2 | *(created at execution time)* |

### T1 — Phase 2 Carry-Forward Cleanup

**Files**: `src/lib/resolver.js` (MODIFY), `tests/resolver.test.js` (MODIFY), optionally `tests/triage-engine.test.js` (CREATE placeholder)

**Scope**: Address the 2 carry-forward items identified in the Phase 2 Review:

1. **Semantic enum alignment** — In `src/lib/resolver.js`, `resolveReview()` at line ~384 compares `finalReview.status` against `PLANNING_STEP_STATUSES.COMPLETE`. Change to use `TASK_STATUSES.COMPLETE` (or a semantically aligned constant) since `final_review.status` follows the task/phase status pattern, not the planning step pattern. Both resolve to `'complete'`, so this is a readability-only change with no behavioral impact.

2. **Negative tests for Orchestrator-managed actions** — Add 4 negative tests to `tests/resolver.test.js` confirming `resolveNextAction()` never returns `UPDATE_STATE_FROM_REVIEW`, `HALT_TRIAGE_INVARIANT`, `UPDATE_STATE_FROM_PHASE_REVIEW`, or `HALT_PHASE_TRIAGE_INVARIANT` for any valid state input. These 4 actions are Orchestrator-managed and should never be emitted by the resolver.

**Acceptance criteria**:
- `resolveReview()` uses `TASK_STATUSES.COMPLETE` (or equivalent) instead of `PLANNING_STEP_STATUSES.COMPLETE`
- 4 new negative tests exist confirming resolver never emits the 4 Orchestrator-managed actions
- `node tests/resolver.test.js` passes — all existing 44 tests plus 4 new negative tests
- `node tests/state-validator.test.js` passes — no regressions (48 tests)
- `node tests/constants.test.js` passes — no regressions (29 tests)

### T2 — Triage Engine Core

**File**: `src/lib/triage-engine.js` (CREATE)

**Scope**: Implement the `executeTriage(state, level, readDocument)` pure function encoding both the 11-row task-level and 5-row phase-level decision tables. Also implement the named helper `checkRetryBudget(task, limits)` for Row 10 branching logic.

**Task-Level Decision Table (11 Rows)** — first-match-wins:

| Row | Conditions | → verdict | → action |
|-----|-----------|-----------|----------|
| 1 | `report_status == "complete"` AND `!has_deviations` AND `review_doc == null` | *(skip)* | *(skip)* |
| 2 | `report_status == "complete"` AND `!has_deviations` AND `review_doc != null` AND `verdict == "approved"` | `"approved"` | `"advanced"` |
| 3 | `report_status == "complete"` AND `has_deviations` AND `deviation_type == "minor"` AND `verdict == "approved"` | `"approved"` | `"advanced"` |
| 4 | `report_status == "complete"` AND `has_deviations` AND `deviation_type == "architectural"` AND `verdict == "approved"` | `"approved"` | `"advanced"` |
| 5 | `report_status == "complete"` AND `review_doc != null` AND `verdict == "changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` |
| 6 | `report_status == "complete"` AND `review_doc != null` AND `verdict == "rejected"` | `"rejected"` | `"halted"` |
| 7 | `report_status == "partial"` AND `review_doc == null` | *(skip)* | *(skip)* |
| 8 | `report_status == "partial"` AND `review_doc != null` AND `verdict == "changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` |
| 9 | `report_status == "partial"` AND `review_doc != null` AND `verdict == "rejected"` | `"rejected"` | `"halted"` |
| 10 | `report_status == "failed"` AND `severity == "minor"` AND `retries < max_retries` | *(from review if exists)* | `"corrective_task_issued"` |
| 11 | `report_status == "failed"` AND (`severity == "critical"` OR `retries >= max_retries`) | *(from review if exists)* | `"halted"` |

**Phase-Level Decision Table (5 Rows)** — first-match-wins:

| Row | Conditions | → verdict | → action |
|-----|-----------|-----------|----------|
| 1 | `phase_review == null` | *(skip)* | *(skip)* |
| 2 | `phase_review_verdict == "approved"` AND all exit criteria met | `"approved"` | `"advanced"` |
| 3 | `phase_review_verdict == "approved"` AND some exit criteria unmet | `"approved"` | `"advanced"` |
| 4 | `phase_review_verdict == "changes_requested"` | `"changes_requested"` | `"corrective_tasks_issued"` |
| 5 | `phase_review_verdict == "rejected"` | `"rejected"` | `"halted"` |

**Key design constraints**:
- Dependency-injected `readDocument(path)` callback — NO direct filesystem access
- `checkRetryBudget(task, limits)` is a named exported function for targeted testability
- Returns `TriageResult` (union of `TriageSuccess` and `TriageError`) per Architecture contracts
- Imports ONLY from `./constants` — zero infrastructure imports
- Immutability check: verify target verdict/action fields are `null` before allowing write (return `IMMUTABILITY_VIOLATION` error if non-null)
- `REVIEW_ACTIONS` (singular `corrective_task_issued`) for task-level; `PHASE_REVIEW_ACTIONS` (plural `corrective_tasks_issued`) for phase-level
- `readDocument` reads: task report (always for task-level), code review (if `review_doc != null`), phase report (always for phase-level, skip if null), phase review (if `phase_review != null`)

**Contract**: Returns `TriageResult` per Architecture § Triage Engine Interfaces:
```javascript
// Success:
{ success: true, level, verdict, action, phase_index, task_index, row_matched, details }
// Error:
{ success: false, level, error, error_code, phase_index, task_index }
```

**Acceptance criteria**:
- Exports `executeTriage(state, level, readDocument)` and `checkRetryBudget(task, limits)` via `module.exports`
- Handles all 11 task-level rows + 5 phase-level rows
- Row 10 uses `checkRetryBudget()` for branching (retry budget × severity)
- Validates input: returns `INVALID_LEVEL` for bad `--level`, `INVALID_STATE` for malformed state
- Returns `DOCUMENT_NOT_FOUND` when required docs are missing
- Returns `INVALID_VERDICT` when frontmatter contains unrecognized verdict value
- Returns `IMMUTABILITY_VIOLATION` when target fields are non-null
- `'use strict'` at top, JSDoc on all exported functions
- Pure function: no `fs`, no `process`, no `Date.now()`, no `Math.random()`

### T3 — Triage Engine Test Suite

**File**: `tests/triage-engine.test.js` (CREATE)

**Scope**: Comprehensive test suite verifying all 16 decision table rows (11 task-level + 5 phase-level) plus error cases. Uses `node:test` framework (`describe`/`it` from `require('node:test')`, `require('node:assert')`). Uses mock `readDocument` callback — no filesystem access in tests.

**Test organization**:
- **Task-level rows** (11+ tests):
  - Row 1: complete, no deviations, no review → skip verdict/action
  - Row 2: complete, no deviations, review approved → `approved`/`advanced`
  - Row 3: complete, minor deviations, review approved → `approved`/`advanced`
  - Row 4: complete, architectural deviations, review approved → `approved`/`advanced`
  - Row 5: complete, review changes_requested → `changes_requested`/`corrective_task_issued`
  - Row 6: complete, review rejected → `rejected`/`halted`
  - Row 7: partial, no review → skip verdict/action
  - Row 8: partial, review changes_requested → `changes_requested`/`corrective_task_issued`
  - Row 9: partial, review rejected → `rejected`/`halted`
  - Row 10: failed, minor severity, retries available → `corrective_task_issued`
  - Row 11: failed, critical severity → `halted`

- **Row 10 branching** (5+ tests):
  - Retry at max → `halted`
  - Retry below max, minor severity → `corrective_task_issued`
  - Retry below max, critical severity → `halted`
  - Severity null → appropriate fallback
  - `checkRetryBudget()` direct tests

- **Phase-level rows** (5+ tests):
  - Row 1: no phase review → skip
  - Row 2: approved, all exit criteria met → `approved`/`advanced`
  - Row 3: approved, some exit criteria unmet → `approved`/`advanced`
  - Row 4: changes_requested → `changes_requested`/`corrective_tasks_issued`
  - Row 5: rejected → `rejected`/`halted`

- **Error cases** (3+ tests):
  - `DOCUMENT_NOT_FOUND`: required doc path missing from disk
  - `INVALID_VERDICT`: unrecognized verdict in frontmatter
  - `IMMUTABILITY_VIOLATION`: target verdict/action already non-null

**Test pattern**: Each test constructs a minimal state object + mock `readDocument` that returns appropriate frontmatter, calls `executeTriage(state, level, mockReadDoc)`, and asserts the result fields.

**Acceptance criteria**:
- All 11 task-level rows have at least one test case each
- All 5 phase-level rows have at least one test case each
- Row 10 branching logic has 5+ dedicated tests (retry at/below max, severity minor/critical/null)
- `checkRetryBudget()` has dedicated unit tests
- 3 error cases tested: `DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`
- `node tests/triage-engine.test.js` exits with code `0`
- Tests import `executeTriage` and `checkRetryBudget` directly (no subprocess spawning)
- Uses `makeBaseState()` helper pattern consistent with Phase 1/2 conventions
- No filesystem access in tests — all document reads via mock callback

### T4 — Triage CLI Entry Point

**Files**: `src/triage.js` (CREATE), `tests/triage.test.js` (CREATE)

**Scope**: CLI wrapper that reads `state.json`, wires real `readDocument` using `fs-helpers` + `frontmatter`, calls `executeTriage()`, writes resolved verdict/action to `state.json` using atomic write pattern, and emits result JSON to stdout. Plus CLI test suite.

**CLI flags**:
- `--state <path>` (required) — Path to `state.json`. Script reads AND writes this file.
- `--level <task|phase>` (required) — Which decision table to evaluate.
- `--project-dir <path>` (required) — Base directory for resolving relative document paths.

**Behavior**:
1. Parse args with `parseArgs(process.argv.slice(2))`
2. Read and parse `state.json` with `JSON.parse(readFile(statePath))`
3. Wire `readDocument` callback using `fs-helpers.readFile` + `frontmatter.extractFrontmatter`
4. Call `executeTriage(state, level, readDocument)` from `src/lib/triage-engine.js`
5. If `result.success === true`:
   - Apply verdict/action to the in-memory state object (on the current task or phase)
   - Atomic write: `JSON.stringify(state, null, 2)` → `fs.writeFileSync(statePath)`
   - Emit `JSON.stringify(result, null, 2)` to stdout
   - Exit 0
6. If `result.success === false`:
   - Do NOT modify `state.json`
   - Emit `JSON.stringify(result, null, 2)` to stdout
   - Exit 1

**Write ordering**: verdict + action written atomically in single JSON rewrite — no partial writes.

**Immutability**: Enforced by the triage engine (returns `IMMUTABILITY_VIOLATION`), not duplicated in CLI.

**Imports**:
- `src/lib/triage-engine.js` — `executeTriage`
- `src/lib/constants.js` — `TRIAGE_LEVELS` for validation
- `../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers.js` — `readFile`
- `../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter.js` — `extractFrontmatter`

**Error handling**: On unexpected error, write `[ERROR] triage: <message>` to stderr, exit 1.

**Test suite** (`tests/triage.test.js`):
- `parseArgs()` tests: valid flags, missing `--state`, missing `--level`, missing `--project-dir`, invalid `--level` value
- `require.main === module` guard exists
- End-to-end tests (mock filesystem or temp files): successful triage writes to state.json, failed triage leaves state.json unmodified

**Acceptance criteria**:
- Shebang `#!/usr/bin/env node`, `'use strict'`, CommonJS
- `parseArgs()` exported via `module.exports`
- `if (require.main === module)` guard
- `node src/triage.js --state <path> --level task --project-dir <dir>` reads state, reads docs, writes verdict/action to state.json, emits valid JSON
- Exit code 0 on success, 1 on error
- Atomic write: entire state.json rewritten (not incrementally patched)
- Immutability enforced: script refuses to overwrite non-null verdict/action fields
- `node tests/triage.test.js` passes
- All existing test suites pass (134 tests — no regressions)

## Execution Order

```
T1 (carry-forward cleanup)
 └→ T2 (triage engine core — depends on T1 for stable constants + resolver)
     ├→ T3 (test suite — depends on T2 for triage engine function)
     └→ T4 (CLI entry point — depends on T2 for triage engine function)  ← parallel-ready
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T3 and T4 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] `src/lib/triage-engine.js` exports `executeTriage(state, level, readDocument)` and `checkRetryBudget(task, limits)`
- [ ] All 11 task-level rows have at least one test case each
- [ ] All 5 phase-level rows have at least one test case each
- [ ] Row 10 branching logic (`checkRetryBudget`) has dedicated tests for: retry at max, retry below max, severity minor, severity critical, severity null
- [ ] Error cases tested: `DOCUMENT_NOT_FOUND`, `INVALID_VERDICT`, `IMMUTABILITY_VIOLATION`
- [ ] `node tests/triage-engine.test.js` passes — all 16+ rows and error cases covered
- [ ] `src/triage.js` runs end-to-end: reads `state.json`, reads documents, writes verdict/action to `state.json`, emits valid JSON to stdout
- [ ] Write ordering enforced: verdict/action written atomically in single JSON rewrite
- [ ] Immutability enforced: script refuses to overwrite non-null verdict/action fields
- [ ] All scripts follow CLI conventions: shebang, `'use strict'`, CommonJS, `parseArgs()` exported, `if (require.main === module)` guard
- [ ] All Phase 2 carry-forward items resolved: semantic enum alignment fixed, negative tests for Orchestrator-managed actions added
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors in any created/modified file)
- [ ] All tests pass (`tests/triage-engine.test.js`, `tests/triage.test.js`, `tests/resolver.test.js`, `tests/state-validator.test.js`, `tests/constants.test.js`)

## Known Risks for This Phase

- **Row 10 branching complexity**: Cross-field lookup across `task.retries`, `limits.max_retries_per_task`, and `task.severity`. Mitigation: named `checkRetryBudget()` function with dedicated tests for all combinations.
- **Singular vs. plural action enum**: Task-level uses `corrective_task_issued` (singular); phase-level uses `corrective_tasks_issued` (plural). Mitigation: `REVIEW_ACTIONS` and `PHASE_REVIEW_ACTIONS` are separate frozen enums in constants — tests assert exact strings.
- **First script with write I/O**: `src/triage.js` is the first script that writes to `state.json`. Atomic write pattern (full rewrite, not incremental) must be carefully implemented. Mitigation: follows the same pattern as `validate-state.js` but adds write capability; immutability check in the engine prevents accidental overwrites.
- **Document path resolution**: Triage CLI resolves relative doc paths from `state.json` against `--project-dir`. Incorrect path joining could break document reads. Mitigation: use `path.resolve(projectDir, docPath)` consistently; test with both absolute and relative paths.
- **Frontmatter verdict extraction**: The triage engine relies on `readDocument` returning frontmatter with a `verdict` field. Malformed or missing frontmatter must produce `INVALID_VERDICT` or `DOCUMENT_NOT_FOUND`, not a crash. Mitigation: defensive null checks in the engine; dedicated error case tests.
